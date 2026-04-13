import { create } from 'zustand'

export interface QuoteItem {
  symbol:        string
  last:          number   // normalized from Yahoo's 'price' field
  change:        number
  changePercent?: number
  dayHigh?:      number
  dayLow?:       number
  dayVolume?:    number
  currency?:     string
  shortName?:    string
}

export type QuoteMap = Record<string, QuoteItem>

interface QuoteState {
  quotes:     QuoteMap
  prevQuotes: QuoteMap
  status:     'idle' | 'connecting' | 'connected' | 'error'
  lastUpdate: number | null

  start:       () => void
  stop:        () => void
  subscribe:   (symbols: string[]) => void
  unsubscribe: (symbols: string[]) => void
  seed:        (initial: QuoteMap) => void
}

const WS_URL       = 'wss://api.iletisimacar.com'
const RECONNECT_MS = 3000
const PING_MS      = 30_000

export const useQuoteStore = create<QuoteState>((set, get) => {
  // ── Module-level WS state (not reactive) ────────────────────────
  let ws:                WebSocket | null              = null
  let reconnectTimer:    ReturnType<typeof setTimeout> | null = null
  let pingTimer:         ReturnType<typeof setInterval>| null = null
  let visHandler:        (() => void) | null           = null
  let isStopped          = false
  const pendingSubs      = new Set<string>()

  // ── Helpers ──────────────────────────────────────────────────────
  function send(msg: object): boolean {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
      return true
    }
    return false
  }

  function clearPing() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
  }

  function openWs() {
    if (isStopped || ws) return
    set({ status: 'connecting' })

    const sock = new WebSocket(WS_URL)
    ws = sock

    sock.onopen = () => {
      set({ status: 'connected' })

      // Flush subscriptions that were queued before connection opened
      if (pendingSubs.size > 0) {
        sock.send(JSON.stringify({ event: 'subscribe', symbols: [...pendingSubs] }))
      }

      // Periodic ping to keep connection alive
      clearPing()
      pingTimer = setInterval(() => send({ event: 'ping' }), PING_MS)
    }

    sock.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as Record<string, unknown>
        if (msg.event !== 'price') return

        const sym = msg.symbol as string
        if (!sym) return

        set((state) => {
          const prev = state.quotes[sym] ?? {} as QuoteItem

          // Merge pattern: Yahoo only sends changed fields; null = keep previous
          const merged = { ...prev } as QuoteItem
          for (const [k, v] of Object.entries(msg)) {
            if (v !== null && v !== undefined && k !== 'event') {
              ;(merged as Record<string, unknown>)[k] = v
            }
          }
          // Yahoo WS sends 'price', normalize to 'last' for internal consistency
          if (msg.price != null) merged.last = Number(msg.price)
          merged.symbol = sym

          return {
            prevQuotes: state.quotes,
            quotes:     { ...state.quotes, [sym]: merged },
            lastUpdate: Date.now(),
            status:     'connected',
          }
        })
      } catch { /* parse error */ }
    }

    sock.onerror = () => set({ status: 'error' })

    sock.onclose = () => {
      ws = null
      clearPing()
      if (!isStopped) {
        set({ status: 'error' })
        reconnectTimer = setTimeout(() => { if (!isStopped) openWs() }, RECONNECT_MS)
      }
    }
  }

  // ── Store actions ─────────────────────────────────────────────────
  return {
    quotes:     {},
    prevQuotes: {},
    status:     'idle',
    lastUpdate: null,

    start() {
      isStopped = false

      visHandler = () => {
        if (document.hidden) {
          ws?.close()
          ws = null
          clearPing()
        } else {
          openWs()
        }
      }
      document.addEventListener('visibilitychange', visHandler)
      openWs()
    },

    stop() {
      isStopped = true
      if (reconnectTimer) { clearTimeout(reconnectTimer);  reconnectTimer = null }
      clearPing()
      ws?.close()
      ws = null
      if (visHandler) {
        document.removeEventListener('visibilitychange', visHandler)
        visHandler = null
      }
      pendingSubs.clear()
      set({ status: 'idle' })
    },

    subscribe(symbols) {
      for (const s of symbols) pendingSubs.add(s)
      send({ event: 'subscribe', symbols })
    },

    unsubscribe(symbols) {
      for (const s of symbols) pendingSubs.delete(s)
      send({ event: 'unsubscribe', symbols })
    },

    seed(initial) {
      // WS'den gelen mevcut tick'ler öncelikli — seed sadece henüz bilinmeyenleri doldurur
      set((state) => ({
        quotes: { ...initial, ...state.quotes },
      }))
    },
  }
})

// ── Symbol helpers ────────────────────────────────────────────────────────────

/**
 * DB sembolünü Yahoo Finance formatına çevirir.
 * termInstruments category bilgisine göre çalışır.
 */
export function toYahooSymbol(symbol: string, category: string): string {
  const cat = category.toLowerCase()
  if (cat === 'bist')    return `${symbol}.IS`
  if (cat === 'forex')   return `${symbol}=X`
  if (cat === 'crypto') {
    // BTCUSD → BTC-USD  |  ETHUSD → ETH-USD
    if (symbol.length > 3 && !symbol.includes('-')) {
      const quote = symbol.slice(-3)   // USD, EUR, TRY...
      const base  = symbol.slice(0, -3)
      return `${base}-${quote}`
    }
  }
  // US stocks, indices, commodities: genellikle direkt Yahoo sembolü
  return symbol
}

/** Yahoo sembolünden DB sembolüne ters çeviri */
export function fromYahooSymbol(yahooSymbol: string): string {
  if (yahooSymbol.endsWith('.IS'))  return yahooSymbol.slice(0, -3)
  if (yahooSymbol.endsWith('=X'))   return yahooSymbol.slice(0, -2)
  if (yahooSymbol.includes('-') && !yahooSymbol.startsWith('^')) {
    return yahooSymbol.replace('-', '')
  }
  return yahooSymbol
}

/** Tek bir Yahoo sembolü için anlık fiyat */
export function useQuote(yahooSymbol: string): QuoteItem | undefined {
  return useQuoteStore((s) => s.quotes[yahooSymbol])
}

/** Fiyat değişim yönü */
export function useQuoteDirection(yahooSymbol: string): 'up' | 'down' | null {
  return useQuoteStore((s) => {
    const cur  = s.quotes[yahooSymbol]?.last
    const prev = s.prevQuotes[yahooSymbol]?.last
    if (cur == null || prev == null || cur === prev) return null
    return cur > prev ? 'up' : 'down'
  })
}
