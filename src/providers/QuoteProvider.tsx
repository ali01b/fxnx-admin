'use client'

import { useEffect } from 'react'
import { useQuoteStore } from '@/stores/quoteStore'

export function QuoteProvider({ children }: { children: React.ReactNode }) {
  const start = useQuoteStore((s) => s.start)
  const stop  = useQuoteStore((s) => s.stop)

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return <>{children}</>
}
