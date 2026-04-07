import { getRoles } from '@/actions/roles'
import { PageContent } from '@/components/layout/PageContent'
import { RolesClient } from '@/components/roles/RolesClient'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'roles.manage')
  if (!allowed) redirect('/unauthorized')

  const roles = await getRoles()
  return (
    <PageContent>
      <RolesClient initialRoles={roles} />
    </PageContent>
  )
}
