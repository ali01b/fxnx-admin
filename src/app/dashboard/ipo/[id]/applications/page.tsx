import { getIpoListing, getIpoApplications, cancelIpoApplication } from '@/actions/ipo'
import { PageContent }  from '@/components/layout/PageContent'
import { PageHeader }   from '@/components/layout/PageHeader'
import { SectionCard }  from '@/components/layout/SectionCard'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { DistributeForm } from './DistributeForm'

export const dynamic = 'force-dynamic'

function fDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_STYLES: Record<string, string> = {
  bekliyor:  'bg-blue-50 text-blue-600 border border-blue-200',
  dagitildi: 'bg-green-100 text-green-700 border border-green-200',
  iptal:     'bg-muted text-muted-foreground border border-border',
}
const STATUS_LABELS: Record<string, string> = {
  bekliyor:  'Bekliyor',
  dagitildi: 'Dağıtıldı',
  iptal:     'İptal',
}

export default async function IpoApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'platform.settings')
  if (!allowed) redirect('/unauthorized')

  const [listing, applications] = await Promise.all([
    getIpoListing(id),
    getIpoApplications(id),
  ])
  if (!listing) notFound()

  const counts = {
    bekliyor:  applications.filter(a => a.status === 'bekliyor').length,
    dagitildi: applications.filter(a => a.status === 'dagitildi').length,
    iptal:     applications.filter(a => a.status === 'iptal').length,
  }

  const totalRequested  = applications.reduce((s, a) => s + (a.requested_lots ?? 0), 0)
  const totalAllocated  = applications.filter(a => a.status === 'dagitildi').reduce((s, a) => s + (a.allocated_lots ?? 0), 0)

  return (
    <PageContent>
      <PageHeader title={`Talepler — ${listing.ticker} ${listing.name}`}>
        <Link
          href={`/dashboard/ipo/${id}`}
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={13} />
          Halka Arza Dön
        </Link>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 my-2">
        {[
          { label: 'Toplam Başvuru', value: applications.length, color: 'var(--c-text-1)' },
          { label: 'Bekliyor', value: counts.bekliyor, color: 'var(--c-primary)' },
          { label: 'Dağıtıldı', value: counts.dagitildi, color: 'var(--c-bull)' },
          { label: 'Talep / Dağıtılan Lot', value: `${totalRequested} / ${totalAllocated}`, color: 'var(--c-text-1)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded px-4 py-3 flex flex-col gap-1">
            <span className="text-[20px] font-extrabold" style={{ color }}>{value}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <SectionCard>
        <table className="w-full">
          <thead>
            <tr className="bg-muted border-b-2 border-border">
              {['Kullanıcı', 'Talep Lot', 'Durum', 'Tarih', 'Dağıtım', 'İşlem'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applications.map((app, i) => {
              const st = app.status as string
              return (
                <tr key={app.id} className={`border-b border-border ${i % 2 === 1 ? 'bg-muted/30' : 'bg-card'}`}>

                  {/* Kullanıcı */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] font-semibold" style={{ color: 'var(--c-text-1)' }}>
                        {app.profile?.first_name} {app.profile?.last_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{app.profile?.email}</span>
                    </div>
                  </td>

                  {/* Talep Lot */}
                  <td className="px-3 py-2 text-[12px] font-bold tabular-nums" style={{ color: 'var(--c-text-1)' }}>
                    {app.requested_lots}
                  </td>

                  {/* Durum */}
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[st] ?? STATUS_STYLES.bekliyor}`}>
                      {STATUS_LABELS[st] ?? st}
                    </span>
                  </td>

                  {/* Talep tarihi */}
                  <td className="px-3 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                    {fDate(app.created_at)}
                  </td>

                  {/* Dağıtım bilgisi */}
                  <td className="px-3 py-2">
                    {app.status === 'dagitildi' ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[12px] font-bold text-green-600 tabular-nums">
                          {app.allocated_lots} lot
                        </span>
                        <span className="text-[10px] text-muted-foreground">{fDate(app.distributed_at)}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* İşlem */}
                  <td className="px-3 py-2">
                    {app.status === 'bekliyor' ? (
                      <div className="flex items-center gap-2">
                        <DistributeForm
                          applicationId={app.id}
                          defaultLots={app.requested_lots}
                          lotFiyat={listing.lot_fiyat}
                        />
                        <form action={cancelIpoApplication}>
                          <input type="hidden" name="application_id" value={app.id} />
                          <button
                            type="submit"
                            className="text-[10px] font-semibold px-2 py-1 rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors cursor-pointer"
                          >
                            İptal
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}

            {applications.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[12px] text-muted-foreground">
                  Henüz başvuru yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-border px-3 py-1.5 bg-muted/30">
          <span className="text-[10px] text-muted-foreground">{applications.length} başvuru</span>
        </div>
      </SectionCard>
    </PageContent>
  )
}
