'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSidebarLiveData } from '@/actions/sidebar'
import { useQuoteStore, toYahooSymbol } from '@/stores/quoteStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SidebarAccount {
  id:           string
  account_code: string
  currency:     string
  balance:      number
  profile: { first_name: string | null; last_name: string | null } | null
}

interface PresenceUser {
  profile_id:   string
  name:         string
  email:        string
  customer_no:  string
  current_page: string
}

interface SidebarPosition {
  account_id: string
  symbol:     string
  side:       string
  qty:        number
  avg_cost:   number
}

interface Props {
  initialAccounts:  SidebarAccount[]
  initialPositions: SidebarPosition[]
  instrumentMap:    Record<string, string>  // DB sembol → kategori
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CURRENCY_SYM: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', TRY: '₺', BTC: '₿' }
const fmtAmt = (n: number, cur: string) =>
  (CURRENCY_SYM[cur] ?? '') + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function InitialsAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const parts    = name.trim().split(' ')
  const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  const hue      = [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 360
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `hsl(${hue},55%,48%)`, fontSize: size * 0.38 }}
    >
      {initials.toUpperCase() || '?'}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalSidebar({ initialAccounts, initialPositions, instrumentMap }: Props) {
  const [accounts,      setAccounts]      = useState(initialAccounts)
  const [openPositions, setOpenPositions] = useState<SidebarPosition[]>(initialPositions)
  const [onlineUsers,   setOnlineUsers]   = useState<PresenceUser[]>([])

  // ── Global WS subscription: tüm açık pozisyon sembollerine abone ol ──────
  // openPositions değişince (yeni işlem / kapanış) subscription güncellenir
  useEffect(() => {
    const store = useQuoteStore.getState()
    const uniqueSymbols = [...new Set(openPositions.map((p) => p.symbol))]
    const yahooSymbols  = uniqueSymbols
      .map((sym) => {
        const cat = instrumentMap[sym]
        return cat ? toYahooSymbol(sym, cat) : null
      })
      .filter((s): s is string => s !== null)

    if (yahooSymbols.length === 0) return
    store.subscribe(yahooSymbols)
    return () => store.unsubscribe(yahooSymbols)
  }, [openPositions, instrumentMap])

  useEffect(() => {
    const supabase = createClient()

    // ── Positions Realtime ────────────────────────────────────────────
    const posChannel = supabase
      .channel('sidebar-positions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'positions' }, (payload) => {
        const r = payload.new as any
        if (r.status !== 'open') return
        setOpenPositions((prev) => [...prev, {
          account_id: r.account_id, symbol: r.symbol, side: r.side,
          qty: Number(r.qty), avg_cost: Number(r.avg_cost),
        }])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'positions' }, (payload) => {
        const r = payload.new as any
        if (r.status === 'closed') {
          setOpenPositions((prev) => prev.filter((p) => !(p.account_id === r.account_id && p.symbol === r.symbol && p.side === r.side)))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'positions' }, (payload) => {
        const r = payload.old as any
        setOpenPositions((prev) => prev.filter((p) => !(p.account_id === r.account_id && p.symbol === r.symbol)))
      })
      .subscribe()

    // ── Presence: online kullanıcılar ─────────────────────────────────
    const presenceChannel = supabase.channel('online-users')
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<PresenceUser>()
        const seen  = new Map<string, PresenceUser>()
        for (const entries of Object.values(state)) {
          for (const entry of entries as PresenceUser[]) {
            if (entry.profile_id) seen.set(entry.profile_id, entry)
          }
        }
        setOnlineUsers(Array.from(seen.values()))
      })
      .subscribe()

    // ── Accounts: bakiye değişikliklerini izle ────────────────────────
    const accChannel = supabase
      .channel('sidebar-accounts')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trading_accounts' }, (payload) => {
        const row = payload.new as any
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === row.id ? { ...a, balance: Number(row.balance ?? a.balance) } : a
          )
        )
      })
      .subscribe()

    // ── Backup poll: 30s ──────────────────────────────────────────────
    const interval = setInterval(async () => {
      try {
        const { accounts: fresh, positions: freshPos } = await getSidebarLiveData()
        setAccounts(fresh)
        setOpenPositions(freshPos)
      } catch (e) {
        console.error('[Sidebar] poll error:', e)
      }
    }, 30_000)

    return () => {
      supabase.removeChannel(posChannel)
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(accChannel)
      clearInterval(interval)
    }
  }, [])

  // Açık pozisyonu olan hesaplar (account bazında gruplandır)
  const accountsWithPositions = useMemo(() => {
    const posMap = new Map<string, SidebarPosition[]>()
    for (const pos of openPositions) {
      const list = posMap.get(pos.account_id) ?? []
      list.push(pos)
      posMap.set(pos.account_id, list)
    }
    return accounts
      .filter((a) => posMap.has(a.id))
      .map((a) => ({ ...a, positions: posMap.get(a.id)! }))
      .slice(0, 30)
  }, [accounts, openPositions])

  return (
    <aside className="w-[280px] flex-shrink-0 border-l border-border flex flex-col overflow-hidden bg-card">

      {/* ── Açık Pozisyonlar ──────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden border-b border-border" style={{ maxHeight: '50%' }}>
        <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-border">
          <span className="text-[13px] font-bold text-foreground">Açık Pozisyonlar</span>
          {accountsWithPositions.length > 0 ? (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: 'var(--c-primary)', background: 'var(--c-primary)15', border: '1px solid var(--c-primary)30' }}
            >
              {openPositions.length} pozisyon
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" title="Açık pozisyon yok" />
          )}
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {accountsWithPositions.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-muted-foreground">Açık pozisyon bulunamadı.</div>
          ) : (
            <div className="divide-y divide-border">
              {accountsWithPositions.map((a) => (
                <Link
                  key={a.id}
                  href="/dashboard"
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-muted/40 transition-colors block"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold" style={{ color: 'var(--c-primary)' }}>
                      {a.account_code}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {a.profile?.first_name} {a.profile?.last_name}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-[11px] font-bold text-foreground">{fmtAmt(a.balance, a.currency)}</div>
                    <div className="text-[10px] text-muted-foreground">{a.positions.length} pozisyon</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Online Kullanıcılar (Presence) ───────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-border">
          <span className="text-[13px] font-bold text-foreground">Online</span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ color: 'var(--c-bull)', background: 'var(--c-bull)15', border: '1px solid var(--c-bull)30' }}
          >
            {onlineUsers.length} aktif
          </span>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {onlineUsers.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-muted-foreground">Online kullanıcı yok.</div>
          ) : (
            <div className="divide-y divide-border">
              {onlineUsers.map((u) => {
                const name = u.name || 'Kullanıcı'
                return (
                  <Link
                    key={u.profile_id}
                    href="/dashboard"
                    className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition-colors block"
                  >
                    <div className="relative flex-shrink-0">
                      <InitialsAvatar name={name} size={30} />
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 ring-1 ring-background" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-foreground truncate">{name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {u.email || u.customer_no || '—'}
                      </div>
                    </div>
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap"
                      style={{ background: 'var(--c-primary)15', color: 'var(--c-primary)' }}
                    >
                      {u.current_page}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </aside>
  )
}
