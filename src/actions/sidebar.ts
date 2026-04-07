'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function getSidebarLiveData() {
  const supabase = createAdminClient()

  const { data: rawAccounts, error: accErr } = await supabase
    .from('trading_accounts')
    .select('id, account_code, currency, balance, profiles!profile_id(first_name, last_name)')
    .eq('status', 'active')
    .limit(500)

  if (accErr) console.error('[sidebar] accounts error:', accErr.message)

  const accounts = (rawAccounts ?? []).map((a: any) => {
    const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
    return {
      id:           a.id,
      account_code: a.account_code,
      currency:     a.currency,
      balance:      Number(a.balance ?? 0),
      profile: p ? { first_name: p.first_name ?? null, last_name: p.last_name ?? null } : null,
    }
  })

  const accountIds = accounts.map((a) => a.id)
  let positions: { account_id: string; symbol: string; side: string; qty: number; avg_cost: number }[] = []

  if (accountIds.length > 0) {
    const { data: rawPositions } = await supabase
      .from('positions')
      .select('account_id, symbol, side, qty, avg_cost')
      .in('account_id', accountIds)
      .eq('status', 'open')

    positions = (rawPositions ?? []).map((p: any) => ({
      account_id: p.account_id,
      symbol:     p.symbol,
      side:       p.side,
      qty:        Number(p.qty),
      avg_cost:   Number(p.avg_cost),
    }))
  }

  return { accounts, positions }
}
