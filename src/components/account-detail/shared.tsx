// ── Shared types ───────────────────────────────────────────────────────────

export interface TradingTerm { id: string; name: string }

export interface Position {
  id: string
  symbol: string
  qty: number
  avg_cost: number
  side: string
  status: string
  close_price?: number | null
  pnl?: number | null
  leverage?: number | null
  used_margin?: number | null
  commission?: number | null
  swap?: number | null
  opened_at?:    string | null
  closed_at?:    string | null
  display_qty?:   number | null
  display_cost?:  number | null
  ipo_listing_id?: string | null
}

export interface Transaction {
  id: string
  type: string
  amount: number
  balance_before: number | null
  balance_after: number | null
  source: string
  note: string | null
  created_at: string
}

export interface Computed {
  equity: number
  margin: number
  freeMargin: number
  floatingPnl: number
  marginLevel: number | null
}

export interface AccountDetail {
  id: string
  account_code: string
  account_type: string
  currency: string
  balance: number
  status: string
  has_trading_permission: boolean
  trading_terms_id: string | null
  created_at: string
  profiles: any
  trading_terms?: any
}

export interface TermInstrument {
  symbol:          string
  name:            string
  category:        string
  leverage:        number
  swap_long:       number
  swap_short:      number
  commission_rate: number
}

// ── Currency symbol helper ───────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', TRY: '₺', BTC: '₿',
  JPY: '¥', CHF: 'Fr', CAD: 'C$', AUD: 'A$', NZD: 'NZ$',
}

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency + ' '
}

// ── Color maps ──────────────────────────────────────────────────────────────

export const KYC_COLOR: Record<string, string> = {
  verified:   'var(--c-bull)',
  pending:    'var(--c-amber)',
  unverified: 'var(--c-text-3)',
  rejected:   'var(--c-bear)',
}

export const STATUS_COLOR: Record<string, string> = {
  active:    'var(--c-bull)',
  suspended: 'var(--c-orange)',
  closed:    'var(--c-bear)',
  pending:   'var(--c-amber)',
}

// ── Formatters ──────────────────────────────────────────────────────────────

export function fmt2(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmt4(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

export function fmtDt(s?: string | null) {
  return s
    ? new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'
}

// ── Shared style helpers ────────────────────────────────────────────────────

export const fieldCls =
  'bg-background border border-border rounded-lg text-[11px] px-2.5 py-1.5 outline-none focus:border-primary text-foreground transition-colors'

export const selectCls =
  'bg-background border border-border rounded-lg text-[11px] px-2.5 py-1.5 outline-none focus:border-primary text-foreground cursor-pointer transition-colors'

export const actionBtnCls =
  'flex items-center gap-1.5 bg-muted border border-border rounded-lg cursor-pointer text-[11px] font-medium px-3 py-1.5 text-foreground hover:bg-muted/80 transition-colors'

// ── Button class constants ──────────────────────────────────────────────────

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] font-semibold cursor-pointer border-none transition-all active:scale-[0.97]' +
  ' bg-primary text-primary-foreground hover:opacity-90 shadow-sm'

export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-all active:scale-[0.97]' +
  ' border border-border bg-background text-foreground hover:bg-muted'

export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium cursor-pointer transition-all active:scale-[0.97]' +
  ' border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'

export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-all active:scale-[0.97]' +
  ' border border-destructive/50 bg-transparent text-destructive hover:bg-destructive/10'

export const btnSm = 'text-[11px] h-6 px-2.5 rounded-md'

// ── Shared UI components ────────────────────────────────────────────────────

export function Divider() {
  return <div className="w-px h-5 bg-border flex-shrink-0" />
}

export function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between pb-2 mb-3 border-b border-border">
      <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
        {children}
      </span>
      {right && <div className="flex gap-1.5">{right}</div>}
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold text-muted-foreground mb-2">
      {children}
    </div>
  )
}

export function FinCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
      <div
        className="text-[15px] font-bold tabular-nums leading-none"
        style={{ color: color ?? 'var(--c-text-1)' }}
      >
        {value}
      </div>
    </div>
  )
}

export function FieldDisplay({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
      <div className={`text-[12px] font-semibold text-foreground truncate ${mono ? 'tabular-nums tracking-wide' : ''}`}>{value}</div>
    </div>
  )
}
