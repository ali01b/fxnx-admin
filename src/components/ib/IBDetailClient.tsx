'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/layout/SectionCard'
import {
  updateIBRates, updateIBStatus, updateRefCode, assignClientToIB,
  removeClientFromIB, markCommissionsPaid,
  getProfilesForIBAssign, type IBDetail,
} from '@/actions/ib'
import { ArrowLeft, Users2, TrendingUp, CheckCircle2, Clock, Pencil } from 'lucide-react'

interface Props {
  detail: IBDetail
}

type Tab = 'clients' | 'commissions'

export function IBDetailClient({ detail }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('clients')
  const [editingRates, setEditingRates] = useState(false)
  const [firstRate, setFirstRate] = useState(String(detail.first_deposit_rate * 100))
  const [subsRate, setSubsRate] = useState(String(detail.subsequent_rate * 100))
  const [editingRefCode, setEditingRefCode] = useState(false)
  const [refCodeValue, setRefCodeValue] = useState(detail.ref_code)
  const [selectedCommissions, setSelectedCommissions] = useState<Set<string>>(new Set())
  const [paidNote, setPaidNote] = useState('')
  const [profileSearch, setProfileSearch] = useState('')
  const [profiles, setProfiles] = useState<{ id: string; first_name: string | null; last_name: string | null; customer_no: string | null }[]>([])
  const [commissionFilter, setCommissionFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const inputCls = 'bg-background border border-border rounded text-[11px] px-2.5 py-1.5 text-foreground outline-none w-full focus:border-[var(--c-primary)]'

  function saveRefCode() {
    setError(null)
    startTransition(async () => {
      const res = await updateRefCode(detail.id, refCodeValue)
      if (res.error) { setError(res.error); return }
      setEditingRefCode(false)
      window.location.reload()
    })
  }

  function saveRates() {
    const fr = parseFloat(firstRate)
    const sr = parseFloat(subsRate)
    if (isNaN(fr) || isNaN(sr)) { setError('Geçersiz oran.'); return }
    setError(null)
    startTransition(async () => {
      const res = await updateIBRates(detail.id, { firstDepositRate: fr / 100, subsequentRate: sr / 100 })
      if (res.error) { setError(res.error); return }
      setEditingRates(false)
      window.location.reload()
    })
  }

  function handleStatusToggle() {
    const newStatus = detail.status === 'active' ? 'suspended' : 'active'
    const label = newStatus === 'suspended' ? 'askıya almak' : 'aktifleştirmek'
    if (!confirm(`Bu IB'yi ${label} istediğinize emin misiniz?`)) return
    startTransition(async () => {
      await updateIBStatus(detail.id, newStatus)
      window.location.reload()
    })
  }

  function handleProfileSearch(q: string) {
    setProfileSearch(q)
    if (q.length < 2) { setProfiles([]); return }
    startTransition(async () => {
      const res = await getProfilesForIBAssign(q)
      setProfiles(res)
    })
  }

  function handleAssignClient(clientId: string) {
    setProfiles([])
    setProfileSearch('')
    startTransition(async () => {
      const res = await assignClientToIB(detail.id, clientId)
      if (res.error) { setError(res.error); return }
      window.location.reload()
    })
  }

  function handleRemoveClient(clientId: string) {
    if (!confirm('Bu müşteriyi IB\'den çıkarmak istediğinize emin misiniz?')) return
    startTransition(async () => {
      const res = await removeClientFromIB(clientId)
      if (res.error) { setError(res.error); return }
      window.location.reload()
    })
  }

  function toggleCommission(id: string) {
    setSelectedCommissions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllPending() {
    const pendingIds = filteredCommissions.filter(c => c.status === 'pending').map(c => c.id)
    const allSelected = pendingIds.every(id => selectedCommissions.has(id))
    setSelectedCommissions(allSelected ? new Set() : new Set(pendingIds))
  }

  function handleMarkPaid() {
    if (selectedCommissions.size === 0) return
    startTransition(async () => {
      const res = await markCommissionsPaid(Array.from(selectedCommissions), paidNote || undefined)
      if (res.error) { setError(res.error); return }
      setSelectedCommissions(new Set())
      setPaidNote('')
      window.location.reload()
    })
  }

  const filteredCommissions = detail.commissions.filter(c =>
    commissionFilter === 'all' ? true : c.status === commissionFilter
  )

  const pendingTotal = detail.commissions.filter(c => c.status === 'pending').reduce((a, c) => a + c.commission_amount, 0)
  const paidTotal    = detail.commissions.filter(c => c.status === 'paid').reduce((a, c) => a + c.commission_amount, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title={[detail.profile?.first_name, detail.profile?.last_name].filter(Boolean).join(' ') || 'IB Detay'}>
        <button
          onClick={() => router.push('/dashboard/ib')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] bg-muted text-muted-foreground border border-border hover:text-foreground"
        >
          <ArrowLeft size={12} />
          Geri
        </button>
        <button
          onClick={handleStatusToggle}
          disabled={isPending}
          className="px-3 py-1.5 rounded text-[11px] font-semibold disabled:opacity-50"
          style={{
            background: detail.status === 'active' ? 'var(--c-bear)18' : 'var(--c-bull)18',
            color: detail.status === 'active' ? 'var(--c-bear)' : 'var(--c-bull)',
            border: `1px solid ${detail.status === 'active' ? 'var(--c-bear)' : 'var(--c-bull)'}`,
          }}
        >
          {detail.status === 'active' ? 'Askıya Al' : 'Aktifleştir'}
        </button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Info card */}
        <SectionCard>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <InfoItem label="Ref Kodu">
              {editingRefCode ? (
                <input
                  className="bg-background border border-border rounded text-[11px] px-2 py-1 w-28 text-foreground outline-none font-mono uppercase"
                  value={refCodeValue}
                  onChange={e => setRefCodeValue(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') saveRefCode(); if (e.key === 'Escape') { setEditingRefCode(false); setRefCodeValue(detail.ref_code) } }}
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <code className="font-mono text-[12px] bg-muted px-1.5 py-0.5 rounded">{detail.ref_code}</code>
                  <button onClick={() => setEditingRefCode(true)} className="text-muted-foreground hover:text-foreground">
                    <Pencil size={11} />
                  </button>
                </div>
              )}
            </InfoItem>
            <InfoItem label="İlk Yatırım Oranı">
              {editingRates ? (
                <input className="bg-background border border-border rounded text-[11px] px-2 py-1 w-16 text-foreground outline-none" type="number" value={firstRate} onChange={e => setFirstRate(e.target.value)} />
              ) : (
                <span className="text-[13px] font-bold text-foreground">%{(detail.first_deposit_rate * 100).toFixed(1)}</span>
              )}
            </InfoItem>
            <InfoItem label="Sonraki Yatırım Oranı">
              {editingRates ? (
                <input className="bg-background border border-border rounded text-[11px] px-2 py-1 w-16 text-foreground outline-none" type="number" value={subsRate} onChange={e => setSubsRate(e.target.value)} />
              ) : (
                <span className="text-[13px] font-bold text-foreground">%{(detail.subsequent_rate * 100).toFixed(1)}</span>
              )}
            </InfoItem>
            <InfoItem label="Durum">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: detail.status === 'active' ? 'var(--c-bull)18' : 'var(--c-bear)18',
                  color: detail.status === 'active' ? 'var(--c-bull)' : 'var(--c-bear)',
                }}
              >
                {detail.status === 'active' ? 'Aktif' : 'Askıda'}
              </span>
            </InfoItem>
          </div>
          <div className="border-t border-border px-4 py-2 flex items-center gap-2 justify-end">
            {(editingRates || editingRefCode) ? (
              <>
                {error && <span className="text-[11px] mr-auto" style={{ color: 'var(--c-bear)' }}>{error}</span>}
                <button
                  onClick={() => { setEditingRates(false); setEditingRefCode(false); setRefCodeValue(detail.ref_code) }}
                  className="px-3 py-1 text-[11px] rounded bg-muted text-muted-foreground border border-border"
                >
                  İptal
                </button>
                <button
                  onClick={editingRates ? saveRates : saveRefCode}
                  disabled={isPending}
                  className="px-3 py-1 text-[11px] font-semibold rounded text-white disabled:opacity-50"
                  style={{ background: 'var(--c-primary)' }}
                >
                  {isPending ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditingRates(true)} className="flex items-center gap-1.5 px-3 py-1 text-[11px] rounded bg-muted text-muted-foreground border border-border hover:text-foreground">
                <Pencil size={11} /> Oranları Düzenle
              </button>
            )}
          </div>
        </SectionCard>

        {/* Commission summary */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Toplam Müşteri" value={detail.clients.length} icon={<Users2 size={15} />} />
          <StatCard label="Bekleyen Komisyon" value={`${fmt(pendingTotal)} TRY`} icon={<Clock size={15} />} color="var(--c-amber)" />
          <StatCard label="Ödenen Komisyon" value={`${fmt(paidTotal)} TRY`} icon={<CheckCircle2 size={15} />} color="var(--c-bull)" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {([['clients', 'Müşteriler'], ['commissions', 'Komisyon Geçmişi']] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-4 py-2 text-[12px] font-semibold transition-colors"
              style={{
                borderBottom: tab === key ? '2px solid var(--c-primary)' : '2px solid transparent',
                color: tab === key ? 'var(--c-primary)' : undefined,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Clients tab */}
        {tab === 'clients' && (
          <SectionCard>
            {/* Add client */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <input
                  className={inputCls}
                  placeholder="Müşteri ekle: Ad veya müşteri no..."
                  value={profileSearch}
                  onChange={e => handleProfileSearch(e.target.value)}
                />
                {profiles.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg max-h-40 overflow-y-auto">
                    {profiles.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAssignClient(p.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors"
                      >
                        <span className="text-[11px] font-semibold text-foreground flex-1">{[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}</span>
                        <span className="text-[10px] text-muted-foreground">{p.customer_no}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted border-b border-border">
                  {['Ad Soyad', 'Müşteri No', 'KYC', 'Toplam Yatırım', 'Atanma Tarihi', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[12px] text-muted-foreground">Henüz müşteri yok.</td>
                  </tr>
                ) : detail.clients.map(c => (
                  <tr key={c.client_id} className="border-b border-border bg-card hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-[12px] font-semibold text-foreground">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{c.customer_no ?? '—'}</td>
                    <td className="px-4 py-3">
                      <KycBadge status={c.kyc_status ?? undefined} />
                    </td>
                    <td className="px-4 py-3 text-[12px] font-mono text-foreground">{fmt(c.total_deposits ?? 0)} TRY</td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{new Date(c.assigned_at).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemoveClient(c.client_id)}
                        className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border hover:text-red-500 hover:border-red-500"
                      >
                        Çıkar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        )}

        {/* Commissions tab */}
        {tab === 'commissions' && (
          <div className="space-y-3">
            {/* Filter + bulk action */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {(['all', 'pending', 'paid'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setCommissionFilter(f)}
                    className="px-3 py-1 rounded text-[11px] font-semibold transition-colors"
                    style={{
                      background: commissionFilter === f ? 'var(--c-primary)' : undefined,
                      color: commissionFilter === f ? 'white' : undefined,
                    }}
                  >
                    {f === 'all' ? 'Tümü' : f === 'pending' ? 'Bekleyen' : 'Ödenen'}
                    {commissionFilter !== f && <span className="ml-1 text-muted-foreground bg-muted rounded px-1 py-0.5">
                      {f === 'all' ? detail.commissions.length : detail.commissions.filter(c => c.status === f).length}
                    </span>}
                  </button>
                ))}
              </div>

              {selectedCommissions.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    className="bg-background border border-border rounded text-[11px] px-2.5 py-1 text-foreground outline-none"
                    placeholder="Ödeme notu..."
                    value={paidNote}
                    onChange={e => setPaidNote(e.target.value)}
                  />
                  <button
                    onClick={handleMarkPaid}
                    disabled={isPending}
                    className="px-3 py-1 text-[11px] font-semibold rounded text-white disabled:opacity-50"
                    style={{ background: 'var(--c-bull)' }}
                  >
                    {selectedCommissions.size} Kaydı Ödendi İşaretle
                  </button>
                </div>
              )}
            </div>

            <SectionCard>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="px-3 py-2.5 w-8">
                      <input
                        type="checkbox"
                        onChange={toggleAllPending}
                        checked={filteredCommissions.filter(c => c.status === 'pending').length > 0 &&
                          filteredCommissions.filter(c => c.status === 'pending').every(c => selectedCommissions.has(c.id))}
                        className="w-3.5 h-3.5"
                      />
                    </th>
                    {['Müşteri', 'Tür', 'Yatırım', 'Oran', 'Komisyon', 'Durum', 'Tarih'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-[12px] text-muted-foreground">Komisyon bulunamadı.</td>
                    </tr>
                  ) : filteredCommissions.map(c => (
                    <tr key={c.id} className="border-b border-border bg-card hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3">
                        {c.status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selectedCommissions.has(c.id)}
                            onChange={() => toggleCommission(c.id)}
                            className="w-3.5 h-3.5"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-[11px] font-semibold text-foreground">{c.client_name}</td>
                      <td className="px-3 py-3">
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                          style={{
                            background: c.commission_type === 'first_deposit' ? 'var(--c-primary)18' : 'var(--c-amber)18',
                            color: c.commission_type === 'first_deposit' ? 'var(--c-primary)' : 'var(--c-amber)',
                          }}
                        >
                          {c.commission_type === 'first_deposit' ? 'İlk' : 'Sonraki'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[11px] font-mono text-foreground">{fmt(c.deposit_amount)} {c.currency}</td>
                      <td className="px-3 py-3 text-[11px] text-muted-foreground">%{(c.commission_rate * 100).toFixed(1)}</td>
                      <td className="px-3 py-3 text-[12px] font-bold font-mono" style={{ color: 'var(--c-bull)' }}>{fmt(c.commission_amount)} {c.currency}</td>
                      <td className="px-3 py-3">
                        <CommissionStatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-3 text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString('tr-TR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color ?? 'var(--c-primary)'}18`, color: color ?? 'var(--c-primary)' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-[14px] font-bold text-foreground leading-tight truncate">{value}</p>
      </div>
    </div>
  )
}

function KycBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; color: string }> = {
    approved: { label: 'Onaylı', color: 'var(--c-bull)' },
    pending:  { label: 'Bekliyor', color: 'var(--c-amber)' },
    rejected: { label: 'Reddedildi', color: 'var(--c-bear)' },
  }
  const s = map[status ?? ''] ?? { label: status ?? '—', color: 'var(--c-border)' }
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background: `${s.color}18`, color: s.color }}>
      {s.label}
    </span>
  )
}

function CommissionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending:   { label: 'Bekleyen', color: 'var(--c-amber)' },
    paid:      { label: 'Ödendi', color: 'var(--c-bull)' },
    cancelled: { label: 'İptal', color: 'var(--c-bear)' },
  }
  const s = map[status] ?? { label: status, color: 'var(--c-border)' }
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background: `${s.color}18`, color: s.color }}>
      {s.label}
    </span>
  )
}

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
