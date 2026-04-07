'use client'

import { useState } from 'react'
import { bulkUpdateTermInstruments } from '@/actions/trading-terms'

const FIELDS = [
  { value: 'min_lot',         label: 'Min Lot',    type: 'number', step: '0.01',   placeholder: 'ör. 0.01' },
  { value: 'max_lot',         label: 'Max Lot',    type: 'number', step: '1',      placeholder: 'ör. 1000000' },
  { value: 'lot_step',        label: 'Lot Adım',   type: 'number', step: '0.001',  placeholder: 'ör. 0.01' },
  { value: 'commission_rate', label: 'Komisyon %', type: 'number', step: '0.0001', placeholder: 'ör. 0.001' },
  { value: 'spread',          label: 'Spread',     type: 'number', step: '0.0001', placeholder: 'ör. 0' },
  { value: 'is_active',       label: 'Aktif',      type: 'select', step: '',       placeholder: '' },
]

const CATEGORIES = [
  { value: 'all',    label: 'Tümü' },
  { value: 'bist',   label: 'BIST' },
  { value: 'fx',     label: 'Forex' },
  { value: 'emtia',  label: 'Emtia' },
  { value: 'index',  label: 'Endeks' },
  { value: 'crypto', label: 'Kripto' },
]

export function BulkUpdateForm({ termId }: { termId: string }) {
  const [selectedField, setSelectedField] = useState('min_lot')
  const field = FIELDS.find((f) => f.value === selectedField)!

  const selectCls = 'border border-border rounded text-[11px] px-1.5 py-1 outline-none focus:border-primary bg-background cursor-pointer'

  return (
    <form action={bulkUpdateTermInstruments} className="flex gap-2 items-end">
      <input type="hidden" name="term_id" value={termId} />

      <div>
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Category</div>
        <select name="category" className={selectCls}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Field</div>
        <select
          name="field"
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          className={selectCls}
        >
          {FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Value</div>
        {field.type === 'select' ? (
          <select name="value" className={`${selectCls} font-bold`}>
            <option value="1">ON</option>
            <option value="0">OFF</option>
          </select>
        ) : (
          <input
            name="value"
            type="number"
            step={field.step}
            placeholder={field.placeholder}
            className="border border-border rounded text-[11px] px-1.5 py-1 w-20 outline-none focus:border-primary bg-background"
          />
        )}
      </div>

      <button
        type="submit"
        className="text-[10px] font-semibold px-3 py-1.5 rounded bg-[var(--c-orange)] text-white hover:opacity-90 transition-opacity cursor-pointer"
      >
        Bulk Apply
      </button>
    </form>
  )
}
