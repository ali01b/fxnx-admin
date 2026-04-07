'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, ScrollText,
  BarChart3, Bell, Settings,
  LogOut, Zap, ClipboardList,
  Users2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/actions/auth'
import { useQuoteStore } from '@/stores/quoteStore'
import type { Permission } from '@/lib/permissions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'


/* ── Navigasyon öğeleri ────────────────────────────────────────────────── */
// permission: null = herkese göster, string = sadece o izne sahip olanlar
const PRIMARY_NAV: { href: string; label: string; exact: boolean; icon: React.ElementType; permission: Permission | null }[] = [
  { href: '/dashboard',                   label: 'Ana Sayfa',         exact: true,  icon: LayoutDashboard, permission: null                },
  { href: '/dashboard/instruments',       label: 'Enstrümanlar',      exact: false, icon: BarChart3,       permission: 'instruments.view'  },
  { href: '/dashboard/trading-terms',     label: 'İşlem Koşulları',   exact: false, icon: ScrollText,      permission: 'instruments.view'  },
  { href: '/dashboard/requests',          label: 'Talepler',          exact: false, icon: ClipboardList,   permission: 'deposits.view'     },
  { href: '/dashboard/notifications',     label: 'Bildirimler',       exact: false, icon: Bell,            permission: 'platform.settings' },
  { href: '/dashboard/platform-settings', label: 'Platform Ayarları', exact: false, icon: Settings,        permission: 'platform.settings' },
  { href: '/dashboard/ib',                label: 'IB Yönetimi',       exact: false, icon: Users2,          permission: 'ib.view'           },
]

/* ── Props ─────────────────────────────────────────────────────────────── */
interface TopNavProps {
  userName:    string
  userEmail:   string
  now:         string
  dbConnected: boolean
  isAdmin:     boolean
  permissions: Permission[]
}

export function TopNav({ userName, userEmail, now: initialNow, dbConnected, isAdmin, permissions }: TopNavProps) {
  const pathname = usePathname()
  const [time, setTime] = useState(initialNow)
  const quoteStatus = useQuoteStore((s) => s.status)

  const visibleNav = PRIMARY_NAV.filter(item =>
    isAdmin || item.permission === null || permissions.includes(item.permission)
  )

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const initials = userName
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const sseOk  = quoteStatus === 'connected'

  return (
    <header className="h-14 flex-shrink-0 bg-card border-b border-border flex items-center px-4 gap-0 z-40">

      {/* ── Logo ── */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-6 flex-shrink-0 group">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
          <Zap size={13} className="text-primary-foreground" fill="currentColor" />
        </div>
        <span className="text-[15px] font-extrabold tracking-tight" style={{ color: 'var(--c-primary)' }}>
          Bluedot
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-widest hidden sm:block" style={{ color: 'var(--c-text-3)' }}>
          Admin
        </span>
      </Link>

      {/* ── Dikey ayırıcı ── */}
      <span className="w-px h-5 bg-border mr-4 flex-shrink-0" />

      {/* ── Primary nav ── */}
      <nav className="flex items-center gap-0.5 flex-1 min-w-0">
        {visibleNav.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors relative flex-shrink-0',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground font-medium'
              )}
            >
              <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{item.label}</span>
            </Link>
          )
        })}

      </nav>

      {/* ── Sağ bölüm ── */}
      <div className="flex items-center gap-3 ml-4 flex-shrink-0">

        {/* DB durumu */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full flex-shrink-0',
              dbConnected ? 'bg-green-500' : 'bg-destructive'
            )}
          />
          <span className="text-[11px] font-medium hidden md:block" style={{ color: 'var(--c-text-3)' }}>
            {dbConnected ? 'DB' : 'DB ✕'}
          </span>
        </div>

        <span className="w-px h-4 bg-border" />

        {/* Bağlantı durumu + saat */}
        <div className="flex items-center gap-2">
          <span
            title={quoteStatus === 'connected' ? 'Canlı veri akışı aktif' : quoteStatus === 'connecting' ? 'Bağlanıyor...' : 'Bağlantı hatası'}
            className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', {
              'bg-green-500 animate-pulse': quoteStatus === 'connected',
              'bg-yellow-400':             quoteStatus === 'connecting' || quoteStatus === 'idle',
              'bg-red-500':                quoteStatus === 'error',
            })}
          />
          <span className="text-[12px] tabular-nums hidden md:block" style={{ color: 'var(--c-text-3)', letterSpacing: '0.3px' }}>
            {time}
          </span>
        </div>

        <span className="w-px h-4 bg-border" />

        {/* Kullanıcı dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 outline-none group">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-opacity group-hover:opacity-80"
              style={{
                background: 'var(--c-primary-soft)',
                border: '1.5px solid var(--c-primary-border)',
                color: 'var(--c-primary)',
              }}
            >
              {initials}
            </div>
            <span className="text-[13px] font-medium hidden lg:block" style={{ color: 'var(--c-text-1)' }}>
              {userName.split(' ')[0]}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--c-text-1)' }}>{userName}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-3)' }}>{userEmail}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-0">
              <form action={logout} className="w-full">
                <button
                  type="submit"
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-[13px] cursor-pointer text-destructive hover:text-destructive"
                >
                  <LogOut size={13} />
                  Çıkış Yap
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
