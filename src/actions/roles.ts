'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { Permission } from '@/lib/permissions'

export interface Role {
  id:          string
  name:        string
  description: string | null
  is_system:   boolean
  created_at:  string
  updated_at:  string
}

export interface RoleWithStats extends Role {
  permissions:  string[]
  user_count:   number
}

// ── Tüm rolleri getir ────────────────────────────────────────────────────────

export async function getRoles(): Promise<RoleWithStats[]> {
  const supabase = createAdminClient()

  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, name, description, is_system, created_at, updated_at')
    .order('is_system', { ascending: false })
    .order('name')

  if (error || !roles) {
    console.error('[getRoles]', error?.message)
    return []
  }

  const { data: perms } = await supabase
    .from('role_permissions')
    .select('role_id, permission')

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id')

  const permMap: Record<string, string[]> = {}
  for (const p of perms ?? []) {
    if (!permMap[p.role_id]) permMap[p.role_id] = []
    permMap[p.role_id].push(p.permission)
  }

  const userCountMap: Record<string, number> = {}
  for (const ur of userRoles ?? []) {
    userCountMap[ur.role_id] = (userCountMap[ur.role_id] ?? 0) + 1
  }

  return roles.map(r => ({
    ...r,
    permissions: permMap[r.id] ?? [],
    user_count:  userCountMap[r.id] ?? 0,
  }))
}

// ── Rol oluştur ──────────────────────────────────────────────────────────────

export async function createRole(data: {
  name:        string
  description?: string
  permissions:  Permission[]
}): Promise<{ error?: string; id?: string }> {
  const supabase = createAdminClient()

  const { data: role, error } = await supabase
    .from('roles')
    .insert({ name: data.name.trim(), description: data.description?.trim() || null })
    .select('id')
    .single()

  if (error || !role) {
    if (error?.message.includes('unique')) return { error: 'Bu isimde bir rol zaten var.' }
    return { error: error?.message ?? 'Rol oluşturulamadı.' }
  }

  if (data.permissions.length > 0) {
    await supabase.from('role_permissions').insert(
      data.permissions.map(p => ({ role_id: role.id, permission: p }))
    )
  }

  revalidatePath('/dashboard/roles')
  return { id: role.id }
}

// ── Rol güncelle ─────────────────────────────────────────────────────────────

export async function updateRole(roleId: string, data: {
  name?:        string
  description?: string
  permissions?: Permission[]
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  // System rollerinin adı değiştirilemez
  const { data: existing } = await supabase
    .from('roles')
    .select('is_system')
    .eq('id', roleId)
    .single()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (!existing?.is_system && data.name) patch.name = data.name.trim()
  if (data.description !== undefined) patch.description = data.description?.trim() || null

  const { error } = await supabase.from('roles').update(patch).eq('id', roleId)
  if (error) return { error: error.message }

  if (data.permissions !== undefined) {
    await supabase.from('role_permissions').delete().eq('role_id', roleId)
    if (data.permissions.length > 0) {
      await supabase.from('role_permissions').insert(
        data.permissions.map(p => ({ role_id: roleId, permission: p }))
      )
    }
  }

  revalidatePath('/dashboard/roles')
  return {}
}

// ── Rol sil ──────────────────────────────────────────────────────────────────

export async function deleteRole(roleId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  const { data: role } = await supabase
    .from('roles')
    .select('is_system')
    .eq('id', roleId)
    .single()

  if (role?.is_system) return { error: 'Sistem rolleri silinemez.' }

  const { error } = await supabase.from('roles').delete().eq('id', roleId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/roles')
  return {}
}

// ── Kullanıcıya rol ata ──────────────────────────────────────────────────────

export async function assignRoleToUser(userId: string, roleId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role_id: roleId }, { onConflict: 'user_id,role_id', ignoreDuplicates: true })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return {}
}

// ── Kullanıcıdan rol kaldır ──────────────────────────────────────────────────

export async function removeRoleFromUser(userId: string, roleId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return {}
}

// ── Bir kullanıcının rollerini getir ─────────────────────────────────────────

export async function getUserRoles(userId: string): Promise<Role[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('user_roles')
    .select('roles(id, name, description, is_system, created_at, updated_at)')
    .eq('user_id', userId)

  if (error) return []
  return (data ?? []).map((r: any) => r.roles).filter(Boolean)
}
