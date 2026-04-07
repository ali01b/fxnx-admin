'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { buildEmailHtml } from '@/lib/email-template'

export async function sendNotification(formData: FormData) {
  const supabase = createAdminClient()

  const title       = formData.get('title') as string
  const body        = formData.get('body') as string
  const targetType  = formData.get('target_type') as string   // 'all' | 'kyc_status' | 'user'
  const targetValue = formData.get('target_value') as string | null
  const sendPush    = formData.get('send_push') === 'true'
  const sendEmail   = formData.get('send_email') === 'true'

  if (!title || !body) return { error: 'Title and body are required.' }

  // Determine recipient user IDs
  let userIds: string[] = []

  if (targetType === 'all') {
    const { data } = await supabase.from('profiles').select('id')
    userIds = (data ?? []).map((u: any) => u.id)
  } else if (targetType === 'kyc_status' && targetValue) {
    const { data } = await supabase.from('profiles').select('id').eq('kyc_status', targetValue)
    userIds = (data ?? []).map((u: any) => u.id)
  } else if (targetType === 'user' && targetValue) {
    // targetValue can be a user ID or email
    const isUuid = /^[0-9a-f-]{36}$/i.test(targetValue)
    if (isUuid) {
      userIds = [targetValue]
    } else {
      const { data } = await supabase.from('profiles').select('id').eq('email', targetValue).limit(1)
      if (data?.[0]) userIds = [data[0].id]
    }
  }

  if (userIds.length === 0) return { error: 'No matching recipients found.' }

  // Log the notification in the DB
  const { data: notif, error: notifErr } = await supabase
    .from('admin_notifications')
    .insert({
      title,
      body,
      target_type:  targetType,
      target_value: targetValue ?? null,
      recipient_count: userIds.length,
      send_push:    sendPush,
      send_email:   sendEmail,
      status:       'sent',
      sent_at:      new Date().toISOString(),
    })
    .select('id')
    .single()

  if (notifErr) console.error('[sendNotification] log error:', notifErr.message)

  // Insert push notification rows for mobile app to consume
  if (sendPush && notif?.id) {
    const rows = userIds.map((userId) => ({
      user_id:         userId,
      notification_id: notif.id,
      title,
      body,
      read:            false,
    }))
    // Insert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      await supabase.from('user_notifications').insert(rows.slice(i, i + 100))
    }
  }

  // E-posta gönderimi — Resend
  if (sendEmail) {
    const { data: emailRows } = await supabase
      .from('profiles')
      .select('email')
      .in('id', userIds.slice(0, 500))

    const emails = (emailRows ?? []).map((r: any) => r.email).filter(Boolean) as string[]

    if (emails.length > 0 && process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@yourdomain.com'

      // Resend toplu gönderi: bcc ile tek istek veya birden fazla alıcıya
      // 50'şer gruplara böl (rate limit önlemi)
      for (let i = 0; i < emails.length; i += 50) {
        const batch = emails.slice(i, i + 50)
        await resend.emails.send({
          from,
          to: batch,
          subject: `${title} — TFG Istanbul`,
          html: buildEmailHtml({
            heroTitle:    title,
            bodyText:     body,
            showSecurity: false,
          }),
        })
      }
    }
  }

  revalidatePath('/dashboard/notifications')
  return { success: true, recipientCount: userIds.length }
}

export async function getNotifications() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('admin_notifications')
    .select('id, title, body, target_type, target_value, recipient_count, send_push, send_email, status, sent_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}
