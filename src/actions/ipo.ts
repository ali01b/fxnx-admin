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

export type IpoStatus =
  | 'taslak'
  | 'aktif'              // geriye dönük uyumluluk
  | 'talep_toplaniyor'
  | 'dagitim_bekleniyor'
  | 'dagitildi'
  | 'gecmis'
  | 'iptal'

export interface IpoListing {
  id:                  string
  ticker:              string
  name:                string
  slug:                string
  logo_url:            string | null
  source_url:          string | null
  badge:               string | null
  status:              IpoStatus
  basvuru_baslangic:   string | null
  basvuru_bitis:       string | null
  borsa_giris:         string | null
  dagitim_tarihi:      string | null
  dagitim_yontemi:     string | null
  fiyat_alt:           number | null
  fiyat_ust:           number | null
  lot_fiyat:           number | null
  pazar:               string | null
  tavan_gun:           number | null
  gunluk_artis_orani:  number | null   // Günlük tavan artış % (default 10)
  intraday_volatility: number | null   // Gün içi dalgalanma % (default 2)
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
    dagitim_tarihi:        str(fd.get('dagitim_tarihi')),
    dagitim_yontemi:       str(fd.get('dagitim_yontemi')),
    fiyat_alt:             num(fd.get('fiyat_alt')),
    fiyat_ust:             num(fd.get('fiyat_ust')),
    lot_fiyat:             num(fd.get('lot_fiyat')),
    pazar:                 str(fd.get('pazar')),
    tavan_gun:             num(fd.get('tavan_gun')),
    gunluk_artis_orani:    num(fd.get('gunluk_artis_orani')) ?? 10,
    intraday_volatility:   num(fd.get('intraday_volatility')) ?? 2,
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

  // Positions'daki FK referansını temizle (pozisyonları silmiyoruz, bağlantıyı koparıyoruz)
  await supabase
    .from('positions')
    .update({ ipo_listing_id: null })
    .eq('ipo_listing_id', id)

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

  // Borsa girişi tarihi kontrolü — henüz gelmemişse dağıtım yapılamaz
  if (listing?.borsa_giris) {
    const borsaGiris = new Date(listing.borsa_giris)
    borsaGiris.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (borsaGiris > today) {
      const fmt = borsaGiris.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      return { success: false, error: `Dağıtım yapılamaz — borsa girişi ${fmt} tarihinde. Bu tarihten önce dağıtım yapılamaz.` }
    }
  }

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

// ── External API sync ───────────────────────────────────────────────────────

const EXT_API = 'https://api.iletisimacar.com/api/ipo'

// Türkçe ay adı → iki haneli rakam
const TR_MONTHS: Record<string, string> = {
  Ocak: '01', Şubat: '02', Mart: '03', Nisan: '04',
  Mayıs: '05', Haziran: '06', Temmuz: '07', Ağustos: '08',
  Eylül: '09', Ekim: '10', Kasım: '11', Aralık: '12',
}

function parseTrDate(s: string): string | null {
  // "23 Şubat 2026" → "2026-02-23"
  const m = s.trim().match(/(\d{1,2})\s+(\S+)\s+(\d{4})/)
  if (!m) return null
  const month = TR_MONTHS[m[2]]
  if (!month) return null
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`
}

function parseTrDateRange(s: string): { start: string | null; end: string | null } {
  // "1-2-3 Nisan 2026" veya "19-20 Şubat 2026" → aynı ay, N gün (ilk ve son gün)
  const sameMonth = s.trim().match(/^(\d{1,2}(?:-\d{1,2})*)\s+(\S+)\s+(\d{4})/)
  if (sameMonth) {
    const month = TR_MONTHS[sameMonth[2]]
    const year  = sameMonth[3]
    if (!month) return { start: null, end: null }
    const days = sameMonth[1].split('-')
    return {
      start: `${year}-${month}-${days[0].padStart(2, '0')}`,
      end:   `${year}-${month}-${days[days.length - 1].padStart(2, '0')}`,
    }
  }
  // "19 Şubat - 20 Mart 2026" → farklı ay
  const diffMonth = s.trim().match(/(\d{1,2})\s+(\S+)\s*-\s*(\d{1,2})\s+(\S+)\s+(\d{4})/)
  if (diffMonth) {
    const m1 = TR_MONTHS[diffMonth[2]], m2 = TR_MONTHS[diffMonth[4]], yr = diffMonth[5]
    return {
      start: m1 ? `${yr}-${m1}-${diffMonth[1].padStart(2, '0')}` : null,
      end:   m2 ? `${yr}-${m2}-${diffMonth[3].padStart(2, '0')}` : null,
    }
  }
  // tek tarih
  const single = parseTrDate(s)
  return { start: single, end: single }
}

function parseTrPrice(s: string): number | null {
  // "22,00 TL" veya "22.00" → 22
  const clean = s.replace(',', '.').replace(/[^\d.]/g, '')
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

export interface ExtApiIpo {
  ticker:   string
  name:     string
  dates:    string  // ham tarih aralığı metni
  url:      string
  slug:     string
  category: string
  badge:    string
}

/** Dış API'deki tüm halka arzları çeker (aktif + taslak + gecmis) */
export async function getExternalApiIpos(): Promise<{ items: ExtApiIpo[]; existingTickers: string[] }> {
  const supabase = createAdminClient()

  const [apiRes, dbRes] = await Promise.all([
    fetch(`${EXT_API}/all`, { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    supabase.from('ipo_listings').select('ticker'),
  ])

  const aktif:  ExtApiIpo[] = (apiRes?.data?.aktif  ?? []).map((i: ExtApiIpo) => ({ ...i, category: 'aktif' }))
  const taslak: ExtApiIpo[] = (apiRes?.data?.taslak ?? []).map((i: ExtApiIpo) => ({ ...i, category: 'taslak' }))
  const gecmis: ExtApiIpo[] = (apiRes?.data?.gecmis ?? []).map((i: ExtApiIpo) => ({ ...i, category: 'gecmis' }))

  // Sıralama: aktif → taslak → gecmis
  const items = [...aktif, ...taslak, ...gecmis]
  const existingTickers = (dbRes.data ?? []).map((r: any) => r.ticker as string)

  return { items, existingTickers }
}

/** Dış API'den tek bir halka arzı Supabase'e taslak olarak içe aktarır */
export async function importIpoFromExternal(fd: FormData): Promise<{ success: boolean; error?: string }> {
  const supabase  = createAdminClient()
  const ticker    = (fd.get('ticker') as string).trim().toUpperCase()
  const name      = (fd.get('name') as string).trim()
  const extSlug   = fd.get('slug') as string
  const extDates  = (fd.get('dates') as string | null) ?? ''
  const sourceUrl = (fd.get('url') as string | null) ?? ''
  const badge     = (fd.get('badge') as string | null) ?? ''

  // Zaten var mı?
  const { data: existing } = await supabase
    .from('ipo_listings').select('id').eq('ticker', ticker).maybeSingle()
  if (existing) return { success: false, error: `${ticker} zaten içe aktarılmış` }

  let basvuru_baslangic: string | null = null
  let basvuru_bitis:     string | null = null
  let borsa_giris:       string | null = null
  let dagitim_tarihi:    string | null = null
  let dagitim_yontemi:   string | null = null
  let lot_fiyat:         number | null = null
  let fiyat_alt:         number | null = null
  let fiyat_ust:         number | null = null
  let halka_arz_orani:   number | null = null
  let pazar:             string | null = null
  let logo_url:          string | null = null
  let sirket_aciklamasi: string | null = null

  try {
    const resp   = await fetch(`${EXT_API}/detail/${extSlug}`, { cache: 'no-store' }).then(r => r.json())
    const data   = resp?.data ?? {}
    const basic  = (data.basicInfo ?? {}) as Record<string, unknown>

    // Logo
    logo_url = (data.logo as string) || null

    // Pazar
    pazar = (data.pazar as string) || (basic.pazar as string) || null

    // Şirket açıklaması
    sirket_aciklamasi = (data.sirketAciklamasi as string) || null

    // Talep toplama tarihleri
    const halkaArzTarihi    = (data.halkaArzTarihi as string) || extDates
    const halkaArzTarihiISO = data.halkaArzTarihiISO as string | null

    if (halkaArzTarihi) {
      const { start, end } = parseTrDateRange(halkaArzTarihi)
      basvuru_baslangic = halkaArzTarihiISO ?? start   // ISO kesin tarihi varsa kullan
      basvuru_bitis     = end
    }

    // Borsa ilk işlem tarihi
    const bistTarihi = (basic.bistIlkIslemTarihi as string) || null
    if (bistTarihi) borsa_giris = parseTrDate(bistTarihi)

    // Dağıtım yöntemi
    dagitim_yontemi = (basic.dagitimYontemi as string) || null

    // Fiyat: "21,10 TL" veya "28,00 - 32,00 TL"
    const fiyatStr = (basic.fiyat as string) || ''
    if (fiyatStr) {
      // Fiyat aralığı için "28,00 - 32,00 TL" formatı
      const rangeMatch = fiyatStr.match(/^([\d,.]+)\s*-\s*([\d,.]+)/)
      if (rangeMatch) {
        fiyat_alt = parseTrPrice(rangeMatch[1])
        fiyat_ust = parseTrPrice(rangeMatch[2])
      } else {
        lot_fiyat = parseTrPrice(fiyatStr)
      }
    }

    // Halka arz oranı: "%25.09" → 25.09
    const dolasimOrani = (basic.fiiliDolasimPayOrani as string) || ''
    if (dolasimOrani) {
      const n = parseFloat(dolasimOrani.replace('%', '').replace(',', '.'))
      if (!isNaN(n)) halka_arz_orani = n
    }
  } catch {
    // Detay çekilemezse ham tarih metnini parse etmeyi dene
    if (extDates) {
      const { start, end } = parseTrDateRange(extDates)
      basvuru_baslangic = start
      basvuru_bitis     = end
    }
  }

  const slug = toSlug(`${ticker}-${name}`)

  const { error } = await supabase.from('ipo_listings').insert({
    ticker,
    name,
    slug,
    logo_url,
    source_url:        sourceUrl || null,
    badge:             badge || '',
    status:            'taslak',
    pazar,
    basvuru_baslangic,
    basvuru_bitis,
    borsa_giris,
    dagitim_tarihi,
    dagitim_yontemi,
    lot_fiyat,
    fiyat_alt,
    fiyat_ust,
    halka_arz_orani,
    sirket_aciklamasi,
    min_lot:           1,
    tahsisat_dagilimi: [],
    finansal_tablo:    [],
  })

  if (error) return { success: false, error: error.message }

  // Enstrüman yoksa otomatik ekle ve BIST term'lerine bağla
  const { data: existingInstrument } = await supabase
    .from('instruments')
    .select('id')
    .eq('symbol', ticker)
    .maybeSingle()

  if (!existingInstrument) {
    const { data: newInstrument } = await supabase
      .from('instruments')
      .insert({
        symbol:         ticker,
        name:           name,
        category:       'bist',
        last_synced_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (newInstrument) {
      // Mevcut BIST term'lerini bul ve yeni enstrümanı bağla
      const { data: bistTermLinks } = await supabase
        .from('trading_term_instrument_settings')
        .select('term_id, instruments!inner(category)')
        .eq('instruments.category', 'bist')

      const termIds = [...new Set((bistTermLinks ?? []).map((l: any) => l.term_id))]

      if (termIds.length > 0) {
        const termInserts = termIds.map((termId) => ({
          term_id:         termId,
          instrument_id:   newInstrument.id,
          leverage:        1,
          margin_call:     50,
          stop_out:        20,
          min_lot:         1,
          max_lot:         10000,
          lot_step:        1,
          commission_rate: 0.001,
          spread:          0,
          is_active:       true,
          is_tradable:     true,
        }))
        await supabase
          .from('trading_term_instrument_settings')
          .upsert(termInserts, { onConflict: 'term_id, instrument_id', ignoreDuplicates: true })
      }
    }
  }

  revalidatePath('/dashboard/ipo')
  revalidatePath('/dashboard/instruments')
  return { success: true }
}
