'use client'

import { useState } from 'react'
import { X, Check, Loader2 } from 'lucide-react'
import { createPosition, updatePosition, closePosition } from '@/actions/positions'
import { Position, TermInstrument, fmt2, fmt4 } from './shared'

// ── Helpers ────────────────────────────────────────────────────────────────

function toLocal(iso?: string | null) {
  if (!iso) return ''
  const d   = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const CATEGORY_ORDER = ['forex', 'commodity', 'index', 'crypto', 'bist']
const CATEGORY_LABEL: Record<string, string> = {
  forex: 'Forex', commodity: 'Emtia', index: 'Endeks', crypto: 'Kripto', bist: 'BIST',
}

// ── Field components ───────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
      {children}
    </label>
  )
}

function InfoCell({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-muted/40 border border-border rounded-lg px-3 py-2.5">
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[12px] font-bold tabular-nums leading-tight" style={{ color: color ?? 'var(--c-text-1)' }}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">{sub}</p>}
    </div>
  )
}

const inputCls =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-[12px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors'

const selectCls =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-[12px] text-foreground outline-none focus:border-primary cursor-pointer appearance-none transition-colors'

// ── Types ──────────────────────────────────────────────────────────────────

export type PositionPatch =
  | { isNew: true }
  | ({ isNew?: false } & Partial<Position>)

interface CommonProps {
  onClose:       () => void
  onSaved:       (patch: PositionPatch) => void
  ccy:           string
  prices:        Record<string, number>
  instruments:   TermInstrument[]
  balance:       number
  openPositions: Pick<Position, 'id' | 'used_margin'>[]
}

type Props =
  | (CommonProps & { mode: 'new';   profileId: string; accountId: string })
  | (CommonProps & { mode: 'edit';  position: Position })
  | (CommonProps & { mode: 'close'; position: Position })

// ── Component ──────────────────────────────────────────────────────────────

export function PositionModal(props: Props) {
  const { onClose, onSaved, ccy, prices, instruments, balance, openPositions } = props
  const isNew   = props.mode === 'new'
  const isClose = props.mode === 'close'
  const pos     = props.mode !== 'new' ? props.position : null

  const isEditClosed   = props.mode === 'edit' && pos?.status === 'closed'
  const suggestedPrice = pos ? (prices[pos.symbol] ?? Number(pos.avg_cost)) : 0
  const initClosePrice = isEditClosed
    ? (Number(pos!.close_price) || suggestedPrice)
    : suggestedPrice
  const [closePrice, setClosePrice] = useState(initClosePrice)

  const [symbol,    setSymbol]    = useState(pos?.symbol   ?? '')
  const [openPrice, setOpenPrice] = useState(
    pos?.avg_cost ? String(pos.avg_cost) : (prices[pos?.symbol ?? ''] ? String(prices[pos?.symbol ?? '']) : '')
  )
  const [leverage,  setLeverage]  = useState(pos?.leverage ? String(Math.round(Number(pos.leverage))) : '1')
  const [qtyStr,    setQtyStr]    = useState(pos?.qty != null ? String(pos.qty) : '')
  const side = (pos?.side ?? 'buy') as 'buy' | 'sell'

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const instByCategory = instruments.reduce<Record<string, TermInstrument[]>>((acc, i) => {
    ;(acc[i.category] ??= []).push(i)
    return acc
  }, {})

  // ── Live margin calculations ────────────────────────────────────────────
  const qty          = parseFloat(qtyStr) || 0
  const priceNum     = parseFloat(openPrice) || 0
  const levNum       = parseInt(leverage) || 1
  const posValue     = qty * priceNum                     // notional / maliyet
  const autoMargin   = levNum > 0 ? posValue / levNum : posValue
  const otherMargin  = openPositions
    .filter((p) => p.id !== pos?.id)
    .reduce((sum, p) => sum + Number(p.used_margin ?? 0), 0)
  const freeMargin   = balance - otherMargin - autoMargin
  const equityChange = posValue - (pos ? Number(pos.qty) * Number(pos.avg_cost) : 0)

  // PnL for close modes
  const isLong = side !== 'sell'
  const calcPnl = pos && (isClose || isEditClosed)
    ? (isLong ? closePrice - Number(pos.avg_cost) : Number(pos.avg_cost) - closePrice) * Math.abs(Number(pos.qty))
    : 0

  const handleSymbolChange = (sym: string) => {
    setSymbol(sym)
    const mkt  = prices[sym]
    if (mkt)  setOpenPrice(String(mkt))
    const inst = instruments.find((i) => i.symbol === sym)
    if (inst) setLeverage(String(Math.round(inst.leverage)))
  }

  // ── Submit handlers ────────────────────────────────────────────────────

  const handleClose = async (fd: FormData) => {
    fd.set('id', pos!.id)
    fd.set('pnl', String(calcPnl))
    setSaving(true)
    onSaved({
      id:          pos!.id,
      status:      'closed',
      close_price: closePrice,
      pnl:         calcPnl,
      closed_at:   (fd.get('closed_at') as string) || new Date().toISOString(),
    })
    onClose()
    await closePosition(fd)
  }

  const handleEdit = async (fd: FormData) => {
    fd.set('id', pos!.id)
    fd.set('status', pos!.status)
    fd.set('symbol',   symbol)
    fd.set('side',     side)
    fd.set('avg_cost', openPrice)
    fd.set('leverage', leverage)
    fd.set('qty',      qtyStr)

    const rawDisplayQty  = fd.get('display_qty')  as string
    const rawDisplayCost = fd.get('display_cost') as string

    const patch: PositionPatch = {
      id:           pos!.id,
      symbol,
      side:         side as 'buy' | 'sell',
      qty:          qty,
      avg_cost:     Number(openPrice),
      leverage:     Number(leverage),
      commission:   Number(fd.get('commission')),
      swap:         Number(fd.get('swap')),
      used_margin:  Number(fd.get('used_margin')),
      opened_at:    fd.get('opened_at') as string,
      display_qty:  rawDisplayQty  ? Number(rawDisplayQty)  : null,
      display_cost: rawDisplayCost ? Number(rawDisplayCost) : null,
      ...(isEditClosed && {
        close_price: closePrice,
        pnl:         calcPnl,
        closed_at:   fd.get('closed_at') as string,
      }),
    }

    setSaving(true)
    onSaved(patch)
    onClose()
    await updatePosition(fd)
  }

  const handleNew = async (fd: FormData) => {
    fd.set('profile_id', (props as any).profileId)
    fd.set('account_id', (props as any).accountId)
    fd.set('symbol',   symbol)
    fd.set('side',     side)
    fd.set('avg_cost', openPrice)
    fd.set('leverage', leverage)
    fd.set('qty',      qtyStr)
    // display_qty / display_cost formda zaten var, fd.get() ile action'da okunacak
    setSaving(true)
    setSaved(true)
    await createPosition(fd)
    onSaved({ isNew: true })
    onClose()
  }

  const title = isNew ? 'Yeni Pozisyon' : isClose ? 'Pozisyonu Kapat' : 'Pozisyon Düzenle'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col w-[520px] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-[14px] font-bold text-foreground">{title}</p>
            {pos && (
              <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                {pos.symbol} · {pos.qty} lot · Açılış {fmt4(Number(pos.avg_cost))}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer bg-transparent"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── CLOSE MODE ──────────────────────────────────────────── */}
        {isClose && pos && (
          <form onSubmit={(e) => { e.preventDefault(); handleClose(new FormData(e.currentTarget)) }}>
            <div className="px-5 py-4 space-y-4">

              {/* Position summary */}
              <div className="grid grid-cols-3 gap-2">
                <InfoCell label="Sembol"        value={pos.symbol} />
                <InfoCell label="Lot"           value={String(pos.qty)} />
                <InfoCell label="Açılış Fiyatı" value={fmt4(Number(pos.avg_cost))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kapanış Fiyatı</Label>
                  <input
                    name="close_price"
                    type="number"
                    step="0.00001"
                    value={closePrice}
                    onChange={(e) => setClosePrice(Number(e.target.value))}
                    className={inputCls}
                    autoFocus
                  />
                  {suggestedPrice !== Number(pos.avg_cost) && (
                    <button
                      type="button"
                      onClick={() => setClosePrice(suggestedPrice)}
                      className="mt-1 text-[10px] font-semibold cursor-pointer bg-transparent border-none p-0 hover:underline text-primary"
                    >
                      Piyasa: {fmt4(suggestedPrice)}
                    </button>
                  )}
                </div>
                <div>
                  <Label>Kapanış Tarihi</Label>
                  <input
                    name="closed_at"
                    type="datetime-local"
                    defaultValue={toLocal(new Date().toISOString())}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* PnL preview */}
              <div
                className="rounded-xl border p-4 flex items-center justify-between"
                style={{
                  background:  calcPnl >= 0 ? 'color-mix(in srgb, var(--c-bull) 6%, transparent)' : 'color-mix(in srgb, var(--c-bear) 6%, transparent)',
                  borderColor: calcPnl >= 0 ? 'color-mix(in srgb, var(--c-bull) 25%, transparent)' : 'color-mix(in srgb, var(--c-bear) 25%, transparent)',
                }}
              >
                <p className="text-[11px] font-semibold text-muted-foreground">Tahmini Kâr / Zarar</p>
                <p className="text-[20px] font-extrabold tabular-nums" style={{ color: calcPnl >= 0 ? 'var(--c-bull)' : 'var(--c-bear)' }}>
                  {calcPnl >= 0 ? '+' : ''}{ccy}{fmt2(calcPnl)}
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/20">
              <button type="button" onClick={onClose}
                className="h-8 px-4 text-[11px] font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer">
                İptal
              </button>
              <button type="submit" disabled={saving}
                className="h-8 px-5 text-[11px] font-bold rounded-lg cursor-pointer transition-colors border-none flex items-center gap-1.5 disabled:opacity-70 text-white"
                style={{ background: 'var(--c-bear)' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                Pozisyonu Kapat
              </button>
            </div>
          </form>
        )}

        {/* ── NEW / EDIT MODE ──────────────────────────────────────── */}
        {!isClose && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              if (isNew) handleNew(fd)
              else       handleEdit(fd)
            }}
            className="flex flex-col overflow-hidden"
          >
            <div className="overflow-y-auto px-5 py-4 space-y-4">

              {/* Symbol */}
              <div>
                <Label>Sembol</Label>
                {instruments.length > 0 ? (
                  <select value={symbol} onChange={(e) => handleSymbolChange(e.target.value)} className={selectCls}>
                    <option value="">— Sembol seçin —</option>
                    {CATEGORY_ORDER.filter((cat) => instByCategory[cat]).map((cat) => (
                      <optgroup key={cat} label={CATEGORY_LABEL[cat] ?? cat}>
                        {instByCategory[cat].map((inst) => (
                          <option key={inst.symbol} value={inst.symbol}>
                            {inst.symbol} — {inst.name}
                            {prices[inst.symbol] ? ` (${fmt4(prices[inst.symbol])})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <input
                    value={symbol}
                    onChange={(e) => handleSymbolChange(e.target.value.toUpperCase())}
                    placeholder="örn. EURUSD"
                    className={inputCls}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <Label>Lot / Miktar</Label>
                  <input
                    name="qty"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={qtyStr}
                    onChange={(e) => setQtyStr(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <Label>
                    Açılış Fiyatı
                    {symbol && prices[symbol] && (
                      <button type="button" onClick={() => setOpenPrice(String(prices[symbol]))}
                        className="ml-2 font-semibold normal-case cursor-pointer bg-transparent border-none hover:underline text-primary"
                        style={{ letterSpacing: 0, fontSize: 9 }}>
                        Piyasa: {fmt4(prices[symbol])}
                      </button>
                    )}
                  </Label>
                  <input type="number" step="0.00001" value={openPrice}
                    onChange={(e) => setOpenPrice(e.target.value)} className={inputCls} />
                </div>

                <div>
                  <Label>Kaldıraç (Çarpan)</Label>
                  <select value={leverage} onChange={(e) => setLeverage(e.target.value)} className={selectCls}>
                    {[1,2,5,10,25,50,100,200,400,500].map((v) => (
                      <option key={v} value={v}>1:{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Komisyon ({ccy})</Label>
                  <input name="commission" type="number" step="0.01"
                    defaultValue={pos?.commission ?? 0} className={inputCls} />
                </div>

                <div>
                  <Label>Swap ({ccy})</Label>
                  <input name="swap" type="number" step="0.000001"
                    defaultValue={pos?.swap ?? 0} className={inputCls} />
                </div>

                <div>
                  <Label>
                    Kullanılan Marjin ({ccy})
                    {autoMargin > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.querySelector<HTMLInputElement>('[name="used_margin"]')
                          if (el) { el.value = fmt2(autoMargin); el.dispatchEvent(new Event('input', { bubbles: true })) }
                        }}
                        className="ml-2 font-semibold normal-case cursor-pointer bg-transparent border-none hover:underline text-primary"
                        style={{ letterSpacing: 0, fontSize: 9 }}
                      >
                        Oto: {fmt2(autoMargin)}
                      </button>
                    )}
                  </Label>
                  <input name="used_margin" type="number" step="0.01"
                    defaultValue={pos?.used_margin ?? 0} className={inputCls} />
                </div>

                <div>
                  <Label>
                    Gösterim Lot
                    <span className="ml-1.5 normal-case font-normal text-muted-foreground" style={{ letterSpacing: 0, fontSize: 9 }}>
                      (boş = gerçek değer)
                    </span>
                  </Label>
                  <input
                    name="display_qty"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={pos?.display_qty ?? ''}
                    placeholder={qtyStr || '—'}
                    className={inputCls}
                  />
                </div>

                <div>
                  <Label>
                    Gösterim Maliyet
                    <span className="ml-1.5 normal-case font-normal text-muted-foreground" style={{ letterSpacing: 0, fontSize: 9 }}>
                      (boş = gerçek değer)
                    </span>
                  </Label>
                  <input
                    name="display_cost"
                    type="number"
                    step="0.00001"
                    min="0"
                    defaultValue={pos?.display_cost ?? ''}
                    placeholder={openPrice || '—'}
                    className={inputCls}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Açılış Tarihi</Label>
                  <input name="opened_at" type="datetime-local"
                    defaultValue={toLocal(pos?.opened_at) || toLocal(new Date().toISOString())}
                    className={inputCls} />
                </div>

                {/* Closed position extra fields */}
                {isEditClosed && pos && (
                  <>
                    <div>
                      <Label>Kapanış Fiyatı</Label>
                      <input name="close_price" type="number" step="0.00001"
                        value={closePrice} onChange={(e) => setClosePrice(Number(e.target.value))}
                        className={inputCls} />
                    </div>
                    <div>
                      <Label>Kapanış Tarihi</Label>
                      <input name="closed_at" type="datetime-local"
                        defaultValue={toLocal(pos.closed_at)} className={inputCls} />
                    </div>
                    <input type="hidden" name="pnl" value={String(calcPnl)} />
                    <div
                      className="col-span-2 rounded-xl border p-3.5 flex items-center justify-between"
                      style={{
                        background:  calcPnl >= 0 ? 'color-mix(in srgb, var(--c-bull) 6%, transparent)' : 'color-mix(in srgb, var(--c-bear) 6%, transparent)',
                        borderColor: calcPnl >= 0 ? 'color-mix(in srgb, var(--c-bull) 25%, transparent)' : 'color-mix(in srgb, var(--c-bear) 25%, transparent)',
                      }}
                    >
                      <p className="text-[11px] font-semibold text-muted-foreground">Hesaplanan PnL</p>
                      <p className="text-[18px] font-extrabold tabular-nums"
                        style={{ color: calcPnl >= 0 ? 'var(--c-bull)' : 'var(--c-bear)' }}>
                        {calcPnl >= 0 ? '+' : ''}{ccy}{fmt2(calcPnl)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* ── Live Hesap Özeti ─────────────────────────────────── */}
              {qty > 0 && priceNum > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3.5 py-2 border-b border-border bg-muted/30">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hesap Özeti</p>
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-border">
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Maliyet</p>
                      <p className="text-[11px] font-bold tabular-nums text-foreground">{ccy}{fmt2(posValue)}</p>
                      <p className="text-[9px] text-muted-foreground tabular-nums mt-0.5">{qty} × {fmt4(priceNum)}</p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Çarpan</p>
                      <p className="text-[11px] font-bold tabular-nums text-foreground">1:{levNum}</p>
                      <p className="text-[9px] text-muted-foreground tabular-nums mt-0.5">
                        {ccy}{fmt2(autoMargin)} marjin
                      </p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Diğer Marjin</p>
                      <p className="text-[11px] font-bold tabular-nums text-foreground">{ccy}{fmt2(otherMargin)}</p>
                      <p className="text-[9px] text-muted-foreground tabular-nums mt-0.5">
                        {openPositions.filter((p) => p.id !== pos?.id).length} pozisyon
                      </p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Boştaki Nakit</p>
                      <p
                        className="text-[11px] font-bold tabular-nums"
                        style={{ color: freeMargin >= 0 ? 'var(--c-bull)' : 'var(--c-bear)' }}
                      >
                        {ccy}{fmt2(freeMargin)}
                      </p>
                      <p className="text-[9px] text-muted-foreground tabular-nums mt-0.5">
                        Bakiye: {ccy}{fmt2(balance)}
                      </p>
                    </div>
                  </div>
                  {freeMargin < 0 && (
                    <div className="px-3.5 py-2 border-t border-border bg-[color-mix(in_srgb,var(--c-bear)_8%,transparent)]">
                      <p className="text-[10px] font-semibold" style={{ color: 'var(--c-bear)' }}>
                        Yetersiz marjin — bu lot büyüklüğü mevcut bakiyeyi aşıyor.
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="flex-shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/20">
              <button type="button" onClick={onClose}
                className="h-8 px-4 text-[11px] font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer">
                İptal
              </button>
              <button type="submit" disabled={saving}
                className="h-8 px-5 text-[11px] font-bold rounded-lg cursor-pointer hover:opacity-90 transition-opacity border-none flex items-center gap-1.5 disabled:opacity-70 bg-primary text-primary-foreground">
                {saving && !saved ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
                {isNew ? 'Pozisyon Aç' : 'Kaydet'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
