'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { notifyUser } from './notify'
import { buildEmailHtml } from '@/lib/email-template'

export async function getAccountDetail(id: string) {
  const supabase = createAdminClient()

  // Batch 1: fetch account base + extended columns in parallel
  const [{ data: account, error: accErr }, { data: extRow, error: extErr }] = await Promise.all([
    supabase
      .from('trading_accounts')
      .select(`
        id, account_code, account_type, currency,
        balance, equity, margin, free_margin, status, created_at,
        profiles!profile_id(id, customer_no, first_name, last_name, email, tc_identity_no, kyc_status, status, created_at)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('trading_accounts')
      .select('trading_terms_id, margin_type, has_trading_permission, specific_leverage, specific_margin_call, specific_stop_out')
      .eq('id', id)
      .single(),
  ])

  if (accErr) console.error('[getAccountDetail] account error:', accErr.message)

  const extra: any = (!extErr && extRow) ? extRow : {}
  const profileId = account
    ? (Array.isArray(account.profiles) ? (account.profiles[0] as any)?.id : (account.profiles as any)?.id)
    : null

  // Batch 2: fetch everything that depends on profileId / trading_terms_id in parallel
  const [profileExtra, trading_terms, rawTermInstruments, positions, transactions, kycDecisions] = await Promise.all([
    profileId
      ? supabase.from('profiles')
          .select('phone, date_of_birth, gender, nationality, address, city, country, postal_code, kyc_submitted_at')
          .eq('id', profileId).single().then(r => r.data ?? {})
      : Promise.resolve({}),

    extra.trading_terms_id
      ? supabase.from('trading_terms').select('id, name').eq('id', extra.trading_terms_id).single().then(r => r.data ?? null)
      : Promise.resolve(null),

    extra.trading_terms_id
      ? supabase.from('trading_term_instrument_settings')
          .select('leverage, swap_long, swap_short, commission_rate, instruments!inner(symbol, name, category)')
          .eq('term_id', extra.trading_terms_id).eq('is_active', true).eq('is_tradable', true)
          .then(r => ({ type: 'term', data: r.data ?? [] }))
      : supabase.from('instruments').select('symbol, name, category')
          .eq('is_active', true).eq('is_tradable', true).order('symbol')
          .then(r => ({ type: 'all', data: r.data ?? [] })),

    profileId
      ? supabase.from('positions')
          .select('id, symbol, qty, avg_cost, side, status, close_price, pnl, leverage, opened_at, closed_at')
          .eq('profile_id', profileId).order('opened_at', { ascending: false }).limit(200)
          .then(r => { if (r.error) console.error('[getAccountDetail] positions error:', r.error.message); return r.data ?? [] })
      : Promise.resolve([]),

    account?.id
      ? supabase.from('balance_transactions')
          .select('id, type, amount, balance_before, balance_after, source, note, created_at')
          .eq('account_id', account.id).order('created_at', { ascending: false }).limit(100)
          .then(r => r.data ?? [])
      : Promise.resolve([]),

    profileId
      ? supabase.from('kyc_decisions')
          .select('id, decision, reason_code, note, created_at')
          .eq('profile_id', profileId).order('created_at', { ascending: false }).limit(10)
          .then(r => r.data ?? [])
      : Promise.resolve([]),
  ])

  // Merge extended profile into account.profiles
  if (account) {
    const baseProfile = Array.isArray(account.profiles) ? account.profiles[0] : account.profiles
    const mergedProfile = baseProfile ? { ...baseProfile, ...(profileExtra as any) } : baseProfile
    if (Array.isArray(account.profiles)) {
      (account as any).profiles = [mergedProfile]
    } else {
      (account as any).profiles = mergedProfile
    }
  }

  // Map term instruments
  const termInstruments: any[] = rawTermInstruments.type === 'term'
    ? (rawTermInstruments.data as any[]).map((t: any) => ({
        symbol:          t.instruments?.symbol          ?? '',
        name:            t.instruments?.name            ?? '',
        category:        t.instruments?.category        ?? '',
        leverage:        Number(t.leverage)             || 1,
        swap_long:       Number(t.swap_long)            || 0,
        swap_short:      Number(t.swap_short)           || 0,
        commission_rate: Number(t.commission_rate)      || 0,
      })).filter((i: any) => i.symbol)
    : (rawTermInstruments.data as any[]).map((i: any) => ({
        symbol: i.symbol, name: i.name, category: i.category,
        leverage: 1, swap_long: 0, swap_short: 0, commission_rate: 0,
      }))

  // Compute margin/equity from open positions using avg_cost (no external API)
  const openPositions = (positions as any[]).filter((p: any) => p.status === 'open')
  let computedMargin = 0
  let computedFloatingPnl = 0
  for (const pos of openPositions) {
    const price = Number(pos.avg_cost)
    const qty   = Math.abs(Number(pos.qty))
    const lev   = Math.max(Number(pos.leverage) || 1, 1)
    computedMargin      += (price * qty) / lev
    computedFloatingPnl += (price - Number(pos.avg_cost)) * qty
  }

  const balance = Number(account?.balance ?? 0)
  const computedEquity      = balance + computedFloatingPnl
  const computedFreeMargin  = computedEquity - computedMargin
  const computedMarginLevel = computedMargin > 0 ? (computedEquity / computedMargin) * 100 : null

  const merged = account ? { ...account, ...extra, trading_terms } : null

  return {
    account: merged,
    positions,
    transactions,
    kycDocUrls: {} as Record<string, string>, // loaded lazily via getKycDocUrls()
    kycDecisions,
    termInstruments,
    computed: {
      equity:      computedEquity,
      margin:      computedMargin,
      freeMargin:  computedFreeMargin,
      floatingPnl: computedFloatingPnl,
      marginLevel: computedMarginLevel,
    },
  }
}

export async function getKycDocUrls(profileId: string): Promise<Record<string, string>> {
  const supabase = createAdminClient()
  const docFiles = await supabase.storage.from('kyc-documents').list(profileId, { limit: 20 }).then(r => r.data ?? [])
  if (docFiles.length === 0) return {}
  const entries = await Promise.all(
    docFiles.map(async (f: any) => {
      const { data } = await supabase.storage.from('kyc-documents').createSignedUrl(`${profileId}/${f.name}`, 600)
      return data?.signedUrl ? [f.name, data.signedUrl] as [string, string] : null
    })
  )
  return Object.fromEntries(entries.filter(Boolean) as [string, string][])
}

export async function assignTradingTerm(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const accountId      = formData.get('account_id') as string
  const tradingTermsId = formData.get('trading_terms_id') as string

  await supabase
    .from('trading_accounts')
    .update({ trading_terms_id: tradingTermsId || null })
    .eq('id', accountId)
  revalidatePath('/dashboard/accounts')
}

export async function setTradingPermission(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const accountId = formData.get('account_id') as string
  const value     = formData.get('value') === 'true'

  await supabase
    .from('trading_accounts')
    .update({ has_trading_permission: value })
    .eq('id', accountId)

  revalidatePath('/dashboard/accounts')
}

export async function adjustBalance(formData: FormData): Promise<void> {
  const supabase  = createAdminClient()
  const accountId = formData.get('account_id') as string
  const type      = formData.get('type') as string
  const note      = formData.get('note') as string | null
  const source    = (formData.get('source') as string) || 'admin'

  const rawAmount = parseFloat(formData.get('amount') as string)

  const { data: acc, error: accErr } = await supabase
    .from('trading_accounts')
    .select('balance, profile_id')
    .eq('id', accountId)
    .single()

  if (accErr) console.error('[adjustBalance] fetch error:', accErr.message)
  if (!acc) return

  const currentBalance = Number(acc.balance ?? 0)
  let newBalance = currentBalance
  let logAmount  = rawAmount

  if (type === 'zero_balance') {
    newBalance = 0
    logAmount  = currentBalance
  } else {
    if (isNaN(rawAmount) || rawAmount <= 0) return
    if (type === 'deposit' || type === 'credit_in' || type === 'correction') {
      newBalance = currentBalance + rawAmount
    } else if (type === 'withdrawal' || type === 'credit_out') {
      newBalance = currentBalance - rawAmount
      if (newBalance < 0) return
    }
  }

  await supabase
    .from('trading_accounts')
    .update({ balance: newBalance })
    .eq('id', accountId)

  // Log transaction (only if balance_transactions table exists)
  try {
    await supabase.from('balance_transactions').insert({
      account_id:     accountId,
      user_id:        acc.profile_id ?? null,
      type,
      amount:         logAmount,
      balance_before: currentBalance,
      balance_after:  newBalance,
      source,
      note:           note || null,
    })
  } catch (_) {}

  // Push notification
  if (acc.profile_id) {
    const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (type === 'deposit' || type === 'credit_in') {
      await notifyUser(acc.profile_id, {
        type:  'deposit',
        title: 'Para Yatırma İşlemi Gerçekleşti',
        body:  `${fmt(logAmount)} TRY tutarındaki para yatırma işleminiz hesabınıza aktarılmıştır. Güncel bakiyeniz: ${fmt(newBalance)} TRY`,
        url:   '/dashboard',
      })
    } else if (type === 'withdrawal' || type === 'credit_out') {
      await notifyUser(acc.profile_id, {
        type:  'withdrawal',
        title: 'Para Çekme İşlemi Gerçekleşti',
        body:  `${fmt(logAmount)} TRY tutarındaki para çekme talebiniz işleme alınmıştır. Güncel bakiyeniz: ${fmt(newBalance)} TRY`,
        url:   '/dashboard',
      })
    } else if (type === 'correction') {
      await notifyUser(acc.profile_id, {
        type:  'system',
        title: 'Hesap Bakiye Düzeltmesi',
        body:  `Hesabınızda ${fmt(logAmount)} TRY tutarında bakiye düzeltmesi yapılmıştır. Güncel bakiyeniz: ${fmt(newBalance)} TRY`,
        url:   '/dashboard',
      })
    }
  }

  revalidatePath('/dashboard/accounts')
}

export async function createTradingAccount(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const profileId      = formData.get('profile_id') as string
  const currency       = formData.get('currency') as string
  const accountType    = formData.get('account_type') as string
  const tradingTermsId = formData.get('trading_terms_id') as string | null
  const marginType     = formData.get('margin_type') as string

  if (!profileId || !currency) return

  const { data: generatedCode } = await supabase.rpc('generate_account_code')
  const accountCode = generatedCode as string

  await supabase.from('trading_accounts').insert({
    profile_id: profileId,
    account_code: accountCode,
    account_type: accountType || 'live',
    currency,
    balance: 0,
    status: 'active',
    trading_terms_id: tradingTermsId || null,
    has_trading_permission: true,
  })

  revalidatePath('/dashboard/accounts')
}

export async function resetUserPassword(userId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  const { data: authUser, error: userErr } = await supabase.auth.admin.getUserById(userId)
  if (userErr || !authUser.user?.email) return { error: userErr?.message ?? 'Email bulunamadı' }
  const email = authUser.user.email

  // Rastgele 12 karakterlik yeni şifre üret
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$'
  const newPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

  const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, { password: newPassword })
  if (updateErr) return { error: updateErr.message }

  // Resend ile e-posta gönder
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@yourdomain.com',
        to: email,
        subject: 'Şifreniz Güncellendi — TFG Istanbul',
        html: buildEmailHtml({
          heroTitle:    'Şifreniz Güncellendi',
          heroSubtitle: 'Hesabınız için yeni bir giriş şifresi oluşturuldu.',
          bodyText:     'Talebiniz doğrultusunda TFG Istanbul hesabınız için yeni bir şifre oluşturulmuştur. Aşağıdaki şifreyi kullanarak platformumuza giriş yapabilirsiniz.',
          password:     newPassword,
          ctaText:      'Giriş Yap',
          showSecurity: true,
        }),
      })
    } catch (mailErr: any) {
      console.error('[resetUserPassword] mail error:', mailErr.message)
    }
  }

  return {}
}

export async function disableUser2FA(userId: string): Promise<{ error?: string; removed?: number }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId })
  if (error) return { error: error.message }
  const factors = data?.factors ?? []
  if (factors.length === 0) return { removed: 0 }
  await Promise.all(
    factors.map((f) => supabase.auth.admin.mfa.deleteFactor({ userId, id: f.id }))
  )
  return { removed: factors.length }
}

export async function toggleProfileSuspend(profileId: string, suspend: boolean): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const newStatus = suspend ? 'suspended' : 'active'
  const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', profileId)
  if (error) return { error: error.message }
  await supabase.auth.admin.updateUserById(profileId, {
    ban_duration: suspend ? '876600h' : 'none',
  })
  revalidatePath('/dashboard')
  return {}
}

export async function updateAccountStatus(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const accountId = formData.get('account_id') as string
  const status    = formData.get('status') as string

  await supabase
    .from('trading_accounts')
    .update({ status })
    .eq('id', accountId)

  revalidatePath('/dashboard/accounts')
}
