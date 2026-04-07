'use client'

import { useState } from 'react'
import { SectionCard } from '@/components/layout/SectionCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { logout } from '@/actions/auth'
import type { IBPortalData } from '@/actions/ib'
import { Users2, TrendingUp, Clock, CheckCircle2, Search, Copy, Check } from 'lucide-react'

interface Props {
  data: IBPortalData
}

export function IBPortalClient({ data }: Props) {
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)

  const filtered = data.clients.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.customer_no ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function copyRefLink() {
    const url = `${window.location.origin.replace('-admin', '')}/register?ref=${data.ref_code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="IB Portalım">
        <form action={logout}>
          <button
            type="submit"
            className="px-3 py-1.5 text-[11px] rounded bg-muted text-muted-foreground border border-border hover:text-foreground"
          >
            Çıkış Yap
          </button>
        </form>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Ref kodu kartı */}
        <SectionCard>
          <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Referans Kodunuz</p>
              <div className="flex items-center gap-2">
                <code className="text-[18px] font-bold font-mono tracking-widest" style={{ color: 'var(--c-primary)' }}>
                  {data.ref_code}
                </code>
                <button
                  onClick={copyRefLink}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-muted text-muted-foreground border border-border hover:text-foreground transition-colors"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Kopyalandı' : 'Linki Kopyala'}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Bu kod ile kayıt olan yatırımcılar otomatik olarak size bağlanır.
              </p>
            </div>
            <div className="flex gap-4 text-center flex-shrink-0">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">İlk Yatırım</p>
                <p className="text-[16px] font-bold" style={{ color: 'var(--c-bull)' }}>
                  %{(data.first_deposit_rate * 100).toFixed(1)}
                </p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sonraki Yatırımlar</p>
                <p className="text-[16px] font-bold" style={{ color: 'var(--c-bull)' }}>
                  %{(data.subsequent_rate * 100).toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Toplam Yatırımcı" value={data.stats.total_clients} icon={<Users2 size={15} />} />
          <StatCard label="Toplam Yatırım" value={`${fmt(data.stats.total_deposits)} ₺`} icon={<TrendingUp size={15} />} color="var(--c-primary)" />
          <StatCard label="Bekleyen Komisyon" value={`${fmt(data.stats.pending_commission)} ₺`} icon={<Clock size={15} />} color="var(--c-amber)" />
          <StatCard label="Ödenen Komisyon" value={`${fmt(data.stats.paid_commission)} ₺`} icon={<CheckCircle2 size={15} />} color="var(--c-bull)" />
        </div>

        {/* Müşteri tablosu */}
        <SectionCard>
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full bg-background border border-border rounded text-[11px] pl-7 pr-3 py-1.5 text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="İsim veya müşteri numarası..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                {['Ad Soyad', 'Müşteri No', 'KYC', 'Toplam Yatırım', 'Bekleyen Komisyon', 'Ödenen Komisyon', 'Kayıt Tarihi'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                    {data.clients.length === 0 ? 'Henüz yatırımcınız bulunmuyor.' : 'Sonuç bulunamadı.'}
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr key={c.client_id} className="border-b border-border bg-card hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-[12px] font-semibold text-foreground">{c.full_name}</td>
                  <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{c.customer_no ?? '—'}</td>
                  <td className="px-4 py-3">
                    <KycBadge status={c.kyc_status} />
                  </td>
                  <td className="px-4 py-3 text-[12px] font-mono text-foreground">
                    {fmt(c.total_deposits)} ₺
                    {c.deposit_count > 0 && (
                      <span className="ml-1 text-[10px] text-muted-foreground">({c.deposit_count}x)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-mono font-semibold" style={{ color: c.pending_commission > 0 ? 'var(--c-amber)' : undefined }}>
                    {fmt(c.pending_commission)} ₺
                  </td>
                  <td className="px-4 py-3 text-[12px] font-mono font-semibold" style={{ color: c.paid_commission > 0 ? 'var(--c-bull)' : undefined }}>
                    {fmt(c.paid_commission)} ₺
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">
                    {new Date(c.assigned_at).toLocaleDateString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length > 0 && (
            <div className="border-t border-border px-4 py-2 bg-muted/30 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{filtered.length} yatırımcı</span>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="text-muted-foreground">
                  Toplam yatırım: <span className="font-semibold text-foreground">{fmt(filtered.reduce((s, c) => s + c.total_deposits, 0))} ₺</span>
                </span>
                <span className="text-muted-foreground">
                  Bekleyen: <span className="font-semibold" style={{ color: 'var(--c-amber)' }}>{fmt(filtered.reduce((s, c) => s + c.pending_commission, 0))} ₺</span>
                </span>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color ?? 'var(--c-primary)'}18`, color: color ?? 'var(--c-primary)' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-[13px] font-bold text-foreground leading-tight truncate">{value}</p>
      </div>
    </div>
  )
}

function KycBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    approved: { label: 'Onaylı',     color: 'var(--c-bull)'   },
    pending:  { label: 'Bekliyor',   color: 'var(--c-amber)'  },
    rejected: { label: 'Reddedildi', color: 'var(--c-bear)'   },
  }
  const s = map[status ?? ''] ?? { label: '—', color: 'var(--c-border)' }
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
      style={{ background: `${s.color}18`, color: s.color }}
    >
      {s.label}
    </span>
  )
}

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
