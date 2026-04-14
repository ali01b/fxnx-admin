'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const QUOTES_API      = 'https://strata-demo.com/api/quotes_all'
const MILLIYET_BIST   = 'https://uzmanpara.milliyet.com.tr/js/hisse_endeks_liste.js'

export async function syncInstruments(): Promise<{ synced: number; error?: string }> {
  const supabase = createAdminClient()

  let items: any[]
  try {
    const res = await fetch(QUOTES_API, { cache: 'no-store' })
    if (!res.ok) return { synced: 0, error: `API error: ${res.status}` }
    const json = await res.json()
    items = Array.isArray(json) ? json : (json.items ?? [])
  } catch (e: any) {
    return { synced: 0, error: e.message }
  }

  if (items.length === 0) return { synced: 0, error: 'API returned no items' }

  // Upsert in batches of 100
  const CATEGORY_MAP: Record<string, string> = {
    fx:     'forex',
    emtia:  'commodity',
  }

  const rows = items.map((item: any) => {
    const raw = item.category ?? 'bist'
    const category = CATEGORY_MAP[raw] ?? raw
    return {
      symbol:         item.symbol,
      name:           item.name ?? item.symbol,
      category,
      last_price:     item.last ?? null,
      last_synced_at: new Date().toISOString(),
    }
  })

  let synced = 0
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const { error } = await supabase
      .from('instruments')
      .upsert(batch, { onConflict: 'symbol', ignoreDuplicates: false })
    if (error) {
      console.error('[syncInstruments] batch error:', error.message)
    } else {
      synced += batch.length
    }
  }

  // Günlük fiyat snapshot'ını candles tablosuna kaydet
  const today = new Date().toISOString().slice(0, 10)
  const candleRows = rows
    .filter((r) => r.last_price != null)
    .map((r) => ({
      symbol: r.symbol,
      date:   today,
      open:   r.last_price,
      high:   r.last_price,
      low:    r.last_price,
      close:  r.last_price,
    }))
  for (let i = 0; i < candleRows.length; i += 500) {
    await supabase
      .from('instrument_candles')
      .upsert(candleRows.slice(i, i + 500), { onConflict: 'symbol, date', ignoreDuplicates: true })
  }

  revalidatePath('/dashboard/instruments')
  return { synced }
}

// ── Milliyet BIST sync ─────────────────────────────────────────────────────
// Kaynak: https://uzmanpara.milliyet.com.tr/js/hisse_endeks_liste.js
// Format: JS dosyası içinde `HisseFullData.HisseData = [{id,kod,ad,tip}, ...]`
// Sadece BIST hisselerini ekler/günceller — mevcut fiyat bilgisi yok, last_price=null

export async function syncBistInstruments(): Promise<{ synced: number; newCount: number; error?: string }> {
  const supabase = createAdminClient()

  // 1. JS dosyasını çek
  let rawText: string
  try {
    const res = await fetch(MILLIYET_BIST, { cache: 'no-store' })
    if (!res.ok) return { synced: 0, newCount: 0, error: `Milliyet API hatası: ${res.status}` }
    rawText = await res.text()
  } catch (e: any) {
    return { synced: 0, newCount: 0, error: e.message }
  }

  // 2. `HisseFullData.HisseData = [...]` kısmını regex ile çıkar
  const match = rawText.match(/HisseFullData\.HisseData\s*=\s*(\[[\s\S]*?\]);/)
  if (!match) return { synced: 0, newCount: 0, error: 'Milliyet API yanıtı parse edilemedi' }

  let items: Array<{ id: string; kod: string; ad: string; tip: string }>
  try {
    items = JSON.parse(match[1])
  } catch {
    return { synced: 0, newCount: 0, error: 'Milliyet JSON parse hatası' }
  }

  if (!items.length) return { synced: 0, newCount: 0, error: 'Milliyet API boş yanıt döndü' }

  // 3. Sadece tip=Hisse olanları al, instruments formatına dönüştür
  const now = new Date().toISOString()
  const rows = items
    .filter((item) => item.tip === 'Hisse' && item.kod)
    .map((item) => ({
      symbol:         item.kod.trim().toUpperCase(),
      name:           item.ad.trim(),
      category:       'bist',
      last_synced_at: now,
      // last_price null bırakıyoruz — mevcut fiyat varsa korumak için upsert ignoreDuplicates değil
    }))

  if (!rows.length) return { synced: 0, newCount: 0, error: 'Filtre sonrası kayıt kalmadı' }

  // 4. Upsert instruments — mevcut kayıtlarda sadece name ve last_synced_at güncellenir
  const incomingSymbols = rows.map((r) => r.symbol)

  // Zaten var olan BIST sembollerini bul (upsert sonrası yeni eklenenleri tespit için)
  const { data: existingRows } = await supabase
    .from('instruments')
    .select('symbol')
    .in('symbol', incomingSymbols)
  const existingSymbols = new Set((existingRows ?? []).map((r: any) => r.symbol))
  const newSymbols = incomingSymbols.filter((s) => !existingSymbols.has(s))

  let synced = 0
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const { error } = await supabase
      .from('instruments')
      .upsert(batch, { onConflict: 'symbol', ignoreDuplicates: false })
    if (error) {
      console.error('[syncBistInstruments] batch error:', error.message)
    } else {
      synced += batch.length
    }
  }

  // 5. Yeni eklenen hisseleri mevcut trading term'lere otomatik bağla
  //    Kriter: halihazırda en az 1 BIST enstrümanı olan tüm term'ler
  if (newSymbols.length > 0) {
    // Yeni eklenen instrument id'lerini çek
    const { data: newInstruments } = await supabase
      .from('instruments')
      .select('id, symbol, min_lot, max_lot, lot_step, is_active, is_tradable')
      .in('symbol', newSymbols)

    // BIST'e bağlı distinct term_id'leri bul
    const { data: bistTermLinks } = await supabase
      .from('trading_term_instrument_settings')
      .select('term_id, instruments!inner(category)')
      .eq('instruments.category', 'bist')

    const termIds = [...new Set((bistTermLinks ?? []).map((l: any) => l.term_id))]

    if (termIds.length > 0 && (newInstruments ?? []).length > 0) {
      const termInserts: any[] = []
      for (const termId of termIds) {
        for (const inst of newInstruments ?? []) {
          termInserts.push({
            term_id:         termId,
            instrument_id:   inst.id,
            leverage:        1,
            margin_call:     50,
            stop_out:        20,
            min_lot:         inst.min_lot  ?? 1,
            max_lot:         inst.max_lot  ?? 10000,
            lot_step:        inst.lot_step ?? 1,
            commission_rate: 0.001,
            spread:          0,
            is_active:       true,
            is_tradable:     true,
          })
        }
      }
      for (let i = 0; i < termInserts.length; i += 200) {
        await supabase
          .from('trading_term_instrument_settings')
          .upsert(termInserts.slice(i, i + 200), {
            onConflict:      'term_id, instrument_id',
            ignoreDuplicates: true,   // zaten varsa dokunma
          })
      }
    }
  }

  revalidatePath('/dashboard/instruments')
  return { synced, newCount: newSymbols.length }
}

const SORTABLE_COLS = new Set([
  'symbol', 'name', 'category', 'last_price', 'margin_type',
  'trading_terms_id', 'min_lot', 'max_lot', 'is_active',
])

export async function getInstruments(opts?: {
  category?: string
  search?: string
  page?: number
  pageSize?: number
  sort?: string
  sortDir?: 'asc' | 'desc'
}) {
  const supabase = createAdminClient()
  const { category, search, page = 1, pageSize = 100, sort, sortDir = 'asc' } = opts ?? {}

  const orderCol = sort && SORTABLE_COLS.has(sort) ? sort : 'symbol'
  const ascending = sortDir !== 'desc'

  let query = supabase
    .from('instruments')
    .select('id, symbol, name, category, is_active, is_tradable, min_lot, max_lot, lot_step, last_price, last_synced_at', { count: 'exact' })
    .order(orderCol, { ascending, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (category && category !== 'all') query = query.eq('category', category)
  if (search) query = query.ilike('symbol', `%${search}%`)

  const { data, count, error } = await query
  if (error) {
    console.error('[getInstruments]', error.message)
    return { instruments: [], total: 0 }
  }

  const instruments = data ?? []

  // Fetch term mappings for this page's instruments
  const ids = instruments.map((i: any) => i.id)
  const { data: termLinks } = ids.length > 0
    ? await supabase
        .from('trading_term_instrument_settings')
        .select('instrument_id, term_id')
        .in('instrument_id', ids)
    : { data: [] }

  const termMap: Record<string, string[]> = {}
  for (const link of termLinks ?? []) {
    if (!termMap[link.instrument_id]) termMap[link.instrument_id] = []
    termMap[link.instrument_id].push(link.term_id)
  }

  const result = instruments.map((inst: any) => ({
    ...inst,
    term_ids: termMap[inst.id] ?? [],
  }))

  return { instruments: result, total: count ?? 0 }
}

export async function updateInstrument(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const id          = formData.get('id') as string
  const isActive    = formData.get('is_active') === 'true'
  const isTradable  = formData.get('is_tradable') === 'true'
  const marginType  = formData.get('margin_type') as string
  const termsId     = formData.get('trading_terms_id') as string | null
  const leverage    = formData.get('specific_leverage')
  const marginCall  = formData.get('specific_margin_call')
  const stopOut     = formData.get('specific_stop_out')
  const minLot      = formData.get('min_lot')
  const maxLot      = formData.get('max_lot')
  const lotStep     = formData.get('lot_step')

  const updates: Record<string, unknown> = {
    is_active:   isActive,
    is_tradable: isTradable,
    updated_at: new Date().toISOString(),
  }
  if (minLot)  updates.min_lot  = Number(minLot)
  if (maxLot)  updates.max_lot  = Number(maxLot)
  if (lotStep) updates.lot_step = Number(lotStep)

  await supabase.from('instruments').update(updates).eq('id', id)

  if (termsId) {
    const { data: existing } = await supabase.from('trading_term_instrument_settings')
      .select('id').eq('term_id', termsId).eq('instrument_id', id).single()

    const jUpdates: any = {}
    if (leverage)   jUpdates.leverage    = Number(leverage)
    if (marginCall) jUpdates.margin_call = Number(marginCall)
    if (stopOut)    jUpdates.stop_out    = Number(stopOut)
    if (minLot)     jUpdates.min_lot     = Number(minLot)
    if (maxLot)     jUpdates.max_lot     = Number(maxLot)
    if (lotStep)    jUpdates.lot_step    = Number(lotStep)

    if (existing) {
      if (Object.keys(jUpdates).length > 0) {
        await supabase.from('trading_term_instrument_settings').update(jUpdates).eq('id', existing.id)
      }
    } else {
      await supabase.from('trading_term_instrument_settings').insert({
        term_id: termsId,
        instrument_id: id,
        leverage: leverage ? Number(leverage) : 10,
        margin_call: marginCall ? Number(marginCall) : 50,
        stop_out: stopOut ? Number(stopOut) : 20,
        min_lot: minLot ? Number(minLot) : 0.01,
        max_lot: maxLot ? Number(maxLot) : 100,
        lot_step: lotStep ? Number(lotStep) : 0.01,
        commission_rate: 0.001,
        spread: 0,
        is_active: isActive,
        is_tradable: isTradable,
      })
    }
  }

  revalidatePath('/dashboard/instruments')
  revalidatePath('/dashboard/trading-terms', 'layout')
}

export async function bulkSetTradingTerms(formData: FormData): Promise<{ count?: number; error?: string }> {
  const supabase   = createAdminClient()
  const category   = formData.get('category') as string
  const termsId    = formData.get('trading_terms_id') as string
  const marginType = formData.get('margin_type') as string

  console.log('[bulkSetTradingTerms]', { category, termsId, marginType })

  if (!termsId) return { error: 'Trading Terms seçilmedi' }

  let result
  if (category && category !== 'all') {
    result = await supabase.from('instruments').select('id, min_lot, max_lot, lot_step, is_active, is_tradable').eq('category', category)
  } else {
    result = await supabase.from('instruments').select('id, min_lot, max_lot, lot_step, is_active, is_tradable').neq('symbol', '')
  }

  if (result.data && result.data.length > 0) {
    const inserts = result.data.map((inst: any) => ({
      term_id: termsId,
      instrument_id: inst.id,
      leverage: 10,
      margin_call: 50,
      stop_out: 20,
      min_lot: inst.min_lot ?? 0.01,
      max_lot: inst.max_lot ?? 100,
      lot_step: inst.lot_step ?? 0.01,
      commission_rate: 0.001,
      spread: 0,
      is_active: inst.is_active ?? true,
      is_tradable: inst.is_tradable ?? true,
    }))
    await supabase.from('trading_term_instrument_settings')
      .upsert(inserts, { onConflict: 'term_id, instrument_id', ignoreDuplicates: true })
  }

  console.log('[bulkSetTradingTerms] result:', result.data?.length, 'error:', result.error?.message)

  if (result.error) return { error: result.error.message }

  revalidatePath('/dashboard/instruments')
  revalidatePath('/dashboard/trading-terms', 'layout')
  return { count: result.data?.length ?? 0 }
}

export async function getCategoryCounts() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('instruments')
    .select('category')

  if (error) return { all: 0 }

  const counts: Record<string, number> = { all: 0 }
  for (const row of data ?? []) {
    counts.all = (counts.all ?? 0) + 1
    counts[row.category] = (counts[row.category] ?? 0) + 1
  }
  return counts
}
