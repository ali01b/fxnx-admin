'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  approveDepositRequest,
  approveWithdrawalRequest,
  rejectRequest,
  addReviewNote,
} from '@/actions/requests'
import {
  btnPrimary, btnSecondary, btnDanger, btnGhost, btnSm,
  fmtDt, fmt2,
} from '@/components/account-detail/shared'
import { CheckCircle, XCircle, StickyNote, AlertTriangle } from 'lucide-react'
import { PaymentAccountsClient } from '@/components/payment-accounts/PaymentAccountsClient'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  customer_no: string | null
}

interface DepositRequest {
  id: string
  account_id: string | null
  profile_id: string | null
  amount: number
  currency: string | null
  payment_method: string | null
  iban: string | null
  bank_name: string | null
  sender_name: string | null
  reference_no: string | null
  status: string
  aml_score: number | null
  aml_flags: string[] | null
  rejection_reason: string | null
  note: string | null
  created_at: string
  profiles: Profile | Profile[] | null
}

interface WithdrawalRequest {
  id: string
  account_id: string | null
  profile_id: string | null
  amount: number
  currency: string | null
  payment_method: string | null
  iban: string | null
  bank_name: string | null
  account_holder: string | null
  reference_no: string | null
  status: string
  aml_score: number | null
  aml_flags: string[] | null
  rejection_reason: string | null
  note: string | null
  created_at: string
  profiles: Profile | Profile[] | null
}

interface PaymentAccount {
  id: string
  type: string
  label: string | null
  description: string | null
  currency: string | null
  is_active: boolean
  bank_name: string | null
  account_holder: string | null
  iban: string | null
  swift: string | null
  coin: string | null
  network: string | null
  wallet_address: string | null
  created_at: string
}

interface Props {
  deposits: DepositRequest[]
  withdrawals: WithdrawalRequest[]
  paymentAccounts: PaymentAccount[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type RowAction =
  | { type: 'approve_confirm' }
  | { type: 'reject_input'; reason: string }
  | { type: 'note_input'; note: string }
  | null

function getProfile(profiles: Profile | Profile[] | null): Profile | null {
  if (!profiles) return null
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    pending:   { bg: 'var(--c-amber)',   text: '#fff', border: 'var(--c-amber)',  label: 'Beklemede' },
    reviewing: { bg: 'var(--c-purple)',  text: '#fff', border: 'var(--c-purple)', label: 'İncelemede' },
    approved:  { bg: 'var(--c-bull)',    text: '#fff', border: 'var(--c-bull)',   label: 'Onaylandı' },
    rejected:  { bg: 'var(--c-bear)',    text: '#fff', border: 'var(--c-bear)',   label: 'Reddedildi' },
  }
  const s = map[status] ?? { bg: 'var(--c-text-3)', text: '#fff', border: 'var(--c-text-3)', label: status }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  )
}

function AmlBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-[10px]">—</span>
  const color =
    score < 30 ? 'var(--c-bull)' :
    score < 70 ? 'var(--c-amber)' :
    'var(--c-bear)'
  return (
    <span className="font-mono text-[10px] font-bold" style={{ color }}>
      {score}
    </span>
  )
}

function PaymentBadge({ method }: { method: string | null }) {
  if (!method) return <span className="text-muted-foreground text-[10px]">—</span>
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-muted border border-border text-foreground">
      {method}
    </span>
  )
}

const STATUS_FILTERS = [
  { key: 'all',       label: 'Tümü' },
  { key: 'pending',   label: 'Beklemede' },
  { key: 'reviewing', label: 'İncelemede' },
  { key: 'approved',  label: 'Onaylandı' },
  { key: 'rejected',  label: 'Reddedildi' },
]

// ── Row component ─────────────────────────────────────────────────────────────

function DepositRow({
  req,
  action,
  setAction,
  isPending,
  onApprove,
  onReject,
  onNote,
  flash,
}: {
  req: DepositRequest
  action: RowAction
  setAction: (a: RowAction) => void
  isPending: boolean
  onApprove: (id: string) => void
  onReject: (id: string, reason: string) => void
  onNote: (id: string, note: string) => void
  flash?: boolean
}) {
  const profile = getProfile(req.profiles)
  const canApprove = req.status === 'pending' || req.status === 'reviewing'

  return (
    <>
      <tr className={`border-b border-border hover:bg-muted/30 transition-colors${flash ? ' req-flash' : ''}`}>
        {/* Date */}
        <td className="px-3 py-2 text-[10px] text-muted-foreground whitespace-nowrap font-mono">
          {fmtDt(req.created_at)}
        </td>
        {/* User */}
        <td className="px-3 py-2">
          <div className="text-[10px] font-semibold text-foreground">
            {profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || '—' : '—'}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">{profile?.email ?? '—'}</div>
        </td>
        {/* Amount */}
        <td className="px-3 py-2 text-right">
          <span className="text-[11px] font-bold font-mono" style={{ color: 'var(--c-bull)' }}>
            +{fmt2(Number(req.amount))}
          </span>
          <div className="text-[9px] text-muted-foreground">{req.currency ?? ''}</div>
        </td>
        {/* Payment Method */}
        <td className="px-3 py-2">
          <PaymentBadge method={req.payment_method} />
        </td>
        {/* Bank/IBAN */}
        <td className="px-3 py-2">
          <div className="text-[10px] font-semibold text-foreground">{req.bank_name ?? '—'}</div>
          <div className="text-[9px] text-muted-foreground font-mono mt-0.5 max-w-[120px] truncate">{req.iban ?? ''}</div>
        </td>
        {/* Sender name */}
        <td className="px-3 py-2 text-[10px] text-foreground">{req.sender_name ?? '—'}</td>
        {/* Reference No */}
        <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">{req.reference_no ?? '—'}</td>
        {/* AML Score */}
        <td className="px-3 py-2 text-center">
          <AmlBadge score={req.aml_score} />
        </td>
        {/* Status */}
        <td className="px-3 py-2">
          <StatusBadge status={req.status} />
        </td>
        {/* Actions */}
        <td className="px-3 py-2">
          <div className="flex items-center gap-1 flex-wrap">
            {canApprove && !action && (
              <button
                className={`${btnPrimary} ${btnSm}`}
                style={{ background: 'var(--c-bull)' }}
                disabled={isPending}
                onClick={() => setAction({ type: 'approve_confirm' })}
              >
                <CheckCircle size={10} />
                Onayla
              </button>
            )}
            {!action && (
              <button
                className={`${btnDanger} ${btnSm}`}
                disabled={isPending || req.status === 'rejected'}
                onClick={() => setAction({ type: 'reject_input', reason: '' })}
              >
                <XCircle size={10} />
                Reddet
              </button>
            )}
            {!action && (
              <button
                className={`${btnSecondary} ${btnSm}`}
                disabled={isPending}
                onClick={() => setAction({ type: 'note_input', note: req.note ?? '' })}
              >
                <StickyNote size={10} />
                Not
              </button>
            )}
            {action && (
              <button
                className={`${btnGhost} ${btnSm}`}
                onClick={() => setAction(null)}
              >
                İptal
              </button>
            )}
          </div>
        </td>
      </tr>
      {/* Inline action row */}
      {action && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={10} className="px-4 py-3">
            {action.type === 'approve_confirm' && (
              <div className="flex items-center gap-3">
                <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                <span className="text-[10px] text-foreground font-semibold">
                  Bu yatırım talebini onaylamak istediğinizden emin misiniz? Hesap bakiyesi güncellenecektir.
                </span>
                <button
                  className={`${btnPrimary} ${btnSm} ml-auto`}
                  style={{ background: 'var(--c-bull)' }}
                  disabled={isPending}
                  onClick={() => onApprove(req.id)}
                >
                  {isPending ? 'İşleniyor...' : 'Evet, Onayla'}
                </button>
              </div>
            )}
            {action.type === 'reject_input' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground flex-shrink-0">Red gerekçesi:</span>
                <input
                  className="flex-1 bg-background border border-border rounded text-[10px] px-2 py-1 outline-none focus:border-primary max-w-sm"
                  placeholder="Red gerekçesi girin..."
                  value={action.reason}
                  onChange={(e) => setAction({ type: 'reject_input', reason: e.target.value })}
                />
                <button
                  className={`${btnDanger} ${btnSm}`}
                  disabled={isPending || !action.reason.trim()}
                  onClick={() => onReject(req.id, action.reason)}
                >
                  {isPending ? 'İşleniyor...' : 'Reddet'}
                </button>
              </div>
            )}
            {action.type === 'note_input' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground flex-shrink-0">Not:</span>
                <input
                  className="flex-1 bg-background border border-border rounded text-[10px] px-2 py-1 outline-none focus:border-primary max-w-sm"
                  placeholder="İnceleme notu girin..."
                  value={action.note}
                  onChange={(e) => setAction({ type: 'note_input', note: e.target.value })}
                />
                <button
                  className={`${btnSecondary} ${btnSm}`}
                  disabled={isPending || !action.note.trim()}
                  onClick={() => onNote(req.id, action.note)}
                >
                  {isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function WithdrawalRow({
  req,
  action,
  setAction,
  isPending,
  onApprove,
  onReject,
  onNote,
  flash,
}: {
  req: WithdrawalRequest
  action: RowAction
  setAction: (a: RowAction) => void
  isPending: boolean
  onApprove: (id: string) => void
  onReject: (id: string, reason: string) => void
  onNote: (id: string, note: string) => void
  flash?: boolean
}) {
  const profile = getProfile(req.profiles)
  const canApprove = req.status === 'pending' || req.status === 'reviewing'

  return (
    <>
      <tr className={`border-b border-border hover:bg-muted/30 transition-colors${flash ? ' req-flash' : ''}`}>
        {/* Date */}
        <td className="px-3 py-2 text-[10px] text-muted-foreground whitespace-nowrap font-mono">
          {fmtDt(req.created_at)}
        </td>
        {/* User */}
        <td className="px-3 py-2">
          <div className="text-[10px] font-semibold text-foreground">
            {profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || '—' : '—'}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">{profile?.email ?? '—'}</div>
        </td>
        {/* Amount */}
        <td className="px-3 py-2 text-right">
          <span className="text-[11px] font-bold font-mono" style={{ color: 'var(--c-bear)' }}>
            -{fmt2(Number(req.amount))}
          </span>
          <div className="text-[9px] text-muted-foreground">{req.currency ?? ''}</div>
        </td>
        {/* Payment Method */}
        <td className="px-3 py-2">
          <PaymentBadge method={req.payment_method} />
        </td>
        {/* Bank/IBAN */}
        <td className="px-3 py-2">
          <div className="text-[10px] font-semibold text-foreground">{req.bank_name ?? '—'}</div>
          <div className="text-[9px] text-muted-foreground font-mono mt-0.5 max-w-[120px] truncate">{req.iban ?? ''}</div>
        </td>
        {/* Account holder */}
        <td className="px-3 py-2 text-[10px] text-foreground">{req.account_holder ?? '—'}</td>
        {/* Reference No */}
        <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">{req.reference_no ?? '—'}</td>
        {/* AML Score */}
        <td className="px-3 py-2 text-center">
          <AmlBadge score={req.aml_score} />
        </td>
        {/* Status */}
        <td className="px-3 py-2">
          <StatusBadge status={req.status} />
        </td>
        {/* Actions */}
        <td className="px-3 py-2">
          <div className="flex items-center gap-1 flex-wrap">
            {canApprove && !action && (
              <button
                className={`${btnPrimary} ${btnSm}`}
                style={{ background: 'var(--c-bull)' }}
                disabled={isPending}
                onClick={() => setAction({ type: 'approve_confirm' })}
              >
                <CheckCircle size={10} />
                Onayla
              </button>
            )}
            {!action && (
              <button
                className={`${btnDanger} ${btnSm}`}
                disabled={isPending || req.status === 'rejected'}
                onClick={() => setAction({ type: 'reject_input', reason: '' })}
              >
                <XCircle size={10} />
                Reddet
              </button>
            )}
            {!action && (
              <button
                className={`${btnSecondary} ${btnSm}`}
                disabled={isPending}
                onClick={() => setAction({ type: 'note_input', note: req.note ?? '' })}
              >
                <StickyNote size={10} />
                Not
              </button>
            )}
            {action && (
              <button
                className={`${btnGhost} ${btnSm}`}
                onClick={() => setAction(null)}
              >
                İptal
              </button>
            )}
          </div>
        </td>
      </tr>
      {/* Inline action row */}
      {action && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={10} className="px-4 py-3">
            {action.type === 'approve_confirm' && (
              <div className="flex items-center gap-3">
                <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                <span className="text-[10px] text-foreground font-semibold">
                  Bu çekim talebini onaylamak istediğinizden emin misiniz? Hesap bakiyesi düşülecektir.
                </span>
                <button
                  className={`${btnPrimary} ${btnSm} ml-auto`}
                  style={{ background: 'var(--c-bull)' }}
                  disabled={isPending}
                  onClick={() => onApprove(req.id)}
                >
                  {isPending ? 'İşleniyor...' : 'Evet, Onayla'}
                </button>
              </div>
            )}
            {action.type === 'reject_input' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground flex-shrink-0">Red gerekçesi:</span>
                <input
                  className="flex-1 bg-background border border-border rounded text-[10px] px-2 py-1 outline-none focus:border-primary max-w-sm"
                  placeholder="Red gerekçesi girin..."
                  value={action.reason}
                  onChange={(e) => setAction({ type: 'reject_input', reason: e.target.value })}
                />
                <button
                  className={`${btnDanger} ${btnSm}`}
                  disabled={isPending || !action.reason.trim()}
                  onClick={() => onReject(req.id, action.reason)}
                >
                  {isPending ? 'İşleniyor...' : 'Reddet'}
                </button>
              </div>
            )}
            {action.type === 'note_input' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground flex-shrink-0">Not:</span>
                <input
                  className="flex-1 bg-background border border-border rounded text-[10px] px-2 py-1 outline-none focus:border-primary max-w-sm"
                  placeholder="İnceleme notu girin..."
                  value={action.note}
                  onChange={(e) => setAction({ type: 'note_input', note: e.target.value })}
                />
                <button
                  className={`${btnSecondary} ${btnSm}`}
                  disabled={isPending || !action.note.trim()}
                  onClick={() => onNote(req.id, action.note)}
                >
                  {isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Table headers ─────────────────────────────────────────────────────────────

const TABLE_TH = 'px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap'

function TableHeader({ isDeposit }: { isDeposit: boolean }) {
  return (
    <thead>
      <tr className="bg-muted border-b border-border">
        <th className={TABLE_TH}>Tarih</th>
        <th className={TABLE_TH}>Kullanıcı</th>
        <th className={`${TABLE_TH} text-right`}>Tutar</th>
        <th className={TABLE_TH}>Yöntem</th>
        <th className={TABLE_TH}>Banka / IBAN</th>
        <th className={TABLE_TH}>{isDeposit ? 'Gönderen' : 'Hesap Sahibi'}</th>
        <th className={TABLE_TH}>Ref No</th>
        <th className={`${TABLE_TH} text-center`}>AML</th>
        <th className={TABLE_TH}>Durum</th>
        <th className={TABLE_TH}>İşlem</th>
      </tr>
    </thead>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function RequestsClient({ deposits: initialDeposits, withdrawals: initialWithdrawals, paymentAccounts }: Props) {
  const [tab, setTab] = useState<'deposit' | 'withdrawal' | 'payment-accounts'>('deposit')
  const [statusFilter, setStatusFilter] = useState('all')
  const [rowActions, setRowActions] = useState<Record<string, RowAction>>({})
  const [isPending, startTransition] = useTransition()
  const [deposits, setDeposits] = useState<DepositRequest[]>(initialDeposits)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(initialWithdrawals)
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const addFlash = (id: string) => {
    setFlashIds((prev) => new Set([...prev, id]))
    if (flashTimers.current[id]) clearTimeout(flashTimers.current[id])
    flashTimers.current[id] = setTimeout(() => {
      setFlashIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    }, 2500)
  }

  useEffect(() => {
    const supabase = createClient()

    const depCh = supabase
      .channel('rt-deposit-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deposit_requests' }, (payload) => {
        const row = payload.new as DepositRequest
        setDeposits((prev) => [row, ...prev])
        addFlash(row.id)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deposit_requests' }, (payload) => {
        const row = payload.new as DepositRequest
        setDeposits((prev) => prev.map((d) => d.id === row.id ? { ...d, ...row } : d))
      })
      .subscribe()

    const wdCh = supabase
      .channel('rt-withdrawal-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'withdrawal_requests' }, (payload) => {
        const row = payload.new as WithdrawalRequest
        setWithdrawals((prev) => [row, ...prev])
        addFlash(row.id)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'withdrawal_requests' }, (payload) => {
        const row = payload.new as WithdrawalRequest
        setWithdrawals((prev) => prev.map((w) => w.id === row.id ? { ...w, ...row } : w))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(depCh)
      supabase.removeChannel(wdCh)
      Object.values(flashTimers.current).forEach(clearTimeout)
    }
  }, [])

  const setRowAction = (id: string, action: RowAction) => {
    setRowActions((prev) => ({ ...prev, [id]: action }))
  }

  const filteredDeposits = statusFilter === 'all'
    ? deposits
    : deposits.filter((d) => d.status === statusFilter)

  const filteredWithdrawals = statusFilter === 'all'
    ? withdrawals
    : withdrawals.filter((w) => w.status === statusFilter)

  const handleApproveDeposit = (id: string) => {
    startTransition(async () => {
      await approveDepositRequest(id)
      setRowAction(id, null)
    })
  }

  const handleApproveWithdrawal = (id: string) => {
    startTransition(async () => {
      await approveWithdrawalRequest(id)
      setRowAction(id, null)
    })
  }

  const handleReject = (table: 'deposit_requests' | 'withdrawal_requests', id: string, reason: string) => {
    startTransition(async () => {
      await rejectRequest(table, id, reason)
      setRowAction(id, null)
    })
  }

  const handleNote = (table: 'deposit_requests' | 'withdrawal_requests', id: string, note: string) => {
    startTransition(async () => {
      await addReviewNote(table, id, note)
      setRowAction(id, null)
    })
  }

  return (
    <div className="p-6 space-y-4">
      <style>{`
        @keyframes req-flash {
          0%   { background-color: color-mix(in srgb, var(--c-primary) 18%, transparent); }
          100% { background-color: transparent; }
        }
        .req-flash { animation: req-flash 2.5s ease-out forwards; }
      `}</style>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-foreground">Talepler</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Para yatırma ve çekme taleplerini yönetin
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="px-2 py-1 bg-muted rounded-full border border-border font-semibold">
            {deposits.filter((d) => d.status === 'pending').length + withdrawals.filter((w) => w.status === 'pending').length} bekleyen talep
          </span>
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex items-center gap-2">
        {[
          { key: 'deposit',          label: 'Yatırım Talepleri',  count: deposits.length },
          { key: 'withdrawal',       label: 'Çekim Talepleri',    count: withdrawals.length },
          { key: 'payment-accounts', label: 'Ödeme Hesapları',    count: paymentAccounts.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key as 'deposit' | 'withdrawal' | 'payment-accounts'); setStatusFilter('all') }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
              tab === t.key
                ? 'bg-primary text-white shadow-sm'
                : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
            }`}
          >
            {t.label}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === t.key ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Ödeme Hesapları tab içeriği */}
      {tab === 'payment-accounts' && (
        <PaymentAccountsClient accounts={paymentAccounts} embedded />
      )}

      {/* Status filter bar + Table */}
      {tab !== 'payment-accounts' && <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const count = tab === 'deposit'
            ? (f.key === 'all' ? deposits.length : deposits.filter((d) => d.status === f.key).length)
            : (f.key === 'all' ? withdrawals.length : withdrawals.filter((w) => w.status === f.key).length)
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                statusFilter === f.key
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
              }`}
            >
              {f.label}
              <span className="text-[9px] opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <TableHeader isDeposit={tab === 'deposit'} />
            <tbody>
              {tab === 'deposit' && (
                filteredDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-[11px] text-muted-foreground">
                      Bu filtreye ait yatırım talebi bulunamadı
                    </td>
                  </tr>
                ) : (
                  filteredDeposits.map((req) => (
                    <DepositRow
                      key={req.id}
                      req={req}
                      action={rowActions[req.id] ?? null}
                      setAction={(a) => setRowAction(req.id, a)}
                      isPending={isPending}
                      onApprove={handleApproveDeposit}
                      onReject={(id, reason) => handleReject('deposit_requests', id, reason)}
                      onNote={(id, note) => handleNote('deposit_requests', id, note)}
                    />
                  ))
                )
              )}
              {tab === 'withdrawal' && (
                filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-[11px] text-muted-foreground">
                      Bu filtreye ait çekim talebi bulunamadı
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((req) => (
                    <WithdrawalRow
                      key={req.id}
                      req={req}
                      action={rowActions[req.id] ?? null}
                      setAction={(a) => setRowAction(req.id, a)}
                      isPending={isPending}
                      onApprove={handleApproveWithdrawal}
                      onReject={(id, reason) => handleReject('withdrawal_requests', id, reason)}
                      onNote={(id, note) => handleNote('withdrawal_requests', id, note)}
                    />
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </div>
  )
}
