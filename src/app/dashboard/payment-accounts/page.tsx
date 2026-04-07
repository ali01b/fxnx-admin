import { getPaymentAccounts } from '@/actions/payment-accounts'
import { PaymentAccountsClient } from '@/components/payment-accounts/PaymentAccountsClient'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PaymentAccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'platform.settings')
  if (!allowed) redirect('/unauthorized')

  const accounts = await getPaymentAccounts()
  return <PaymentAccountsClient accounts={accounts} />
}
