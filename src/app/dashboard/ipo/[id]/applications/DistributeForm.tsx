'use client'

import { useState, useTransition } from 'react'
import { distributeIpoLots } from '@/actions/ipo'

interface Props {
  applicationId: string
  defaultLots:   number
  lotFiyat:      number | null
}

export function DistributeForm({ applicationId, defaultLots, lotFiyat }: Props) {
  const [lots,    setLots]    = useState(defaultLots)
  const [open,    setOpen]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [pending, startTx]    = useTransition()

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] font-semibold px-2 py-1 rounded bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer"
      >
        Dağıt
      </button>
    )
  }

  const totalCost = lotFiyat != null ? (lots * lotFiyat).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : null

  const handleSubmit = () => {
    setError(null)
    startTx(async () => {
      const fd = new FormData()
      fd.set('application_id', applicationId)
      fd.set('allocated_lots', String(lots))
      const res = await distributeIpoLots(fd)
      if (!res.success) {
        setError(res.error ?? 'Hata')
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input
        type="number"
        value={lots}
        min={1}
        onChange={e => setLots(Math.max(1, parseInt(e.target.value, 10) || 1))}
        className="w-16 h-6 text-[11px] px-1.5 rounded border border-border bg-background text-center tabular-nums"
      />
      {totalCost && (
        <span className="text-[10px] text-muted-foreground">₺{totalCost}</span>
      )}
      <button
        onClick={handleSubmit}
        disabled={pending}
        className="text-[10px] font-semibold px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50"
      >
        {pending ? '…' : 'Onayla'}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[10px] font-semibold px-2 py-1 rounded bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors cursor-pointer"
      >
        İptal
      </button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  )
}
