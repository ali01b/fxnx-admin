'use client'

import { PERMISSION_GROUPS, PERMISSION_LABELS, type Permission } from '@/lib/permissions'

interface Props {
  selected: Permission[]
  onChange: (permissions: Permission[]) => void
  disabled?: boolean
}

export function PermissionMatrix({ selected, onChange, disabled }: Props) {
  const selectedSet = new Set(selected)

  function toggle(perm: Permission) {
    if (disabled) return
    const next = new Set(selectedSet)
    if (next.has(perm)) next.delete(perm)
    else next.add(perm)
    onChange(Array.from(next) as Permission[])
  }

  function toggleGroup(perms: Permission[]) {
    if (disabled) return
    const allSelected = perms.every(p => selectedSet.has(p))
    const next = new Set(selectedSet)
    if (allSelected) {
      perms.forEach(p => next.delete(p))
    } else {
      perms.forEach(p => next.add(p))
    }
    onChange(Array.from(next) as Permission[])
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {PERMISSION_GROUPS.map(group => {
        const allSelected = group.permissions.every(p => selectedSet.has(p))
        const someSelected = group.permissions.some(p => selectedSet.has(p))

        return (
          <div key={group.label} className="bg-background border border-border rounded-lg overflow-hidden">
            {/* Group header */}
            <div
              className={`flex items-center gap-2 px-3 py-2 bg-muted border-b border-border ${disabled ? '' : 'cursor-pointer hover:bg-muted/80'}`}
              onClick={() => toggleGroup(group.permissions)}
            >
              <div
                className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                style={{
                  background: allSelected ? 'var(--c-primary)' : someSelected ? 'var(--c-primary)' : 'transparent',
                  borderColor: allSelected || someSelected ? 'var(--c-primary)' : 'var(--c-border)',
                }}
              >
                {allSelected && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {someSelected && !allSelected && (
                  <div className="w-2 h-0.5 bg-white rounded" />
                )}
              </div>
              <span className="text-[11px] font-semibold text-foreground">{group.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {group.permissions.filter(p => selectedSet.has(p)).length}/{group.permissions.length}
              </span>
            </div>

            {/* Permissions */}
            <div className="divide-y divide-border">
              {group.permissions.map(perm => (
                <label
                  key={perm}
                  className={`flex items-center gap-2 px-3 py-2 ${disabled ? '' : 'cursor-pointer hover:bg-muted/30'} transition-colors`}
                >
                  <div
                    className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0"
                    style={{
                      background: selectedSet.has(perm) ? 'var(--c-primary)' : 'transparent',
                      borderColor: selectedSet.has(perm) ? 'var(--c-primary)' : 'var(--c-border)',
                    }}
                  >
                    {selectedSet.has(perm) && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedSet.has(perm)}
                    onChange={() => toggle(perm)}
                    disabled={disabled}
                  />
                  <span className="text-[11px] text-foreground">{PERMISSION_LABELS[perm]}</span>
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
