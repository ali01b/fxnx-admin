import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const QUOTES_URL = 'https://strata-demo.com/api/quotes_all'

export async function GET(request: Request) {
  // Vercel Cron güvenlik kontrolü
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // 1. Dış API'den güncel fiyatları çek
  const res = await fetch(QUOTES_URL, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
  if (!res.ok) {
    return NextResponse.json({ error: 'Fiyat verisi alınamadı' }, { status: 502 })
  }

  const json = await res.json()
  const items: Array<{ symbol: string; last: number }> = json.items ?? json

  if (!items.length) {
    return NextResponse.json({ error: 'Boş fiyat listesi' }, { status: 502 })
  }

  // 2. Sadece mevcut enstrümanların fiyatını güncelle (yeni satır ekleme)
  const priceMap = Object.fromEntries(items.map((i) => [i.symbol, i.last]))
  const now = new Date().toISOString()

  const { data: existingInstruments, error: fetchErr } = await supabase
    .from('instruments')
    .select('symbol')

  if (fetchErr) {
    console.error('[cron] instruments fetch hatası:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const matchedSymbols = (existingInstruments ?? [])
    .map((i) => i.symbol)
    .filter((s) => priceMap[s] !== undefined)

  if (!matchedSymbols.length) {
    return NextResponse.json({ error: 'API fiyatları ile eşleşen enstrüman yok' }, { status: 502 })
  }

  // Her sembolü ayrı ayrı güncelle (upsert yerine update — yeni satır eklenmez)
  const updateResults = await Promise.all(
    matchedSymbols.map((symbol) =>
      supabase
        .from('instruments')
        .update({ last_price: priceMap[symbol], last_synced_at: now })
        .eq('symbol', symbol)
    )
  )

  const priceErr = updateResults.find((r) => r.error)?.error
  if (priceErr) {
    console.error('[cron] instruments update hatası:', priceErr.message)
    return NextResponse.json({ error: priceErr.message }, { status: 500 })
  }

  // 3. Postgres fonksiyonu: tek SQL sorgusuyla tüm hesapları güncelle
  const { error: calcErr } = await supabase.rpc('recalculate_account_financials')

  if (calcErr) {
    console.error('[cron] recalculate_account_financials hatası:', calcErr.message)
    return NextResponse.json({ error: calcErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, priceCount: matchedSymbols.length, ts: new Date().toISOString() })
}
