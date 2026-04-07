'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/* ─── refreshAccountMargin ───────────────────────────────────────────────────
   Hesabın tüm açık pozisyonlarının used_margin toplamını DB'ye yazar.
*/
async function refreshAccountMargin(supabase: ReturnType<typeof createAdminClient>, accountId: string): Promise<void> {
  const [posRes, accRes] = await Promise.all([
    supabase
      .from('positions')
      .select('used_margin')
      .eq('account_id', accountId)
      .eq('status', 'open'),
    supabase
      .from('trading_accounts')
      .select('balance')
      .eq('id', accountId)
      .single(),
  ])

  const totalMargin = (posRes.data ?? []).reduce((s, p: any) => s + Number(p.used_margin ?? 0), 0)
  const balance     = Number(accRes.data?.balance ?? 0)

  await supabase.from('trading_accounts').update({
    margin:      totalMargin,
    free_margin: balance - totalMargin,
  }).eq('id', accountId)
}

export async function createPosition(formData: FormData): Promise<void> {
  const supabase    = createAdminClient()
  const accountId   = formData.get('account_id') as string

  await supabase.from('positions').insert({
    profile_id:  formData.get('profile_id') as string,
    account_id:  accountId,
    symbol:      (formData.get('symbol') as string).toUpperCase().trim(),
    side:        'buy',
    qty:         Number(formData.get('qty')),
    avg_cost:    Number(formData.get('avg_cost')),
    leverage:    Number(formData.get('leverage'))   || 1,
    commission:  Number(formData.get('commission')) || 0,
    swap:        Number(formData.get('swap'))        || 0,
    used_margin: Number(formData.get('used_margin')) || 0,
    status:      'open',
    opened_at:   (formData.get('opened_at') as string) || new Date().toISOString(),
  })

  await refreshAccountMargin(supabase, accountId)
  revalidatePath('/dashboard/accounts')
}

export async function updatePosition(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const id       = formData.get('id') as string
  const status   = formData.get('status') as string

  const updates: Record<string, unknown> = {
    symbol:      (formData.get('symbol') as string).toUpperCase().trim(),
    side:        'buy',
    qty:         Number(formData.get('qty')),
    avg_cost:    Number(formData.get('avg_cost')),
    leverage:    Number(formData.get('leverage'))   || 1,
    commission:  Number(formData.get('commission')) || 0,
    swap:        Number(formData.get('swap'))        || 0,
    used_margin: Number(formData.get('used_margin')) || 0,
    opened_at:   formData.get('opened_at') as string,
  }

  if (status === 'closed') {
    updates.close_price = Number(formData.get('close_price')) || null
    updates.pnl         = Number(formData.get('pnl'))         || null
    updates.closed_at   = (formData.get('closed_at') as string) || null
  }

  await supabase.from('positions').update(updates).eq('id', id)

  // account_id'yi pozisyondan al, margin'i senkronize et
  const { data: pos } = await supabase
    .from('positions')
    .select('account_id')
    .eq('id', id)
    .single()
  if (pos?.account_id) await refreshAccountMargin(supabase, pos.account_id)

  revalidatePath('/dashboard/accounts')
}

export async function closePosition(formData: FormData): Promise<void> {
  const supabase   = createAdminClient()
  const id         = formData.get('id') as string
  const closePrice = Number(formData.get('close_price'))
  const pnl        = Number(formData.get('pnl'))
  const closedAt   = (formData.get('closed_at') as string) || new Date().toISOString()

  // Pozisyonu bul — used_margin ve account_id lazım
  const { data: pos } = await supabase
    .from('positions')
    .select('account_id, used_margin')
    .eq('id', id)
    .single()

  await supabase.from('positions').update({
    status:      'closed',
    close_price: closePrice,
    pnl,
    closed_at:   closedAt,
  }).eq('id', id)

  if (pos) {
    // Bakiyeye teminat + PnL iade et
    const { data: acc } = await supabase
      .from('trading_accounts')
      .select('balance')
      .eq('id', pos.account_id)
      .single()
    if (acc) {
      const returnAmount = Number(pos.used_margin) + pnl
      await supabase.from('trading_accounts')
        .update({ balance: acc.balance + returnAmount })
        .eq('id', pos.account_id)
    }

    await refreshAccountMargin(supabase, pos.account_id)
  }

  revalidatePath('/dashboard/accounts')
}

export async function closeAllPositions(formData: FormData): Promise<void> {
  const supabase  = createAdminClient()
  const accountId = formData.get('account_id') as string
  const pricesRaw = formData.get('prices') as string

  let priceMap: Record<string, number> = {}
  try { priceMap = JSON.parse(pricesRaw) } catch { /* ignore */ }

  const { data: openPositions } = await supabase
    .from('positions')
    .select('id, symbol, qty, avg_cost, side, used_margin')
    .eq('account_id', accountId)
    .eq('status', 'open')

  if (!openPositions?.length) return

  const now       = new Date().toISOString()
  let   totalPnl  = 0
  let   totalUsedMargin = 0

  await Promise.all(
    openPositions.map((pos) => {
      const cp   = priceMap[pos.symbol] ?? Number(pos.avg_cost)
      const pnl  = (cp - Number(pos.avg_cost)) * Number(pos.qty)
      totalPnl        += pnl
      totalUsedMargin += Number(pos.used_margin ?? 0)
      return supabase.from('positions').update({
        status:      'closed',
        close_price: cp,
        pnl,
        closed_at:   now,
      }).eq('id', pos.id)
    })
  )

  // Bakiyeye toplam teminat + PnL iade et
  const { data: acc } = await supabase
    .from('trading_accounts')
    .select('balance')
    .eq('id', accountId)
    .single()
  if (acc) {
    const returnAmount = totalUsedMargin + totalPnl
    await supabase.from('trading_accounts')
      .update({ balance: acc.balance + returnAmount })
      .eq('id', accountId)
  }

  await refreshAccountMargin(supabase, accountId)
  revalidatePath('/dashboard/accounts')
}
