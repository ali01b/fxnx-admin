'use client'

import { useState, useTransition } from 'react'
import { sendNotification } from '@/actions/notifications'

const TARGET_OPTIONS = [
  { value: 'all',        label: 'Tüm Kullanıcılar', color: 'var(--c-primary)', bg: 'var(--c-primary)18' },
  { value: 'kyc_status', label: 'KYC Durumuna Göre', color: '#7C3AED',         bg: '#7C3AED18' },
  { value: 'user',       label: 'Belirli Kullanıcı', color: 'var(--c-bull)',   bg: 'var(--c-bull)18' },
]
const KYC_STATUS_OPTIONS = ['unverified', 'pending', 'verified', 'rejected']

const TARGET_COLOR: Record<string, string> = {
  all: 'var(--c-primary)', kyc_status: '#7C3AED', user: 'var(--c-bull)',
}

interface Notification {
  id: string
  title: string
  body: string
  target_type: string
  target_value: string | null
  recipient_count: number
  send_push: boolean
  send_email: boolean
  status: string
  sent_at: string | null
  created_at: string
}

interface Props {
  history: Notification[]
}

const fmtDt = (s: string) =>
  new Date(s).toLocaleDateString('tr-TR') + ' ' +
  new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

export function NotificationsClient({ history: initialHistory }: Props) {
  const [history, setHistory]         = useState<Notification[]>(initialHistory)
  const [targetType, setTargetType]   = useState<string>('all')
  const [sendPush, setSendPush]       = useState(true)
  const [sendEmail, setSendEmail]     = useState(false)
  const [result, setResult]           = useState<{ success?: boolean; error?: string; recipientCount?: number } | null>(null)
  const [isPending, startTransition]  = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('send_push', sendPush ? 'true' : 'false')
    fd.set('send_email', sendEmail ? 'true' : 'false')
    setResult(null)
    startTransition(async () => {
      const res = await sendNotification(fd)
      setResult(res as any)
      if ((res as any)?.success) window.location.reload()
    })
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">

      {/* ── LEFT: Compose Panel ──────────────────────────── */}
      <div className="w-[400px] flex-shrink-0 bg-card border-r border-border flex flex-col">

        {/* Panel header */}
        <div className="border-b border-border px-4 py-3">
          <div className="text-[13px] font-bold text-foreground">Bildirim Gönder</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Kullanıcılara push veya e-posta bildirimi gönderin
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {/* Target audience */}
          <div>
            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Hedef Kitle
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {TARGET_OPTIONS.map((opt) => {
                const active = targetType === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTargetType(opt.value)}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-semibold cursor-pointer border transition-colors"
                    style={active
                      ? { background: opt.bg, border: `1px solid ${opt.color}`, color: opt.color }
                      : { background: 'var(--c-muted)', border: '1px solid var(--c-border)', color: 'var(--c-text-3)' }
                    }
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <input type="hidden" name="target_type" value={targetType} />
          </div>

          {/* Target value (conditional) */}
          {targetType === 'kyc_status' && (
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                KYC Durumu
              </div>
              <select
                name="target_value"
                className="w-full bg-background border border-border rounded text-[11px] px-2.5 py-1.5 text-foreground outline-none"
              >
                {KYC_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'user' && (
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Kullanıcı ID veya E-posta
              </div>
              <input
                name="target_value"
                placeholder="UUID veya user@example.com"
                className="w-full bg-background border border-border rounded text-[11px] px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          )}

          {targetType === 'all' && <input type="hidden" name="target_value" value="" />}

          {/* Title */}
          <div>
            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Bildirim Başlığı
            </div>
            <input
              name="title"
              placeholder="örn. Önemli Hesap Güncellemesi"
              className="w-full bg-background border border-border rounded text-[11px] px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          {/* Body */}
          <div>
            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Mesaj İçeriği
            </div>
            <textarea
              name="body"
              placeholder="Mesajınızı buraya yazın..."
              rows={5}
              className="w-full bg-background border border-border rounded text-[11px] px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground outline-none resize-y leading-relaxed"
            />
          </div>

          {/* Channels */}
          <div>
            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Teslimat Kanalları
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSendPush((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold cursor-pointer border transition-colors"
                style={sendPush
                  ? { background: 'var(--c-primary)18', border: '1px solid var(--c-primary)', color: 'var(--c-primary)' }
                  : { background: 'var(--c-muted)', border: '1px solid var(--c-border)', color: 'var(--c-text-3)' }
                }
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
                Push Bildirimi
              </button>
              <button
                type="button"
                onClick={() => setSendEmail((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold cursor-pointer border transition-colors"
                style={sendEmail
                  ? { background: '#7C3AED18', border: '1px solid #7C3AED', color: '#7C3AED' }
                  : { background: 'var(--c-muted)', border: '1px solid var(--c-border)', color: 'var(--c-text-3)' }
                }
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                E-posta
                <span className="text-[9px] opacity-50">(Resend)</span>
              </button>
            </div>
          </div>

          {/* Result */}
          {result?.error && (
            <div
              className="rounded-lg px-3 py-2.5 text-[11px]"
              style={{ background: 'var(--c-bear)18', border: '1px solid var(--c-bear)40', color: 'var(--c-bear)' }}
            >
              {result.error}
            </div>
          )}
          {result?.success && (
            <div
              className="rounded-lg px-3 py-2.5 text-[11px]"
              style={{ background: 'var(--c-bull)18', border: '1px solid var(--c-bull)40', color: 'var(--c-bull)' }}
            >
              {result.recipientCount} alıcıya gönderildi.
            </div>
          )}

          {/* Submit */}
          <div className="pt-1 border-t border-border">
            <button
              type="submit"
              disabled={isPending || (!sendPush && !sendEmail)}
              className="w-full py-2 rounded text-[12px] font-bold text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              style={{ background: 'var(--c-primary)' }}
            >
              {isPending ? 'Gönderiliyor...' : 'Bildirimi Gönder'}
            </button>
          </div>
        </form>
      </div>

      {/* ── RIGHT: History ──────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* History header */}
        <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-foreground">Gönderilen Bildirimler</span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: 'var(--c-primary)', background: 'var(--c-primary)18' }}
            >
              {history.length}
            </span>
          </div>
        </div>

        {/* History table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted border-b border-border">
                {['Tarih', 'Başlık', 'Mesaj', 'Hedef', 'Alıcı', 'Kanal', 'Durum'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((n) => {
                const tColor = TARGET_COLOR[n.target_type] ?? 'var(--c-text-3)'
                return (
                  <tr key={n.id} className="border-b border-border bg-card hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                      {fmtDt(n.sent_at ?? n.created_at)}
                    </td>
                    <td className="px-3 py-2 font-bold text-foreground max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {n.title}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {n.body}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{ color: tColor, background: `${tColor}18` }}
                      >
                        {n.target_type === 'all'
                          ? 'Tümü'
                          : n.target_value
                            ? `${n.target_type}: ${n.target_value}`
                            : n.target_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-foreground text-center">
                      {n.recipient_count}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {n.send_push && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ color: 'var(--c-primary)', background: 'var(--c-primary)18' }}
                          >
                            Push
                          </span>
                        )}
                        {n.send_email && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ color: '#7C3AED', background: '#7C3AED18' }}
                          >
                            E-posta
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={n.status === 'sent'
                          ? { color: 'var(--c-bull)', background: 'var(--c-bull)18' }
                          : { color: 'var(--c-amber)', background: 'var(--c-amber)18' }
                        }
                      >
                        {n.status === 'sent' ? 'Gönderildi' : n.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[12px] text-muted-foreground">
                    Henüz bildirim gönderilmedi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
