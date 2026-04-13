import { AccountDetail, FieldDisplay, SectionHeader, STATUS_COLOR, KYC_COLOR } from './shared'

interface Props {
  account:   AccountDetail
  kycStatus: string
}

export function PersonalTab({ account, kycStatus }: Props) {
  const profile = Array.isArray(account.profiles) ? account.profiles[0] : account.profiles

  return (
    <div className="p-5 space-y-6 min-h-full">

      {/* ── Identity ─────────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-4">
        <SectionHeader>Kimlik</SectionHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <FieldDisplay label="Ad"             value={profile?.first_name ?? '—'} />
          <FieldDisplay label="Soyad"          value={profile?.last_name ?? '—'} />
          <FieldDisplay label="Müşteri No."    value={profile?.customer_no ?? '—'} mono />
          <FieldDisplay label="TC Kimlik No."  value={(profile as any)?.tc_identity_no ?? '—'} mono />
          <FieldDisplay label="Uyruk"          value={(profile as any)?.nationality ?? '—'} />
          <FieldDisplay label="Cinsiyet"       value={(profile as any)?.gender ?? '—'} />
          <FieldDisplay
            label="Doğum Tarihi"
            value={(profile as any)?.date_of_birth
              ? new Date((profile as any).date_of_birth).toLocaleDateString('tr-TR')
              : '—'}
          />
          <FieldDisplay
            label="Kayıt Tarihi"
            value={profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString('tr-TR')
              : '—'}
          />
          <FieldDisplay label="Hesap Tipi" value={account.account_type ?? '—'} />
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-4">
        <SectionHeader>İletişim</SectionHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <FieldDisplay label="E-posta"    value={profile?.email ?? '—'} />
          <FieldDisplay label="Telefon"    value={(profile as any)?.phone ?? '—'} />
          <FieldDisplay label="Adres"      value={(profile as any)?.address ?? '—'} />
          <FieldDisplay label="Şehir"      value={(profile as any)?.city ?? '—'} />
          <FieldDisplay label="Ülke"       value={(profile as any)?.country ?? '—'} />
          <FieldDisplay label="Posta Kodu" value={(profile as any)?.postal_code ?? '—'} />
        </div>
      </section>

      {/* ── Status summary ───────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-4">
        <SectionHeader>Durum</SectionHeader>
        <div className="flex gap-3">
          {[
            {
              label: 'Hesap Durumu',
              value: account.status,
              color: STATUS_COLOR[account.status] ?? 'var(--c-text-3)',
            },
            {
              label: 'KYC Durumu',
              value: kycStatus,
              color: KYC_COLOR[kycStatus] ?? 'var(--c-text-3)',
            },
            {
              label: 'Para Birimi',
              value: account.currency,
              color: 'var(--c-primary)',
            },
          ].map((item) => (
            <div key={item.label} className="flex-1 rounded-lg p-3"
              style={{ background: `${item.color}10`, border: `1px solid ${item.color}25` }}>
              <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                {item.label}
              </div>
              <span className="text-[13px] font-bold uppercase tracking-wide"
                style={{ color: item.color }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
