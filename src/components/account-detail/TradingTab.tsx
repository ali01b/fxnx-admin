'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { assignTradingTerm, setTradingPermission, adjustBalance, updateAccountStatus } from '@/actions/accounts'
import { closeAllPositions } from '@/actions/positions'
import { useQuoteStore, toYahooSymbol, type QuoteItem } from '@/stores/quoteStore'
import {
  AccountDetail, TradingTerm, Position, Transaction, TermInstrument,
  FinCell, SectionHeader, Divider,
  fmt2, fmt4, fmtDt, currencySymbol,
  fieldCls, selectCls, btnPrimary, btnSecondary, btnGhost, btnSm, STATUS_COLOR,
} from './shared'
import { PositionModal, PositionPatch } from './PositionModal'

type PosTab    = 'open' | 'pending' | 'closed' | 'transactions'
type ActionKey = 'deposit' | 'withdrawal' | 'credit_in' | 'credit_out' | 'zero_balance'

const ACTION_BUTTONS: { key: ActionKey; label: string }[] = [
  { key: 'deposit',      label: 'Para Yatır'  },
  { key: 'withdrawal',   label: 'Para Çek'    },
  { key: 'credit_in',    label: 'Kredi Gir'   },
  { key: 'credit_out',   label: 'Kredi Çıkar' },
  { key: 'zero_balance', label: 'Sıfırla'     },
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

  // DB sembolü → Yahoo sembolü haritası
  const dbToYahoo = useMemo(
    () => Object.fromEntries(termInstruments.map((i) => [i.symbol, toYahooSymbol(i.symbol, i.category)])),
    [termInstruments]
  )

  // Store'dan direkt oku — her WS tick'te quotes yeni referans → garantili re-render
  const storeQuotes = useQuoteStore((s) => s.quotes)
  const getPrice = (dbSym: string): number | undefined =>
    storeQuotes[dbToYahoo[dbSym] ?? dbSym]?.last

  useEffect(() => {
    if (termInstruments.length === 0) return

    const yahooSymbols = Object.values(dbToYahoo)
    const store = useQuoteStore.getState()

    // Subscribe: GlobalSidebar zaten tüm açık pozisyonlara subscribe ediyor,
    // ama bu hesaba ait semboller listede yoksa (yeni hesap / farklı term) burada da subscribe et
    store.subscribe(yahooSymbols)

    // REST snapshot: store'da henüz yoksa hemen fiyatları doldur
    const missing = yahooSymbols.filter((s) => store.quotes[s] == null)
    if (missing.length > 0) {
      fetch(`https://api.iletisimacar.com/api/yf/quote?symbols=${missing.join(',')}`)
        .then(r => r.json())
        .then((resp: { success: boolean; data?: Array<Record<string, unknown>> }) => {
          if (!resp.success || !Array.isArray(resp.data)) return
          const seed: Record<string, QuoteItem> = {}
          for (const q of resp.data) {
            const sym = q.symbol as string
            if (!sym || q.price == null) continue
            seed[sym] = { symbol: sym, last: Number(q.price), change: Number(q.change ?? 0) }
          }
          useQuoteStore.getState().seed(seed)
        })
        .catch(() => {})
    }

    return () => store.unsubscribe(yahooSymbols)
  }, [termInstruments, dbToYahoo])

  // Position modal state — fiyatları açılış anında snapshot'la, re-render'dan korunmak için
  const [modalPrices, setModalPrices] = useState<Record<string, number>>({})
  const [showNewPos,  setShowNewPos]  = useState(false)
  const [editingPos,  setEditingPos]  = useState<Position | null>(null)
  const [closingPos,  setClosingPos]  = useState<Position | null>(null)
  const [closingAll,  setClosingAll]  = useState(false)

  const snapPrices = () => {
    const snap: Record<string, number> = {}
    for (const dbSym of Object.keys(dbToYahoo)) {
      const p = getPrice(dbSym)
      if (p != null) snap[dbSym] = p
    }
    return snap
  }
  const openNewPos   = ()            => { setModalPrices(snapPrices()); setShowNewPos(true) }
  const openEditPos  = (p: Position) => { setModalPrices(snapPrices()); setEditingPos(p) }
  const openClosePos = (p: Position) => { setModalPrices(snapPrices()); setClosingPos(p) }

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
  const profileId = profile?.id

  useEffect(() => {
    const supabase = createClient()

    const fetchOpenPositions = async () => {
      const { data } = await supabase
        .from('positions')
        .select('id, symbol, qty, avg_cost, side, leverage, used_margin, commission, swap, status, close_price, pnl, opened_at, closed_at, display_qty, display_cost')
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
      supabase.removeChannel(posCh)
      supabase.removeChannel(accCh)
    }
  }, [account.id, profileId])

  // ── Derived live calculations ─────────────────────────────────────
  const balance = liveBalance
  let liveFloatingPnl = 0
  for (const pos of livePositions) {
    const price  = getPrice((pos as any).symbol) ?? Number((pos as any).avg_cost)
    const qty    = Math.abs(Number((pos as any).qty))
    const avg    = Number((pos as any).avg_cost)
    const isLong = (pos as any).side !== 'sell'
    liveFloatingPnl += (isLong ? price - avg : avg - price) * qty
  }
  const openPnl = liveFloatingPnl

  const filteredPositions = posTab === 'open'
    ? livePositions
    : localPositions.filter((p) => p.status === posTab)

  const totalPnl        = filteredPositions.reduce((s, p) => s + Number(p.pnl ?? 0), 0)
  const totalSwap       = filteredPositions.reduce((s, p) => s + Number(p.swap       ?? 0), 0)
  const totalCommission = filteredPositions.reduce((s, p) => s + Number(p.commission ?? 0), 0)

  const handlePositionSaved = (patch: PositionPatch) => {
    if ('isNew' in patch && patch.isNew) {
      // New position: targeted re-fetch (need server-assigned ID)
      const supabase = createClient()
      supabase
        .from('positions')
        .select('id, symbol, qty, avg_cost, side, leverage, used_margin, commission, swap, status, close_price, pnl, opened_at, closed_at, display_qty, display_cost')
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
                  ? `${btnSecondary} border-primary text-primary`
                  : btnSecondary}
                onClick={() => setShowTermsEdit((v) => !v)}
              >
                İşlem Koşullarını Düzenle
              </button>
            }
          >
            İşlem Ayarları
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
              <span className="text-[10px] text-muted-foreground font-semibold whitespace-nowrap">İşlem Grubu:</span>
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
            <span className="text-[10px] text-muted-foreground font-semibold">Durum:</span>
            <select
              value={localStatus}
              className={selectCls}
              style={{ color: STATUS_COLOR[localStatus] ?? 'var(--c-text-1)', fontWeight: 700 }}
              onChange={(e) => setLocalStatus(e.target.value)}
            >
              {[
                { value: 'active',    label: 'Aktif'    },
                { value: 'suspended', label: 'Askıda'   },
                { value: 'closed',    label: 'Kapalı'   },
                { value: 'pending',   label: 'Bekliyor' },
              ].map(({ value, label }) => (
                <option key={value} value={value} style={{ color: STATUS_COLOR[value] }}>{label}</option>
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
                >Kaydet</button>
                <button onClick={() => setLocalStatus(savedStatus)} className={`${btnGhost} ${btnSm}`}>İptal</button>
              </>
            )}
          </div>

          <Divider />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-semibold">İşlem Koşulları:</span>
            <span
              className="text-[10px] font-bold rounded px-2 py-0.5 transition-all"
              style={{
                color:      'var(--c-primary)',
                background: 'var(--c-primary-soft)',
                border:     '1px solid var(--c-primary-border)',
              }}
            >
              {localTermName ?? '— Yok —'}
            </span>
          </div>

          <Divider />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-semibold">İşlem İzni:</span>
            <select
              value={localTradability ? 'true' : 'false'}
              className={selectCls}
              style={{ color: localTradability ? 'var(--c-bull)' : 'var(--c-bear)', fontWeight: 700 }}
              onChange={(e) => setLocalTradability(e.target.value === 'true')}
            >
              <option value="true">Açık</option>
              <option value="false">Kapalı</option>
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
                >Kaydet</button>
                <button onClick={() => setLocalTradability(savedTradability)} className={`${btnGhost} ${btnSm}`}>İptal</button>
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
              {ACTION_BUTTONS.map(({ key, label }) => {
                const isActive = activeAction === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveAction(isActive ? null : key)}
                    className={`${btnSm} inline-flex items-center justify-center gap-1 rounded-md text-[10px] font-medium cursor-pointer transition-all active:scale-[0.97] whitespace-nowrap border ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-transparent text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          }
        >
          Canlı Finansal Bilgiler
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
                <button type="submit" className={btnSecondary}>Onayla</button>
                <button type="button" onClick={() => setActiveAction(null)} className={btnGhost}>İptal</button>
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
                  {activeAction === 'deposit'    ? 'Para Yatır'  :
                   activeAction === 'withdrawal' ? 'Para Çek'    :
                   activeAction === 'credit_in'  ? 'Kredi Gir'   : 'Kredi Çıkar'} Tutarı:
                </span>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-[11px] text-muted-foreground">{ccy}</span>
                  <input name="amount" type="number" step="0.01" placeholder="0.00" autoFocus
                    className={`${fieldCls} w-28 text-right tabular-nums pl-6`} />
                </div>
                <input name="note" placeholder="Not (isteğe bağlı)" className={`${fieldCls} flex-1`} />
                <button type="submit" className={btnPrimary}>
                  Kaydet
                </button>
                <button type="button" onClick={() => setActiveAction(null)} className={btnGhost}>İptal</button>
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
              const tabLabels: Record<string, string> = { open: 'Açık', pending: 'Bekleyen', closed: 'Kapalı', transactions: 'İşlemler' }
              const label = t === 'transactions'
                ? `İşlemler${localTransactions.length > 0 ? ` (${localTransactions.length})` : ''}`
                : `${tabLabels[t] ?? t}${isActive ? ` (${filteredPositions.length})` : ''}`
              return (
                <button
                  key={t}
                  onClick={() => setPosTab(t)}
                  className={`h-6 px-2.5 rounded text-[10px] font-semibold transition-all cursor-pointer border-none ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
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
                  className={`${btnSm} inline-flex items-center justify-center gap-1 rounded-md text-[10px] font-medium cursor-pointer transition-all active:scale-[0.97] border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground`}
                >
                  + Yeni
                </button>
                {posTab === 'open' && livePositions.length > 0 && (
                  <button
                    onClick={() => setClosingAll(true)}
                    className={`${btnSm} inline-flex items-center justify-center gap-1 rounded-md text-[10px] font-medium cursor-pointer transition-all active:scale-[0.97] border border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10`}
                  >
                    Tümünü Kapat
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
                  {['Tarih','Tür','Kaynak','Tutar','Önceki Bakiye','Sonraki Bakiye','Not'].map((h) => (
                    <th key={h} className={`px-2 py-1.5 font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${
                      ['Tutar','Önceki Bakiye','Sonraki Bakiye'].includes(h) ? 'text-right' : 'text-left'
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {localTransactions.map((tx, i) => {
                  const isCredit = ['deposit','credit_in','correction'].includes(tx.type)
                  const sourceInfo =
                    tx.source === 'system'       ? { label: 'Sistem',  color: 'var(--c-primary)' } :
                    tx.source === 'user_request' ? { label: 'Talep',   color: 'var(--c-amber)'   } :
                                                   { label: 'Admin',   color: 'var(--c-purple)'  }
                  const typeLabel =
                    tx.type === 'deposit'      ? 'Para Yatırma'  :
                    tx.type === 'withdrawal'   ? 'Para Çekme'    :
                    tx.type === 'credit_in'    ? 'Kredi Girişi'  :
                    tx.type === 'credit_out'   ? 'Kredi Çıkışı'  :
                    tx.type === 'zero_balance' ? 'Sıfırlama'     : 'Düzeltme'
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
                      <td className="px-2 py-1 text-right tabular-nums font-bold"
                        style={{ color: isCredit ? 'var(--c-bull)' : 'var(--c-bear)' }}>
                        {isCredit ? '+' : '-'}{ccy}{fmt2(Number(tx.amount))}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                        {tx.balance_before != null ? `${ccy}${fmt2(Number(tx.balance_before))}` : '—'}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums font-semibold text-foreground">
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
                  const isLong       = (pos as any).side !== 'sell'
                  const currentPrice = isOpenPos ? (getPrice((pos as any).symbol) ?? Number(pos.avg_cost)) : null
                  const floatPnl     = isOpenPos && currentPrice !== null
                    ? (isLong ? currentPrice - Number(pos.avg_cost) : Number(pos.avg_cost) - currentPrice) * Math.abs(Number(pos.qty))
                    : null
                  const pnl          = isOpenPos ? (floatPnl ?? 0) : Number(pos.pnl ?? 0)
                  const swap         = Number(pos.swap       ?? 0)
                  const commission   = Number(pos.commission ?? 0)
                  const leverage     = Number(pos.leverage   ?? 1)

                  return (
                    <tr key={pos.id} className={`border-b border-border hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/10' : 'bg-card'}`}>
                      <td className="px-2 py-1 tabular-nums font-semibold text-primary text-[9px]">{pos.id.slice(0,8).toUpperCase()}</td>
                      <td className="px-2 py-1 font-bold text-foreground">{pos.symbol}</td>
                      <td className="px-2 py-1">
                        <span className="font-semibold text-[10px] px-1.5 py-0.5 rounded" style={isLong
                          ? { color: 'var(--c-bull)', background: 'color-mix(in srgb, var(--c-bull) 12%, transparent)' }
                          : { color: 'var(--c-bear)', background: 'color-mix(in srgb, var(--c-bear) 12%, transparent)' }}>
                          {isLong ? 'ALIŞ' : 'SATIŞ'}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {Number(pos.qty).toLocaleString('tr-TR')}
                        {(pos as any).display_qty != null && (
                          <span className="ml-1 text-[9px] font-semibold" style={{ color: 'var(--c-amber)' }}>
                            →{Number((pos as any).display_qty).toLocaleString('tr-TR')}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {fmt4(Number(pos.avg_cost))}
                        {(pos as any).display_cost != null && (
                          <span className="ml-1 text-[9px] font-semibold" style={{ color: 'var(--c-amber)' }}>
                            →{fmt4(Number((pos as any).display_cost))}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums font-semibold" style={{ color: isOpenPos ? 'var(--c-primary)' : undefined }}>
                        {isOpenPos && currentPrice !== null
                          ? fmt4(currentPrice)
                          : pos.close_price ? fmt4(Number(pos.close_price)) : '—'}
                      </td>
                      <td className="px-2 py-1 text-left tabular-nums text-muted-foreground">
                        {leverage > 1 ? `1:${leverage}` : '—'}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{fmtDt(pos.opened_at)}</td>
                      {posTab === 'closed' && (
                        <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{fmtDt(pos.closed_at)}</td>
                      )}
                      <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                        {swap !== 0 ? `${swap < 0 ? '-' : '+'}${ccy}${fmt2(Math.abs(swap))}` : '—'}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                        {commission !== 0 ? `${ccy}${fmt2(commission)}` : '—'}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums font-bold"
                        style={{ color: pnl >= 0 ? 'var(--c-bull)' : 'var(--c-bear)' }}>
                        {pnl >= 0 ? '+' : ''}{ccy}{fmt2(pnl)}
                      </td>
                      {/* Row actions */}
                      <td className="px-2 py-1 whitespace-nowrap">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditPos(pos)}
                            className="text-[9px] font-medium h-5 px-2 rounded cursor-pointer border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-[0.97]"
                          >
                            Düzenle
                          </button>
                          {isOpenPos && (
                            <button
                              onClick={() => openClosePos(pos)}
                              className="text-[9px] font-medium h-5 px-2 rounded cursor-pointer border border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10 transition-all active:scale-[0.97]"
                            >
                              Kapat
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
        <div className="bg-card border-t border-border px-3 py-1.5 flex items-center gap-0 text-[10px] flex-shrink-0">
          {[
            { label: 'Adet',     val: `${filteredPositions.length}` },
            { label: 'Swap',     val: `${totalSwap < 0 ? '-' : '+'}${ccy}${fmt2(Math.abs(totalSwap))}` },
            { label: 'Komisyon', val: `${ccy}${fmt2(totalCommission)}` },
            { label: 'P&L',      val: `${totalPnl >= 0 ? '+' : ''}${ccy}${fmt2(totalPnl)}`, color: totalPnl >= 0 ? 'var(--c-bull)' : 'var(--c-bear)' },
          ].map((item, idx, arr) => (
            <span key={item.label} className={`text-muted-foreground ${idx < arr.length - 1 ? 'pr-3.5 border-r border-border mr-3.5' : ''}`}>
              {item.label}:{' '}
              <span className="tabular-nums font-bold" style={{ color: item.color ?? 'var(--c-text-1)' }}>{item.val}</span>
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
          balance={liveBalance}
          openPositions={livePositions}
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
          balance={liveBalance}
          openPositions={livePositions}
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
          balance={liveBalance}
          openPositions={livePositions}
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
            <div className="px-3.5 py-3 border-b border-border">
              <div className="text-[13px] font-bold text-foreground">Tüm Pozisyonları Kapat</div>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-muted-foreground mb-4">
                <strong className="text-foreground">{livePositions.length} açık pozisyon</strong> güncel piyasa fiyatlarından kapatılacak. Bu işlem geri alınamaz.
              </p>
              <form
                action={async (fd) => {
                  fd.set('account_id', account.id)
                  fd.set('prices', JSON.stringify(snapPrices()))
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
