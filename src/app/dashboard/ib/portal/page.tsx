import { createClient } from '@/lib/supabase/server'
import { getMyIBPortalData } from '@/actions/ib'
import { redirect } from 'next/navigation'
import { PageContent } from '@/components/layout/PageContent'
import { IBPortalClient } from '@/components/ib/IBPortalClient'

export default async function IBPortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await getMyIBPortalData(user.id)
  if (!data) redirect('/login')

  return (
    <PageContent>
      <IBPortalClient data={data} />
    </PageContent>
  )
}
