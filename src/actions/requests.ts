'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { notifyUser } from './notify'
import { createIBCommissionIfApplicable } from './ib'

export async function getDepositRequests(status?: string) {
  const supabase = createAdminClient()
  let query = supabase
    .from('deposit_requests')
    .select(`
      id, account_id, profile_id, amount, currency, payment_method,
      iban, bank_name, sender_name, reference_no, status,
      aml_score, aml_flags, reviewed_by, reviewed_at,
      approved_by, approved_at, second_approval_by, second_approved_at,
      rejection_reason, note, created_at, updated_at,
      profiles!profile_id(id, first_name, last_name, email, customer_no)
    `)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) console.error('[getDepositRequests]', error.message)
  return data ?? []
}

export async function getWithdrawalRequests(status?: string) {
  const supabase = createAdminClient()
  let query = supabase
    .from('withdrawal_requests')
    .select(`
      id, account_id, profile_id, amount, currency, payment_method,
      iban, bank_name, account_holder, reference_no, status,
      aml_score, aml_flags, reviewed_by, reviewed_at,
      approved_by, approved_at, second_approval_by, second_approved_at,
      rejection_reason, note, created_at, updated_at,
      profiles!profile_id(id, first_name, last_name, email, customer_no)
    `)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) console.error('[getWithdrawalRequests]', error.message)
  return data ?? []
}

export async function approveDepositRequest(requestId: string, note?: string) {
  const supabase = createAdminClient()

  const { data: req, error: reqErr } = await supabase
    .from('deposit_requests')
    .select('id, account_id, profile_id, amount, currency, status')
    .eq('id', requestId)
    .single()

  if (reqErr || !req) {
    console.error('[approveDepositRequest] fetch error:', reqErr?.message)
    return { error: reqErr?.message ?? 'Talep bulunamadı' }
  }

  if (!req.account_id) {
    return { error: 'Hesap ID eksik' }
  }

  // Fetch current balance
  const { data: acc, error: accErr } = await supabase
    .from('trading_accounts')
    .select('balance, margin, profile_id')
    .eq('id', req.account_id)
    .single()

  if (accErr || !acc) {
    console.error('[approveDepositRequest] account fetch error:', accErr?.message)
    return { error: 'Hesap bulunamadı' }
  }

  const currentBalance = Number(acc.balance ?? 0)
  const amount = Number(req.amount)
  const newBalance = currentBalance + amount
  const currentMargin = Number(acc.margin ?? 0)

  // Update balance
  await supabase
    .from('trading_accounts')
    .update({ balance: newBalance, free_margin: newBalance - currentMargin })
    .eq('id', req.account_id)

  // Insert balance transaction
  try {
    await supabase.from('balance_transactions').insert({
      account_id: req.account_id,
      user_id: req.profile_id ?? null,
      type: 'deposit',
      amount,
      balance_before: currentBalance,
      balance_after: newBalance,
      source: 'bank',
      note: note || null,
    })
  } catch (_) { }

  // Update deposit request status
  await supabase
    .from('deposit_requests')
    .update({
      status: 'approved',
      approved_by: null,
      approved_at: new Date().toISOString(),
      note: note || null,
    })
    .eq('id', requestId)

  // Notify user
  if (req.profile_id) {
    const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    await notifyUser(req.profile_id, {
      type: 'deposit',
      title: 'Para Yatırma Talebiniz Onaylandı',
      body: `${fmt(amount)} ${req.currency ?? 'TRY'} tutarındaki para yatırma talebiniz onaylanmış ve hesabınıza aktarılmıştır. Güncel bakiyeniz: ${fmt(newBalance)} ${req.currency ?? 'TRY'}`,
      url: '/dashboard',
    })
  }

  // IB komisyonu (hata olursa yatırım onayını etkileme)
  if (req.profile_id) {
    try {
      await createIBCommissionIfApplicable(req.profile_id, req.id, amount, req.currency ?? 'TRY')
    } catch (_) { }
  }

  revalidatePath('/dashboard/requests')
  return { success: true }
}

export async function approveWithdrawalRequest(requestId: string, note?: string) {
  const supabase = createAdminClient()

  const { data: req, error: reqErr } = await supabase
    .from('withdrawal_requests')
    .select('id, account_id, profile_id, amount, currency, status')
    .eq('id', requestId)
    .single()

  if (reqErr || !req) {
    console.error('[approveWithdrawalRequest] fetch error:', reqErr?.message)
    return { error: reqErr?.message ?? 'Talep bulunamadı' }
  }

  if (!req.account_id) {
    return { error: 'Hesap ID eksik' }
  }

  // Fetch current balance
  const { data: acc, error: accErr } = await supabase
    .from('trading_accounts')
    .select('balance, margin, profile_id')
    .eq('id', req.account_id)
    .single()

  if (accErr || !acc) {
    console.error('[approveWithdrawalRequest] account fetch error:', accErr?.message)
    return { error: 'Hesap bulunamadı' }
  }

  const currentBalance = Number(acc.balance ?? 0)
  const amount = Number(req.amount)
  const newBalance = currentBalance - amount

  if (newBalance < 0) {
    return { error: 'Yetersiz bakiye' }
  }

  const currentMargin = Number(acc.margin ?? 0)

  // Update balance
  await supabase
    .from('trading_accounts')
    .update({ balance: newBalance, free_margin: newBalance - currentMargin })
    .eq('id', req.account_id)

  // Insert balance transaction
  try {
    await supabase.from('balance_transactions').insert({
      account_id: req.account_id,
      user_id: req.profile_id ?? null,
      type: 'withdrawal',
      amount,
      balance_before: currentBalance,
      balance_after: newBalance,
      source: 'admin',
      note: note || null,
    })
  } catch (_) { }

  // Update withdrawal request status
  await supabase
    .from('withdrawal_requests')
    .update({
      status: 'approved',
      approved_by: null,
      approved_at: new Date().toISOString(),
      note: note || null,
    })
    .eq('id', requestId)

  // Notify user
  if (req.profile_id) {
    const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    await notifyUser(req.profile_id, {
      type: 'withdrawal',
      title: 'Para Çekme Talebiniz Onaylandı',
      body: `${fmt(amount)} ${req.currency ?? 'TRY'} tutarındaki para çekme talebiniz onaylanmıştır. Güncel bakiyeniz: ${fmt(newBalance)} ${req.currency ?? 'TRY'}`,
      url: '/dashboard',
    })
  }

  revalidatePath('/dashboard/requests')
  return { success: true }
}

export async function rejectRequest(
  table: 'deposit_requests' | 'withdrawal_requests',
  requestId: string,
  reason: string
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from(table)
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) {
    console.error('[rejectRequest]', error.message)
    return { error: error.message }
  }

  revalidatePath('/dashboard/requests')
  return { success: true }
}

export async function addReviewNote(
  table: 'deposit_requests' | 'withdrawal_requests',
  requestId: string,
  note: string
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from(table)
    .update({
      note,
      status: 'reviewing',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) {
    console.error('[addReviewNote]', error.message)
    return { error: error.message }
  }

  revalidatePath('/dashboard/requests')
  return { success: true }
}
