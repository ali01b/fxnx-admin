import { getExternalApiIpos } from '@/actions/ipo'
import { PageContent }  from '@/components/layout/PageContent'
import { PageHeader }   from '@/components/layout/PageHeader'
import { SectionCard }  from '@/components/layout/SectionCard'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { ImportButton } from './ImportButton'

export const dynamic = 'force-dynamic'

export default async function IpoSyncPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'platform.settings')
  if (!allowed) redirect('/unauthorized')

  const { items, existingTickers } = await getExternalApiIpos()
  const existingSet = new Set(existingTickers)

  return (
    <PageContent>
      <PageHeader title="API Senkronizasyonu — Halka Arz">
        <Link
          href="/dashboard/ipo"
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={13} />
          Halka Arz Listesi
        </Link>
      </PageHeader>

      <p className="text-[11px] text-muted-foreground mb-3">
        Aşağıdaki liste harici API'den gelen halka arzları gösteriyor.
        İçe aktardığınız halka arz <strong>taslak</strong> olarak oluşturulur — yayınlamadan önce bilgileri düzenleyip durumu değiştirin.
      </p>

      <SectionCard>
        <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted-foreground">{items.length} halka arz bulundu</span>
          <span className="text-[10px] text-muted-foreground">
            {existingTickers.length} tanesi zaten içe aktarılmış
          </span>
        </div>

        {items.length === 0 && (
          <div className="px-3 py-10 text-center text-[12px] text-muted-foreground">
            API'den veri alınamadı.
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr className="bg-muted border-b border-border">
              {['Şirket', 'Ticker', 'Tarih Aralığı', 'Kategori', 'Kaynak', 'Durum', 'İşlem'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const imported   = existingSet.has(item.ticker?.toUpperCase())
              const isPast     = item.category === 'gecmis'
              const rowBg      = isPast
                ? 'bg-red-50/60'
                : i % 2 === 1 ? 'bg-muted/30' : 'bg-card'

              const CATEGORY_BADGE: Record<string, string> = {
                aktif:  'bg-sky-100 text-sky-700 border-sky-200',
                taslak: 'bg-blue-50 text-blue-600 border-blue-200',
                gecmis: 'bg-red-50 text-red-600 border-red-200',
              }
              const CATEGORY_LABEL: Record<string, string> = {
                aktif:  'Aktif',
                taslak: 'Taslak',
                gecmis: 'Geçmiş',
              }

              return (
                <tr key={item.ticker} className={`border-b border-border ${rowBg}`}>
                  {/* Şirket */}
                  <td className="px-3 py-2">
                    <span className={`text-[12px] font-semibold ${isPast ? 'text-red-700' : ''}`} style={isPast ? {} : { color: 'var(--c-text-1)' }}>
                      {item.name}
                    </span>
                    {item.badge && (
                      <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        {item.badge}
                      </span>
                    )}
                  </td>

                  {/* Ticker */}
                  <td className="px-3 py-2">
                    <span className="text-[12px] font-bold font-mono" style={{ color: 'var(--c-primary)' }}>
                      {item.ticker}
                    </span>
                  </td>

                  {/* Tarihler */}
                  <td className={`px-3 py-2 text-[11px] whitespace-nowrap ${isPast ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {item.dates || '—'}
                  </td>

                  {/* Kategori */}
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_BADGE[item.category] ?? CATEGORY_BADGE.taslak}`}>
                      {CATEGORY_LABEL[item.category] ?? item.category}
                    </span>
                  </td>

                  {/* Kaynak */}
                  <td className="px-3 py-2">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <ExternalLink size={10} />
                        Kaynak
                      </a>
                    ) : <span className="text-[10px] text-muted-foreground">—</span>}
                  </td>

                  {/* Durum */}
                  <td className="px-3 py-2">
                    {imported ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                        İçe Aktarıldı
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        Bekliyor
                      </span>
                    )}
                  </td>

                  {/* İşlem */}
                  <td className="px-3 py-2">
                    {imported ? (
                      <Link
                        href="/dashboard/ipo"
                        className="text-[10px] font-semibold px-2 py-1 rounded bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors"
                      >
                        Düzenle
                      </Link>
                    ) : (
                      <ImportButton
                        ticker={item.ticker}
                        name={item.name}
                        slug={item.slug}
                        dates={item.dates ?? ''}
                        url={item.url ?? ''}
                        badge={item.badge ?? ''}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </SectionCard>
    </PageContent>
  )
}
