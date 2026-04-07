'use client'

import { useState } from 'react'
import { X, Plus, UserCircle2 } from 'lucide-react'
import { createTradingAccount, getKycDocUrls } from '@/actions/accounts'
import { TradingTab }  from './TradingTab'
import { PersonalTab } from './PersonalTab'
import { KycTab }      from './KycTab'
import { SecurityTab } from './SecurityTab'
import {
  AccountDetail, TradingTerm, Position, Transaction,
  Computed, TermInstrument, fieldCls, btnPrimary, btnSecondary, btnGhost,
} from './shared'

// ── Types ──────────────────────────────────────────────────────────────────

type MainTab = 'trading' | 'personal' | 'kyc' | 'security'
type PosTab  = 'open' | 'pending' | 'closed' | 'transactions'

interface Props {
  onClose:               () => void
  onRefresh:             () => void
  account:               AccountDetail
  positions:             Position[]
  transactions:          Transaction[]
  kycDocUrls:            Record<string, string>
  kycDecisions:          Array<{ id?: string; decision: string; reason_code?: string; note?: string; created_at: string }>
  computed?:             Computed
  allTerms:              TradingTerm[]
  termInstruments:       TermInstrument[]
  initialPosTab?:        PosTab
  initialEditPositionId?: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const TABS: { key: MainTab; label: string }[] = [
  { key: 'trading',  label: 'Trading'         },
  { key: 'personal', label: 'Kişisel Bilgiler' },
  { key: 'kyc',      label: 'KYC'              },
  { key: 'security', label: 'Güvenlik'         },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function InitialsAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const parts    = name.trim().split(' ')
  const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  const hue      = [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 360
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0 shadow-sm"
      style={{
        width:      size,
        height:     size,
        background: `hsl(${hue},50%,42%)`,
        fontSize:   size * 0.37,
        letterSpacing: '-0.02em',
      }}
    >
      {initials.toUpperCase() || <UserCircle2 size={size * 0.55} />}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active:    { label: 'Aktif',    color: 'var(--c-bull)'    },
    suspended: { label: 'Askıda',   color: 'var(--c-orange)'  },
    closed:    { label: 'Kapalı',   color: 'var(--c-bear)'    },
    pending:   { label: 'Bekliyor', color: 'var(--c-amber)'   },
  }
  const { label, color } = map[status] ?? { label: status, color: 'var(--c-text-3)' }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border leading-none"
      style={{ color, background: `${color}14`, borderColor: `${color}40` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      {label}
    </span>
  )
}

function KycPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    approved: { label: 'KYC ✓', color: 'var(--c-bull)'  },
    verified: { label: 'KYC ✓', color: 'var(--c-bull)'  },
    pending:  { label: 'KYC …', color: 'var(--c-amber)' },
    rejected: { label: 'KYC ✗', color: 'var(--c-bear)'  },
    none:     { label: 'KYC —', color: 'var(--c-text-3)'},
  }
  const { label, color } = map[status] ?? map.none
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border leading-none"
      style={{ color, background: `${color}14`, borderColor: `${color}40` }}
    >
      {label}
    </span>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export function AccountDetailPanel({
  account, positions, transactions, kycDecisions,
  allTerms, termInstruments, initialPosTab, initialEditPositionId,
  onClose, onRefresh,
}: Omit<Props, 'kycDocUrls'>) {
  const [mainTab,       setMainTab]       = useState<MainTab>('trading')
  const [kycStatus,     setKycStatus]     = useState<string>(
    (Array.isArray(account.profiles) ? account.profiles[0] : account.profiles)?.kyc_status ?? 'none'
  )
  const [showCreate,    setShowCreate]    = useState(false)
  const [lazyKycUrls,   setLazyKycUrls]  = useState<Record<string, string>>({})
  const [kycUrlsLoaded, setKycUrlsLoaded] = useState(false)

  const profile  = Array.isArray(account.profiles) ? account.profiles[0] : account.profiles
  const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || '—'

  function handleTabClick(key: MainTab) {
    setMainTab(key)
    if (key === 'kyc' && !kycUrlsLoaded && profile?.id) {
      setKycUrlsLoaded(true)
      getKycDocUrls(profile.id).then(setLazyKycUrls)
    }
  }

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-card border-b border-border">

        {/* Top row: avatar + info + actions */}
        <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">

          {/* Left: avatar + identity */}
          <div className="flex items-center gap-3 min-w-0">
            <InitialsAvatar name={fullName} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span
                  className="font-mono font-bold text-[14px] leading-none tracking-tight"
                  style={{ color: 'var(--c-primary)' }}
                >
                  {account.account_code}
                </span>
                <StatusPill status={account.status} />
                <KycPill    status={kycStatus} />
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md font-mono leading-none"
                  style={{
                    color:      'var(--c-primary)',
                    background: 'var(--c-primary-soft)',
                  }}
                >
                  {account.currency}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate leading-none">
                {fullName}
                {profile?.email && (
                  <span className="ml-2 opacity-60">{profile.email}</span>
                )}
              </p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowCreate(true)}
              className={btnSecondary}
            >
              <Plus size={11} strokeWidth={2.5} />
              Hesap Ekle
            </button>
            <button
              onClick={onClose}
              className={`${btnGhost} w-7 h-7 px-0`}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tab bar — pill style */}
        <nav className="flex items-center gap-0.5 px-4 pb-2">
          {TABS.map(({ key, label }) => {
            const isActive = mainTab === key
            return (
              <button
                key={key}
                onClick={() => handleTabClick(key)}
                className={`
                  flex items-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-semibold
                  transition-all cursor-pointer border-none
                  ${isActive
                    ? 'bg-[var(--c-primary)] text-white shadow-sm'
                    : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                `}
              >
                {label}
                {key === 'kyc' && kycStatus === 'pending' && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: isActive ? 'rgba(255,255,255,0.7)' : 'var(--c-amber)' }}
                  />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
        {mainTab === 'trading' && (
          <TradingTab
            account={account}
            positions={positions}
            transactions={transactions}
            allTerms={allTerms}
            termInstruments={termInstruments}
            initialPosTab={initialPosTab}
            initialEditPositionId={initialEditPositionId}
          />
        )}
        {mainTab === 'personal' && (
          <PersonalTab account={account} kycStatus={kycStatus} />
        )}
        {mainTab === 'kyc' && (
          <KycTab
            account={account}
            kycDocUrls={lazyKycUrls}
            kycDecisions={kycDecisions}
            kycStatus={kycStatus}
            setKycStatus={setKycStatus}
            onRefresh={onRefresh}
          />
        )}
        {mainTab === 'security' && (
          <SecurityTab account={account} onRefresh={onRefresh} />
        )}
      </div>

      {/* ── Yeni Hesap Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-[150] bg-black/40 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-card rounded-xl w-[420px] shadow-2xl border border-border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="text-[13px] font-bold" style={{ color: 'var(--c-text-1)' }}>
                  Yeni Hesap Oluştur
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{fullName}</p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className={`${btnGhost} w-7 h-7 px-0`}
              >
                <X size={13} />
              </button>
            </div>

            {/* Modal form */}
            <form
              action={async (fd: FormData) => { await createTradingAccount(fd); setShowCreate(false) }}
              className="p-4 space-y-3"
            >
              <input type="hidden" name="profile_id" value={profile?.id ?? ''} />

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                    Para Birimi
                  </label>
                  <select name="currency" className={`${fieldCls} w-full cursor-pointer`}>
                    {['TRY', 'USD', 'EUR', 'GBP'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                    Hesap Tipi
                  </label>
                  <select name="account_type" className={`${fieldCls} w-full cursor-pointer`}>
                    <option value="live">Gerçek</option>
                    <option value="demo">Demo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  İşlem Koşulları
                </label>
                <div className="flex gap-2">
                  <select name="trading_terms_id" className={`${fieldCls} flex-1 cursor-pointer`}>
                    <option value="">— Varsayılan —</option>
                    {allTerms.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <select name="margin_type" className={`${fieldCls} cursor-pointer`}>
                    <option value="group">Grup</option>
                    <option value="specific">Spesifik</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className={btnSecondary}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className={btnPrimary}
                >
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
