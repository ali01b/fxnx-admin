import { getIpoListings } from '@/actions/ipo'
import { updateIpoStatus, deleteIpoListing } from '@/actions/ipo'
import { PageContent }  from '@/components/layout/PageContent'
import { PageHeader }   from '@/components/layout/PageHeader'
import { SectionCard }  from '@/components/layout/SectionCard'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  aktif:  { label: 'Aktif',   cls: 'bg-green-100 text-green-700 border border-green-200' },
  taslak: { label: 'Taslak',  cls: 'bg-blue-50 text-blue-600 border border-blue-200' },
  gecmis: { label: 'Geçmiş',  cls: 'bg-muted text-muted-foreground border border-border' },
}

const STATUS_OPTIONS = [
  { value: 'aktif',  label: 'Aktif'  },
  { value: 'taslak', label: 'Taslak' },
  { value: 'gecmis', label: 'Geçmiş' },
]

function fDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function IpoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'platform.settings')
  if (!allowed) redirect('/unauthorized')

  const listings = await getIpoListings()

  const counts = {
    aktif:  listings.filter(l => l.status === 'aktif').length,
    taslak: listings.filter(l => l.status === 'taslak').length,
    gecmis: listings.filter(l => l.status === 'gecmis').length,
  }

  return (
    <PageContent>
      <PageHeader title="Halka Arz Yönetimi">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/ipo/ext-applications"
            className="text-[11px] font-semibold px-3 py-1.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            Harici Talepler
          </Link>
          <Link
            href="/dashboard/ipo/create"
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />
            Yeni Halka Arz
          </Link>
        </div>
      </PageHeader>

      {/* Özet sayaçlar */}
      <div className="grid grid-cols-3 gap-2 my-2">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <div key={value} className="bg-card border border-border rounded px-4 py-3 flex flex-col gap-1">
            <span className="text-[22px] font-extrabold" style={{ color: value === 'aktif' ? 'var(--c-bull)' : value === 'taslak' ? 'var(--c-primary)' : 'var(--c-text-3)' }}>
              {counts[value as keyof typeof counts]}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <SectionCard>
        <table className="w-full">
          <thead>
            <tr className="bg-muted border-b-2 border-border">
              {['Şirket', 'Ticker', 'Durum', 'Başvuru', 'Borsa Girişi', 'Lot Fiyatı', 'Pazar', 'Durum Değiştir', 'İşlemler'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listings.map((item, i) => {
              const st = STATUS_LABELS[item.status] ?? STATUS_LABELS.taslak
              return (
                <tr key={item.id} className={`border-b border-border ${i % 2 === 1 ? 'bg-muted/30' : 'bg-card'}`}>

                  {/* Şirket */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {item.logo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.logo_url} alt="" className="w-6 h-6 rounded object-contain bg-muted" />
                      )}
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-1)' }}>
                        {item.name}
                      </span>
                    </div>
                  </td>

                  {/* Ticker */}
                  <td className="px-3 py-2">
                    <span className="text-[11px] font-bold font-mono" style={{ color: 'var(--c-primary)' }}>
                      {item.ticker}
                    </span>
                  </td>

                  {/* Durum rozeti */}
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>

                  {/* Başvuru tarihleri */}
                  <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    {fDate(item.basvuru_baslangic)} – {fDate(item.basvuru_bitis)}
                  </td>

                  {/* Borsa girişi */}
                  <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    {fDate(item.borsa_giris)}
                  </td>

                  {/* Lot fiyatı */}
                  <td className="px-3 py-2 text-[11px] font-mono tabular-nums text-muted-foreground">
                    {item.lot_fiyat != null ? `₺${item.lot_fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—'}
                  </td>

                  {/* Pazar */}
                  <td className="px-3 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                    {item.pazar ?? '—'}
                  </td>

                  {/* Hızlı durum değiştir */}
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {STATUS_OPTIONS.filter(s => s.value !== item.status).map(s => (
                        <form key={s.value} action={updateIpoStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value={s.value} />
                          <button
                            type="submit"
                            className="text-[10px] font-semibold px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground hover:bg-muted/80 whitespace-nowrap cursor-pointer transition-colors"
                          >
                            → {s.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>

                  {/* İşlemler */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/ipo/${item.id}/applications`}
                        className="text-[10px] font-semibold px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        Talepler
                      </Link>
                      <Link
                        href={`/dashboard/ipo/${item.id}`}
                        className="text-[10px] font-semibold px-2 py-1 rounded bg-primary text-white hover:bg-primary/90 transition-colors"
                      >
                        Düzenle
                      </Link>
                      <form action={deleteIpoListing}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors cursor-pointer"
                        >
                          Sil
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}

            {listings.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-[12px] text-muted-foreground">
                  Henüz halka arz kaydı yok.{' '}
                  <Link href="/dashboard/ipo/create" className="text-primary underline">
                    İlk kaydı oluşturun.
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="border-t border-border px-3 py-1.5 bg-muted/30">
          <span className="text-[10px] text-muted-foreground">{listings.length} kayıt</span>
        </div>
      </SectionCard>
    </PageContent>
  )
}
