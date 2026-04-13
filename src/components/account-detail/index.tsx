'use client'

import { useState } from 'react'
import { X, Plus, UserCircle2, TrendingUp, User, ShieldCheck, Lock, ChevronRight } from 'lucide-react'
import { createTradingAccount, getKycDocUrls } from '@/actions/accounts'
import { TradingTab }  from './TradingTab'
import { PersonalTab } from './PersonalTab'
import { KycTab }      from './KycTab'
import { SecurityTab } from './SecurityTab'
import {
  AccountDetail, TradingTerm, Position, Transaction,
  Computed, TermInstrument, fieldCls, selectCls, btnPrimary, btnSecondary, btnGhost,
} from './shared'

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

const TABS: { key: MainTab; label: string; icon: React.ElementType }[] = [
  { key: 'trading',  label: 'İşlem',            icon: TrendingUp  },
  { key: 'personal', label: 'Kişisel Bilgiler',  icon: User        },
  { key: 'kyc',      label: 'Kimlik Doğrulama',  icon: ShieldCheck },
  { key: 'security', label: 'Güvenlik',           icon: Lock        },
]

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:    { label: 'Aktif',    color: 'var(--c-bull)'    },
  suspended: { label: 'Askıda',   color: 'var(--c-orange)'  },
  closed:    { label: 'Kapalı',   color: 'var(--c-bear)'    },
  pending:   { label: 'Bekliyor', color: 'var(--c-amber)'   },
}

const KYC_MAP: Record<string, { label: string; color: string }> = {
  approved:   { label: 'Onaylı',    color: 'var(--c-bull)'   },
  verified:   { label: 'Onaylı',    color: 'var(--c-bull)'   },
  pending:    { label: 'Bekliyor',  color: 'var(--c-amber)'  },
  rejected:   { label: 'Reddedildi',color: 'var(--c-bear)'  },
  none:       { label: 'Yok',       color: 'var(--c-text-3)' },
}

// ── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const parts    = name.trim().split(' ')
  const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  const hue      = [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 360
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl text-white font-bold flex-shrink-0"
      style={{
        width:      size,
        height:     size,
        background: `hsl(${hue},40%,38%)`,
        fontSize:   size * 0.36,
      }}
    >
      {initials.toUpperCase() || <UserCircle2 size={size * 0.55} />}
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

  const statusInfo = STATUS_MAP[account.status] ?? { label: account.status, color: 'var(--c-text-3)' }
  const kycInfo    = KYC_MAP[kycStatus]         ?? KYC_MAP.none

  function handleTabClick(key: MainTab) {
    setMainTab(key)
    if (key === 'kyc' && !kycUrlsLoaded && profile?.id) {
      setKycUrlsLoaded(true)
      getKycDocUrls(profile.id).then(setLazyKycUrls)
    }
  }

  return (
    <>
      <div className="flex h-full overflow-hidden">

        {/* ── Left Sidebar ────────────────────────────────────────────── */}
        <div className="w-[210px] flex-shrink-0 flex flex-col bg-card border-r border-border">

          {/* Top: close button */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Hesap Detayı
            </span>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer border-none bg-transparent"
            >
              <X size={13} />
            </button>
          </div>

          {/* User card */}
          <div className="px-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="relative">
                <Avatar name={fullName} size={42} />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card"
                  style={{ background: statusInfo.color }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-foreground leading-tight truncate">{fullName}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--c-primary)' }}>
                  {account.account_code}
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="mt-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Durum</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none"
                  style={{ color: statusInfo.color, background: `${statusInfo.color}18`, border: `1px solid ${statusInfo.color}30` }}
                >
                  {statusInfo.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">KYC</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none"
                  style={{ color: kycInfo.color, background: `${kycInfo.color}18`, border: `1px solid ${kycInfo.color}30` }}
                >
                  {kycInfo.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Para Birimi</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full leading-none"
                  style={{ color: 'var(--c-primary)', background: 'var(--c-primary-soft)', border: '1px solid var(--c-primary-border)' }}
                >
                  {account.currency}
                </span>
              </div>
              {profile?.email && (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={profile.email}>
                  {profile.email}
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 h-px bg-border" />

          {/* Navigation */}
          <nav className="flex-1 p-2 pt-3 space-y-0.5">
            {TABS.map(({ key, label, icon: Icon }) => {
              const isActive = mainTab === key
              return (
                <button
                  key={key}
                  onClick={() => handleTabClick(key)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                    text-[12px] font-medium transition-all cursor-pointer border-none text-left
                    ${isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                    }
                  `}
                >
                  <Icon size={13} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="flex-1">{label}</span>
                  {key === 'kyc' && kycStatus === 'pending' && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--c-amber)' }} />
                  )}
                  {isActive && <ChevronRight size={11} className="opacity-60 flex-shrink-0" />}
                </button>
              )
            })}
          </nav>

          {/* Footer action */}
          <div className="p-3 border-t border-border">
            <button
              onClick={() => setShowCreate(true)}
              className={`${btnSecondary} w-full justify-center`}
            >
              <Plus size={13} strokeWidth={2} />
              Hesap Ekle
            </button>
          </div>
        </div>

        {/* ── Right Content ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-background min-w-0">
          {/* TradingTab her zaman mount'lu kalır — sekme geçişinde unmount olmaz,
              WS subscription/fiyatlar kesilmez, geri gelince yeniden fetch gerekmez */}
          <div className={mainTab === 'trading' ? '' : 'hidden'}>
            <TradingTab
              account={account}
              positions={positions}
              transactions={transactions}
              allTerms={allTerms}
              termInstruments={termInstruments}
              initialPosTab={initialPosTab}
              initialEditPositionId={initialEditPositionId}
            />
          </div>
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
      </div>

      {/* ── Yeni Hesap Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-card rounded-2xl w-[420px] shadow-2xl border border-border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-[14px] font-bold text-foreground">Yeni Hesap Oluştur</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{fullName}</p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
            <form
              action={async (fd: FormData) => { await createTradingAccount(fd); setShowCreate(false) }}
              className="p-5 space-y-4"
            >
              <input type="hidden" name="profile_id" value={profile?.id ?? ''} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                    Para Birimi
                  </label>
                  <select name="currency" className={`${selectCls} w-full`}>
                    {['TRY', 'USD', 'EUR', 'GBP'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                    Hesap Tipi
                  </label>
                  <select name="account_type" className={`${selectCls} w-full`}>
                    <option value="live">Gerçek</option>
                    <option value="demo">Demo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                  İşlem Koşulları
                </label>
                <div className="flex gap-2">
                  <select name="trading_terms_id" className={`${selectCls} flex-1`}>
                    <option value="">— Varsayılan —</option>
                    {allTerms.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <select name="margin_type" className={selectCls}>
                    <option value="group">Grup</option>
                    <option value="specific">Spesifik</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-border">
                <button type="button" onClick={() => setShowCreate(false)} className={btnGhost}>
                  İptal
                </button>
                <button type="submit" className={btnPrimary}>
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
