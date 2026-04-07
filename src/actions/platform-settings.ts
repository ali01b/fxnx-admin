'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Types ─────────────────────────────────────────────────────────

export interface PlatformSetting {
  key: string
  value: string
  description: string | null
  updated_by: string | null
  updated_at: string
}

// ── Queries ───────────────────────────────────────────────────────

export async function getPlatformSettings(): Promise<PlatformSetting[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .order('key', { ascending: true })

  if (error) console.error('[getPlatformSettings] error:', error)
  return data ?? []
}

// ── Mutations ─────────────────────────────────────────────────────

export async function updatePlatformSetting(
  key: string,
  value: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()

  // Get the current admin user id
  const serverClient = await createClient()
  const { data: { user } } = await serverClient.auth.getUser()

  const { error } = await supabase
    .from('platform_settings')
    .update({
      value,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('key', key)

  if (error) {
    console.error('[updatePlatformSetting] error:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/platform-settings')
  return { error: null }
}

// ── Market Hours ───────────────────────────────────────────────────

export interface MarketHours {
  id:         string
  category:   string
  label:      string
  open_time:  string
  close_time: string
  timezone:   string
  open_days:  string
  is_enabled: boolean
  updated_at: string
}

export async function getMarketHours(): Promise<MarketHours[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('market_hours')
    .select('*')
    .order('category')
  if (error) console.error('[getMarketHours] error:', error)
  return data ?? []
}

export async function updateMarketHours(
  id: string,
  patch: Partial<Omit<MarketHours, 'id' | 'category' | 'updated_at'>>
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('market_hours')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[updateMarketHours] error:', error)
    return { error: error.message }
  }
  revalidatePath('/dashboard/platform-settings')
  return { error: null }
}
