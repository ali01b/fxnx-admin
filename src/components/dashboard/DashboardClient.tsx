'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getAccountDetail } from '@/actions/accounts'
import { AccountDetailPanel } from '@/components/account-detail'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'

// ── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id:           string
  account_code: string
  account_type: string
  currency:     string
  balance:      number
  credit:       number
  status:       string
  profile: {
    id:          string
    first_name:  string | null
    last_name:   string | null
    email:       string | null
    customer_no: string | null
    kyc_status:  string | null
  } | null
}

interface OpenPosition {
  id:           string
  symbol:       string
  side:         string
  qty:          number
  avg_cost:     number
  pnl:          number | null
  opened_at:    string | null
  account_code: string
  account_id:   string
  currency:     string
  profile_name: string
}

interface ClosedPosition {
  id:           string
  symbol:       string
  side:         string
  qty:          number
  avg_cost:     number
  close_price:  number | null
  pnl:          number | null
  swap:         number
  commission:   number
  opened_at:    string | null
  closed_at:    string | null
  account_code: string
  currency:     string
  profile_name: string
}

interface Stats {
  totalUsers:         number
  onlineCount:        number
  pendingDeposits:    number
  pendingWithdrawals: number
}

interface Props {
  accounts:        Account[]
  openPositions:   OpenPosition[]
  closedPositions: ClosedPosition[]
  stats:           Stats
  allTerms:        { id: string; name: string }[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CURRENCY_SYM: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', TRY: '₺', BTC: '₿' }
const fmtAmt = (n: number, cur?: string) =>
  (CURRENCY_SYM[cur ?? ''] ?? '') + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const KYC_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  approved: { color: 'var(--c-bull)',    bg: 'var(--c-bull)15',   label: 'Onaylandı'     },
  pending:  { color: 'var(--c-amber)',   bg: 'var(--c-amber)15',  label: 'Beklemede'     },
  none:     { color: 'var(--c-text-3)', bg: 'var(--c-text-3)10', label: 'Doğrulanmamış' },
  rejected: { color: 'var(--c-bear)',   bg: 'var(--c-bear)15',   label: 'Reddedildi'    },
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  active:    { color: 'var(--c-bull)',   bg: 'var(--c-bull)15'  },
  suspended: { color: 'var(--c-orange)', bg: 'var(--c-orange)15' },
  closed:    { color: 'var(--c-bear)',   bg: 'var(--c-bear)15'  },
  pending:   { color: 'var(--c-amber)',  bg: 'var(--c-amber)15' },
}

function ColorBadge({ value, map }: { value: string; map: Record<string, { color: string; bg: string; label?: string }> }) {
  const s = map[value] ?? { color: 'var(--c-text-3)', bg: 'transparent' }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}30` }}>
      {(s as any).label ?? value}
    </span>
  )
}

function InitialsAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const parts    = name.trim().split(' ')
  const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  const hue      = [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 360
  return (
    <span className="inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `hsl(${hue},55%,48%)`, fontSize: size * 0.38 }}>
      {initials.toUpperCase() || '?'}
    </span>
  )
}

function SideToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [
    { key: 'all',  label: 'Tümü' },
    { key: 'buy',  label: 'Alış' },
  ]
  return (
    <div className="flex items-center rounded-lg border border-border overflow-hidden h-8">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="px-3 text-[11px] font-semibold h-full transition-colors cursor-pointer"
          style={{
            background: value === o.key ? 'var(--c-primary)' : 'transparent',
            color:      value === o.key ? 'white' : 'var(--c-text-3)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 text-[11px] px-2 rounded-lg border border-border bg-background text-foreground cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

// ── Flash hook ────────────────────────────────────────────────────────────────


export function DashboardClient({ accounts: initialAccounts, openPositions: initialOpenPositions, closedPositions: initialClosedPositions, stats, allTerms }: Props) {

  // ── State ─────────────────────────────────────────────────────────
  const [accounts,        setAccounts]        = useState(initialAccounts)
  const [openPositions,   setOpenPositions]   = useState(initialOpenPositions)
  const [closedPositions]                     = useState(initialClosedPositions)

  // ── Live stats (Realtime ile güncellenir) ──────────────────────────
  const [totalUsers,   setTotalUsers]   = useState(stats.totalUsers)
  const [onlineCount,  setOnlineCount]  = useState(stats.onlineCount)

  // Accounts filters
  const [accCurrency,   setAccCurrency]   = useState('')
  const [accKyc,        setAccKyc]        = useState('')
  const [accStatus,     setAccStatus]     = useState('')
  const [accSearch,     setAccSearch]     = useState('')

  // Open positions filters
  const [openSymbol,    setOpenSymbol]    = useState('')
  const [openSide,      setOpenSide]      = useState('all')

  // Closed positions filters
  const [closedSymbol,  setClosedSymbol]  = useState('')
  const [closedSide,    setClosedSide]    = useState('all')
  const [closedDateFrom, setClosedDateFrom] = useState('')
  const [closedDateTo,   setClosedDateTo]   = useState('')

  // Detail modal
  const [selectedId,     setSelectedId]     = useState<string | null>(null)
  const [detailData,     setDetailData]     = useState<Awaited<ReturnType<typeof getAccountDetail>> | null>(null)
  const [detailLoading,  setDetailLoading]  = useState(false)
  const [detailPosTab,        setDetailPosTab]        = useState<'open' | 'pending' | 'closed' | 'transactions' | undefined>(undefined)
  const [detailEditPositionId, setDetailEditPositionId] = useState<string | undefined>(undefined)

  // ── Realtime: incremental updates (no full re-fetch) ──────────────
  useEffect(() => {
    const supabase = createClient()

    // İlk yükleme — sadece bir kez
    const initialLoad = async () => {
      const [posRes, accRes] = await Promise.all([
        supabase
          .from('positions')
          .select('id, symbol, side, qty, avg_cost, pnl, opened_at, account_id, trading_accounts!account_id(account_code, currency), profiles!profile_id(first_name, last_name)')
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(300),
        supabase
          .from('trading_accounts')
          .select('id, account_code, account_type, currency, balance, status, created_at, profiles!profile_id(id, first_name, last_name, email, customer_no, kyc_status)')
          .order('created_at', { ascending: false })
          .limit(1000),
      ])
      if (posRes.data) {
        setOpenPositions(posRes.data.map((p: any) => ({
          id: p.id, symbol: p.symbol, side: p.side,
          qty: Number(p.qty), avg_cost: Number(p.avg_cost),
          pnl: p.pnl != null ? Number(p.pnl) : null,
          opened_at:    p.opened_at,
          account_id:   p.account_id ?? '',
          account_code: p.trading_accounts?.account_code ?? '—',
          currency:     p.trading_accounts?.currency ?? 'USD',
          profile_name: `${p.profiles?.first_name ?? ''} ${p.profiles?.last_name ?? ''}`.trim() || '—',
        })))
      }
      if (accRes.data) {
        setAccounts(accRes.data.map((a: any) => {
          const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
          return {
            id: a.id, account_code: a.account_code,
            account_type: a.account_type ?? 'live', currency: a.currency,
            balance: Number(a.balance ?? 0),
            credit: 0, status: a.status ?? 'active',
            profile: p ? { id: p.id, first_name: p.first_name ?? null, last_name: p.last_name ?? null, email: p.email ?? null, customer_no: p.customer_no ?? null, kyc_status: p.kyc_status ?? null } : null,
          }
        }))
      }
    }
    initialLoad()

    // ── positions: incremental ─────────────────────────────────────
    const posChannel = supabase
      .channel('rt-positions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'positions' }, async (payload) => {
        const row = payload.new as any
        if (row.status !== 'open') return
        // join verisi yok, tek satır çek
        const { data } = await supabase
          .from('positions')
          .select('id, symbol, side, qty, avg_cost, pnl, opened_at, account_id, trading_accounts!account_id(account_code, currency), profiles!profile_id(first_name, last_name)')
          .eq('id', row.id)
          .single()
        if (!data) return
        const p = data as any
        setOpenPositions((prev) => [{
          id: p.id, symbol: p.symbol, side: p.side,
          qty: Number(p.qty), avg_cost: Number(p.avg_cost),
          pnl: p.pnl != null ? Number(p.pnl) : null,
          opened_at:    p.opened_at,
          account_id:   p.account_id ?? '',
          account_code: p.trading_accounts?.account_code ?? '—',
          currency:     p.trading_accounts?.currency ?? 'USD',
          profile_name: `${p.profiles?.first_name ?? ''} ${p.profiles?.last_name ?? ''}`.trim() || '—',
        }, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'positions' }, (payload) => {
        const row = payload.new as any
        if (row.status === 'closed') {
          // Kapatıldı → listeden çıkar
          setOpenPositions((prev) => prev.filter((p) => p.id !== row.id))
        } else {
          // Güncellendi → sadece o satırı güncelle
          setOpenPositions((prev) => prev.map((p) =>
            p.id === row.id
              ? { ...p, qty: Number(row.qty), avg_cost: Number(row.avg_cost), pnl: row.pnl != null ? Number(row.pnl) : null }
              : p
          ))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'positions' }, (payload) => {
        setOpenPositions((prev) => prev.filter((p) => p.id !== (payload.old as any).id))
      })
      .subscribe()

    // ── trading_accounts: incremental ─────────────────────────────
    const accChannel = supabase
      .channel('rt-accounts')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trading_accounts' }, (payload) => {
        const row = payload.new as any
        setAccounts((prev) => prev.map((a) =>
          a.id === row.id
            ? { ...a, balance: Number(row.balance ?? a.balance), status: row.status ?? a.status }
            : a
        ))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trading_accounts' }, async (payload) => {
        const { data } = await supabase
          .from('trading_accounts')
          .select('id, account_code, account_type, currency, balance, status, created_at, profiles!profile_id(id, first_name, last_name, email, customer_no, kyc_status)')
          .eq('id', (payload.new as any).id)
          .single()
        if (!data) return
        const a = data as any
        const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
        setAccounts((prev) => [{
          id: a.id, account_code: a.account_code, account_type: a.account_type ?? 'live',
          currency: a.currency, balance: Number(a.balance ?? 0),
          credit: 0, status: a.status ?? 'active',
          profile: p ? { id: p.id, first_name: p.first_name ?? null, last_name: p.last_name ?? null, email: p.email ?? null, customer_no: p.customer_no ?? null, kyc_status: p.kyc_status ?? null } : null,
        }, ...prev])
        setTotalUsers((n) => n + 1)
      })
      .subscribe()

    // ── profiles: kyc_status değişince accounts listesini güncelle ─
    const profileChannel = supabase
      .channel('rt-profiles-kyc')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const row = payload.new as any
        setAccounts((prev) => prev.map((a) =>
          a.profile?.id === row.id
            ? { ...a, profile: { ...a.profile!, kyc_status: row.kyc_status ?? null }, status: row.status ?? a.status }
            : a
        ))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(posChannel)
      supabase.removeChannel(accChannel)
      supabase.removeChannel(profileChannel)
    }
  }, [])

  // ── Detail modal ─────────────────────────────────────────────────
  const openDetail = useCallback(async (id: string, posTab?: 'open' | 'pending' | 'closed' | 'transactions', editPositionId?: string) => {
    setSelectedId(id)
    setDetailPosTab(posTab)
    setDetailEditPositionId(editPositionId)
    setDetailLoading(true)
    try {
      const result = await getAccountDetail(id)
      setDetailData(result)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const refreshDetail = useCallback(async (id: string) => {
    try {
      const result = await getAccountDetail(id)
      setDetailData(result)
    } catch { /* ignore */ }
  }, [])

  const closeDetail = useCallback(() => {
    setSelectedId(null)
    setDetailData(null)
    setDetailPosTab(undefined)
    setDetailEditPositionId(undefined)
  }, [])

  // ── Derived ───────────────────────────────────────────────────────
  const uniqueCurrencies = useMemo(() =>
    [...new Set(accounts.map((a) => a.currency).filter(Boolean))].sort()
  , [accounts])

  const filteredAccounts = useMemo(() => {
    let list = accounts
    if (accSearch) {
      const q = accSearch.toLowerCase().trim()
      list = list.filter((a) =>
        a.account_code.toLowerCase().includes(q) ||
        `${a.profile?.first_name ?? ''} ${a.profile?.last_name ?? ''}`.toLowerCase().includes(q) ||
        (a.profile?.email ?? '').toLowerCase().includes(q) ||
        (a.profile?.customer_no ?? '').toLowerCase().includes(q)
      )
    }
    if (accCurrency) list = list.filter((a) => a.currency === accCurrency)
    if (accKyc)      list = list.filter((a) => (a.profile?.kyc_status ?? 'none') === accKyc)
    if (accStatus)   list = list.filter((a) => a.status === accStatus)
    return list
  }, [accounts, accSearch, accCurrency, accKyc, accStatus])

  const filteredOpenPositions = useMemo(() => {
    let list = openPositions
    if (openSymbol) {
      const q = openSymbol.toLowerCase().trim()
      list = list.filter((p) => p.symbol.toLowerCase().includes(q))
    }
    if (openSide !== 'all') list = list.filter((p) => p.side === openSide)
    return list
  }, [openPositions, openSymbol, openSide])

  const filteredClosedPositions = useMemo(() => {
    let list = closedPositions
    if (closedSymbol) {
      const q = closedSymbol.toLowerCase().trim()
      list = list.filter((p) => p.symbol.toLowerCase().includes(q))
    }
    if (closedSide !== 'all') list = list.filter((p) => p.side === closedSide)
    if (closedDateFrom) {
      const from = new Date(closedDateFrom).getTime()
      list = list.filter((p) => p.closed_at && new Date(p.closed_at).getTime() >= from)
    }
    if (closedDateTo) {
      const to = new Date(closedDateTo).getTime() + 86400000
      list = list.filter((p) => p.closed_at && new Date(p.closed_at).getTime() <= to)
    }
    return list
  }, [closedPositions, closedSymbol, closedSide, closedDateFrom, closedDateTo])

  // ── Stat cards ────────────────────────────────────────────────────
  const statItems = [
    { label: 'TOPLAM KULLANICI',  value: totalUsers,               color: undefined,          href: undefined },
    { label: 'ONLİNE KULLANICI',  value: onlineCount,              color: 'var(--c-bull)',    href: undefined },
    { label: 'BEKLEYEN YATIRIM',  value: stats.pendingDeposits,    color: undefined,          href: undefined },
    { label: 'BEKLEYEN ÇEKİM',    value: stats.pendingWithdrawals, color: undefined,          href: undefined },
    { label: 'AÇIK POZİSYON',     value: openPositions.length,     color: 'var(--c-primary)', href: undefined },
  ]

  return (
    <>
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[18px] font-bold text-foreground tracking-tight">İşlem Yönetimi</h1>
          </div>
          <span className="text-[12px] text-muted-foreground">
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {statItems.map((s) => {
            const inner = (
              <div className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</span>
                  {s.href && (
                    <svg className="text-muted-foreground/40 group-hover:text-primary transition-colors" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  )}
                </div>
                <div className="text-[24px] font-bold leading-none" style={{ color: s.color ?? 'var(--c-text-1)' }}>
                  {s.value}
                </div>
              </div>
            )
            return s.href
              ? <Link key={s.label} href={s.href}>{inner}</Link>
              : <div key={s.label}>{inner}</div>
          })}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 min-w-0">
        <Tabs defaultValue="hesaplar" className="flex flex-col gap-3">
          <TabsList variant="line" className="gap-0">
            <TabsTrigger value="hesaplar" className="text-[12px] px-4">
              Hesaplar
              <span className="ml-1.5 text-[10px] text-muted-foreground">({accounts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="acik-pozisyonlar" className="text-[12px] px-4">
              Açık Pozisyonlar
              <span className="ml-1.5 text-[10px] text-muted-foreground">({openPositions.length})</span>
            </TabsTrigger>
            <TabsTrigger value="kapali-pozisyonlar" className="text-[12px] px-4">
              Kapalı Pozisyonlar
              <span className="ml-1.5 text-[10px] text-muted-foreground">({closedPositions.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Hesaplar ──────────────────────────────────────────── */}
          <TabsContent value="hesaplar">
            {/* Filters */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <Input
                  value={accSearch}
                  onChange={(e) => setAccSearch(e.target.value)}
                  placeholder="Ara..."
                  className="pl-8 h-8 text-[12px] bg-background w-[200px]"
                />
              </div>
              <FilterSelect
                value={accCurrency}
                onChange={setAccCurrency}
                options={uniqueCurrencies.map((c) => ({ value: c, label: c }))}
                placeholder="Para Birimi"
              />
              <FilterSelect
                value={accKyc}
                onChange={setAccKyc}
                options={[
                  { value: 'none',     label: 'Doğrulanmamış' },
                  { value: 'pending',  label: 'Beklemede'      },
                  { value: 'approved', label: 'Onaylandı'      },
                  { value: 'rejected', label: 'Reddedildi'     },
                ]}
                placeholder="KYC Durumu"
              />
              <FilterSelect
                value={accStatus}
                onChange={setAccStatus}
                options={[
                  { value: 'active',    label: 'Aktif'    },
                  { value: 'suspended', label: 'Askıya Alındı' },
                  { value: 'closed',    label: 'Kapalı'   },
                ]}
                placeholder="Hesap Durumu"
              />
              {(accSearch || accCurrency || accKyc || accStatus) && (
                <button
                  onClick={() => { setAccSearch(''); setAccCurrency(''); setAccKyc(''); setAccStatus('') }}
                  className="h-8 px-3 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors cursor-pointer"
                >
                  Temizle
                </button>
              )}
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Kullanıcı</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Müşteri No</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Hesap No</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Para</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">KYC</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-right">Bakiye</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Durum</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((a) => {
                    const name = `${a.profile?.first_name ?? ''} ${a.profile?.last_name ?? ''}`.trim() || '—'
                    return (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => openDetail(a.id)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <InitialsAvatar name={name} size={26} />
                            <div className="min-w-0">
                              <div className="font-semibold text-[12px] text-foreground truncate">{name}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{a.profile?.email ?? '—'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {a.profile?.customer_no ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-[11px]" style={{ color: 'var(--c-primary)' }}>
                          {a.account_code}
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ color: 'var(--c-primary)', background: 'var(--c-primary-soft)', border: '1px solid var(--c-primary-border)' }}>
                            {a.currency}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ColorBadge value={a.profile?.kyc_status ?? 'none'} map={KYC_STYLE} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] font-semibold">
                          {fmtAmt(a.balance, a.currency)}
                        </TableCell>
                        <TableCell>
                          <ColorBadge value={a.status} map={STATUS_STYLE} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openDetail(a.id)}
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg text-white cursor-pointer transition-opacity hover:opacity-80"
                            style={{ background: 'var(--c-primary)' }}
                          >
                            Düzenle
                          </button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {filteredAccounts.length === 0 && (
                <div className="py-10 text-center text-[12px] text-muted-foreground">Hesap bulunamadı.</div>
              )}
            </div>
          </TabsContent>

          {/* ── Açık Pozisyonlar ──────────────────────────────────── */}
          <TabsContent value="acik-pozisyonlar">
            {/* Filters */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <Input
                  value={openSymbol}
                  onChange={(e) => setOpenSymbol(e.target.value)}
                  placeholder="Sembol..."
                  className="pl-8 h-8 text-[12px] bg-background w-[160px]"
                />
              </div>
              <SideToggle value={openSide} onChange={setOpenSide} />
              {(openSymbol || openSide !== 'all') && (
                <button
                  onClick={() => { setOpenSymbol(''); setOpenSide('all') }}
                  className="h-8 px-3 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors cursor-pointer"
                >
                  Temizle
                </button>
              )}
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Hesap</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Kullanıcı</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Sembol</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-right">Lot</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-right">Açılış Fiyatı</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-right">K/Z</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Tarih</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOpenPositions.map((p) => {
                    const pnl = p.pnl ?? 0
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono font-bold text-[11px]" style={{ color: 'var(--c-primary)' }}>
                          {p.account_code}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{p.profile_name}</TableCell>
                        <TableCell className="font-bold text-[12px]">{p.symbol}</TableCell>
                        <TableCell className="text-right font-mono text-[11px]">
                          {Number(p.qty).toLocaleString('en-US')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px]">
                          {Number(p.avg_cost).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono font-bold text-[11px]"
                            style={{ color: pnl >= 0 ? 'var(--c-bull)' : 'var(--c-bear)' }}>
                            {pnl >= 0 ? '+' : ''}{fmtAmt(pnl, p.currency)}
                          </span>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground font-mono">
                          {p.opened_at ? new Date(p.opened_at).toLocaleDateString('tr-TR') : '—'}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => {
                              const acc = accounts.find((a) => a.account_code === p.account_code)
                              if (acc) openDetail(acc.id)
                            }}
                            className="text-[10px] font-semibold text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                          >
                            Hesaba git →
                          </button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {filteredOpenPositions.length === 0 && (
                <div className="py-10 text-center text-[12px] text-muted-foreground">Açık pozisyon bulunamadı.</div>
              )}
            </div>
          </TabsContent>

          {/* ── Kapalı Pozisyonlar ────────────────────────────────── */}
          <TabsContent value="kapali-pozisyonlar">
            {/* Filters */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <Input
                  value={closedSymbol}
                  onChange={(e) => setClosedSymbol(e.target.value)}
                  placeholder="Sembol..."
                  className="pl-8 h-8 text-[12px] bg-background w-[160px]"
                />
              </div>
              <SideToggle value={closedSide} onChange={setClosedSide} />
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={closedDateFrom}
                  onChange={(e) => setClosedDateFrom(e.target.value)}
                  className="h-8 text-[11px] px-2 rounded-lg border border-border bg-background text-foreground cursor-pointer"
                />
                <span className="text-[11px] text-muted-foreground">—</span>
                <input
                  type="date"
                  value={closedDateTo}
                  onChange={(e) => setClosedDateTo(e.target.value)}
                  className="h-8 text-[11px] px-2 rounded-lg border border-border bg-background text-foreground cursor-pointer"
                />
              </div>
              {(closedSymbol || closedSide !== 'all' || closedDateFrom || closedDateTo) && (
                <button
                  onClick={() => { setClosedSymbol(''); setClosedSide('all'); setClosedDateFrom(''); setClosedDateTo('') }}
                  className="h-8 px-3 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors cursor-pointer"
                >
                  Temizle
                </button>
              )}
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Hesap</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Kullanıcı</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Sembol</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-right">Lot</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-right">Açılış Fiyatı</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-right">Kapanış Fiyatı</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-right">K/Z</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-right">Swap</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-right">Komisyon</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Açılış</TableHead>
                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Kapanış</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClosedPositions.map((p) => {
                    const pnl = p.pnl ?? 0
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono font-bold text-[11px]" style={{ color: 'var(--c-primary)' }}>
                          {p.account_code}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{p.profile_name}</TableCell>
                        <TableCell className="font-bold text-[12px]">{p.symbol}</TableCell>
                        <TableCell className="text-right font-mono text-[11px]">
                          {Number(p.qty).toLocaleString('en-US')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px]">
                          {Number(p.avg_cost).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px]">
                          {p.close_price != null
                            ? Number(p.close_price).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono font-bold text-[11px]"
                            style={{ color: pnl >= 0 ? 'var(--c-bull)' : 'var(--c-bear)' }}>
                            {pnl >= 0 ? '+' : ''}{fmtAmt(pnl, p.currency)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                          {fmtAmt(p.swap, p.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                          {fmtAmt(p.commission, p.currency)}
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground font-mono">
                          {p.opened_at ? new Date(p.opened_at).toLocaleDateString('tr-TR') : '—'}
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground font-mono">
                          {p.closed_at ? new Date(p.closed_at).toLocaleDateString('tr-TR') : '—'}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => {
                              const acc = accounts.find((a) => a.account_code === p.account_code)
                              if (acc) openDetail(acc.id, 'closed', p.id)
                            }}
                            className="text-[10px] font-semibold text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                          >
                            Düzenle →
                          </button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {filteredClosedPositions.length === 0 && (
                <div className="py-10 text-center text-[12px] text-muted-foreground">Kapalı pozisyon bulunamadı.</div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>

    {/* ── Detail Modal ──────────────────────────────────────────────── */}
    {selectedId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={closeDetail}
        />
        {/* Modal */}
        <div className="relative w-full max-w-[1000px] h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {detailLoading || !detailData ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin text-primary" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span className="text-[12px] text-muted-foreground">Yükleniyor...</span>
              </div>
            </div>
          ) : (
            <AccountDetailPanel
              account={detailData.account}
              positions={detailData.positions}
              transactions={detailData.transactions}
              kycDecisions={detailData.kycDecisions}
              allTerms={allTerms}
              termInstruments={detailData.termInstruments ?? []}
              initialPosTab={detailPosTab}
              initialEditPositionId={detailEditPositionId}
              onClose={closeDetail}
              onRefresh={() => refreshDetail(selectedId)}
            />
          )}
        </div>
      </div>
    )}
    </>
  )
}
