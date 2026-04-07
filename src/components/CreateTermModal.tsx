'use client'

import { useRef, useState } from 'react'
import { createTradingTerm } from '@/actions/trading-terms'

export function CreateTermModal() {
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] font-semibold px-2.5 py-1 rounded bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer"
      >
        + Add Trading Terms
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-card border border-border rounded-lg w-[420px] shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-primary px-4 py-2.5 flex items-center justify-between">
              <span className="text-[12px] font-bold text-white tracking-wide">
                YENİ TRADING TERMS GRUBU
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/60 hover:text-white text-lg leading-none cursor-pointer bg-transparent border-none"
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form
              ref={formRef}
              action={async (fd) => {
                await createTradingTerm(fd)
                setOpen(false)
              }}
              className="p-4 flex flex-col gap-3"
            >
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  name="name"
                  required
                  autoFocus
                  placeholder="örn. Standard, VIP, Kurumsal..."
                  className="w-full border border-border rounded text-[12px] px-2 py-1.5 outline-none focus:border-primary bg-background"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                  Description
                </label>
                <input
                  name="description"
                  placeholder="İsteğe bağlı açıklama..."
                  className="w-full border border-border rounded text-[12px] px-2 py-1.5 outline-none focus:border-primary bg-background"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[10px] font-semibold px-4 py-1.5 rounded border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer bg-transparent"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="text-[10px] font-semibold px-4 py-1.5 rounded bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Oluştur & Düzenle →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
