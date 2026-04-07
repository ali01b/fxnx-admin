import { create } from 'zustand'

export interface QuoteItem {
  symbol:  string
  last:    number
  change:  number
  high?:   number
  low?:    number
  volume?: number
}

export type QuoteMap = Record<string, QuoteItem>

interface QuoteState {
  quotes:    QuoteMap
  prevQuotes: QuoteMap
  status:    'idle' | 'connecting' | 'connected' | 'error'
  lastUpdate: number | null
  _intervalId: ReturnType<typeof setInterval> | null

  // Actions
  start:  () => void
  stop:   () => void
  _fetch: () => Promise<void>
}

const QUOTES_URL = '/api/quotes'
const POLL_MS    = 3000

export const useQuoteStore = create<QuoteState>((set, get) => ({
  quotes:      {},
  prevQuotes:  {},
  status:      'idle',
  lastUpdate:  null,
  _intervalId: null,

  _fetch: async () => {
    try {
      const res  = await fetch(QUOTES_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as unknown[]

      const items: unknown[] = Array.isArray(json) ? json : (json as Record<string, unknown[]>)?.items ?? []

      const next: QuoteMap = {}
      for (const item of items) {
        const i = item as Record<string, unknown>
        const sym = i.symbol as string
        if (!sym) continue
        next[sym] = {
          symbol:  sym,
          last:    Number(i.last   ?? i.price ?? 0),
          change:  Number(i.change ?? i.pct   ?? 0),
          high:    i.high   != null ? Number(i.high)   : undefined,
          low:     i.low    != null ? Number(i.low)    : undefined,
          volume:  i.volume != null ? Number(i.volume) : undefined,
        }
      }

      set((state) => ({
        prevQuotes: state.quotes,
        quotes:     next,
        status:     'connected',
        lastUpdate: Date.now(),
      }))
    } catch {
      set({ status: 'error' })
    }
  },

  start: () => {
    const state = get()
    if (state._intervalId) return // zaten çalışıyor

    set({ status: 'connecting' })
    state._fetch()

    const id = setInterval(() => {
      get()._fetch()
    }, POLL_MS)

    set({ _intervalId: id })
  },

  stop: () => {
    const { _intervalId } = get()
    if (_intervalId) {
      clearInterval(_intervalId)
      set({ _intervalId: null, status: 'idle' })
    }
  },
}))

/** Tek bir sembol için anlık fiyat döner */
export function useQuote(symbol: string): QuoteItem | undefined {
  return useQuoteStore((s) => s.quotes[symbol])
}

/** Fiyat değişim yönü: 'up' | 'down' | null */
export function useQuoteDirection(symbol: string): 'up' | 'down' | null {
  return useQuoteStore((s) => {
    const cur  = s.quotes[symbol]?.last
    const prev = s.prevQuotes[symbol]?.last
    if (cur == null || prev == null || cur === prev) return null
    return cur > prev ? 'up' : 'down'
  })
}
