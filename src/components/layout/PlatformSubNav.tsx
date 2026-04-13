'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, ScrollText, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard/platform-settings', label: 'Platform Ayarları', icon: Settings2,  exact: true  },
  { href: '/dashboard/instruments',        label: 'Enstrümanlar',       icon: BarChart3,  exact: false },
  { href: '/dashboard/trading-terms',      label: 'İşlem Koşulları',    icon: ScrollText, exact: false },
]

export function PlatformSubNav() {
  const pathname = usePathname()

  return (
    <div className="bg-card border-b border-border flex items-center px-3 gap-0.5 flex-shrink-0">
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium relative transition-colors',
              active
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon size={13} strokeWidth={active ? 2.2 : 1.8} />
            {label}
            {active && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-t" />
            )}
          </Link>
        )
      })}
    </div>
  )
}
