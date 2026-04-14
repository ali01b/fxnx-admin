'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────

export interface IpoApplication {
  id:              string
  ipo_listing_id:  string | null
  ext_ticker:      string | null
  ext_name:        string | null
  profile_id:      string
  account_id:      string
  requested_lots:  number
  allocated_lots:  number | null
  status:          'bekliyor' | 'dagitildi' | 'iptal'
  created_at:      string
  distributed_at:  string | null
  // joined
  profile?: { first_name: string; last_name: string; email: string } | null
  ipo_listing?: { ticker: string; name: string; lot_fiyat: number | null; is_synthetic: boolean } | null
}

export interface IpoListing {
  id:                  string
  ticker:              string
  name:                string
  slug:                string
  logo_url:            string | null
  source_url:          string | null
  badge:               string | null
  status:              'aktif' | 'taslak' | 'gecmis'
  basvuru_baslangic:   string | null
  basvuru_bitis:       string | null
  borsa_giris:         string | null
  fiyat_alt:           number | null
  fiyat_ust:           number | null
  lot_fiyat:           number | null
  pazar:               string | null
  tavan_gun:           number | null
  min_lot:             number | null
  max_lot:             number | null
  halka_arz_orani:     number | null
  halka_arz_buyuklugu: string | null
  sirket_aciklamasi:   string | null
  tahsisat_dagilimi:   unknown[]
  finansal_tablo:      unknown[]
  created_at:          string
  updated_at:          string
}

// ── Helpers ────────────────────────────────────────────────────────

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function safeJson(raw: string | null, fallback: unknown[] = []): unknown[] {
  if (!raw || !raw.trim()) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

function num(v: FormDataEntryValue | null): number | null {
  if (!v || v === '') return null
  const n = parseFloat(v as string)
  return isNaN(n) ? null : n
}

function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim() || null
  return s
}

// ── Queries ────────────────────────────────────────────────────────

export async function getIpoListings(status?: IpoListing['status']): Promise<IpoListing[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('ipo_listings')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data } = await query
  return (data ?? []) as IpoListing[]
}

export async function getIpoListing(id: string): Promise<IpoListing | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ipo_listings')
    .select('*')
    .eq('id', id)
    .single()
  return (data ?? null) as IpoListing | null
}

// ── Mutations ──────────────────────────────────────────────────────

export async function createIpoListing(fd: FormData) {
  const supabase = createAdminClient()

  const name   = (fd.get('name') as string).trim()
  const ticker = (fd.get('ticker') as string).trim().toUpperCase()
  const slug   = str(fd.get('slug')) ?? toSlug(`${ticker}-${name}`)

  const { error } = await supabase.from('ipo_listings').insert({
    ticker,
    name,
    slug,
    logo_url:              str(fd.get('logo_url')),
    source_url:            str(fd.get('source_url')),
    badge:                 str(fd.get('badge')) ?? '',
    status:                str(fd.get('status')) ?? 'taslak',
    basvuru_baslangic:     str(fd.get('basvuru_baslangic')),
    basvuru_bitis:         str(fd.get('basvuru_bitis')),
    borsa_giris:           str(fd.get('borsa_giris')),
    fiyat_alt:             num(fd.get('fiyat_alt')),
    fiyat_ust:             num(fd.get('fiyat_ust')),
    lot_fiyat:             num(fd.get('lot_fiyat')),
    pazar:                 str(fd.get('pazar')),
    tavan_gun:             num(fd.get('tavan_gun')),
    is_synthetic:          fd.get('is_synthetic') === 'true',
    min_lot:               num(fd.get('min_lot')) ?? 1,
    max_lot:               num(fd.get('max_lot')),
    halka_arz_orani:       num(fd.get('halka_arz_orani')),
    halka_arz_buyuklugu:   str(fd.get('halka_arz_buyuklugu')),
    sirket_aciklamasi:     str(fd.get('sirket_aciklamasi')),
    tahsisat_dagilimi:     safeJson(fd.get('tahsisat_dagilimi') as string),
    finansal_tablo:        safeJson(fd.get('finansal_tablo') as string),
  })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/ipo')
  redirect('/dashboard/ipo')
}

export async function updateIpoListing(fd: FormData) {
  const supabase = createAdminClient()
  const id = fd.get('id') as string

  const { error } = await supabase.from('ipo_listings').update({
    ticker:                (fd.get('ticker') as string).trim().toUpperCase(),
    name:                  (fd.get('name') as string).trim(),
    slug:                  str(fd.get('slug')),
    logo_url:              str(fd.get('logo_url')),
    source_url:            str(fd.get('source_url')),
    badge:                 str(fd.get('badge')) ?? '',
    status:                str(fd.get('status')) ?? 'taslak',
    basvuru_baslangic:     str(fd.get('basvuru_baslangic')),
    basvuru_bitis:         str(fd.get('basvuru_bitis')),
    borsa_giris:           str(fd.get('borsa_giris')),
    fiyat_alt:             num(fd.get('fiyat_alt')),
    fiyat_ust:             num(fd.get('fiyat_ust')),
    lot_fiyat:             num(fd.get('lot_fiyat')),
    pazar:                 str(fd.get('pazar')),
    tavan_gun:             num(fd.get('tavan_gun')),
    is_synthetic:          fd.get('is_synthetic') === 'true',
    min_lot:               num(fd.get('min_lot')) ?? 1,
    max_lot:               num(fd.get('max_lot')),
    halka_arz_orani:       num(fd.get('halka_arz_orani')),
    halka_arz_buyuklugu:   str(fd.get('halka_arz_buyuklugu')),
    sirket_aciklamasi:     str(fd.get('sirket_aciklamasi')),
    tahsisat_dagilimi:     safeJson(fd.get('tahsisat_dagilimi') as string),
    finansal_tablo:        safeJson(fd.get('finansal_tablo') as string),
  }).eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/ipo')
  redirect('/dashboard/ipo')
}

export async function updateIpoStatus(fd: FormData) {
  const supabase = createAdminClient()
  const id     = fd.get('id') as string
  const status = fd.get('status') as string

  const { error } = await supabase
    .from('ipo_listings')
    .update({ status })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/ipo')
}

export async function deleteIpoListing(fd: FormData) {
  const supabase = createAdminClient()
  const id = fd.get('id') as string

  const { error } = await supabase
    .from('ipo_listings')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/ipo')
  redirect('/dashboard/ipo')
}

// ── Application Management ──────────────────────────────────────────────

async function enrichWithProfiles(supabase: ReturnType<typeof createAdminClient>, apps: any[]): Promise<any[]> {
  if (!apps.length) return apps
  const profileIds = [...new Set(apps.map((a: any) => a.profile_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', profileIds)
  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
  return apps.map((a: any) => ({ ...a, profile: profileMap[a.profile_id] ?? null }))
}

export async function getIpoApplications(ipoListingId: string): Promise<IpoApplication[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ipo_applications')
    .select('*, ipo_listings:ipo_listing_id ( ticker, name, lot_fiyat, is_synthetic )')
    .eq('ipo_listing_id', ipoListingId)
    .order('created_at', { ascending: false })

  const enriched = await enrichWithProfiles(supabase, data ?? [])
  return enriched.map((r: any) => ({
    ...r,
    profile:     r.profile      ?? null,
    ipo_listing: r.ipo_listings ?? null,
  })) as IpoApplication[]
}

// All external (non-Supabase) applications — grouped view for admin
export async function getExtIpoApplications(): Promise<IpoApplication[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ipo_applications')
    .select('*')
    .is('ipo_listing_id', null)
    .order('created_at', { ascending: false })

  const enriched = await enrichWithProfiles(supabase, data ?? [])
  return enriched.map((r: any) => ({
    ...r,
    profile:     r.profiles ?? null,
    ipo_listing: null,
  })) as IpoApplication[]
}

export async function distributeIpoLots(fd: FormData): Promise<{ success: boolean; error?: string }> {
  const supabase    = createAdminClient()
  const appId       = fd.get('application_id') as string
  const allocLots   = parseInt(fd.get('allocated_lots') as string, 10)

  if (isNaN(allocLots) || allocLots <= 0) return { success: false, error: 'Geçersiz lot miktarı' }

  // Fetch application + listing details
  const { data: app, error: appErr } = await supabase
    .from('ipo_applications')
    .select('*, ipo_listings:ipo_listing_id ( ticker, lot_fiyat, is_synthetic, tavan_gun, borsa_giris )')
    .eq('id', appId)
    .single()

  if (appErr || !app) return { success: false, error: 'Başvuru bulunamadı' }
  if (app.status === 'dagitildi') return { success: false, error: 'Bu başvuru zaten dağıtıldı' }

  const listing = app.ipo_listings as any
  const lotFiyat = Number(listing?.lot_fiyat ?? 0)
  const ticker   = listing?.ticker as string
  if (!ticker) return { success: false, error: 'Ticker bulunamadı' }

  const posValue   = allocLots * lotFiyat
  const usedMargin = posValue  // leverage = 1 for IPO

  // Create position for the user
  const { error: posErr } = await supabase.from('positions').insert({
    profile_id:      app.profile_id,
    account_id:      app.account_id,
    symbol:          ticker,
    side:            'buy',
    qty:             allocLots,
    avg_cost:        lotFiyat,
    status:          'open',
    leverage:        1,
    used_margin:     usedMargin,
    commission:      0,
    ipo_listing_id:  app.ipo_listing_id,
  })

  if (posErr) return { success: false, error: posErr.message }

  // Mark application as distributed
  await supabase.from('ipo_applications').update({
    status:         'dagitildi',
    allocated_lots: allocLots,
    distributed_at: new Date().toISOString(),
  }).eq('id', appId)

  revalidatePath(`/dashboard/ipo/${app.ipo_listing_id}/applications`)
  return { success: true }
}

export async function cancelIpoApplication(fd: FormData): Promise<void> {
  const supabase = createAdminClient()
  const appId    = fd.get('application_id') as string

  await supabase.from('ipo_applications').update({ status: 'iptal' }).eq('id', appId)
  revalidatePath('/dashboard/ipo')
}
