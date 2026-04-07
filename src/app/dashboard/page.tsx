import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

async function getDashboardData() {
  const supabase = createAdminClient()

  const safeCount = async (query: any): Promise<number> => {
    try { const { count } = await query; return count ?? 0 } catch { return 0 }
  }

  const [
    totalUsers,
    onlineCount,
    pendingDeposits,
    pendingWithdrawals,
    { data: rawAccounts, error: accErr },
    { data: rawOpenPositions },
    { data: rawClosedPositions },
    { data: rawTerms },
  ] = await Promise.all([
    safeCount(supabase.from('profiles').select('*', { count: 'exact', head: true })),
    safeCount(supabase.from('user_sessions').select('*', { count: 'exact', head: true }).eq('is_active', true).gte('last_active', new Date(Date.now() - 2 * 60 * 1000).toISOString())),
    safeCount(supabase.from('deposit_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    safeCount(supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    supabase.from('trading_accounts').select(`
      id, account_code, account_type, currency,
      balance, status, created_at,
      profiles!profile_id(id, first_name, last_name, email, customer_no, kyc_status)
    `).order('created_at', { ascending: false }).limit(1000),
    supabase.from('positions')
      .select('id, symbol, side, qty, avg_cost, pnl, opened_at, account_id, trading_accounts!account_id(account_code, currency), profiles!profile_id(first_name, last_name)')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(500),
    supabase.from('positions')
      .select('id, symbol, side, qty, avg_cost, close_price, pnl, swap, commission, opened_at, closed_at, trading_accounts!account_id(account_code, currency), profiles!profile_id(first_name, last_name)')
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(500),
    supabase.from('trading_terms').select('id, name').order('name'),
  ])

  if (accErr) console.error('[dashboard] accounts query error:', accErr.message, accErr.details)

  const accounts = (rawAccounts ?? []).map((a: any) => {
    const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
    return {
      id:           a.id,
      account_code: a.account_code,
      account_type: a.account_type ?? 'live',
      currency:     a.currency,
      balance:      Number(a.balance ?? 0),
      credit:       0,
      status:       a.status ?? 'active',
      profile: p ? {
        id:          p.id,
        first_name:  p.first_name  ?? null,
        last_name:   p.last_name   ?? null,
        email:       p.email       ?? null,
        customer_no: p.customer_no ?? null,
        kyc_status:  p.kyc_status  ?? null,
      } : null,
    }
  })

  const mapPosition = (p: any) => ({
    id:           p.id,
    symbol:       p.symbol,
    side:         p.side,
    qty:          Number(p.qty),
    avg_cost:     Number(p.avg_cost),
    leverage:     Number(p.leverage ?? 1),
    pnl:          p.pnl != null ? Number(p.pnl) : null,
    opened_at:    p.opened_at ?? null,
    account_id:   p.account_id ?? '',
    account_code: p.trading_accounts?.account_code ?? '—',
    currency:     p.trading_accounts?.currency ?? 'USD',
    profile_name: `${p.profiles?.first_name ?? ''} ${p.profiles?.last_name ?? ''}`.trim() || '—',
    used_margin:  Number(p.used_margin ?? 0),
  })

  const openPositions = (rawOpenPositions ?? []).map(mapPosition)

  const closedPositions = (rawClosedPositions ?? []).map((p: any) => ({
    id:           p.id,
    symbol:       p.symbol,
    side:         p.side,
    qty:          Number(p.qty),
    avg_cost:     Number(p.avg_cost),
    close_price:  p.close_price != null ? Number(p.close_price) : null,
    pnl:          p.pnl != null ? Number(p.pnl) : null,
    swap:         Number(p.swap ?? 0),
    commission:   Number(p.commission ?? 0),
    opened_at:    p.opened_at ?? null,
    closed_at:    p.closed_at ?? null,
    account_code: p.trading_accounts?.account_code ?? '—',
    currency:     p.trading_accounts?.currency ?? 'USD',
    profile_name: `${p.profiles?.first_name ?? ''} ${p.profiles?.last_name ?? ''}`.trim() || '—',
  }))

  const allTerms = (rawTerms ?? []).map((t: any) => ({ id: t.id, name: t.name }))

  return {
    accounts,
    openPositions,
    closedPositions,
    allTerms,
    stats: {
      totalUsers,
      onlineCount,
      pendingDeposits,
      pendingWithdrawals,
    },
  }
}

export default async function DashboardPage() {
  const { accounts, openPositions, closedPositions, allTerms, stats } = await getDashboardData()

  return (
    <DashboardClient
      accounts={accounts}
      openPositions={openPositions}
      closedPositions={closedPositions}
      allTerms={allTerms}
      stats={stats}
    />
  )
}
