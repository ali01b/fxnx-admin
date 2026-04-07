import { getDepositRequests, getWithdrawalRequests } from '@/actions/requests'
import { getPaymentAccounts } from '@/actions/payment-accounts'
import { RequestsClient } from '@/components/requests/RequestsClient'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'deposits.view')
  if (!allowed) redirect('/unauthorized')

  const [deposits, withdrawals, paymentAccounts] = await Promise.all([
    getDepositRequests(),
    getWithdrawalRequests(),
    getPaymentAccounts(),
  ])

  return <RequestsClient deposits={deposits} withdrawals={withdrawals} paymentAccounts={paymentAccounts} />
}
