'use client'

import { useState, useTransition } from 'react'
import { importIpoFromExternal } from '@/actions/ipo'

interface Props {
  ticker: string
  name:   string
  slug:   string
  dates:  string
  url:    string
  badge:  string
}

export function ImportButton({ ticker, name, slug, dates, url, badge }: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  function handleImport() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('ticker', ticker)
      fd.set('name',   name)
      fd.set('slug',   slug)
      fd.set('dates',  dates)
      fd.set('url',    url)
      fd.set('badge',  badge)
      const res = await importIpoFromExternal(fd)
      if (res.success) {
        setResult({ ok: true, msg: 'İçe aktarıldı' })
      } else {
        setResult({ ok: false, msg: res.error ?? 'Hata oluştu' })
      }
    })
  }

  if (result?.ok) {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-100 text-green-700 border border-green-200">
        ✓ Aktarıldı
      </span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleImport}
        disabled={isPending}
        className="text-[10px] font-semibold px-2 py-1 rounded bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Aktarılıyor...' : 'İçe Aktar'}
      </button>
      {result?.ok === false && (
        <span className="text-[9px] text-destructive">{result.msg}</span>
      )}
    </div>
  )
}
