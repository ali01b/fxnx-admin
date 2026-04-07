'use client'

import { useState, useTransition } from 'react'
import {
  createPaymentAccount,
  updatePaymentAccount,
  togglePaymentAccount,
  deletePaymentAccount,
} from '@/actions/payment-accounts'
import {
  btnPrimary, btnSecondary, btnDanger, btnGhost, btnSm,
} from '@/components/account-detail/shared'
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Building2, Wallet,
  AlertTriangle, X, Check,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentAccount {
  id: string
  type: string
  label: string | null
  currency: string | null
  is_active: boolean
  bank_name: string | null
  account_holder: string | null
  iban: string | null
  swift: string | null
  description: string | null
  coin: string | null
  network: string | null
  wallet_address: string | null
  created_at: string
}

interface Props {
  accounts: PaymentAccount[]
  embedded?: boolean
}

// ── Shared field input ────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-background border border-border rounded text-[10px] px-2 py-1.5 outline-none focus:border-primary text-foreground placeholder:text-muted-foreground'

const labelCls = 'text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5'

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className={labelCls}>{label}{required && <span className="text-[var(--c-bear)] ml-0.5">*</span>}</label>
      <input
        name={name}
        className={inputCls}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}

// ── Add/Edit form: Bank ───────────────────────────────────────────────────────

function BankForm({
  account,
  onCancel,
  onSave,
  isPending,
}: {
  account?: PaymentAccount
  onCancel: () => void
  onSave: (fd: FormData) => void
  isPending: boolean
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)) }}
      className="bg-muted/40 border border-border rounded-xl p-4 mt-3 space-y-3"
    >
      <input type="hidden" name="type" value="bank" />
      {account && <input type="hidden" name="id" value={account.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Etiket" name="label" defaultValue={account?.label ?? ''} placeholder="Örn: Ana Hesap" required />
        <Field label="Para Birimi" name="currency" defaultValue={account?.currency ?? 'TRY'} placeholder="TRY" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Banka Adı" name="bank_name" defaultValue={account?.bank_name ?? ''} placeholder="Garanti BBVA" required />
        <Field label="Hesap Sahibi" name="account_holder" defaultValue={account?.account_holder ?? ''} placeholder="Bluedot Finans A.Ş." required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="IBAN" name="iban" defaultValue={account?.iban ?? ''} placeholder="TR00 0000 0000 0000 0000 0000 00" required />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className={labelCls}>
          Uyarı / Açıklama
          <span className="ml-1 normal-case font-normal text-muted-foreground">(kullanıcıya gösterilir)</span>
        </label>
        <textarea
          name="description"
          className={`${inputCls} resize-none`}
          rows={2}
          defaultValue={account?.description ?? ''}
          placeholder="Örn: Açıklama kısmına {{ad_soyad}} yazınız. Hafta sonu işlem yapılmamaktadır."
        />
        <p className="text-[9px] text-muted-foreground mt-0.5">
          <code className="bg-muted px-1 py-0.5 rounded">{"{{ad_soyad}}"}</code> yazarsanız kullanıcının adı ve soyadı otomatik gösterilir.
        </p>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className={`${btnGhost} ${btnSm}`} onClick={onCancel}>İptal</button>
        <button type="submit" className={`${btnPrimary} ${btnSm}`} disabled={isPending}>
          {isPending ? 'Kaydediliyor...' : account ? 'Güncelle' : 'Ekle'}
        </button>
      </div>
    </form>
  )
}

// ── Add/Edit form: Crypto ─────────────────────────────────────────────────────

function CryptoForm({
  account,
  onCancel,
  onSave,
  isPending,
}: {
  account?: PaymentAccount
  onCancel: () => void
  onSave: (fd: FormData) => void
  isPending: boolean
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)) }}
      className="bg-muted/40 border border-border rounded-xl p-4 mt-3 space-y-3"
    >
      <input type="hidden" name="type" value="crypto" />
      {account && <input type="hidden" name="id" value={account.id} />}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Etiket" name="label" defaultValue={account?.label ?? ''} placeholder="Örn: USDT TRC20" required />
        <Field label="Coin" name="coin" defaultValue={account?.coin ?? ''} placeholder="USDT" required />
        <Field label="Network" name="network" defaultValue={account?.network ?? ''} placeholder="TRC20" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cüzdan Adresi" name="wallet_address" defaultValue={account?.wallet_address ?? ''} placeholder="0x..." required />
        <Field label="Para Birimi" name="currency" defaultValue={account?.currency ?? 'USDT'} placeholder="USDT" required />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className={`${btnGhost} ${btnSm}`} onClick={onCancel}>İptal</button>
        <button type="submit" className={`${btnPrimary} ${btnSm}`} disabled={isPending}>
          {isPending ? 'Kaydediliyor...' : account ? 'Güncelle' : 'Ekle'}
        </button>
      </div>
    </form>
  )
}

// ── Account Card ──────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onEdit,
  onToggle,
  onDelete,
  isPending,
}: {
  account: PaymentAccount
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  isPending: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isBank = account.type === 'bank'
  const accentColor = isBank ? 'var(--c-primary)' : 'var(--c-amber)'

  return (
    <div
      className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 relative overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}
          >
            {isBank
              ? <Building2 size={13} style={{ color: accentColor }} />
              : <Wallet size={13} style={{ color: accentColor }} />
            }
          </div>
          <div>
            <div className="text-[11px] font-bold text-foreground leading-tight">{account.label ?? '—'}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">{account.currency ?? ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              background: account.is_active ? 'color-mix(in srgb, var(--c-bull) 12%, transparent)' : 'var(--c-muted)',
              color: account.is_active ? 'var(--c-bull)' : 'var(--c-text-3)',
              border: `1px solid ${account.is_active ? 'var(--c-bull)' : 'transparent'}`,
            }}
          >
            {account.is_active ? 'Aktif' : 'Pasif'}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {isBank ? (
          <>
            <InfoRow label="Banka" value={account.bank_name} />
            <InfoRow label="Hesap Sahibi" value={account.account_holder} />
            <InfoRow label="IBAN" value={account.iban} mono />
          </>
        ) : (
          <>
            <InfoRow label="Coin" value={account.coin} />
            <InfoRow label="Network" value={account.network} />
            <InfoRow label="Adres" value={account.wallet_address} mono truncate />
          </>
        )}
      </div>

      {/* Uyarı */}
      {account.description && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-[10px] leading-relaxed"
          style={{
            background: 'color-mix(in srgb, var(--c-bear) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--c-bear) 30%, transparent)',
            color: 'var(--c-bear)',
          }}
        >
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{account.description}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-border">
        <button
          className={`${btnGhost} ${btnSm} flex items-center gap-1`}
          onClick={onToggle}
          disabled={isPending}
        >
          {account.is_active
            ? <ToggleRight size={11} style={{ color: 'var(--c-bull)' }} />
            : <ToggleLeft size={11} className="text-muted-foreground" />
          }
          {account.is_active ? 'Devre Dışı' : 'Aktif Et'}
        </button>
        <button className={`${btnSecondary} ${btnSm}`} onClick={onEdit} disabled={isPending}>
          <Pencil size={10} />
          Düzenle
        </button>
        <div className="ml-auto">
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-[var(--c-bear)] font-semibold">Emin misiniz?</span>
              <button
                className={`${btnDanger} ${btnSm}`}
                onClick={onDelete}
                disabled={isPending}
              >
                <Check size={10} />
                Evet
              </button>
              <button
                className={`${btnGhost} ${btnSm}`}
                onClick={() => setConfirmDelete(false)}
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <button
              className={`${btnDanger} ${btnSm}`}
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
            >
              <Trash2 size={10} />
              Sil
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono,
  truncate,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  truncate?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={`text-[10px] font-semibold text-foreground ${mono ? 'font-mono' : ''} ${truncate ? 'truncate max-w-[180px]' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

type FormState =
  | { mode: 'add' }
  | { mode: 'edit'; account: PaymentAccount }
  | null

function Section({
  title,
  type,
  accounts,
  isPending,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  formState,
  onCloseForm,
  onSave,
  icon: Icon,
  accentColor,
}: {
  title: string
  type: string
  accounts: PaymentAccount[]
  isPending: boolean
  onAdd: () => void
  onEdit: (account: PaymentAccount) => void
  onToggle: (account: PaymentAccount) => void
  onDelete: (id: string) => void
  formState: FormState
  onCloseForm: () => void
  onSave: (fd: FormData) => void
  icon: React.ElementType
  accentColor: string
}) {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between pb-1.5 mb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon size={13} style={{ color: accentColor }} />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
            {accounts.length}
          </span>
        </div>
        <button
          className={`${btnSecondary} ${btnSm}`}
          onClick={onAdd}
          disabled={isPending}
        >
          <Plus size={10} />
          {type === 'bank' ? 'Banka Hesabı Ekle' : 'Kripto Cüzdan Ekle'}
        </button>
      </div>

      {/* Add form */}
      {formState?.mode === 'add' && (
        type === 'bank'
          ? <BankForm onCancel={onCloseForm} onSave={onSave} isPending={isPending} />
          : <CryptoForm onCancel={onCloseForm} onSave={onSave} isPending={isPending} />
      )}

      {/* Cards */}
      {accounts.length === 0 && !formState ? (
        <div className="py-10 text-center">
          <div className="text-[11px] text-muted-foreground">
            Henüz {type === 'bank' ? 'banka hesabı' : 'kripto cüzdan'} eklenmemiş
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <div key={acc.id}>
              <AccountCard
                account={acc}
                onEdit={() => onEdit(acc)}
                onToggle={() => onToggle(acc)}
                onDelete={() => onDelete(acc.id)}
                isPending={isPending}
              />
              {formState?.mode === 'edit' && formState.account.id === acc.id && (
                type === 'bank'
                  ? <BankForm account={acc} onCancel={onCloseForm} onSave={onSave} isPending={isPending} />
                  : <CryptoForm account={acc} onCancel={onCloseForm} onSave={onSave} isPending={isPending} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PaymentAccountsClient({ accounts, embedded = false }: Props) {
  const [isPending, startTransition] = useTransition()
  const [bankForm, setBankForm] = useState<FormState>(null)
  const [cryptoForm, setCryptoForm] = useState<FormState>(null)

  const bankAccounts = accounts.filter((a) => a.type === 'bank')
  const cryptoAccounts = accounts.filter((a) => a.type === 'crypto')

  const handleSave = (fd: FormData) => {
    const id = fd.get('id') as string | null
    startTransition(async () => {
      if (id) {
        await updatePaymentAccount(fd)
      } else {
        await createPaymentAccount(fd)
      }
      setBankForm(null)
      setCryptoForm(null)
    })
  }

  const handleToggle = (acc: PaymentAccount) => {
    startTransition(async () => {
      await togglePaymentAccount(acc.id, !acc.is_active)
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deletePaymentAccount(id)
    })
  }

  return (
    <div className={embedded ? 'space-y-8' : 'p-6 space-y-8'}>
      {/* Page header */}
      {!embedded && (
        <div>
          <h1 className="text-[18px] font-bold text-foreground">Ödeme Hesapları</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Platform ödeme hesaplarını yönetin
          </p>
        </div>
      )}

      {/* Bank section */}
      <Section
        title="Banka Hesapları"
        type="bank"
        accounts={bankAccounts}
        isPending={isPending}
        onAdd={() => { setBankForm({ mode: 'add' }); setCryptoForm(null) }}
        onEdit={(acc) => { setBankForm({ mode: 'edit', account: acc }); setCryptoForm(null) }}
        onToggle={handleToggle}
        onDelete={handleDelete}
        formState={bankForm}
        onCloseForm={() => setBankForm(null)}
        onSave={handleSave}
        icon={Building2}
        accentColor="var(--c-primary)"
      />

      {/* Crypto section */}
      <Section
        title="Kripto Cüzdanlar"
        type="crypto"
        accounts={cryptoAccounts}
        isPending={isPending}
        onAdd={() => { setCryptoForm({ mode: 'add' }); setBankForm(null) }}
        onEdit={(acc) => { setCryptoForm({ mode: 'edit', account: acc }); setBankForm(null) }}
        onToggle={handleToggle}
        onDelete={handleDelete}
        formState={cryptoForm}
        onCloseForm={() => setCryptoForm(null)}
        onSave={handleSave}
        icon={Wallet}
        accentColor="var(--c-amber)"
      />
    </div>
  )
}
