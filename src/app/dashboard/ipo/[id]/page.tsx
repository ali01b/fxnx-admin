import { getIpoListing, updateIpoListing } from '@/actions/ipo'
import { IpoForm }         from '@/components/ipo/IpoForm'
import { PageContent }     from '@/components/layout/PageContent'
import { PageHeader }      from '@/components/layout/PageHeader'
import { createClient }    from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function IpoEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'platform.settings')
  if (!allowed) redirect('/unauthorized')

  const listing = await getIpoListing(id)
  if (!listing) notFound()

  const STATUS_LABELS: Record<string, string> = {
    aktif: 'Aktif', taslak: 'Taslak', gecmis: 'Geçmiş',
  }

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
            <span className="text-[13px] font-bold text-foreground">{listing.ticker} — {listing.name}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 bg-primary/10 text-primary">
              {STATUS_LABELS[listing.status] ?? listing.status}
            </span>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/ipo/${id}/applications`}
            className="text-[11px] font-semibold px-3 py-1.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            Talepleri Gör
          </Link>
          <span className="text-[10px] text-muted-foreground">
            Son güncelleme: {new Date(listing.updated_at).toLocaleDateString('tr-TR')} {new Date(listing.updated_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </PageHeader>

      <div className="mt-2 max-w-3xl">
        <IpoForm action={updateIpoListing} initial={listing} mode="edit" />
      </div>
    </PageContent>
  )
}
