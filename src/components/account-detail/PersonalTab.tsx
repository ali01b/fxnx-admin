import { AccountDetail, FieldDisplay, SectionHeader, STATUS_COLOR, KYC_COLOR } from './shared'

interface Props {
  account:   AccountDetail
  kycStatus: string
}

export function PersonalTab({ account, kycStatus }: Props) {
  const profile = Array.isArray(account.profiles) ? account.profiles[0] : account.profiles

  return (
    <div className="p-5 space-y-6 bg-card min-h-full">

      {/* ── Identity ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Identity</SectionHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <FieldDisplay label="First Name"       value={profile?.first_name ?? '—'} />
          <FieldDisplay label="Last Name"        value={profile?.last_name ?? '—'} />
          <FieldDisplay label="Customer No."     value={profile?.customer_no ?? '—'} mono />
          <FieldDisplay label="National ID (TC)" value={(profile as any)?.tc_identity_no ?? '—'} mono />
          <FieldDisplay label="Nationality"      value={(profile as any)?.nationality ?? '—'} />
          <FieldDisplay label="Gender"           value={(profile as any)?.gender ?? '—'} />
          <FieldDisplay
            label="Date of Birth"
            value={(profile as any)?.date_of_birth
              ? new Date((profile as any).date_of_birth).toLocaleDateString('en-GB')
              : '—'}
          />
          <FieldDisplay
            label="Registered"
            value={profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString('en-GB')
              : '—'}
          />
          <FieldDisplay label="Account Type" value={account.account_type ?? '—'} />
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Contact</SectionHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <FieldDisplay label="Email"       value={profile?.email ?? '—'} />
          <FieldDisplay label="Phone"       value={(profile as any)?.phone ?? '—'} />
          <FieldDisplay label="Address"     value={(profile as any)?.address ?? '—'} />
          <FieldDisplay label="City"        value={(profile as any)?.city ?? '—'} />
          <FieldDisplay label="Country"     value={(profile as any)?.country ?? '—'} />
          <FieldDisplay label="Postal Code" value={(profile as any)?.postal_code ?? '—'} />
        </div>
      </section>

      {/* ── Status summary ───────────────────────────────────────────── */}
      <section>
        <SectionHeader>Status</SectionHeader>
        <div className="flex gap-4">
          {[
            {
              label: 'Account Status',
              value: account.status,
              color: STATUS_COLOR[account.status] ?? 'var(--c-text-3)',
              mono: false,
            },
            {
              label: 'KYC Status',
              value: kycStatus,
              color: KYC_COLOR[kycStatus] ?? 'var(--c-text-3)',
              mono: false,
            },
            {
              label: 'Currency',
              value: account.currency,
              color: 'var(--c-primary)',
              mono: true,
            },
          ].map((item) => (
            <div key={item.label} className="flex-1 border-l-2 pl-3 py-1" style={{ borderColor: item.color }}>
              <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                {item.label}
              </div>
              <span
                className={`text-[13px] font-bold uppercase ${item.mono ? 'font-mono' : ''}`}
                style={{ color: item.color }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
