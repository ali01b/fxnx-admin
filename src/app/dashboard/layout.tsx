import { createClient }        from '@/lib/supabase/server'
import { TopNav }               from '@/components/TopNav'
import { GlobalSidebar }        from '@/components/layout/GlobalSidebar'
import { QuoteProvider }        from '@/providers/QuoteProvider'
import { getSidebarLiveData }   from '@/actions/sidebar'
import { getUserPermissions }   from '@/lib/auth-utils'
import type { Permission }      from '@/lib/permissions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile, error: dbError }, sidebarData, { data: ibProfile }] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, email, role').eq('id', user?.id ?? '').single(),
    getSidebarLiveData(),
    supabase.from('ib_profiles').select('id').eq('profile_id', user?.id ?? '').maybeSingle(),
  ])

  const isAdmin  = ['admin', 'superadmin'].includes(profile?.role ?? '')
  const isIBUser = !!ibProfile && !isAdmin

  // Staff ise izinlerini çek, admin ise hepsine sahip
  const permissions: Permission[] = isAdmin
    ? []  // boş = admin → tüm nav görünür
    : await getUserPermissions(user?.id ?? '')

  const now         = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const userName    = profile ? `${profile.first_name} ${profile.last_name}` : 'Admin'
  const dbConnected = !dbError

  const { accounts, positions } = sidebarData

  // IB kullanıcısı için sade layout
  if (isIBUser) {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--c-bg)' }}>
        <header className="h-14 flex-shrink-0 bg-card border-b border-border flex items-center px-6 gap-4 z-40">
          <span className="text-[15px] font-extrabold tracking-tight" style={{ color: 'var(--c-primary)' }}>
            Bluedot
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            IB Portal
          </span>
          <div className="flex-1" />
          <span className="text-[13px] font-medium text-foreground">{userName}</span>
        </header>
        <main className="flex-1 overflow-auto min-h-0">
          {children}
        </main>
      </div>
    )
  }

  return (
    <QuoteProvider>
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--c-bg)' }}>
        <TopNav
          userName={userName}
          userEmail={profile?.email ?? ''}
          now={now}
          dbConnected={dbConnected}
          isAdmin={isAdmin}
          permissions={permissions}
        />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <main className="flex-1 overflow-auto min-h-0">
            {children}
          </main>
          <GlobalSidebar initialAccounts={accounts} initialPositions={positions} />
        </div>
      </div>
    </QuoteProvider>
  )
}
