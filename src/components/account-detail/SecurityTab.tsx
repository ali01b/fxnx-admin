'use client'

import { useState } from 'react'
import { KeyRound, ShieldOff, UserX, UserCheck } from 'lucide-react'
import { resetUserPassword, disableUser2FA, toggleProfileSuspend } from '@/actions/accounts'
import {
  AccountDetail, FieldDisplay, fmtDt,
  btnSecondary, btnDanger, btnPrimary, btnGhost,
} from './shared'

interface Props {
  account:   AccountDetail
  onRefresh: () => void
}

type ActionKey = 'reset' | '2fa' | 'suspend'

export function SecurityTab({ account, onRefresh }: Props) {
  const profile     = Array.isArray(account.profiles) ? account.profiles[0] : account.profiles
  const profileId   = profile?.id ?? ''
  const isSuspended = profile?.status === 'suspended'

  const [loading,        setLoading]        = useState<ActionKey | null>(null)
  const [feedback,       setFeedback]       = useState<{ key: ActionKey; msg: string; ok: boolean } | null>(null)
  const [confirmSuspend, setConfirmSuspend] = useState(false)

  function flash(key: ActionKey, msg: string, ok: boolean) {
    setFeedback({ key, msg, ok })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function handleReset() {
    setLoading('reset')
    const res = await resetUserPassword(profileId)
    setLoading(null)
    flash('reset', res.error ? `Hata: ${res.error}` : 'Şifre sıfırlama e-postası gönderildi.', !res.error)
  }

  async function handle2FA() {
    setLoading('2fa')
    const res = await disableUser2FA(profileId)
    setLoading(null)
    if (res.error) flash('2fa', `Hata: ${res.error}`, false)
    else if (res.removed === 0) flash('2fa', '2FA zaten aktif değil.', true)
    else flash('2fa', `${res.removed} 2FA faktörü kaldırıldı.`, true)
  }

  async function handleSuspend() {
    setLoading('suspend')
    setConfirmSuspend(false)
    const res = await toggleProfileSuspend(profileId, !isSuspended)
    setLoading(null)
    if (res.error) {
      flash('suspend', `Hata: ${res.error}`, false)
    } else {
      flash('suspend', isSuspended ? 'Hesap aktif edildi.' : 'Hesap askıya alındı.', true)
      onRefresh()
    }
  }

  return (
    <div className="p-5 space-y-5 bg-card min-h-full">

      {/* ── Feedback bar ───────────────────────────────────────────────── */}
      {feedback && (
        <div
          className="text-[11px] font-semibold px-4 py-2.5 rounded-md border flex items-center gap-2"
          style={feedback.ok
            ? { background: 'color-mix(in srgb, var(--c-bull) 8%, transparent)', color: 'var(--c-bull)', borderColor: 'color-mix(in srgb, var(--c-bull) 25%, transparent)' }
            : { background: 'color-mix(in srgb, var(--c-bear) 8%, transparent)', color: 'var(--c-bear)', borderColor: 'color-mix(in srgb, var(--c-bear) 25%, transparent)' }
          }
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: feedback.ok ? 'var(--c-bull)' : 'var(--c-bear)' }}
          />
          {feedback.msg}
        </div>
      )}

      {/* ── User info ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center pb-1.5 mb-4 border-b border-border">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            User Info
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <FieldDisplay label="User ID"        value={profileId || '—'}                        mono />
          <FieldDisplay label="Profile Status" value={profile?.status?.toUpperCase() ?? '—'} />
          <FieldDisplay label="E-posta"        value={profile?.email ?? '—'} />
          <FieldDisplay label="Kayıt Tarihi"   value={fmtDt(profile?.created_at)} />
        </div>
      </section>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center pb-1.5 mb-3 border-b border-border">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Actions
          </span>
        </div>

        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">

          {/* Reset Password */}
          <div className="flex items-center gap-4 px-4 py-3.5 bg-card hover:bg-muted/30 transition-colors">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--c-primary-soft)' }}
            >
              <KeyRound size={14} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground">Şifre Sıfırla</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Kullanıcıya şifre sıfırlama e-postası gönderir.
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={loading === 'reset'}
              className={`${btnSecondary} disabled:opacity-50 flex-shrink-0`}
            >
              {loading === 'reset' ? 'Gönderiliyor…' : 'Reset Password'}
            </button>
          </div>

          {/* Disable 2FA */}
          <div className="flex items-center gap-4 px-4 py-3.5 bg-card hover:bg-muted/30 transition-colors">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--c-amber) 12%, transparent)' }}
            >
              <ShieldOff size={14} style={{ color: 'var(--c-amber)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground">2FA Devre Dışı</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Kullanıcının tüm 2FA faktörlerini kaldırır.
              </p>
            </div>
            <button
              onClick={handle2FA}
              disabled={loading === '2fa'}
              className={`${btnSecondary} disabled:opacity-50 flex-shrink-0`}
            >
              {loading === '2fa' ? 'İşleniyor…' : 'Disable 2FA'}
            </button>
          </div>

          {/* Suspend / Unsuspend */}
          <div className="flex items-center gap-4 px-4 py-3.5 bg-card hover:bg-muted/30 transition-colors">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: isSuspended
                  ? 'color-mix(in srgb, var(--c-bull) 12%, transparent)'
                  : 'color-mix(in srgb, var(--c-bear) 10%, transparent)',
              }}
            >
              {isSuspended
                ? <UserCheck size={14} style={{ color: 'var(--c-bull)' }} />
                : <UserX     size={14} style={{ color: 'var(--c-bear)' }} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground">
                {isSuspended ? 'Hesabı Aktif Et' : 'Hesabı Askıya Al'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isSuspended
                  ? 'Kullanıcının erişimini yeniden açar.'
                  : 'Kullanıcının platforma erişimini engeller.'}
              </p>
            </div>

            {confirmSuspend ? (
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setConfirmSuspend(false)}
                  className={btnGhost}
                >
                  İptal
                </button>
                <button
                  onClick={handleSuspend}
                  disabled={loading === 'suspend'}
                  className={`${btnPrimary} disabled:opacity-50`}
                  style={{ background: isSuspended ? 'var(--c-bull)' : 'var(--c-bear)' }}
                >
                  {loading === 'suspend' ? 'İşleniyor…' : 'Onayla'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmSuspend(true)}
                disabled={loading === 'suspend'}
                className={`${isSuspended ? btnSecondary : btnDanger} disabled:opacity-50 flex-shrink-0`}
                style={isSuspended
                  ? { borderColor: 'var(--c-bull)', color: 'var(--c-bull)' }
                  : undefined
                }
              >
                {isSuspended ? 'Aktif Et' : 'Suspend Account'}
              </button>
            )}
          </div>

        </div>
      </section>

    </div>
  )
}
