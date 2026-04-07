'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────

export interface TradingTerm {
  id: string
  name: string
  description: string | null
  is_default: boolean
  leverage: number
  margin_call_level: number
  stop_out_level: number
  created_at: string
  updated_at: string
  account_count?: number
}

export interface TermInstrument {
  id: string
  term_id: string
  symbol: string
  name: string
  category: string
  leverage: number | null
  margin_call: number | null
  stop_out: number | null
  min_lot: number
  max_lot: number
  lot_step: number
  commission_rate: number
  spread: number
  is_active: boolean
  is_tradable: boolean
  last_price: number | null
}

// ── Queries ───────────────────────────────────────────────────────

export async function getTradingTerms(): Promise<TradingTerm[]> {
  const supabase = createAdminClient()
  const { data: terms } = await supabase
    .from('trading_terms')
    .select('*')
    .order('created_at', { ascending: true })

  if (!terms) return []

  // Get account counts per term
  const { data: accountLinks } = await supabase
    .from('trading_accounts')
    .select('trading_terms_id')

  const countMap: Record<string, number> = {}
  for (const link of accountLinks ?? []) {
    if (link.trading_terms_id) {
      countMap[link.trading_terms_id] = (countMap[link.trading_terms_id] ?? 0) + 1
    }
  }

  return terms.map((t) => ({ ...t, account_count: countMap[t.id] ?? 0 }))
}

export async function getTradingTerm(id: string): Promise<TradingTerm | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('trading_terms')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

export async function getTermInstruments(termId: string): Promise<TermInstrument[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('trading_term_instrument_settings')
    .select(`
      leverage, margin_call, stop_out, min_lot, max_lot, lot_step, commission_rate, spread,
      is_active, is_tradable,
      instruments!inner ( id, symbol, name, category, last_price )
    `)
    .eq('term_id', termId)
    .limit(10000)

  if (error) console.error('[getTermInstruments] error:', error)

  return (data ?? [])
    .map((row: any) => ({
      id:              row.instruments.id,
      term_id:         termId,
      symbol:          row.instruments.symbol,
      name:            row.instruments.name,
      category:        row.instruments.category,
      leverage:        row.leverage,
      margin_call:     row.margin_call,
      stop_out:        row.stop_out,
      min_lot:         row.min_lot,
      max_lot:         row.max_lot,
      lot_step:        row.lot_step,
      commission_rate: row.commission_rate ?? 0.001,
      spread:          row.spread ?? 0,
      is_active:       row.is_active,
      is_tradable:     row.is_tradable,
      last_price:      row.instruments.last_price,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
}

export async function getAllInstruments() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('instruments')
    .select('id, symbol, name, category, is_active')
    .order('category', { ascending: true })
  return data ?? []
}

// ── Mutations ─────────────────────────────────────────────────────

export async function createTradingTerm(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const name        = formData.get('name') as string
  const description = formData.get('description') as string

  if (!name?.trim()) return

  const { data, error } = await supabase
    .from('trading_terms')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
    })
    .select()
    .single()

  if (error || !data) return

  // Seed all active instruments with default settings
  const instruments = await getAllInstruments()
  if (instruments.length > 0) {
    await supabase.from('trading_term_instrument_settings').insert(
      instruments.map((inst) => ({
        term_id: data.id,
        instrument_id: inst.id,
        min_lot: 0.01,
        max_lot: 100,
        lot_step: 0.01,
        commission_rate: 0.001,
        spread: 0,
        is_active: true,
        is_tradable: true,
      }))
    )
  }

  redirect(`/dashboard/trading-terms/${data.id}`)
}

export async function updateTradingTerm(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const id          = formData.get('id') as string
  const name        = formData.get('name') as string
  const description = formData.get('description') as string

  await supabase.from('trading_terms').update({
    name: name.trim(),
    description: description?.trim() || null,
  }).eq('id', id)

  revalidatePath('/dashboard/trading-terms')
  revalidatePath(`/dashboard/trading-terms/${id}`)
}

export async function deleteTradingTerm(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const id = formData.get('id') as string
  await supabase.from('trading_terms').delete().eq('id', id)
  revalidatePath('/dashboard/trading-terms')
}

export async function duplicateTradingTerm(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const id = formData.get('id') as string

  const { data: original } = await supabase
    .from('trading_terms')
    .select('*')
    .eq('id', id)
    .single()

  if (!original) return

  const { data: copy, error } = await supabase
    .from('trading_terms')
    .insert({ name: `${original.name} (Copy)`, description: original.description, is_default: false })
    .select()
    .single()

  if (error || !copy) return

  // Copy all instrument settings
  const { data: instruments } = await supabase
    .from('trading_term_instrument_settings')
    .select('*')
    .eq('term_id', id)

  if (instruments && instruments.length > 0) {
    await supabase.from('trading_term_instrument_settings').insert(
      instruments.map(({ id: _id, term_id: _tid, ...rest }) => ({
        ...rest,
        term_id: copy.id,
      }))
    )
  }

  revalidatePath('/dashboard/trading-terms')
}

export async function updateTermInstrument(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const id     = formData.get('id') as string
  const termId = formData.get('term_id') as string

  const updates: Record<string, unknown> = {
    is_active:    formData.get('is_active') === 'true',
    is_tradable:  formData.get('is_tradable') === 'true',
    updated_at:   new Date().toISOString(),
  }
  const minLot         = formData.get('min_lot')
  const maxLot         = formData.get('max_lot')
  const lotStep        = formData.get('lot_step')
  const commissionRate = formData.get('commission_rate')
  const spread         = formData.get('spread')
  if (minLot         !== null && minLot         !== '') updates.min_lot         = Number(minLot)
  if (maxLot         !== null && maxLot         !== '') updates.max_lot         = Number(maxLot)
  if (lotStep        !== null && lotStep        !== '') updates.lot_step        = Number(lotStep)
  if (commissionRate !== null && commissionRate !== '') updates.commission_rate = Number(commissionRate)
  if (spread         !== null && spread         !== '') updates.spread          = Number(spread)

  await supabase.from('trading_term_instrument_settings').update(updates).eq('term_id', termId).eq('instrument_id', id)
  revalidatePath(`/dashboard/trading-terms/${termId}`)
}

export async function bulkUpdateTermInstruments(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const termId   = formData.get('term_id') as string
  const category = formData.get('category') as string
  const field    = formData.get('field') as string
  const value    = parseFloat(formData.get('value') as string)

  if (isNaN(value)) return

  // Map display field names to instruments table column names
  const COL_MAP: Record<string, string> = {
    min_lot:         'min_lot',
    max_lot:         'max_lot',
    lot_step:        'lot_step',
    commission_rate: 'commission_rate',
    spread:          'spread',
    is_active:       'is_active',
  }
  const col = COL_MAP[field] ?? field
  const updateValue = field === 'is_active' ? value === 1 : value

  let query = supabase
    .from('trading_term_instrument_settings')
    .update({ [col]: updateValue, updated_at: new Date().toISOString() })
    .eq('term_id', termId)

  if (category && category !== 'all') {
    const { data: insts } = await supabase.from('instruments').select('id').eq('category', category)
    if (insts && insts.length > 0) {
      query = (query as any).in('instrument_id', insts.map(i => i.id))
    } else {
      return // no instruments to update
    }
  }

  await query
  revalidatePath(`/dashboard/trading-terms/${termId}`)
}

export async function addInstrumentToTerm(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const termId = formData.get('term_id') as string
  const symbol = formData.get('symbol') as string

  const { data: inst } = await supabase.from('instruments').select('id').eq('symbol', symbol).single()
  if (!inst) return

  await supabase
    .from('trading_term_instrument_settings')
    .insert({
      term_id: termId,
      instrument_id: inst.id,
      min_lot: 0.01,
      max_lot: 100,
      lot_step: 0.01,
      commission_rate: 0.001,
      spread: 0,
      is_active: true,
      is_tradable: true,
    })

  revalidatePath(`/dashboard/trading-terms/${termId}`)
}
