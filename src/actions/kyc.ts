'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { notifyUser } from './notify'

export async function updateKycStatus(formData: FormData): Promise<void> {
  const supabase = createAdminClient()
  const userId    = formData.get('userId') as string
  const newStatus = formData.get('newStatus') as string
  const reason    = formData.get('reason') as string | null
  const note      = formData.get('note') as string | null

  if (!userId || !newStatus) return

  const updates: Record<string, unknown> = { kyc_status: newStatus }
  if (newStatus === 'verified') updates.status = 'active'

  const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', userId)
  if (updateError) {
    console.error('[updateKycStatus] profiles update error:', updateError)
    throw new Error(updateError.message)
  }

  try {
    await supabase.from('kyc_decisions').insert({
      profile_id: userId, decision: newStatus,
      reason_code: reason || null, note: note || null,
    })
  } catch (e) {
    console.error('[updateKycStatus] kyc_decisions insert error:', e)
  }

  if (newStatus === 'verified') {
    await notifyUser(userId, {
      type:  'system',
      title: 'Kimlik Doğrulama Tamamlandı',
      body:  'Kimlik doğrulama süreciniz başarıyla tamamlanmıştır. Hesabınız aktif olup tüm işlemlere erişiminiz açılmıştır.',
      url:   '/dashboard',
    })
  } else if (newStatus === 'rejected') {
    await notifyUser(userId, {
      type:  'system',
      title: 'Kimlik Doğrulama Başvurusu Sonuçlandı',
      body:  reason
        ? `Kimlik doğrulama başvurunuz inceleme sonucunda onaylanamamıştır. Ret gerekçesi: ${reason}. Belgelerinizi güncelleyerek yeniden başvurabilirsiniz.`
        : 'Kimlik doğrulama başvurunuz inceleme sonucunda onaylanamamıştır. Belgelerinizi güncelleyerek yeniden başvurabilirsiniz.',
      url:   '/dashboard',
    })
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/ib')
}

export async function getKycDetail(userId: string) {
  const supabase = createAdminClient()

  const [{ data: user }, docFiles, { data: decisions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.storage.from('kyc-documents').list(userId, { limit: 20 }).then((r) => r.data ?? []),
    supabase.from('kyc_decisions').select('*').eq('profile_id', userId).order('created_at', { ascending: false }).limit(10),
  ])

  const docUrls: Record<string, string> = {}
  if (docFiles.length > 0) {
    await Promise.all(
      docFiles.map(async (f) => {
        const { data } = await supabase.storage
          .from('kyc-documents')
          .createSignedUrl(`${userId}/${f.name}`, 600)
        if (data?.signedUrl) docUrls[f.name] = data.signedUrl
      })
    )
  }

  return { user, docUrls, decisions: decisions ?? [] }
}
