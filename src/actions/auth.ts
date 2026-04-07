'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  // Check admin role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Kimlik doğrulama başarısız.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    // IB kullanıcısı mı?
    const { data: ibProfile } = await supabase
      .from('ib_profiles')
      .select('id')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (ibProfile) {
      redirect('/dashboard/ib/portal')
    }

    // Staff (user_roles) kontrolü
    const { data: staffRoles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .limit(1)

    if (staffRoles && staffRoles.length > 0) {
      redirect('/dashboard')
    }

    await supabase.auth.signOut()
    return { error: 'Bu panele erişim yetkiniz yok.' }
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
