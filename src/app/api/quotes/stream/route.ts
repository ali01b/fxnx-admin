import { NextRequest } from 'next/server'

const UPSTREAM    = 'https://strata-demo.com/api/quotes_all'
const INTERVAL_MS = 3000

export const dynamic = 'force-dynamic'

// Module-level cache: tüm bağlı client'lar aynı upstream verisini paylaşır
let upstreamCache: { data: unknown; ts: number } | null = null

async function fetchUpstream(signal: AbortSignal): Promise<unknown> {
  const now = Date.now()
  if (upstreamCache && now - upstreamCache.ts < INTERVAL_MS - 200) {
    return upstreamCache.data
  }
  const res = await fetch(UPSTREAM, {
    cache:  'no-store',
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  const data = await res.json()
  upstreamCache = { data, ts: Date.now() }
  return data
}

export async function GET(request: NextRequest) {
  const { signal } = request
  const encoder    = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let timer: ReturnType<typeof setInterval> | null = null

      async function push() {
        if (signal.aborted) return
        try {
          const data = await fetchUpstream(signal)
          if (signal.aborted) return
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // ağ hatası — bu turu atla
        }
      }

      push()
      timer = setInterval(push, INTERVAL_MS)

      signal.addEventListener('abort', () => {
        if (timer) clearInterval(timer)
        try { controller.close() } catch { /* zaten kapandı */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
