import { getPlatformSettings, getMarketHours } from '@/actions/platform-settings'
import { PlatformSettingsClient } from '@/components/PlatformSettingsClient'
import { PlatformSubNav }         from '@/components/layout/PlatformSubNav'
import { createClient }           from '@/lib/supabase/server'
import { checkPermission }        from '@/lib/auth-utils'
import { redirect }               from 'next/navigation'

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
    <div className="flex flex-col h-full">
      <PlatformSubNav />
      <div className="flex-1 overflow-auto p-2">
        <PlatformSettingsClient settings={settings} marketHours={marketHours} />
      </div>
    </div>
  )
}
