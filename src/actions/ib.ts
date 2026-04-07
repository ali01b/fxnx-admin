'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface IBProfile {
  id:                 string
  profile_id:         string
  ref_code:           string
  first_deposit_rate: number
  subsequent_rate:    number
  status:             'active' | 'suspended'
  notes:              string | null
  created_at:         string
  updated_at:         string
  profile: {
    first_name: string | null
    last_name:  string | null
    email:      string | null
    customer_no: string | null
  } | null
}

export interface IBWithStats extends IBProfile {
  client_count:        number
  total_deposits:      number
  pending_commissions: number
  paid_commissions:    number
}

export interface IBClient {
  id:            string
  client_id:     string
  assigned_at:   string
  assigned_by:   string | null
  first_name:    string | null
  last_name:     string | null
  customer_no:   string | null
  kyc_status:    string | null
  total_deposits: number
  deposit_count:  number
}

export interface IBCommission {
  id:                 string
  client_id:          string
  deposit_request_id: string
  deposit_amount:     number
  commission_rate:    number
  commission_amount:  number
  commission_type:    'first_deposit' | 'subsequent'
  currency:           string
  status:             'pending' | 'paid' | 'cancelled'
  paid_at:            string | null
  note:               string | null
  created_at:         string
  client_name:        string
}

export interface IBDetail extends IBProfile {
  clients:     IBClient[]
  commissions: IBCommission[]
  stats: {
    total_clients:     number
    total_deposits:    number
    total_earned:      number
    pending_amount:    number
    first_dep_amount:  number
    subsequent_amount: number
  }
}

// ── Helper: benzersiz ref kodu üret ─────────────────────────────────────────

async function generateUniqueRefCode(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = 'IB-' + Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
    const { data } = await supabase
      .from('ib_profiles')
      .select('id')
      .eq('ref_code', code)
      .maybeSingle()
    if (!data) return code
  }
  throw new Error('Benzersiz ref kodu üretilemedi.')
}

// ── IB listesi ───────────────────────────────────────────────────────────────

export async function getIBList(): Promise<IBWithStats[]> {
  const supabase = createAdminClient()

  const { data: ibs, error } = await supabase
    .from('ib_profiles')
    .select(`
      id, profile_id, ref_code, first_deposit_rate, subsequent_rate,
      status, notes, created_at, updated_at,
      profiles!profile_id(first_name, last_name, email, customer_no)
    `)
    .order('created_at', { ascending: false })

  if (error || !ibs) {
    console.error('[getIBList]', error?.message)
    return []
  }

  const ibIds = ibs.map(i => i.id)
  if (ibIds.length === 0) return []

  const { data: referrals } = await supabase
    .from('ib_referrals')
    .select('ib_profile_id')
    .in('ib_profile_id', ibIds)

  const { data: commissions } = await supabase
    .from('ib_commissions')
    .select('ib_profile_id, commission_amount, status')
    .in('ib_profile_id', ibIds)

  const clientCountMap: Record<string, number> = {}
  for (const r of referrals ?? []) {
    clientCountMap[r.ib_profile_id] = (clientCountMap[r.ib_profile_id] ?? 0) + 1
  }

  const pendingMap: Record<string, number> = {}
  const paidMap: Record<string, number> = {}
  for (const c of commissions ?? []) {
    if (c.status === 'pending') pendingMap[c.ib_profile_id] = (pendingMap[c.ib_profile_id] ?? 0) + Number(c.commission_amount)
    if (c.status === 'paid')    paidMap[c.ib_profile_id]    = (paidMap[c.ib_profile_id]    ?? 0) + Number(c.commission_amount)
  }

  return ibs.map((ib: any) => {
    const p = Array.isArray(ib.profiles) ? ib.profiles[0] : ib.profiles
    return {
      ...ib,
      profile:             p ?? null,
      first_deposit_rate:  Number(ib.first_deposit_rate),
      subsequent_rate:     Number(ib.subsequent_rate),
      client_count:        clientCountMap[ib.id] ?? 0,
      total_deposits:      0, // hesaplama detay sayfasında
      pending_commissions: pendingMap[ib.id] ?? 0,
      paid_commissions:    paidMap[ib.id]    ?? 0,
    }
  })
}

// ── IB detay ─────────────────────────────────────────────────────────────────

export async function getIBDetail(ibId: string): Promise<IBDetail | null> {
  const supabase = createAdminClient()

  const { data: ib, error } = await supabase
    .from('ib_profiles')
    .select(`
      id, profile_id, ref_code, first_deposit_rate, subsequent_rate,
      status, notes, created_at, updated_at,
      profiles!profile_id(first_name, last_name, email, customer_no)
    `)
    .eq('id', ibId)
    .single()

  if (error || !ib) return null

  // Müşteri listesi
  const { data: referrals } = await supabase
    .from('ib_referrals')
    .select(`
      id, client_id, assigned_at, assigned_by,
      profiles!client_id(first_name, last_name, customer_no, kyc_status)
    `)
    .eq('ib_profile_id', ibId)
    .order('assigned_at', { ascending: false })

  // Müşterilerin toplam depozitlerini hesapla
  const clientIds = (referrals ?? []).map((r: any) => r.client_id)
  const { data: deposits } = clientIds.length > 0
    ? await supabase
        .from('deposit_requests')
        .select('profile_id, amount')
        .in('profile_id', clientIds)
        .eq('status', 'approved')
    : { data: [] }

  const depositSumMap: Record<string, number> = {}
  const depositCountMap: Record<string, number> = {}
  for (const d of deposits ?? []) {
    depositSumMap[d.profile_id]   = (depositSumMap[d.profile_id]   ?? 0) + Number(d.amount)
    depositCountMap[d.profile_id] = (depositCountMap[d.profile_id] ?? 0) + 1
  }

  const clients: IBClient[] = (referrals ?? []).map((r: any) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      id:             r.id,
      client_id:      r.client_id,
      assigned_at:    r.assigned_at,
      assigned_by:    r.assigned_by,
      first_name:     p?.first_name  ?? null,
      last_name:      p?.last_name   ?? null,
      customer_no:    p?.customer_no ?? null,
      kyc_status:     p?.kyc_status  ?? null,
      total_deposits: depositSumMap[r.client_id]   ?? 0,
      deposit_count:  depositCountMap[r.client_id] ?? 0,
    }
  })

  // Komisyon geçmişi
  const { data: commissions } = await supabase
    .from('ib_commissions')
    .select(`
      id, client_id, deposit_request_id, deposit_amount, commission_rate,
      commission_amount, commission_type, currency, status, paid_at, note, created_at,
      profiles!client_id(first_name, last_name)
    `)
    .eq('ib_profile_id', ibId)
    .order('created_at', { ascending: false })

  const commissionList: IBCommission[] = (commissions ?? []).map((c: any) => {
    const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
    return {
      id:                 c.id,
      client_id:          c.client_id,
      deposit_request_id: c.deposit_request_id,
      deposit_amount:     Number(c.deposit_amount),
      commission_rate:    Number(c.commission_rate),
      commission_amount:  Number(c.commission_amount),
      commission_type:    c.commission_type,
      currency:           c.currency,
      status:             c.status,
      paid_at:            c.paid_at,
      note:               c.note,
      created_at:         c.created_at,
      client_name:        p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '—',
    }
  })

  const totalEarned  = commissionList.reduce((s, c) => s + c.commission_amount, 0)
  const pendingAmt   = commissionList.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0)
  const firstDepAmt  = commissionList.filter(c => c.commission_type === 'first_deposit').reduce((s, c) => s + c.commission_amount, 0)
  const subseqAmt    = commissionList.filter(c => c.commission_type === 'subsequent').reduce((s, c) => s + c.commission_amount, 0)
  const totalDeposits = Object.values(depositSumMap).reduce((s, n) => s + n, 0)

  const p = Array.isArray(ib.profiles) ? (ib.profiles as any)[0] : ib.profiles

  return {
    ...ib,
    profile:            p ?? null,
    first_deposit_rate: Number(ib.first_deposit_rate),
    subsequent_rate:    Number(ib.subsequent_rate),
    clients:            clients,
    commissions:        commissionList,
    stats: {
      total_clients:    clients.length,
      total_deposits:   totalDeposits,
      total_earned:     totalEarned,
      pending_amount:   pendingAmt,
      first_dep_amount: firstDepAmt,
      subsequent_amount: subseqAmt,
    },
  }
}

// ── IB oluştur ───────────────────────────────────────────────────────────────

export async function createIBProfile(data: {
  profileId:         string
  firstDepositRate:  number
  subsequentRate:    number
  notes?:            string
}): Promise<{ error?: string; ibProfile?: IBProfile }> {
  const supabase = createAdminClient()

  // Zaten IB mi?
  const { data: existing } = await supabase
    .from('ib_profiles')
    .select('id')
    .eq('profile_id', data.profileId)
    .maybeSingle()

  if (existing) return { error: 'Bu kullanıcı zaten bir IB profilidir.' }

  let refCode: string
  try {
    refCode = await generateUniqueRefCode(supabase)
  } catch (e: any) {
    return { error: e.message }
  }

  const { data: ib, error } = await supabase
    .from('ib_profiles')
    .insert({
      profile_id:         data.profileId,
      ref_code:           refCode,
      first_deposit_rate: data.firstDepositRate,
      subsequent_rate:    data.subsequentRate,
      notes:              data.notes || null,
    })
    .select(`
      id, profile_id, ref_code, first_deposit_rate, subsequent_rate,
      status, notes, created_at, updated_at,
      profiles!profile_id(first_name, last_name, email, customer_no)
    `)
    .single()

  if (error || !ib) return { error: error?.message ?? 'IB oluşturulamadı.' }

  revalidatePath('/dashboard/ib')
  const p = Array.isArray(ib.profiles) ? (ib.profiles as any)[0] : ib.profiles
  return { ibProfile: { ...ib, profile: p ?? null, first_deposit_rate: Number(ib.first_deposit_rate), subsequent_rate: Number(ib.subsequent_rate) } }
}

// ── Ref kodunu güncelle ──────────────────────────────────────────────────────

export async function updateRefCode(ibId: string, newRefCode: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const trimmed = newRefCode.trim().toUpperCase()
  if (!trimmed) return { error: 'Ref kodu boş olamaz.' }
  if (!/^[A-Z0-9-]{3,20}$/.test(trimmed)) return { error: 'Geçersiz format. Harf, rakam ve - kullanılabilir (3-20 karakter).' }

  // Benzersizlik kontrolü
  const { data: existing } = await supabase
    .from('ib_profiles')
    .select('id')
    .eq('ref_code', trimmed)
    .neq('id', ibId)
    .maybeSingle()

  if (existing) return { error: 'Bu ref kodu zaten kullanımda.' }

  const { error } = await supabase
    .from('ib_profiles')
    .update({ ref_code: trimmed, updated_at: new Date().toISOString() })
    .eq('id', ibId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/ib')
  return {}
}

// ── Komisyon oranlarını güncelle ──────────────────────────────────────────────

export async function updateIBRates(ibId: string, data: {
  firstDepositRate: number
  subsequentRate:   number
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('ib_profiles')
    .update({
      first_deposit_rate: data.firstDepositRate,
      subsequent_rate:    data.subsequentRate,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', ibId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/ib')
  return {}
}

// ── IB durumunu güncelle ─────────────────────────────────────────────────────

export async function updateIBStatus(ibId: string, status: 'active' | 'suspended'): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('ib_profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', ibId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/ib')
  return {}
}

// ── Müşteri ata ──────────────────────────────────────────────────────────────

export async function assignClientToIB(ibId: string, clientId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  // Zaten başka bir IB'ye bağlı mı?
  const { data: existing } = await supabase
    .from('ib_referrals')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle()

  if (existing) return { error: 'Bu kullanıcı zaten bir IB\'ye bağlı.' }

  const { error } = await supabase
    .from('ib_referrals')
    .insert({ ib_profile_id: ibId, client_id: clientId })

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/ib/${ibId}`)
  return {}
}

// ── Müşteri çıkar ────────────────────────────────────────────────────────────

export async function removeClientFromIB(clientId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('ib_referrals')
    .delete()
    .eq('client_id', clientId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/ib')
  return {}
}

// ── Komisyonları ödendi işaretle ─────────────────────────────────────────────

export async function markCommissionsPaid(
  commissionIds: string[],
  note?: string
): Promise<{ error?: string }> {
  if (commissionIds.length === 0) return {}
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('ib_commissions')
    .update({
      status:  'paid',
      paid_at: new Date().toISOString(),
      note:    note || null,
    })
    .in('id', commissionIds)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  revalidatePath('/dashboard/ib')
  return {}
}

// ── Kullanılabilir profilleri getir (IB oluşturmak için) ─────────────────────

export async function getProfilesForIBAssign(search?: string) {
  const supabase = createAdminClient()

  // Zaten IB olan profil id'lerini dışarıda bırak
  const { data: existingIBs } = await supabase
    .from('ib_profiles')
    .select('profile_id')

  const excludeIds = (existingIBs ?? []).map(i => i.profile_id)

  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, email, customer_no')
    .order('first_name')
    .limit(30)

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,customer_no.ilike.%${search}%`
    )
  }

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data } = await query
  return data ?? []
}

// ── IB portal verisi (IB kullanıcısının kendi görünümü) ──────────────────────

export interface IBPortalClient {
  client_id:      string
  full_name:      string
  customer_no:    string | null
  kyc_status:     string | null
  assigned_at:    string
  total_deposits: number
  deposit_count:  number
  pending_commission: number
  paid_commission:    number
}

export interface IBPortalData {
  id:                 string
  ref_code:           string
  first_deposit_rate: number
  subsequent_rate:    number
  status:             string
  clients:            IBPortalClient[]
  stats: {
    total_clients:      number
    total_deposits:     number
    pending_commission: number
    paid_commission:    number
  }
}

export async function getMyIBPortalData(userId: string): Promise<IBPortalData | null> {
  const supabase = createAdminClient()

  const { data: ibProfile, error } = await supabase
    .from('ib_profiles')
    .select('id, ref_code, first_deposit_rate, subsequent_rate, status')
    .eq('profile_id', userId)
    .single()

  if (error || !ibProfile) return null

  // Müşteriler
  const { data: referrals } = await supabase
    .from('ib_referrals')
    .select(`
      client_id, assigned_at,
      profiles!client_id(first_name, last_name, customer_no, kyc_status)
    `)
    .eq('ib_profile_id', ibProfile.id)
    .order('assigned_at', { ascending: false })

  const clientIds = (referrals ?? []).map((r: any) => r.client_id)

  // Toplam depozitler
  const { data: deposits } = clientIds.length > 0
    ? await supabase
        .from('deposit_requests')
        .select('profile_id, amount')
        .in('profile_id', clientIds)
        .eq('status', 'approved')
    : { data: [] }

  const depositSumMap:   Record<string, number> = {}
  const depositCountMap: Record<string, number> = {}
  for (const d of deposits ?? []) {
    depositSumMap[d.profile_id]   = (depositSumMap[d.profile_id]   ?? 0) + Number(d.amount)
    depositCountMap[d.profile_id] = (depositCountMap[d.profile_id] ?? 0) + 1
  }

  // Komisyonlar
  const { data: commissions } = await supabase
    .from('ib_commissions')
    .select('client_id, commission_amount, status')
    .eq('ib_profile_id', ibProfile.id)

  const pendingCommMap: Record<string, number> = {}
  const paidCommMap:   Record<string, number> = {}
  for (const c of commissions ?? []) {
    if (c.status === 'pending') pendingCommMap[c.client_id] = (pendingCommMap[c.client_id] ?? 0) + Number(c.commission_amount)
    if (c.status === 'paid')    paidCommMap[c.client_id]   = (paidCommMap[c.client_id]   ?? 0) + Number(c.commission_amount)
  }

  const clients: IBPortalClient[] = (referrals ?? []).map((r: any) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      client_id:          r.client_id,
      full_name:          p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '—',
      customer_no:        p?.customer_no  ?? null,
      kyc_status:         p?.kyc_status   ?? null,
      assigned_at:        r.assigned_at,
      total_deposits:     depositSumMap[r.client_id]   ?? 0,
      deposit_count:      depositCountMap[r.client_id] ?? 0,
      pending_commission: pendingCommMap[r.client_id]  ?? 0,
      paid_commission:    paidCommMap[r.client_id]     ?? 0,
    }
  })

  const totalDeposits    = clients.reduce((s, c) => s + c.total_deposits, 0)
  const totalPending     = clients.reduce((s, c) => s + c.pending_commission, 0)
  const totalPaid        = clients.reduce((s, c) => s + c.paid_commission, 0)

  return {
    id:                 ibProfile.id,
    ref_code:           ibProfile.ref_code,
    first_deposit_rate: Number(ibProfile.first_deposit_rate),
    subsequent_rate:    Number(ibProfile.subsequent_rate),
    status:             ibProfile.status,
    clients,
    stats: {
      total_clients:      clients.length,
      total_deposits:     totalDeposits,
      pending_commission: totalPending,
      paid_commission:    totalPaid,
    },
  }
}

// ── Yatırım onaylandığında IB komisyonu oluştur (requests.ts tarafından çağrılır) ─

export async function createIBCommissionIfApplicable(
  profileId:         string,
  depositRequestId:  string,
  amount:            number,
  currency:          string
): Promise<void> {
  const supabase = createAdminClient()

  const { data: referral } = await supabase
    .from('ib_referrals')
    .select(`
      ib_profile_id,
      ib_profiles!ib_profile_id(first_deposit_rate, subsequent_rate, status)
    `)
    .eq('client_id', profileId)
    .maybeSingle()

  if (!referral) return
  const ibp = (referral as any).ib_profiles
  if (!ibp || ibp.status !== 'active') return

  // Bu talep hariç daha önce onaylanmış depozit var mı?
  const { count } = await supabase
    .from('deposit_requests')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('status', 'approved')
    .neq('id', depositRequestId)

  const isFirst = (count ?? 0) === 0
  const rate    = isFirst ? Number(ibp.first_deposit_rate) : Number(ibp.subsequent_rate)

  await supabase.from('ib_commissions').insert({
    ib_profile_id:      referral.ib_profile_id,
    client_id:          profileId,
    deposit_request_id: depositRequestId,
    deposit_amount:     amount,
    commission_rate:    rate,
    commission_amount:  amount * rate,
    commission_type:    isFirst ? 'first_deposit' : 'subsequent',
    currency,
    status:             'pending',
  })
}
