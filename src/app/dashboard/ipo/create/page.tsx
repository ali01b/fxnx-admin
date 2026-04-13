import { createIpoListing } from '@/actions/ipo'
import { IpoForm }          from '@/components/ipo/IpoForm'
import { PageContent }      from '@/components/layout/PageContent'
import { PageHeader }       from '@/components/layout/PageHeader'
import { createClient }     from '@/lib/supabase/server'
import { checkPermission }  from '@/lib/auth-utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

export default async function IpoCreatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'platform.settings')
  if (!allowed) redirect('/unauthorized')

  return (
    <PageContent>
      <PageHeader
        left={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/ipo"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={13} />
              Halka Arz Listesi
            </Link>
            <span className="text-muted-foreground text-[11px]">/</span>
            <span className="text-[13px] font-bold text-foreground">Yeni Halka Arz</span>
          </div>
        }
      />

      <div className="mt-2 max-w-3xl">
        <IpoForm action={createIpoListing} mode="create" />
      </div>
    </PageContent>
  )
}
