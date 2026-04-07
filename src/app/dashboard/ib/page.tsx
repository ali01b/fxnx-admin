import { getIBList } from '@/actions/ib'
import { PageContent } from '@/components/layout/PageContent'
import { IBClient } from '@/components/ib/IBClient'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'

export default async function IBPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'ib.view')
  if (!allowed) redirect('/unauthorized')

  const ibs = await getIBList()
  return (
    <PageContent>
      <IBClient initialIBs={ibs} />
    </PageContent>
  )
}
