import { getPlatformSettings, getMarketHours } from '@/actions/platform-settings'
import { PlatformSettingsClient } from '@/components/PlatformSettingsClient'
import { createClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'

export default async function PlatformSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = await checkPermission(user.id, profile?.role, 'platform.settings')
  if (!allowed) redirect('/unauthorized')

  const [settings, marketHours] = await Promise.all([
    getPlatformSettings(),
    getMarketHours(),
  ])

  return (
    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

      <div style={{
        background: 'white', border: '1px solid #dde2e9',
        padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3748', letterSpacing: '0.5px' }}>
          PLATFORM AYARLARI
        </span>
      </div>

      <PlatformSettingsClient settings={settings} marketHours={marketHours} />

    </div>
  )
}
