import { getTradingTerm, getTermInstruments, updateTradingTerm, updateTermInstrument } from '@/actions/trading-terms'
import { BulkUpdateForm } from '@/components/BulkUpdateForm'
import { PageContent }    from '@/components/layout/PageContent'
import { PageHeader }     from '@/components/layout/PageHeader'
import { SectionCard }    from '@/components/layout/SectionCard'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

const CATEGORY_COLORS: Record<string, string> = {
  bist:      '#28a745',
  forex:     '#6f42c1',
  commodity: '#f59e0b',
  index:     '#17a2b8',
  crypto:    '#fd7e14',
}

const CATEGORIES = ['bist', 'forex', 'commodity', 'index', 'crypto']

interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ category?: string; page?: string }>
}

export default async function TradingTermDetailPage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'instruments.view')
  if (!allowed) redirect('/unauthorized')

  const { id }                           = await params
  const { category: filterCategory, page: pageStr } = await searchParams

  const page     = Math.max(1, parseInt(pageStr ?? '1', 10))
  const pageSize = 100

  const [term, instruments] = await Promise.all([
    getTradingTerm(id),
    getTermInstruments(id),
  ])

  if (!term) notFound()

  const filtered   = filterCategory ? instruments.filter((i) => i.category === filterCategory) : instruments
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <PageContent>
      {/* Breadcrumb header */}
      <PageHeader
        left={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/trading-terms" className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
              Trading Terms
            </Link>
            <span className="text-[10px] text-border">›</span>
            <span className="text-[13px] font-bold text-foreground">{term.name}</span>
            {term.is_default && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded-sm bg-primary/10 text-primary tracking-wider">
                DEFAULT
              </span>
            )}
          </div>
        }
      >
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{instruments.length} instruments</span>
          <span className="text-border">|</span>
          <span>Son güncelleme: {new Date(term.updated_at).toLocaleDateString('en-GB')}</span>
        </div>
      </PageHeader>

      {/* Edit form + Bulk update */}
      <SectionCard>
        <div className="px-3 py-2 flex gap-4 items-end flex-wrap">
          {/* Edit name/description */}
          <form action={updateTradingTerm} className="flex gap-2 items-end flex-wrap">
            <input type="hidden" name="id" value={term.id} />
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Name</div>
              <input
                name="name"
                defaultValue={term.name}
                className="border border-border rounded text-[11px] px-2 py-1 w-44 outline-none focus:border-primary bg-background"
              />
            </div>
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</div>
              <input
                name="description"
                defaultValue={term.description ?? ''}
                className="border border-border rounded text-[11px] px-2 py-1 w-48 outline-none focus:border-primary bg-background"
              />
            </div>
            <button
              type="submit"
              className="text-[10px] font-semibold px-3 py-1.5 rounded bg-[var(--c-bull)] text-white hover:opacity-90 transition-opacity cursor-pointer"
            >
              Kaydet
            </button>
          </form>

          <div className="w-px bg-border self-stretch" />
          <BulkUpdateForm termId={term.id} />
        </div>
      </SectionCard>

      {/* Category filter tabs */}
      <div className="bg-card border border-border flex items-stretch">
        <Link
          href={`/dashboard/trading-terms/${id}`}
          className={`px-3 py-2 text-[10px] font-semibold tracking-wide transition-colors ${
            !filterCategory
              ? 'border-b-2 border-primary text-primary'
              : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          ALL ({instruments.length})
        </Link>
        {CATEGORIES.map((cat) => {
          const count = instruments.filter((i) => i.category === cat).length
          if (count === 0) return null
          const color = CATEGORY_COLORS[cat]
          return (
            <Link
              key={cat}
              href={`/dashboard/trading-terms/${id}?category=${cat}`}
              className="px-3 py-2 text-[10px] font-semibold tracking-wide transition-colors"
              style={{
                borderBottom: filterCategory === cat ? `2px solid ${color}` : '2px solid transparent',
                color: filterCategory === cat ? color : undefined,
              }}
            >
              <span className={filterCategory !== cat ? 'text-muted-foreground hover:text-foreground' : ''}>
                {cat.toUpperCase()} ({count})
              </span>
            </Link>
          )
        })}
      </div>

      {/* Hidden forms for instrument rows */}
      <div className="hidden">
        {paginated.map((inst) => (
          <form key={(inst as any).id} id={`inst-form-${(inst as any).id}`} action={updateTermInstrument}>
            <input type="hidden" name="id"      value={(inst as any).id} />
            <input type="hidden" name="term_id" value={id} />
          </form>
        ))}
      </div>

      {/* Instruments table */}
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="bg-muted border-b-2 border-border">
                {['Symbol', 'Ad', 'Kategori', 'Min Lot', 'Max Lot', 'Lot Adım', 'Kom. %', 'Spread', 'Aktif', 'İşlem', ''].map((h) => (
                  <th
                    key={h}
                    className={`px-2 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${h === '' ? 'text-center' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((inst, i) => (
                <InstrumentRow key={inst.id} inst={inst} index={i} />
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-3 py-8 text-center text-[12px] text-muted-foreground">
                    Bu kategoride enstrüman yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2 bg-muted/30 flex justify-between items-center">
          <div className="text-[11px] text-muted-foreground">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / {filtered.length} enstrüman
            <span className="ml-3 text-muted-foreground/60">| Aktif: {paginated.filter((i) => i.is_active).length}</span>
          </div>

          {totalPages > 1 && (
            <div className="flex gap-1.5 items-center">
              <Link
                href={`?category=${filterCategory ?? ''}&page=${Math.max(1, page - 1)}`}
                className={`px-2.5 py-1 bg-card border border-border rounded text-[10px] font-semibold transition-colors ${
                  page <= 1 ? 'text-muted-foreground/40 pointer-events-none' : 'text-foreground hover:bg-muted'
                }`}
              >
                Önceki
              </Link>
              <span className="text-[11px] font-semibold text-foreground">{page} / {totalPages}</span>
              <Link
                href={`?category=${filterCategory ?? ''}&page=${Math.min(totalPages, page + 1)}`}
                className={`px-2.5 py-1 bg-card border border-border rounded text-[10px] font-semibold transition-colors ${
                  page >= totalPages ? 'text-muted-foreground/40 pointer-events-none' : 'text-foreground hover:bg-muted'
                }`}
              >
                Sonraki
              </Link>
            </div>
          )}
        </div>
      </SectionCard>
    </PageContent>
  )
}

// ── Inline editable instrument row ─────────────────────────────────────────

import type { TermInstrument } from '@/actions/trading-terms'

function InstrumentRow({ inst, index }: { inst: TermInstrument; index: number }) {
  const catColor = CATEGORY_COLORS[inst.category] ?? 'var(--c-text-3)'

  return (
    <tr className={`border-b border-border ${index % 2 === 1 ? 'bg-muted/20' : 'bg-card'}`}>
      {/* Symbol */}
      <td className="px-2 py-1 whitespace-nowrap">
        <span className="text-[11px] font-bold font-mono text-foreground">{inst.symbol}</span>
      </td>

      {/* Name */}
      <td className="px-2 py-1 text-[10px] text-muted-foreground max-w-[150px] whitespace-nowrap overflow-hidden text-ellipsis">
        {inst.name}
      </td>

      {/* Category */}
      <td className="px-2 py-1">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide"
          style={{ background: `${catColor}18`, color: catColor }}
        >
          {inst.category}
        </span>
      </td>

      {/* Editable numeric fields */}
      {([
        { name: 'min_lot',         value: inst.min_lot,         step: '0.01',   width: 60 },
        { name: 'max_lot',         value: inst.max_lot,         step: '1',      width: 70 },
        { name: 'lot_step',        value: inst.lot_step,        step: '0.001',  width: 60 },
        { name: 'commission_rate', value: inst.commission_rate, step: '0.0001', width: 65 },
        { name: 'spread',          value: inst.spread,          step: '0.0001', width: 60 },
      ] as { name: string; value: number | null; step: string; width: number }[]).map((field) => (
        <td key={field.name} className="px-1 py-1">
          <input
            key={`${field.name}-${field.value}`}
            form={`inst-form-${inst.id}`}
            name={field.name}
            type="number"
            defaultValue={field.value ?? ''}
            step={field.step}
            placeholder="—"
            className="border border-border rounded text-[10px] font-mono text-right px-1 py-0.5 outline-none focus:border-primary bg-background"
            style={{ width: `${field.width}px` }}
          />
        </td>
      ))}

      {/* Active toggle */}
      <td className="px-2 py-1">
        <select
          key={String(inst.is_active)}
          form={`inst-form-${inst.id}`}
          name="is_active"
          defaultValue={String(inst.is_active)}
          className="border border-border rounded text-[10px] px-1 py-0.5 outline-none font-bold cursor-pointer"
          style={{
            background: inst.is_active ? '#f0fff4' : '#fff5f5',
            color:      inst.is_active ? 'var(--c-bull)' : 'var(--c-bear)',
          }}
        >
          <option value="true">ON</option>
          <option value="false">OFF</option>
        </select>
      </td>

      {/* Save button */}
      <td className="px-1.5 py-1">
        <button
          form={`inst-form-${inst.id}`}
          type="submit"
          className="text-[9px] font-bold px-2 py-1 rounded bg-[var(--c-bull)] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          Kaydet
        </button>
      </td>
    </tr>
  )
}
