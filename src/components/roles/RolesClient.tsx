'use client'

import { useState, useTransition } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/layout/SectionCard'
import { PermissionMatrix } from './PermissionMatrix'
import {
  createRole, updateRole, deleteRole,
  type RoleWithStats,
} from '@/actions/roles'
import type { Permission } from '@/lib/permissions'
import { ShieldCheck, Pencil, Trash2, ChevronDown, ChevronUp, Plus, Lock } from 'lucide-react'

interface Props {
  initialRoles: RoleWithStats[]
}

interface FormState {
  name: string
  description: string
  permissions: Permission[]
}

const EMPTY_FORM: FormState = { name: '', description: '', permissions: [] }

export function RolesClient({ initialRoles }: Props) {
  const [roles, setRoles] = useState<RoleWithStats[]>(initialRoles)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const systemRoles = roles.filter(r => r.is_system)
  const customRoles  = roles.filter(r => !r.is_system)

  function startCreate() {
    setCreating(true)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  function startEdit(role: RoleWithStats) {
    setEditingId(role.id)
    setCreating(false)
    setExpandedId(role.id)
    setForm({
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions as Permission[],
    })
    setError(null)
  }

  function cancel() {
    setCreating(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  function handleCreate() {
    if (!form.name.trim()) { setError('Rol adı gereklidir.'); return }
    setError(null)
    startTransition(async () => {
      const res = await createRole({
        name: form.name,
        description: form.description || undefined,
        permissions: form.permissions,
      })
      if (res.error) { setError(res.error); return }
      // Reload by refreshing
      window.location.reload()
    })
  }

  function handleUpdate(roleId: string, isSystem: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await updateRole(roleId, {
        name: isSystem ? undefined : form.name,
        description: form.description || undefined,
        permissions: form.permissions,
      })
      if (res.error) { setError(res.error); return }
      window.location.reload()
    })
  }

  function handleDelete(roleId: string) {
    if (!confirm('Bu rolü silmek istediğinize emin misiniz?')) return
    startTransition(async () => {
      const res = await deleteRole(roleId)
      if (res.error) { setError(res.error); return }
      setRoles(prev => prev.filter(r => r.id !== roleId))
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Rol Yönetimi">
        <button
          onClick={startCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold text-white"
          style={{ background: 'var(--c-primary)' }}
        >
          <Plus size={13} />
          Yeni Rol
        </button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Create form */}
        {creating && (
          <SectionCard>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} style={{ color: 'var(--c-primary)' }} />
                <span className="text-[13px] font-semibold text-foreground">Yeni Rol Oluştur</span>
              </div>
              <RoleForm
                form={form}
                setForm={setForm}
                isSystem={false}
                error={error}
              />
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={cancel}
                  className="px-3 py-1.5 text-[11px] rounded bg-muted text-muted-foreground border border-border"
                >
                  İptal
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isPending}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded text-white disabled:opacity-50"
                  style={{ background: 'var(--c-primary)' }}
                >
                  {isPending ? 'Oluşturuluyor…' : 'Rol Oluştur'}
                </button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* System roles */}
        {systemRoles.length > 0 && (
          <SectionCard>
            <div className="bg-muted/50 border-b border-border px-4 py-2 flex items-center gap-2">
              <Lock size={12} className="text-muted-foreground" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sistem Rolleri</span>
            </div>
            <div className="divide-y divide-border">
              {systemRoles.map(role => (
                <RoleRow
                  key={role.id}
                  role={role}
                  isEditing={editingId === role.id}
                  isExpanded={expandedId === role.id}
                  form={form}
                  setForm={setForm}
                  error={editingId === role.id ? error : null}
                  isPending={isPending}
                  onToggleExpand={() => setExpandedId(expandedId === role.id ? null : role.id)}
                  onEdit={() => startEdit(role)}
                  onUpdate={() => handleUpdate(role.id, true)}
                  onDelete={() => handleDelete(role.id)}
                  onCancel={cancel}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {/* Custom roles */}
        <SectionCard>
          <div className="bg-muted/50 border-b border-border px-4 py-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Özel Roller</span>
          </div>
          {customRoles.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-muted-foreground">
              Henüz özel rol oluşturulmamış.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {customRoles.map(role => (
                <RoleRow
                  key={role.id}
                  role={role}
                  isEditing={editingId === role.id}
                  isExpanded={expandedId === role.id}
                  form={form}
                  setForm={setForm}
                  error={editingId === role.id ? error : null}
                  isPending={isPending}
                  onToggleExpand={() => setExpandedId(expandedId === role.id ? null : role.id)}
                  onEdit={() => startEdit(role)}
                  onUpdate={() => handleUpdate(role.id, false)}
                  onDelete={() => handleDelete(role.id)}
                  onCancel={cancel}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ── RoleRow ────────────────────────────────────────────────────────────────

interface RoleRowProps {
  role: RoleWithStats
  isEditing: boolean
  isExpanded: boolean
  form: FormState
  setForm: (f: FormState) => void
  error: string | null
  isPending: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onUpdate: () => void
  onDelete: () => void
  onCancel: () => void
}

function RoleRow({
  role, isEditing, isExpanded, form, setForm, error,
  isPending, onToggleExpand, onEdit, onUpdate, onDelete, onCancel,
}: RoleRowProps) {
  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
        <button onClick={onToggleExpand} className="flex-1 flex items-center gap-3 text-left min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--c-primary)18' }}>
            <ShieldCheck size={13} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-foreground">{role.name}</span>
              {role.is_system && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-muted text-muted-foreground border border-border">
                  Sistem
                </span>
              )}
            </div>
            {role.description && (
              <p className="text-[11px] text-muted-foreground truncate">{role.description}</p>
            )}
          </div>
          <div className="flex items-center gap-4 flex-shrink-0 text-[11px] text-muted-foreground">
            <span>{role.permissions.length} yetki</span>
            <span>{role.user_count} kullanıcı</span>
          </div>
          {isExpanded ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Pencil size={12} />
          </button>
          {!role.is_system && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded: view or edit */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border bg-background">
          {isEditing ? (
            <div className="pt-4 space-y-4">
              <RoleForm
                form={form}
                setForm={setForm}
                isSystem={role.is_system}
                error={error}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onCancel}
                  className="px-3 py-1.5 text-[11px] rounded bg-muted text-muted-foreground border border-border"
                >
                  İptal
                </button>
                <button
                  onClick={onUpdate}
                  disabled={isPending}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded text-white disabled:opacity-50"
                  style={{ background: 'var(--c-primary)' }}
                >
                  {isPending ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Yetkiler</p>
              <PermissionMatrix
                selected={role.permissions as Permission[]}
                onChange={() => {}}
                disabled
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── RoleForm ───────────────────────────────────────────────────────────────

interface RoleFormProps {
  form: FormState
  setForm: (f: FormState) => void
  isSystem: boolean
  error: string | null
}

function RoleForm({ form, setForm, isSystem, error }: RoleFormProps) {
  const inputCls = 'bg-background border border-border rounded text-[11px] px-2.5 py-1.5 text-foreground outline-none w-full focus:border-[var(--c-primary)]'

  return (
    <div className="space-y-3">
      {!isSystem && (
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Rol Adı *</label>
          <input
            className={inputCls}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Örn: Müşteri Temsilcisi"
          />
        </div>
      )}
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Açıklama</label>
        <input
          className={inputCls}
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="Opsiyonel"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Yetkiler</label>
        <PermissionMatrix
          selected={form.permissions}
          onChange={perms => setForm({ ...form, permissions: perms })}
        />
      </div>
      {error && (
        <p className="text-[11px] font-medium" style={{ color: 'var(--c-bear)' }}>{error}</p>
      )}
    </div>
  )
}
