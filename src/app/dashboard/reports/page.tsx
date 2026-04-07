import { createAdminClient } from '@/lib/supabase/admin'
import { PageContent }       from '@/components/layout/PageContent'
import { PageHeader }        from '@/components/layout/PageHeader'
import { SectionCard }       from '@/components/layout/SectionCard'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'

export default async function ReportsPage() {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabaseAuth.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'platform.reports')
  if (!allowed) redirect('/unauthorized')

  const supabase = createAdminClient()

  const [
    { count: totalUsers },
    { count: totalPositions },
    { count: closedPositions },
    { data: accounts },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('positions').select('*', { count: 'exact', head: true }),
    supabase.from('positions').select('*', { count: 'exact', head: true }).eq('status', 'closed'),
    supabase.from('trading_accounts').select('balance, equity, margin, free_margin, currency'),
  ])

  const totalBalance = (accounts ?? []).reduce((s, a) => s + Number(a.balance ?? 0), 0)
  const totalEquity  = (accounts ?? []).reduce((s, a) => s + Number(a.equity  ?? 0), 0)
  const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 })

  const stats = [
    { label: 'Toplam Kullanıcı',  value: totalUsers ?? 0,                                      color: 'var(--c-primary)',  prefix: ''  },
    { label: 'Toplam Pozisyon',   value: totalPositions ?? 0,                                  color: 'var(--c-purple)',   prefix: ''  },
    { label: 'Kapalı Pozisyon',   value: closedPositions ?? 0,                                 color: 'var(--c-bull)',     prefix: ''  },
    { label: 'Açık Pozisyon',     value: (totalPositions ?? 0) - (closedPositions ?? 0),       color: 'var(--c-orange)',   prefix: ''  },
    { label: 'Toplam Bakiye',     value: fmt(totalBalance),                                    color: 'var(--c-primary)',  prefix: '₺' },
    { label: 'Toplam Equity',     value: fmt(totalEquity),                                     color: 'var(--c-bull)',     prefix: '₺' },
  ]

  const COMING_SOON = [
    'Kullanıcı Büyüme Raporu',
    'İşlem Hacmi Raporu',
    'KYC Durum Raporu',
    'Bakiye Dağılım Raporu',
  ]

  return (
    <PageContent>
      <PageHeader title="Raporlar">
        <button className="text-[10px] font-semibold px-2.5 py-1 rounded bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors cursor-pointer">
          Dışa Aktar
        </button>
      </PageHeader>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border p-4">
            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {s.label}
            </div>
            <div className="text-[22px] font-bold font-mono" style={{ color: s.color }}>
              {s.prefix}{s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon panels */}
      <div className="grid grid-cols-2 gap-2">
        {COMING_SOON.map((title) => (
          <SectionCard key={title} title={title}>
            <div className="flex items-center justify-center py-10 text-[11px] text-muted-foreground/50">
              Yakında...
            </div>
          </SectionCard>
        ))}
      </div>
    </PageContent>
  )
}
