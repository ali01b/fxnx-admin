import { getIBDetail } from '@/actions/ib'
import { PageContent } from '@/components/layout/PageContent'
import { IBDetailClient } from '@/components/ib/IBDetailClient'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'

interface Props {
  params: Promise<{ id: string }>
}

export default async function IBDetailPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'ib.view')
  if (!allowed) redirect('/unauthorized')

  const { id } = await params
  const detail = await getIBDetail(id)
  if (!detail) notFound()
  return (
    <PageContent>
      <IBDetailClient detail={detail} />
    </PageContent>
  )
}
