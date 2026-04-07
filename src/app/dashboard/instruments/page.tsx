import { getInstruments, getCategoryCounts } from '@/actions/instruments'
import { InstrumentsClient } from '@/components/InstrumentsClient'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function InstrumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string; page?: string; sort?: string; sortDir?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'instruments.view')
  if (!allowed) redirect('/unauthorized')

  const sp       = await searchParams
  const category = sp.category ?? 'all'
  const search   = sp.search ?? ''
  const page     = Number(sp.page ?? 1)
  const sort     = sp.sort ?? ''
  const sortDir  = (sp.sortDir === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'

  const [{ instruments, total }, counts, { data: terms }] = await Promise.all([
    getInstruments({ category: category !== 'all' ? category : undefined, search, page, sort, sortDir }),
    getCategoryCounts(),
    createAdminClient().from('trading_terms').select('id, name').order('name'),
  ])

  return (
    <InstrumentsClient
      instruments={instruments ?? []}
      total={total}
      page={page}
      category={category}
      search={search}
      counts={counts}
      allTerms={terms ?? []}
      sort={sort}
      sortDir={sortDir}
    />
  )
}
