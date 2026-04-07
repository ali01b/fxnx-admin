'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { Permission } from '@/lib/permissions'

/** Kullanıcının tüm rol izinlerini döner (admin/superadmin için boş dizi — her şeye erişebilir) */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('user_roles')
    .select(`
      roles!role_id(
        role_permissions(permission)
      )
    `)
    .eq('user_id', userId)

  const perms = new Set<string>()
  for (const ur of data ?? []) {
    const role = (ur as any).roles
    for (const rp of role?.role_permissions ?? []) {
      if (rp.permission) perms.add(rp.permission)
    }
  }

  return Array.from(perms) as Permission[]
}

/** Kullanıcının belirli bir izni olup olmadığını kontrol eder.
 *  Admin/superadmin için her zaman true döner. */
export async function checkPermission(
  userId: string,
  profileRole: string | null | undefined,
  permission: Permission
): Promise<boolean> {
  if (['admin', 'superadmin'].includes(profileRole ?? '')) return true
  const perms = await getUserPermissions(userId)
  return perms.includes(permission)
}

/** Kullanıcının herhangi bir user_roles kaydı var mı (staff mi)? */
export async function isStaffUser(userId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .limit(1)
  return (data?.length ?? 0) > 0
}
