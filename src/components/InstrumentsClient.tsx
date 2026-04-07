'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { syncInstruments, updateInstrument, bulkSetTradingTerms } from '@/actions/instruments'

const CATEGORIES = [
  { key: 'all',       label: 'Tümü',    color: 'var(--c-primary)', bg: 'var(--c-primary)18' },
  { key: 'bist',      label: 'BIST',    color: '#00A651',           bg: '#00A65118' },
  { key: 'forex',     label: 'Forex',   color: '#7C3AED',           bg: '#7C3AED18' },
  { key: 'commodity', label: 'Emtia',   color: '#F59E0B',           bg: '#F59E0B18' },
  { key: 'index',     label: 'Endeks',  color: 'var(--c-primary)', bg: 'var(--c-primary)18' },
  { key: 'crypto',    label: 'Kripto',  color: '#F97316',           bg: '#F9731618' },
]

const CAT_COLOR: Record<string, string> = {
  bist: '#00A651', forex: '#7C3AED', commodity: '#F59E0B', index: 'var(--c-primary)', crypto: '#F97316',
}

const SORT_COL: Record<string, string> = {
  symbol:     'symbol',
  name:       'name',
  category:   'category',
  last_price: 'last_price',
  min_lot:    'min_lot',
  max_lot:    'max_lot',
  lot_step:   'lot_step',
  is_active:  'is_active',
}

interface Instrument {
  id: string
  symbol: string
  name: string
  category: string
  is_active: boolean
  is_tradable: boolean
  min_lot: number
  max_lot: number
  lot_step: number
  last_price: number | null
  last_synced_at: string | null
  term_ids: string[]
}

interface TradingTerm { id: string; name: string }

interface Props {
  instruments: Instrument[]
  total: number
  page: number
  category: string
  search: string
  counts: Record<string, number>
  allTerms: TradingTerm[]
  sort: string
  sortDir: 'asc' | 'desc'
}

const PAGE_SIZE = 100

export function InstrumentsClient({
  instruments, total, page, category,
  search: initialSearch, counts, allTerms,
  sort: currentSort, sortDir: currentSortDir,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [syncing, setSyncing]       = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [search, setSearch]         = useState(initialSearch)
  const [editId, setEditId]         = useState<string | null>(null)
  const [showBulk, setShowBulk]     = useState(false)

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams({ category, search, page: String(page), sort: currentSort, sortDir: currentSortDir, ...params })
    startTransition(() => router.push(`/dashboard/instruments?${sp}`))
  }

  const handleSort = (displayField: string) => {
    const dbCol = SORT_COL[displayField] ?? displayField
    const newDir = currentSort === dbCol && currentSortDir === 'asc' ? 'desc' : 'asc'
    navigate({ sort: dbCol, sortDir: newDir, page: '1' })
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    const res = await syncInstruments()
    setSyncing(false)
    if (res.error) {
      setSyncResult(`Hata: ${res.error}`)
    } else {
      setSyncResult(`${res.synced} enstrüman senkronize edildi.`)
      setTimeout(() => window.location.reload(), 800)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── TOOLBAR ─────────────────────────────────────────── */}
      <div className="bg-card border-b border-border px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <span className="text-[13px] font-bold text-foreground">Enstrümanlar</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ color: 'var(--c-primary)', background: 'var(--c-primary)18' }}
        >
          {total.toLocaleString()}
        </span>

        {syncResult && (
          <span
            className="text-[11px] px-2.5 py-1 rounded"
            style={{
              color:      syncResult.startsWith('Hata') ? 'var(--c-bear)' : 'var(--c-bull)',
              background: syncResult.startsWith('Hata') ? 'var(--c-bear)18'  : 'var(--c-bull)18',
            }}
          >
            {syncResult}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate({ search, page: '1' })}
            placeholder="Sembol ara..."
            className="bg-background border border-border rounded text-[11px] px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary w-[150px]"
          />
          <button
            onClick={() => setShowBulk((v) => !v)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded cursor-pointer transition-colors"
            style={showBulk
              ? { background: '#7C3AED18', border: '1px solid #7C3AED', color: '#7C3AED' }
              : { background: 'var(--c-muted)', border: '1px solid var(--c-border)', color: 'var(--c-text-3)' }
            }
          >
            Toplu Ayar
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-[11px] font-semibold px-3 py-1.5 rounded text-white border-none cursor-pointer"
            style={{ background: syncing ? 'var(--c-muted)' : 'var(--c-primary)', cursor: syncing ? 'not-allowed' : 'pointer' }}
          >
            {syncing ? 'Senkronize ediliyor...' : "API'den Senkronize Et"}
          </button>
        </div>
      </div>

      {/* ── BULK SETTINGS BAR ──────────────────────────────── */}
      {showBulk && (
        <form
          action={async (fd) => {
            fd.set('category', category)
            const res = await bulkSetTradingTerms(fd)
            if (res.error) { alert(res.error); return }
            setShowBulk(false)
            window.location.reload()
          }}
          className="bg-muted/30 border-b border-border px-4 py-2 flex items-center gap-2 flex-shrink-0"
        >
          <span className="text-[11px] font-bold text-muted-foreground">
            Toplu uygula — {category === 'all' ? 'Tüm kategoriler' : category.toUpperCase()}:
          </span>
          <select
            name="trading_terms_id"
            className="bg-background border border-border rounded text-[10px] px-2 py-1.5 text-foreground outline-none"
          >
            <option value="">— Trading Terms seç —</option>
            {allTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            type="submit"
            className="text-[11px] font-bold px-3 py-1.5 rounded text-white border-none cursor-pointer"
            style={{ background: 'var(--c-primary)' }}
          >
            Uygula
          </button>
          <button
            type="button"
            onClick={() => setShowBulk(false)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded bg-muted text-muted-foreground border border-border cursor-pointer"
          >
            İptal
          </button>
        </form>
      )}

      {/* ── CATEGORY TABS ──────────────────────────────────── */}
      <div className="bg-card border-b border-border flex flex-shrink-0 overflow-x-auto px-1">
        {CATEGORIES.map((cat) => {
          const count  = counts[cat.key] ?? 0
          const active = category === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => navigate({ category: cat.key, page: '1' })}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors bg-transparent border-none border-b-2"
              style={{
                borderBottomColor: active ? cat.color : 'transparent',
                color: active ? cat.color : 'var(--c-text-3)',
              }}
            >
              {cat.label}
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: active ? cat.bg  : 'var(--c-muted)',
                  color:      active ? cat.color : 'var(--c-text-3)',
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── TABLE ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto" style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 0.15s' }}>
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted border-b border-border">
              {([
                { label: 'Sembol',        field: 'symbol' },
                { label: 'Ad',            field: 'name' },
                { label: 'Kategori',      field: 'category' },
                { label: 'Son Fiyat',     field: 'last_price' },
                { label: 'Trading Terms', field: '' },
                { label: 'Min Lot',       field: 'min_lot' },
                { label: 'Max Lot',       field: 'max_lot' },
                { label: 'Lot Adım',      field: 'lot_step' },
                { label: 'Aktif',         field: 'is_active' },
                { label: '',              field: '' },
              ] as const).map(({ label, field }) => (
                <th
                  key={label}
                  onClick={() => field && handleSort(field)}
                  className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
                  style={{
                    color: currentSort === (SORT_COL[field] ?? field) && field
                      ? 'var(--c-primary)'
                      : 'var(--c-text-3)',
                    cursor: field ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                >
                  {label}
                  {currentSort === (SORT_COL[field] ?? field) && field && (
                    <span className="ml-1 text-[9px]">{currentSortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instruments.map((inst) => {
              const isEditing = editId === inst.id
              const linkedTermIds   = inst.term_ids ?? []
              const linkedTermNames = allTerms.filter((t) => linkedTermIds.includes(t.id)).map((t) => t.name)
              const catColor = CAT_COLOR[inst.category] ?? 'var(--c-text-3)'

              return (
                <tr key={inst.id} className="border-b border-border bg-card hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-mono font-bold text-foreground">
                    {inst.symbol}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                    {inst.name}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                      style={{ color: catColor, background: `${catColor}18` }}
                    >
                      {inst.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground text-right">
                    {inst.last_price != null
                      ? inst.last_price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                      : '—'}
                  </td>

                  {isEditing ? (
                    <td colSpan={6} className="px-3 py-2">
                      <form
                        action={async (fd) => {
                          fd.set('id', inst.id)
                          await updateInstrument(fd)
                          setEditId(null)
                          startTransition(() => router.refresh())
                        }}
                        className="flex items-center gap-2 flex-wrap"
                      >
                        <label className="text-[10px] text-muted-foreground">Trading Term</label>
                        <select
                          name="trading_terms_id"
                          defaultValue={linkedTermIds[0] ?? ''}
                          className="bg-background border border-border rounded text-[10px] px-2 py-1.5 text-foreground outline-none"
                        >
                          <option value="">— None —</option>
                          {allTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <label className="text-[10px] text-muted-foreground">Min Lot</label>
                        <input
                          name="min_lot"
                          defaultValue={inst.min_lot}
                          className="bg-background border border-border rounded text-[10px] px-2 py-1.5 text-foreground outline-none w-[70px]"
                        />
                        <label className="text-[10px] text-muted-foreground">Max Lot</label>
                        <input
                          name="max_lot"
                          defaultValue={inst.max_lot}
                          className="bg-background border border-border rounded text-[10px] px-2 py-1.5 text-foreground outline-none w-[80px]"
                        />
                        <label className="text-[10px] text-muted-foreground">Lot Adım</label>
                        <input
                          name="lot_step"
                          defaultValue={inst.lot_step}
                          className="bg-background border border-border rounded text-[10px] px-2 py-1.5 text-foreground outline-none w-[60px]"
                        />
                        <select
                          name="is_active"
                          defaultValue={String(inst.is_active)}
                          className="bg-background border border-border rounded text-[10px] px-2 py-1.5 text-foreground outline-none"
                        >
                          <option value="true">Aktif</option>
                          <option value="false">Pasif</option>
                        </select>
                        <select
                          name="is_tradable"
                          defaultValue={String(inst.is_tradable)}
                          className="bg-background border border-border rounded text-[10px] px-2 py-1.5 text-foreground outline-none"
                        >
                          <option value="true">İşlem var</option>
                          <option value="false">İşlem yok</option>
                        </select>
                        <button
                          type="submit"
                          className="text-[10px] font-bold px-3 py-1.5 rounded text-white border-none cursor-pointer"
                          style={{ background: 'var(--c-primary)' }}
                        >
                          Kaydet
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditId(null)}
                          className="text-[10px] font-semibold px-2.5 py-1.5 rounded bg-muted text-muted-foreground border border-border cursor-pointer"
                        >
                          İptal
                        </button>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 max-w-[140px]">
                        {linkedTermNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {linkedTermNames.map((name) => (
                              <span
                                key={name}
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                style={{ color: 'var(--c-primary)', background: 'var(--c-primary)18' }}
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{inst.min_lot}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{Number(inst.max_lot).toLocaleString('en-US')}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{inst.lot_step}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ background: inst.is_active ? 'var(--c-bull)' : 'var(--c-bear)' }}
                          title={inst.is_active ? 'Aktif' : 'Pasif'}
                        />
                        {!inst.is_tradable && (
                          <span
                            className="ml-1.5 text-[9px] font-bold"
                            style={{ color: 'var(--c-amber)' }}
                          >
                            NO TRADE
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setEditId(inst.id)}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors cursor-pointer"
                        >
                          Düzenle
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
            {instruments.length === 0 && (
              <tr>
                <td colSpan={10} className="py-16 text-center text-[12px] text-muted-foreground">
                  {total === 0
                    ? "Henüz enstrüman yok. \"API'den Senkronize Et\" butonuna tıklayın."
                    : 'Sonuç bulunamadı.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── PAGINATION ─────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="bg-card border-t border-border px-4 py-2 flex items-center gap-2 justify-end flex-shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
          </span>
          <button
            disabled={page <= 1 || isPending}
            onClick={() => navigate({ page: String(page - 1) })}
            className="text-[11px] font-semibold px-3 py-1 rounded bg-muted text-muted-foreground border border-border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Önceki
          </button>
          <span className="text-[11px] font-bold text-foreground">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages || isPending}
            onClick={() => navigate({ page: String(page + 1) })}
            className="text-[11px] font-semibold px-3 py-1 rounded bg-muted text-muted-foreground border border-border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  )
}
