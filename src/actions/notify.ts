'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function notifyUser(
  profileId: string,
  payload: { type: string; title: string; body: string; url?: string },
): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('notifications').insert({
    profile_id: profileId,
    type:       payload.type,
    title:      payload.title,
    body:       payload.body,
  })
}
