'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/layout/SectionCard'
import { createIBProfile, getProfilesForIBAssign, type IBWithStats } from '@/actions/ib'
import { Users2, Plus, Search, TrendingUp, UserCheck } from 'lucide-react'

interface Props {
  initialIBs: IBWithStats[]
}

export function IBClient({ initialIBs }: Props) {
  const router = useRouter()
  const [ibs] = useState<IBWithStats[]>(initialIBs)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [profileSearch, setProfileSearch] = useState('')
  const [profiles, setProfiles] = useState<{ id: string; first_name: string | null; last_name: string | null; customer_no: string | null; email: string | null }[]>([])
  const [selectedProfile, setSelectedProfile] = useState<{ id: string; first_name: string | null; last_name: string | null; customer_no: string | null; email: string | null } | null>(null)
  const [firstRate, setFirstRate] = useState('5')
  const [subsRate, setSubsRate] = useState('2')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const inputCls = 'bg-background border border-border rounded text-[11px] px-2.5 py-1.5 text-foreground outline-none w-full focus:border-[var(--c-primary)]'

  function ibFullName(ib: IBWithStats) {
    return [ib.profile?.first_name, ib.profile?.last_name].filter(Boolean).join(' ') || '—'
  }

  const filtered = ibs.filter(ib =>
    ibFullName(ib).toLowerCase().includes(search.toLowerCase()) ||
    ib.ref_code.toLowerCase().includes(search.toLowerCase())
  )

  function handleProfileSearch(q: string) {
    setProfileSearch(q)
    setSelectedProfile(null)
    if (q.length < 2) { setProfiles([]); return }
    startTransition(async () => {
      const res = await getProfilesForIBAssign(q)
      setProfiles(res)
    })
  }

  function handleCreate() {
    if (!selectedProfile) { setError('Kullanıcı seçiniz.'); return }
    const fr = parseFloat(firstRate)
    const sr = parseFloat(subsRate)
    if (isNaN(fr) || fr < 0 || fr > 100) { setError('Geçersiz ilk yatırım oranı.'); return }
    if (isNaN(sr) || sr < 0 || sr > 100) { setError('Geçersiz sonraki yatırım oranı.'); return }
    setError(null)
    startTransition(async () => {
      const res = await createIBProfile({
        profileId: selectedProfile.id,
        firstDepositRate: fr / 100,
        subsequentRate: sr / 100,
        notes: notes || undefined,
      })
      if (res.error) { setError(res.error); return }
      window.location.reload()
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="IB Yönetimi">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold text-white"
          style={{ background: 'var(--c-primary)' }}
        >
          <Plus size={13} />
          Yeni IB
        </button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Toplam IB" value={ibs.length} icon={<Users2 size={16} />} />
          <StatCard label="Aktif IB" value={ibs.filter(ib => ib.status === 'active').length} icon={<UserCheck size={16} />} color="var(--c-bull)" />
          <StatCard label="Toplam Müşteri" value={ibs.reduce((a, ib) => a + ib.client_count, 0)} icon={<TrendingUp size={16} />} color="var(--c-primary)" />
        </div>

        {/* Create form */}
        {creating && (
          <SectionCard>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">Yeni IB Oluştur</span>
                <button onClick={() => setCreating(false)} className="text-[11px] text-muted-foreground hover:text-foreground">İptal</button>
              </div>

              {/* Profile search */}
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Kullanıcı *</label>
                {selectedProfile ? (
                  <div className="flex items-center gap-2 p-2 bg-background border border-border rounded">
                    <span className="text-[11px] font-semibold text-foreground flex-1">{[selectedProfile.first_name, selectedProfile.last_name].filter(Boolean).join(' ')}</span>
                    <span className="text-[10px] text-muted-foreground">{selectedProfile.customer_no}</span>
                    <button onClick={() => setSelectedProfile(null)} className="text-[10px] text-muted-foreground hover:text-foreground">×</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      className={inputCls}
                      placeholder="Ad veya müşteri no ile ara..."
                      value={profileSearch}
                      onChange={e => handleProfileSearch(e.target.value)}
                    />
                    {profiles.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg max-h-40 overflow-y-auto">
                        {profiles.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedProfile(p); setProfiles([]); setProfileSearch('') }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors"
                          >
                            <span className="text-[11px] font-semibold text-foreground flex-1">{[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}</span>
                            <span className="text-[10px] text-muted-foreground">{p.customer_no}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">İlk Yatırım Oranı (%)</label>
                  <input className={inputCls} type="number" min="0" max="100" step="0.1" value={firstRate} onChange={e => setFirstRate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Sonraki Yatırım Oranı (%)</label>
                  <input className={inputCls} type="number" min="0" max="100" step="0.1" value={subsRate} onChange={e => setSubsRate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Not (opsiyonel)</label>
                <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="İç not..." />
              </div>

              {error && <p className="text-[11px]" style={{ color: 'var(--c-bear)' }}>{error}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setCreating(false)}
                  className="px-3 py-1.5 text-[11px] rounded bg-muted text-muted-foreground border border-border"
                >
                  İptal
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isPending}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded text-white disabled:opacity-50"
                  style={{ background: 'var(--c-primary)' }}
                >
                  {isPending ? 'Oluşturuluyor…' : 'IB Oluştur'}
                </button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full bg-card border border-border rounded text-[11px] pl-7 pr-3 py-1.5 text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="IB adı veya ref kodu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <SectionCard>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                {['Ad Soyad', 'Ref Kodu', 'Müşteri', 'Bekleyen Komisyon', 'Ödenen Komisyon', 'Durum', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                    IB bulunamadı.
                  </td>
                </tr>
              ) : filtered.map(ib => (
                <tr key={ib.id} className="border-b border-border bg-card hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-semibold text-foreground">{ibFullName(ib)}</span>
                    {ib.profile?.email && <p className="text-[10px] text-muted-foreground">{ib.profile.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{ib.ref_code}</code>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-foreground">{ib.client_count}</td>
                  <td className="px-4 py-3 text-[12px] font-mono text-foreground">
                    {formatAmount(ib.pending_commissions)} TRY
                  </td>
                  <td className="px-4 py-3 text-[12px] font-mono text-foreground">
                    {formatAmount(ib.paid_commissions)} TRY
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ib.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => router.push(`/dashboard/ib/${ib.id}`)}
                      className="px-2.5 py-1 rounded text-[10px] font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border"
                    >
                      Detay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color ?? 'var(--c-primary)'}18`, color: color ?? 'var(--c-primary)' }}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-[18px] font-bold text-foreground leading-tight">{value}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'active'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: `${isActive ? 'var(--c-bull)' : 'var(--c-bear)'}18`,
        color: isActive ? 'var(--c-bull)' : 'var(--c-bear)',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? 'var(--c-bull)' : 'var(--c-bear)' }} />
      {isActive ? 'Aktif' : 'Askıya Alındı'}
    </span>
  )
}

function formatAmount(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
