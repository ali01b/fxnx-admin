'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { assignTradingTerm, setTradingPermission, adjustBalance, updateAccountStatus } from '@/actions/accounts'
import { closeAllPositions } from '@/actions/positions'
import {
  AccountDetail, TradingTerm, Position, Transaction, TermInstrument,
  FinCell, SectionHeader, Divider,
  fmt2, fmt4, fmtDt, currencySymbol,
  fieldCls, btnPrimary, btnSecondary, btnGhost, btnSm, STATUS_COLOR,
} from './shared'
import { PositionModal, PositionPatch } from './PositionModal'

type PosTab    = 'open' | 'pending' | 'closed' | 'transactions'
type ActionKey = 'deposit' | 'withdrawal' | 'credit_in' | 'credit_out' | 'zero_balance'

const ACTION_BUTTONS: { key: ActionKey; label: string; color: string }[] = [
  { key: 'deposit',      label: 'Deposit',      color: 'var(--c-bull)'    },
  { key: 'withdrawal',   label: 'Withdraw',     color: 'var(--c-bear)'    },
  { key: 'credit_in',    label: 'Credit In',    color: 'var(--c-primary)' },
  { key: 'credit_out',   label: 'Credit Out',   color: 'var(--c-purple)'  },
  { key: 'zero_balance', label: 'Zero Balance', color: 'var(--c-text-2)'  },
]

interface Props {
  account:              AccountDetail
  positions:            Position[]
  transactions:         Transaction[]
  allTerms:             TradingTerm[]
  termInstruments:      TermInstrument[]
  initialPosTab?:       PosTab
  initialEditPositionId?: string
}

export function TradingTab({ account, positions, transactions, allTerms, termInstruments, initialPosTab, initialEditPositionId }: Props) {
  const profile = Array.isArray(account.profiles) ? account.profiles[0] : account.profiles
  const term    = Array.isArray(account.trading_terms) ? account.trading_terms[0] : account.trading_terms
  const ccy     = currencySymbol(account.currency)

  // ── UI State ─────────────────────────────────────────────────────
  const [posTab,        setPosTab]        = useState<PosTab>(initialPosTab ?? 'open')
  const [showTermsEdit, setShowTermsEdit] = useState(false)
  const [activeAction,  setActiveAction]  = useState<ActionKey | null>(null)

  // Position modal state — snapshot prices at open time to prevent re-renders from breaking modal
  const [modalPrices, setModalPrices] = useState<Record<string, number>>({})
  const [showNewPos,  setShowNewPos]  = useState(false)
  const [editingPos,  setEditingPos]  = useState<Position | null>(null)
  const [closingPos,  setClosingPos]  = useState<Position | null>(null)
  const [closingAll,  setClosingAll]  = useState(false)

  const openNewPos  = ()               => { setModalPrices({ ...prices }); setShowNewPos(true) }
  const openEditPos = (p: Position)    => { setModalPrices({ ...prices }); setEditingPos(p) }
  const openClosePos = (p: Position)   => { setModalPrices({ ...prices }); setClosingPos(p) }

  // Auto-open edit modal if a specific position ID was passed (shortcut from dashboard)
  useEffect(() => {
    if (!initialEditPositionId) return
    const target = positions.find((p) => p.id === initialEditPositionId)
    if (target) openEditPos(target)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditPositionId])

  // ── Local position/transaction state (optimistic) ────────────────
  const [localPositions,    setLocalPositions]    = useState<Position[]>(positions)
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>(transactions)

  // Sync when parent does a real refresh
  useEffect(() => { setLocalPositions(positions) },    [positions])
  useEffect(() => { setLocalTransactions(transactions) }, [transactions])

  // ── Optimistic local state ────────────────────────────────────────
  const [localTermName,    setLocalTermName]    = useState<string | null>(
    Array.isArray(account.trading_terms) ? account.trading_terms[0]?.name : (account.trading_terms as any)?.name ?? null
  )
  const [localTradability,  setLocalTradability]  = useState(account.has_trading_permission !== false)
  const [savedTradability,  setSavedTradability]  = useState(account.has_trading_permission !== false)
  const [localStatus,       setLocalStatus]       = useState(account.status ?? 'active')
  const [savedStatus,       setSavedStatus]       = useState(account.status ?? 'active')

  // ── Live data ─────────────────────────────────────────────────────
  const [liveBalance,   setLiveBalance]   = useState(Number(account.balance ?? 0))
  const [livePositions, setLivePositions] = useState(positions.filter((p) => p.status === 'open'))
  const [prices,        setPrices]        = useState<Record<string, number>>({})
  const profileId = profile?.id

  const pollPrices = useCallback(async () => {
    try {
      const res  = await fetch('/api/quotes', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const items: any[] = Array.isArray(json) ? json : (json.items ?? [])
      const map: Record<string, number> = {}
      for (const item of items) {
        if (item.symbol && item.last != null) map[item.symbol] = Number(item.last)
      }
      setPrices(map)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    pollPrices()
    const priceTimer = setInterval(pollPrices, 3000)
    const supabase   = createClient()

    const fetchOpenPositions = async () => {
      const { data } = await supabase
        .from('positions')
        .select('id, symbol, qty, avg_cost, side, leverage, used_margin, commission, swap, status, close_price, pnl, opened_at, closed_at')
        .eq('profile_id', profileId)
        .eq('status', 'open')
      if (data) setLivePositions(data as any)
    }

    const posCh = supabase
      .channel('adp-pos-' + account.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions', filter: `profile_id=eq.${profileId}` }, fetchOpenPositions)
      .subscribe()

    const accCh = supabase
      .channel('adp-acc-' + account.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trading_accounts', filter: `id=eq.${account.id}` }, (payload) => {
        const u = payload.new as any
        if (u.balance != null) setLiveBalance(Number(u.balance))
      })
      .subscribe()

    return () => {
      clearInterval(priceTimer)
      supabase.removeChannel(posCh)
      supabase.removeChannel(accCh)
    }
  }, [account.id, profileId, pollPrices])

  // ── Derived live calculations ─────────────────────────────────────
  const balance = liveBalance
  let liveFloatingPnl = 0
  for (const pos of livePositions) {
    const price = prices[(pos as any).symbol] ?? Number((pos as any).avg_cost)
    const qty   = Math.abs(Number((pos as any).qty))
    liveFloatingPnl += (price - Number((pos as any).avg_cost)) * qty
  }
  const openPnl = liveFloatingPnl

  const filteredPositions = posTab === 'open'
    ? livePositions
    : localPositions.filter((p) => p.status === posTab)

  const totalPnl        = filteredPositions.reduce((s, p) => s + Number(p.pnl ?? 0), 0)
  const totalSwap       = filteredPositions.reduce((s, p) => s + Number(p.swap       ?? 0), 0)
  const totalCommission = filteredPositions.reduce((s, p) => s + Number(p.commission ?? 0), 0)

  const selectCls = `${fieldCls} cursor-pointer`

  const handlePositionSaved = (patch: PositionPatch) => {
    if ('isNew' in patch && patch.isNew) {
      // New position: targeted re-fetch (need server-assigned ID)
      const supabase = createClient()
      supabase
        .from('positions')
        .select('id, symbol, qty, avg_cost, side, leverage, used_margin, commission, swap, status, close_price, pnl, opened_at, closed_at')
        .eq('profile_id', profileId)
        .order('opened_at', { ascending: false })
        .limit(200)
        .then(({ data }) => {
          if (data) {
            setLocalPositions(data as any)
            setLivePositions((data as Position[]).filter((p) => p.status === 'open'))
          }
        })
      return
    }

    const p = patch as Partial<Position>
    if (!p.id) return

    // Optimistic update — no full re-fetch needed
    setLocalPositions((prev) => prev.map((pos) => pos.id === p.id ? { ...pos, ...p } : pos))
    if (p.status === 'closed') {
      setLivePositions((prev) => prev.filter((pos) => pos.id !== p.id))
    }
  }

  const handleBalanceAction = async (fd: FormData) => {
    const type   = fd.get('type') as string
    const amount = Number(fd.get('amount')) || 0
    const note   = fd.get('note') as string | null

    await adjustBalance(fd)
    setActiveAction(null)

    const isCredit       = ['deposit', 'credit_in', 'correction'].includes(type)
    const effectiveAmt   = type === 'zero_balance' ? liveBalance : amount
    const balAfter       = type === 'zero_balance' ? 0 : isCredit ? liveBalance + amount : liveBalance - amount

    setLocalTransactions((prev) => [{
      id:             'opt-' + Date.now(),
      type,
      amount:         effectiveAmt,
      balance_before: liveBalance,
      balance_after:  balAfter,
      source:         'admin',
      note:           note || null,
      created_at:     new Date().toISOString(),
    } as Transaction, ...prev])
  }

  return (
    <div className="flex flex-col">

      {/* ── Trading Settings ──────────────────────────────────────── */}
      <div className="bg-card border-b border-border">
        <div className="px-3 pt-2.5">
          <SectionHeader
            right={
              <button
                className={showTermsEdit
                  ? `${btnSecondary} border-[var(--c-primary)] text-[var(--c-primary)] bg-[var(--c-primary-soft)]`
                  : btnSecondary}
                onClick={() => setShowTermsEdit((v) => !v)}
              >
                Edit Trading Terms
              </button>
            }
          >
            Trading
          </SectionHeader>
        </div>

        {/* Trading Terms inline editor */}
        {showTermsEdit && (
          <div className="px-3 py-2.5 bg-muted/40 border-b border-border">
            <form
              action={async (fd: FormData) => {
                const selId   = fd.get('trading_terms_id') as string
                const selName = allTerms.find((t) => t.id === selId)?.name ?? null
                setLocalTermName(selName)
                await assignTradingTerm(fd)
                setShowTermsEdit(false)
              }}
              className="flex gap-2 items-center"
            >
              <input type="hidden" name="account_id" value={account.id} />
              <span className="text-[10px] text-muted-foreground font-semibold whitespace-nowrap">Trading Grubu:</span>
              <select name="trading_terms_id" defaultValue={term?.id ?? ''} className={`${selectCls} flex-1`}>
                <option value="">— Yok —</option>
                {allTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button type="submit" className={btnPrimary}>Kaydet</button>
              <button type="button" onClick={() => setShowTermsEdit(false)} className={btnGhost}>İptal</button>
            </form>
          </div>
        )}

        {/* Status / Terms / Tradability row */}
        <div className="px-3 py-2 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-semibold">State:</span>
            <select
              value={localStatus}
              className={selectCls}
              style={{ color: STATUS_COLOR[localStatus] ?? 'var(--c-text-1)', fontWeight: 700 }}
              onChange={(e) => setLocalStatus(e.target.value)}
            >
              {['active','suspended','closed','pending'].map((s) => (
                <option key={s} value={s} style={{ color: STATUS_COLOR[s] }}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            {localStatus !== savedStatus && (
              <>
                <button
                  onClick={async () => {
                    const fd = new FormData()
                    fd.set('account_id', account.id)
                    fd.set('status', localStatus)
                    setSavedStatus(localStatus)
                    await updateAccountStatus(fd)
                  }}
                  className={`${btnPrimary} ${btnSm}`}
                >Save</button>
                <button onClick={() => setLocalStatus(savedStatus)} className={`${btnGhost} ${btnSm}`}>Cancel</button>
              </>
            )}
          </div>

          <Divider />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-semibold">Trading Terms:</span>
            <span
              className="text-[10px] font-bold rounded px-2 py-0.5 transition-all"
              style={{
                color:      'var(--c-primary)',
                background: 'var(--c-primary-soft)',
                border:     '1px solid var(--c-primary-border)',
              }}
            >
              {localTermName ?? '— None —'}
            </span>
          </div>

          <Divider />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-semibold">Tradability:</span>
            <select
              value={localTradability ? 'true' : 'false'}
              className={selectCls}
              style={{ color: localTradability ? 'var(--c-bull)' : 'var(--c-bear)', fontWeight: 700 }}
              onChange={(e) => setLocalTradability(e.target.value === 'true')}
            >
              <option value="true">Full Trade</option>
              <option value="false">No Trade</option>
            </select>
            {localTradability !== savedTradability && (
              <>
                <button
                  onClick={async () => {
                    const fd = new FormData()
                    fd.set('account_id', account.id)
                    fd.set('value', localTradability ? 'true' : 'false')
                    setSavedTradability(localTradability)
                    await setTradingPermission(fd)
                  }}
                  className={`${btnPrimary} ${btnSm}`}
                >Save</button>
                <button onClick={() => setLocalTradability(savedTradability)} className={`${btnGhost} ${btnSm}`}>Cancel</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Live Financial Information ─────────────────────────────── */}
      <div className="bg-card border-b border-border mt-1">
        <div className="px-3 pt-2.5">
        <SectionHeader
          right={
            <div className="flex gap-1">
              {ACTION_BUTTONS.map(({ key, label, color }) => {
                const isActive = activeAction === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveAction(isActive ? null : key)}
                    className={`${btnSm} inline-flex items-center justify-center gap-1.5 rounded-md font-semibold cursor-pointer transition-all active:scale-[0.97] whitespace-nowrap`}
                    style={{
                      background:  isActive ? color : 'transparent',
                      border:      `1px solid ${color}`,
                      color:       isActive ? 'white' : color,
                      height:      '24px',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          }
        >
          Live Financial Information
        </SectionHeader>
        </div>

        {/* Inline action form */}
        {activeAction && (
          <div className="px-3 py-2 bg-muted/40 border-b border-border">
            {activeAction === 'zero_balance' ? (
              <form
                onSubmit={async (e) => { e.preventDefault(); await handleBalanceAction(new FormData(e.currentTarget)) }}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="account_id" value={account.id} />
                <input type="hidden" name="type"       value="zero_balance" />
                <input type="hidden" name="amount"     value="0" />
                <span className="text-[11px] text-muted-foreground">
                  Bu işlem bakiyeyi <strong>{ccy}0.00</strong> yapacak. Onaylıyor musunuz?
                </span>
                <button type="submit" className={btnSecondary}>Confirm</button>
                <button type="button" onClick={() => setActiveAction(null)} className={btnGhost}>Cancel</button>
              </form>
            ) : (
              <form
                onSubmit={async (e) => { e.preventDefault(); await handleBalanceAction(new FormData(e.currentTarget)) }}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="account_id" value={account.id} />
                <input type="hidden" name="type" value={
                  activeAction === 'credit_in'  ? 'deposit'    :
                  activeAction === 'credit_out' ? 'withdrawal' : activeAction
                } />
                <span className="text-[10px] font-bold text-foreground whitespace-nowrap min-w-[70px]">
                  {activeAction === 'deposit'    ? 'Deposit'    :
                   activeAction === 'withdrawal' ? 'Withdraw'   :
                   activeAction === 'credit_in'  ? 'Credit In'  : 'Credit Out'} Amount:
                </span>
                <div className="relative flex items-center">
                  <span className="absolute left-2 text-[10px] text-muted-foreground font-mono">{ccy}</span>
                  <input name="amount" type="number" step="0.01" placeholder="0.00" autoFocus
                    className={`${fieldCls} w-28 text-right font-mono pl-6`} />
                </div>
                <input name="note" placeholder="Note (optional)" className={`${fieldCls} flex-1`} />
                <button
                  type="submit"
                  className={btnPrimary}
                  style={{ background: activeAction === 'deposit' ? 'var(--c-bull)' : activeAction === 'withdrawal' ? 'var(--c-bear)' : activeAction === 'credit_in' ? 'var(--c-primary)' : 'var(--c-purple)' }}
                >
                  Save
                </button>
                <button type="button" onClick={() => setActiveAction(null)} className={btnGhost}>Cancel</button>
              </form>
            )}
          </div>
        )}

        {/* Financial cells */}
        <div className="p-2.5 grid grid-cols-3 gap-1.5">
          <FinCell label="Bakiye"    value={`${ccy}${fmt2(balance)}`} />
          <FinCell label="Açık P&L" value={(openPnl >= 0 ? '+' : '') + `${ccy}${fmt2(openPnl)}`}
            color={openPnl >= 0 ? 'var(--c-bull)' : 'var(--c-bear)'} />
          <FinCell label="Pozisyonlar" value={String(livePositions.length)} />
        </div>
      </div>

      {/* ── Positions Section ─────────────────────────────────────── */}
      <div className="bg-card mt-1 border-b border-border">

        {/* Position sub-tabs + actions */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-0.5">
            {(['open', 'pending', 'closed', 'transactions'] as PosTab[]).map((t) => {
              const isActive = posTab === t
              const label = t === 'transactions'
                ? `Transactions${localTransactions.length > 0 ? ` (${localTransactions.length})` : ''}`
                : `${t.charAt(0).toUpperCase() + t.slice(1)}${isActive ? ` (${filteredPositions.length})` : ''}`
              return (
                <button
                  key={t}
                  onClick={() => setPosTab(t)}
                  className={`h-6 px-2.5 rounded text-[10px] font-semibold transition-all cursor-pointer border-none ${
                    isActive
                      ? 'bg-[var(--c-primary)] text-white shadow-sm'
                      : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-1">
            {posTab !== 'transactions' && (
              <>
                <button
                  onClick={openNewPos}
                  className={`${btnSm} inline-flex items-center justify-center gap-1 rounded-md font-semibold cursor-pointer transition-all active:scale-[0.97] border`}
                  style={{ color: 'var(--c-bull)', borderColor: 'color-mix(in srgb, var(--c-bull) 40%, transparent)', background: 'color-mix(in srgb, var(--c-bull) 10%, transparent)', height: '24px' }}
                >
                  + New
                </button>
                {posTab === 'open' && livePositions.length > 0 && (
                  <button
                    onClick={() => setClosingAll(true)}
                    className={`${btnSm} inline-flex items-center justify-center gap-1 rounded-md font-semibold cursor-pointer transition-all active:scale-[0.97] border`}
                    style={{ color: 'var(--c-bear)', borderColor: 'color-mix(in srgb, var(--c-bear) 40%, transparent)', background: 'transparent', height: '24px' }}
                  >
                    Close All
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Transactions table */}
        {posTab === 'transactions' && (
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted border-b border-border">
                  {['Date','Type','Source','Amount','Balance Before','Balance After','Note'].map((h) => (
                    <th key={h} className={`px-2 py-1.5 font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${
                      ['Amount','Balance Before','Balance After'].includes(h) ? 'text-right' : 'text-left'
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {localTransactions.map((tx, i) => {
                  const isCredit = ['deposit','credit_in','correction'].includes(tx.type)
                  const sourceInfo =
                    tx.source === 'system'       ? { label: 'System',  color: 'var(--c-primary)' } :
                    tx.source === 'user_request' ? { label: 'Request', color: 'var(--c-amber)'   } :
                                                   { label: 'Admin',   color: 'var(--c-purple)'  }
                  const typeLabel =
                    tx.type === 'deposit'      ? 'Deposit'     :
                    tx.type === 'withdrawal'   ? 'Withdrawal'  :
                    tx.type === 'credit_in'    ? 'Credit In'   :
                    tx.type === 'credit_out'   ? 'Credit Out'  :
                    tx.type === 'zero_balance' ? 'Zero Balance': 'Correction'
                  return (
                    <tr key={tx.id} className={`border-b border-border ${i % 2 === 1 ? 'bg-muted/20' : 'bg-card'}`}>
                      <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{fmtDt(tx.created_at)}</td>
                      <td className="px-2 py-1">
                        <span className="font-bold" style={{ color: isCredit ? 'var(--c-bull)' : 'var(--c-bear)' }}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <span className="text-[9px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wide"
                          style={{ color: sourceInfo.color, background: `${sourceInfo.color}18`, border: `1px solid ${sourceInfo.color}40` }}>
                          {sourceInfo.label}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right font-mono font-bold"
                        style={{ color: isCredit ? 'var(--c-bull)' : 'var(--c-bear)' }}>
                        {isCredit ? '+' : '-'}{ccy}{fmt2(Number(tx.amount))}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-muted-foreground">
                        {tx.balance_before != null ? `${ccy}${fmt2(Number(tx.balance_before))}` : '—'}
                      </td>
                      <td className="px-2 py-1 text-right font-mono font-semibold text-foreground">
                        {tx.balance_after != null ? `${ccy}${fmt2(Number(tx.balance_after))}` : '—'}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {tx.note ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {localTransactions.length === 0 && (
              <div className="py-5 text-center text-[11px] text-muted-foreground">İşlem kaydı yok.</div>
            )}
          </div>
        )}

        {/* Positions table */}
        {posTab !== 'transactions' && (
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted border-b border-border">
                  {[
                    'ID', 'Sembol', 'Tür', 'Lot', 'Açılış Fiyatı',
                    posTab === 'closed' ? 'Kapanış Fiyatı' : 'Güncel Fiyat',
                    'Kaldıraç', 'Açılış Tarihi',
                    posTab === 'closed' ? 'Kapanış Tarihi' : null,
                    'Swap', 'Komisyon', 'P&L', ''
                  ].filter(Boolean).map((h) => (
                    <th key={h!} className={`px-2 py-1.5 font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${
                      ['Açılış Fiyatı','Güncel Fiyat','Kapanış Fiyatı','Lot','Swap','Komisyon','P&L'].includes(h!) ? 'text-right' : 'text-left'
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((pos, i) => {
                  const isOpenPos    = pos.status === 'open'
                  const currentPrice = isOpenPos ? (prices[(pos as any).symbol] ?? Number(pos.avg_cost)) : null
                  const floatPnl     = isOpenPos && currentPrice !== null
                    ? (currentPrice - Number(pos.avg_cost)) * Number(pos.qty)
                    : null
                  const pnl          = isOpenPos ? (floatPnl ?? 0) : Number(pos.pnl ?? 0)
                  const swap         = Number(pos.swap       ?? 0)
                  const commission   = Number(pos.commission ?? 0)
                  const leverage     = Number(pos.leverage   ?? 1)

                  return (
                    <tr key={pos.id} className={`border-b border-border hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/10' : 'bg-card'}`}>
                      <td className="px-2 py-1 font-mono font-semibold text-primary">{pos.id.slice(0,8).toUpperCase()}</td>
                      <td className="px-2 py-1 font-bold text-foreground">{pos.symbol}</td>
                      <td className="px-2 py-1">
                        <span className="font-bold" style={{ color: 'var(--c-bull)' }}>
                          ALIŞ
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right font-mono">{Number(pos.qty).toLocaleString('en-US')}</td>
                      <td className="px-2 py-1 text-right font-mono">{fmt4(Number(pos.avg_cost))}</td>
                      <td className="px-2 py-1 text-right font-mono" style={{ color: isOpenPos ? 'var(--c-primary)' : undefined }}>
                        {isOpenPos && currentPrice !== null
                          ? fmt4(currentPrice)
                          : pos.close_price ? fmt4(Number(pos.close_price)) : '—'}
                      </td>
                      <td className="px-2 py-1 text-left font-mono text-muted-foreground">
                        {leverage > 1 ? `1:${leverage}` : '—'}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{fmtDt(pos.opened_at)}</td>
                      {posTab === 'closed' && (
                        <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{fmtDt(pos.closed_at)}</td>
                      )}
                      <td className="px-2 py-1 text-right font-mono text-muted-foreground">
                        {swap !== 0 ? `${swap < 0 ? '-' : '+'}${ccy}${fmt2(Math.abs(swap))}` : '—'}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-muted-foreground">
                        {commission !== 0 ? `${ccy}${fmt2(commission)}` : '—'}
                      </td>
                      <td className="px-2 py-1 text-right font-mono font-bold"
                        style={{ color: pnl >= 0 ? 'var(--c-bull)' : 'var(--c-bear)' }}>
                        {pnl >= 0 ? '+' : ''}{ccy}{fmt2(pnl)}
                      </td>
                      {/* Row actions */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditPos(pos)}
                            className="text-[8px] font-bold h-5 px-1.5 rounded cursor-pointer border transition-all active:scale-[0.97]"
                            style={{ color: 'var(--c-primary)', borderColor: 'color-mix(in srgb, var(--c-primary) 40%, transparent)', background: 'var(--c-primary-soft)' }}
                          >
                            Edit
                          </button>
                          {isOpenPos && (
                            <button
                              onClick={() => openClosePos(pos)}
                              className="text-[8px] font-bold h-5 px-1.5 rounded cursor-pointer border transition-all active:scale-[0.97]"
                              style={{ color: 'var(--c-bear)', borderColor: 'color-mix(in srgb, var(--c-bear) 40%, transparent)', background: 'color-mix(in srgb, var(--c-bear) 8%, transparent)' }}
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredPositions.length === 0 && (
              <div className="py-5 text-center text-[11px] text-muted-foreground">
                {posTab === 'open' ? 'Açık pozisyon yok.' : posTab === 'closed' ? 'Kapalı pozisyon yok.' : 'Bekleyen emir yok.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────── */}
      {posTab !== 'transactions' && (
        <div className="bg-primary px-3 py-1.5 flex items-center gap-0 text-[10px] flex-shrink-0">
          {[
            { label: 'Count',      val: `${filteredPositions.length}`,                                           mono: true },
            { label: 'Swap',       val: `${totalSwap < 0 ? '-' : '+'}${ccy}${fmt2(Math.abs(totalSwap))}`,       mono: true },
            { label: 'Commission', val: `${ccy}${fmt2(totalCommission)}`,                                         mono: true },
            { label: 'P&L',        val: `${totalPnl >= 0 ? '+' : ''}${ccy}${fmt2(totalPnl)}`,                   mono: true, color: totalPnl >= 0 ? 'var(--c-bull)' : 'var(--c-bear)' },
          ].map((item, idx, arr) => (
            <span key={item.label} className={`text-white/60 ${idx < arr.length - 1 ? 'pr-3.5 border-r border-white/10 mr-3.5' : ''}`}>
              {item.label}:{' '}
              <span className="font-mono font-bold" style={{ color: item.color ?? 'white' }}>{item.val}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Position Modals ───────────────────────────────────────── */}
      {showNewPos && (
        <PositionModal
          mode="new"
          profileId={profileId ?? ''}
          accountId={account.id}
          ccy={ccy}
          prices={modalPrices}
          instruments={termInstruments}
          onClose={() => setShowNewPos(false)}
          onSaved={handlePositionSaved}
        />
      )}
      {editingPos && (
        <PositionModal
          mode="edit"
          position={editingPos}
          ccy={ccy}
          prices={modalPrices}
          instruments={termInstruments}
          onClose={() => setEditingPos(null)}
          onSaved={handlePositionSaved}
        />
      )}
      {closingPos && (
        <PositionModal
          mode="close"
          position={closingPos}
          ccy={ccy}
          prices={modalPrices}
          instruments={termInstruments}
          onClose={() => setClosingPos(null)}
          onSaved={handlePositionSaved}
        />
      )}

      {/* Close All confirmation */}
      {closingAll && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
          onClick={() => setClosingAll(false)}
        >
          <div className="bg-card rounded-lg shadow-2xl overflow-hidden w-[360px]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-primary px-3.5 py-2.5">
              <div className="text-[12px] font-bold text-white">Tüm Pozisyonları Kapat</div>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-muted-foreground mb-4">
                <strong className="text-foreground">{livePositions.length} açık pozisyon</strong> güncel piyasa fiyatlarından kapatılacak. Bu işlem geri alınamaz.
              </p>
              <form
                action={async (fd) => {
                  fd.set('account_id', account.id)
                  fd.set('prices', JSON.stringify(prices))
                  await closeAllPositions(fd)
                  setClosingAll(false)
                  handlePositionSaved({ isNew: true })
                }}
                className="flex gap-2 justify-end"
              >
                <button type="button" onClick={() => setClosingAll(false)} className={btnGhost}>İptal</button>
                <button
                  type="submit"
                  className={btnPrimary}
                  style={{ background: 'var(--c-bear)' }}
                >
                  Tümünü Kapat
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
