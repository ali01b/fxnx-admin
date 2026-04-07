import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('https://strata-demo.com/api/quotes_all', { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ items: [] }, { status: 502 })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 })
  }
}
