'use client'

import { deleteTradingTerm } from '@/actions/trading-terms'

export function DeleteTermButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteTradingTerm} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`"${name}" silinsin mi? Bu işlem geri alınamaz.`)) {
            e.preventDefault()
          }
        }}
        className="text-[10px] font-semibold px-2 py-1 rounded bg-destructive text-white hover:opacity-90 transition-opacity cursor-pointer"
      >
        Delete
      </button>
    </form>
  )
}
