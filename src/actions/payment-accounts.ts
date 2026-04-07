'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getPaymentAccounts() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('platform_payment_accounts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) console.error('[getPaymentAccounts]', error.message)
  return data ?? []
}

export async function createPaymentAccount(formData: FormData) {
  const supabase = createAdminClient()

  const type = formData.get('type') as string

  const payload: Record<string, unknown> = {
    type,
    label:      formData.get('label') as string,
    currency:   formData.get('currency') as string,
    is_active:  true,
  }

  if (type === 'bank') {
    payload.bank_name       = formData.get('bank_name') as string
    payload.account_holder  = formData.get('account_holder') as string
    payload.iban            = formData.get('iban') as string
    payload.description     = formData.get('description') as string || null
  } else if (type === 'crypto') {
    payload.coin           = formData.get('coin') as string
    payload.network        = formData.get('network') as string
    payload.wallet_address = formData.get('wallet_address') as string
  }

  const { error } = await supabase.from('platform_payment_accounts').insert(payload)
  if (error) {
    console.error('[createPaymentAccount]', error.message)
    return { error: error.message }
  }

  revalidatePath('/dashboard/payment-accounts')
  return { success: true }
}

export async function updatePaymentAccount(formData: FormData) {
  const supabase = createAdminClient()

  const id   = formData.get('id') as string
  const type = formData.get('type') as string

  if (!id) return { error: 'ID eksik' }

  const payload: Record<string, unknown> = {
    label:    formData.get('label') as string,
    currency: formData.get('currency') as string,
  }

  if (type === 'bank') {
    payload.bank_name      = formData.get('bank_name') as string
    payload.account_holder = formData.get('account_holder') as string
    payload.iban           = formData.get('iban') as string
    payload.description    = formData.get('description') as string || null
  } else if (type === 'crypto') {
    payload.coin           = formData.get('coin') as string
    payload.network        = formData.get('network') as string
    payload.wallet_address = formData.get('wallet_address') as string
  }

  const { error } = await supabase
    .from('platform_payment_accounts')
    .update(payload)
    .eq('id', id)

  if (error) {
    console.error('[updatePaymentAccount]', error.message)
    return { error: error.message }
  }

  revalidatePath('/dashboard/payment-accounts')
  return { success: true }
}

export async function togglePaymentAccount(id: string, isActive: boolean) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('platform_payment_accounts')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) {
    console.error('[togglePaymentAccount]', error.message)
    return { error: error.message }
  }

  revalidatePath('/dashboard/payment-accounts')
  return { success: true }
}

export async function deletePaymentAccount(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('platform_payment_accounts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[deletePaymentAccount]', error.message)
    return { error: error.message }
  }

  revalidatePath('/dashboard/payment-accounts')
  return { success: true }
}
