import { getExtIpoApplications, cancelIpoApplication } from '@/actions/ipo'
import { PageContent }  from '@/components/layout/PageContent'
import { PageHeader }   from '@/components/layout/PageHeader'
import { SectionCard }  from '@/components/layout/SectionCard'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

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
  bekliyor: 'Bekliyor', dagitildi: 'Dağıtıldı', iptal: 'İptal',
}

export default async function ExtApplicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'platform.settings')
  if (!allowed) redirect('/unauthorized')

  const applications = await getExtIpoApplications()

  // Group by ticker
  const byTicker = applications.reduce<Record<string, typeof applications>>((acc, a) => {
    const key = a.ext_ticker ?? '—'
    acc[key] = acc[key] ?? []
    acc[key].push(a)
    return acc
  }, {})

  return (
    <PageContent>
      <PageHeader title="Harici Halka Arz Talepleri">
        <Link href="/dashboard/ipo" className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={13} />
          Halka Arz Listesi
        </Link>
      </PageHeader>

      <p className="text-[11px] text-muted-foreground mb-3">
        Bu sayfada kullanıcıların harici (API kaynaklı) halka arzlara verdiği talepler listeleniyor.
        Dağıtım yapmak için ilgili hisseyi admin panelinde <strong>Yeni Halka Arz</strong> olarak ekleyip oradan dağıtın.
      </p>

      {Object.keys(byTicker).length === 0 && (
        <SectionCard>
          <div className="px-3 py-10 text-center text-[12px] text-muted-foreground">Henüz harici talep yok.</div>
        </SectionCard>
      )}

      {Object.entries(byTicker).map(([ticker, apps]) => (
        <SectionCard key={ticker}>
          <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
            <span className="text-[13px] font-bold" style={{ color: 'var(--c-primary)' }}>{ticker}</span>
            <span className="text-[10px] text-muted-foreground">{apps[0]?.ext_name ?? ''} · {apps.length} başvuru · {apps.reduce((s, a) => s + (a.requested_lots ?? 0), 0)} lot talep</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-muted border-b border-border">
                {['Kullanıcı', 'Talep Lot', 'Durum', 'Tarih', 'İşlem'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apps.map((app, i) => (
                <tr key={app.id} className={`border-b border-border ${i % 2 === 1 ? 'bg-muted/30' : 'bg-card'}`}>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] font-semibold" style={{ color: 'var(--c-text-1)' }}>{app.profile?.first_name} {app.profile?.last_name}</span>
                      <span className="text-[10px] text-muted-foreground">{app.profile?.email}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[12px] font-bold tabular-nums" style={{ color: 'var(--c-text-1)' }}>{app.requested_lots}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[app.status] ?? STATUS_STYLES.bekliyor}`}>
                      {STATUS_LABELS[app.status] ?? app.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground whitespace-nowrap">{fDate(app.created_at)}</td>
                  <td className="px-3 py-2">
                    {app.status === 'bekliyor' && (
                      <form action={cancelIpoApplication}>
                        <input type="hidden" name="application_id" value={app.id} />
                        <button type="submit" className="text-[10px] font-semibold px-2 py-1 rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors cursor-pointer">
                          İptal
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      ))}
    </PageContent>
  )
}
