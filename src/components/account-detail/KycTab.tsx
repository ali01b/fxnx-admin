'use client'

import { useState, useEffect } from 'react'
import { updateKycStatus } from '@/actions/kyc'
import {
  AccountDetail, KYC_COLOR, FieldDisplay, fmtDt, fieldCls,
  btnPrimary, btnSecondary, btnDanger, btnGhost, btnSm,
} from './shared'

interface Props {
  account:     AccountDetail
  kycDocUrls:  Record<string, string>
  kycDecisions: Array<{ id?: string; decision: string; reason_code?: string; note?: string; created_at: string }>
  kycStatus:   string
  setKycStatus: (s: string) => void
  onRefresh:   () => void
}

const REJECTION_REASONS = [
  { code: 'BLURRY_IMAGE',     label: 'Blurry / unreadable image' },
  { code: 'EXPIRED_ID',       label: 'Document expired'          },
  { code: 'MISMATCH',         label: 'Name / date mismatch'      },
  { code: 'INCOMPLETE',       label: 'Incomplete document'        },
  { code: 'WRONG_DOCUMENT',   label: 'Wrong document type'       },
  { code: 'SELFIE_MISMATCH',  label: 'Selfie does not match ID'  },
  { code: 'SUSPECTED_FRAUD',  label: 'Suspected fraud'           },
]

export function KycTab({ account, kycDocUrls, kycDecisions, kycStatus, setKycStatus, onRefresh }: Props) {
  const profile = Array.isArray(account.profiles) ? account.profiles[0] : account.profiles
  const [showReject,    setShowReject]    = useState(false)
  const [activeDocUrl,  setActiveDocUrl]  = useState<string | null>(Object.values(kycDocUrls)[0] ?? null)
  const [activeDocName, setActiveDocName] = useState<string>(Object.keys(kycDocUrls)[0] ?? '')

  const kycColor = KYC_COLOR[kycStatus] ?? 'var(--c-text-3)'

  useEffect(() => {
    const urls  = Object.values(kycDocUrls)
    const names = Object.keys(kycDocUrls)
    if (urls.length > 0 && !activeDocUrl) {
      setActiveDocUrl(urls[0])
      setActiveDocName(names[0])
    }
  }, [kycDocUrls])

  return (
    <div className="flex flex-col" style={{ background: 'var(--c-bg)' }}>

      {/* ── Status Bar ────────────────────────────────────────────────── */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-5">

        {/* Status badge */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">KYC Status</span>
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full leading-none w-fit"
            style={{
              color:       kycColor,
              background:  `${kycColor}14`,
              border:      `1px solid ${kycColor}40`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: kycColor }} />
            {kycStatus.charAt(0).toUpperCase() + kycStatus.slice(1)}
          </span>
        </div>

        {(profile as any)?.kyc_submitted_at && (
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Submitted</span>
            <span className="text-[11px] font-semibold text-foreground font-mono">
              {fmtDt((profile as any).kyc_submitted_at)}
            </span>
          </div>
        )}

        {/* Action buttons — right aligned */}
        <div className="ml-auto flex items-center gap-2">
          {kycStatus !== 'verified' && (
            <button
              onClick={async () => {
                const fd = new FormData()
                fd.set('userId', profile?.id ?? '')
                fd.set('newStatus', 'verified')
                setKycStatus('verified')
                setShowReject(false)
                await updateKycStatus(fd)
                onRefresh()
              }}
              className={btnPrimary}
              style={{ background: 'var(--c-bull)' }}
            >
              Approve KYC
            </button>
          )}
          {kycStatus !== 'rejected' && (
            <button
              onClick={() => setShowReject((v) => !v)}
              className={showReject
                ? `${btnPrimary} !bg-[var(--c-bear)]`
                : btnDanger
              }
            >
              {showReject ? 'Cancel' : 'Reject KYC'}
            </button>
          )}
          {kycStatus !== 'pending' && kycStatus !== 'unverified' && (
            <button
              onClick={async () => {
                const fd = new FormData()
                fd.set('userId', profile?.id ?? '')
                fd.set('newStatus', 'pending')
                setKycStatus('pending')
                await updateKycStatus(fd)
                onRefresh()
              }}
              className={btnGhost}
            >
              Reset to Pending
            </button>
          )}
        </div>
      </div>

      {/* ── Reject form ───────────────────────────────────────────────── */}
      {showReject && (
        <form
          action={async (fd: FormData) => {
            fd.set('userId', profile?.id ?? '')
            fd.set('newStatus', 'rejected')
            setKycStatus('rejected')
            setShowReject(false)
            await updateKycStatus(fd)
            onRefresh()
          }}
          className="bg-card border-b border-border px-4 py-3 flex gap-3 items-end"
          style={{ borderLeft: '3px solid var(--c-bear)' }}
        >
          <div className="flex-1">
            <label className="block text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--c-bear)' }}>
              Rejection Reason
            </label>
            <select name="reason" className={`${fieldCls} w-full`}>
              <option value="">— Select reason —</option>
              {REJECTION_REASONS.map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--c-bear)' }}>
              Note (optional)
            </label>
            <input name="note" placeholder="Additional note…" className={`${fieldCls} w-full`} />
          </div>
          <button
            type="submit"
            className={btnPrimary}
            style={{ background: 'var(--c-bear)', flexShrink: 0 }}
          >
            Confirm Rejection
          </button>
        </form>
      )}

      {/* ── Documents + Identity panel ────────────────────────────────── */}
      <div className="flex min-h-[320px] flex-1">

        {/* Left: Document viewer */}
        <div className="flex-1 border-r border-border bg-card flex flex-col">

          {/* Section label */}
          <div className="px-3.5 py-2 border-b border-border flex items-center">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Documents</span>
          </div>

          {Object.keys(kycDocUrls).length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[11px] text-muted-foreground">Belge yüklenmemiş.</p>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">

              {/* Thumbnails sidebar */}
              <div className="w-[88px] border-r border-border overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
                {Object.entries(kycDocUrls).map(([name, url]) => (
                  <button
                    key={name}
                    onClick={() => { setActiveDocUrl(url); setActiveDocName(name) }}
                    className="block w-full p-1.5 border-b border-border cursor-pointer bg-transparent transition-colors text-center"
                    style={{
                      background: activeDocName === name ? 'var(--c-primary-soft)' : undefined,
                    }}
                  >
                    <div
                      className="h-[54px] rounded overflow-hidden flex items-center justify-center"
                      style={{
                        background:  'var(--c-border)',
                        border:      activeDocName === name
                          ? '2px solid var(--c-primary)'
                          : '1px solid var(--c-border)',
                        borderRadius: 6,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={name} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-[8px] text-muted-foreground mt-1 overflow-hidden text-ellipsis whitespace-nowrap px-0.5">
                      {name.replace(/\.[^.]+$/, '')}
                    </div>
                  </button>
                ))}
              </div>

              {/* Main preview */}
              <div className="flex-1 overflow-auto flex items-center justify-center bg-[#161618] p-4">
                {activeDocUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeDocUrl}
                    alt={activeDocName}
                    className="max-w-full max-h-[300px] object-contain rounded shadow-xl"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Identity + decision history */}
        <div className="w-[272px] flex-shrink-0 bg-card overflow-y-auto flex flex-col">

          {/* Identity */}
          <div className="px-3.5 py-2 border-b border-border">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              Identity Verification
            </span>
          </div>
          <div className="p-4 flex flex-col gap-3.5">
            <FieldDisplay label="Full Name"        value={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || '—'} />
            <FieldDisplay label="National ID (TC)" value={(profile as any)?.tc_identity_no ?? '—'} mono />
            <FieldDisplay label="Nationality"      value={(profile as any)?.nationality ?? '—'} />
            <FieldDisplay label="Date of Birth"    value={(profile as any)?.date_of_birth ? new Date((profile as any).date_of_birth).toLocaleDateString('en-GB') : '—'} />
            <FieldDisplay label="Gender"           value={(profile as any)?.gender ?? '—'} />
          </div>

          {/* Decision history */}
          {kycDecisions.length > 0 && (
            <>
              <div className="px-3.5 py-2 border-y border-border">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Decision History
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2.5">
                {kycDecisions.map((d, i) => {
                  const dColor = KYC_COLOR[d.decision] ?? 'var(--c-text-3)'
                  return (
                    <div
                      key={d.id ?? i}
                      className="pl-3 py-1.5 border-l-2"
                      style={{ borderColor: dColor }}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: dColor }}
                        >
                          {d.decision}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {new Date(d.created_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      {d.reason_code && (
                        <div className="text-[9px] text-muted-foreground mt-0.5">
                          {d.reason_code.replace(/_/g, ' ')}
                        </div>
                      )}
                      {d.note && (
                        <div className="text-[9px] text-muted-foreground italic mt-0.5">{d.note}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
