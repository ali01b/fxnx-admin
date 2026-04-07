import { getTradingTerms, duplicateTradingTerm } from '@/actions/trading-terms'
import { DeleteTermButton }  from '@/components/DeleteTermButton'
import { CreateTermModal }   from '@/components/CreateTermModal'
import { PageContent }       from '@/components/layout/PageContent'
import { PageHeader }        from '@/components/layout/PageHeader'
import { SectionCard }       from '@/components/layout/SectionCard'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function TradingTermsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'instruments.view')
  if (!allowed) redirect('/unauthorized')

  const terms = await getTradingTerms()

  return (
    <PageContent>
      <PageHeader title="Trading Terms">
        <CreateTermModal />
        <button className="text-[10px] font-semibold px-2.5 py-1 rounded bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors cursor-pointer">
          Export
        </button>
      </PageHeader>

      <SectionCard>
        <table className="w-full">
          <thead>
            <tr className="bg-muted border-b-2 border-border">
              {['Name', 'Description', 'Son Güncelleme', 'Hesaplar', 'İşlemler'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terms.map((term, i) => (
              <tr key={term.id} className={`border-b border-border ${i % 2 === 1 ? 'bg-muted/30' : 'bg-card'}`}>

                {/* Name */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {term.is_default && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded-sm bg-primary/10 text-primary tracking-wider">
                        DEFAULT
                      </span>
                    )}
                    <Link
                      href={`/dashboard/trading-terms/${term.id}`}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      {term.name}
                    </Link>
                  </div>
                </td>

                {/* Description */}
                <td className="px-3 py-2 text-[11px] text-muted-foreground">
                  {term.description ?? <span className="text-border">—</span>}
                </td>

                {/* Last Update */}
                <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                  {new Date(term.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                  {new Date(term.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </td>

                {/* Accounts */}
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(term.account_count ?? 0) > 0 ? 'text-[var(--c-bull)] bg-green-50' : 'text-muted-foreground bg-muted'}`}>
                    {term.account_count ?? 0}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    <Link
                      href={`/dashboard/trading-terms/${term.id}`}
                      className="text-[10px] font-semibold px-2 py-1 rounded bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                      Edit
                    </Link>
                    <form action={duplicateTradingTerm} className="inline">
                      <input type="hidden" name="id" value={term.id} />
                      <button
                        type="submit"
                        className="text-[10px] font-semibold px-2 py-1 rounded bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors cursor-pointer"
                      >
                        Duplicate
                      </button>
                    </form>
                    {!term.is_default && <DeleteTermButton id={term.id} name={term.name} />}
                  </div>
                </td>
              </tr>
            ))}
            {terms.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[12px] text-muted-foreground">
                  Trading term bulunamadı. İlk grubu oluşturun.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="border-t border-border px-3 py-1.5 bg-muted/30">
          <span className="text-[10px] text-muted-foreground">
            {terms.length} grup
          </span>
        </div>
      </SectionCard>
    </PageContent>
  )
}
