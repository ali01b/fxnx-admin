'use client'

import { useState } from 'react'
import { updatePlatformSetting, updateMarketHours, PlatformSetting, MarketHours } from '@/actions/platform-settings'

interface Props {
  settings:    PlatformSetting[]
  marketHours: MarketHours[]
}

function randomSuffix(length: number): string {
  const chars = 'A3K9MVXR2B7PQJNTZ'
  return chars.slice(0, Math.max(1, length))
}

function CustomerNoPreview(props: { prefix: string; length: number }) {
  const digits = '1234567890'.slice(0, Math.min(props.length, 10)).padEnd(props.length, '0')
  if (!props.prefix) return <span className="text-muted-foreground/30">—</span>
  return <span>{props.prefix}-{digits}</span>
}

function AccountCodePreview(props: { prefix: string; length: number }) {
  const suffix = randomSuffix(props.length)
  if (!props.prefix) return <span className="text-muted-foreground/30">—</span>
  return <span>{props.prefix}-{suffix}</span>
}

// ── Shared input class ─────────────────────────────────────────────────────────
const inputCls = 'bg-background border border-border rounded text-[11px] px-2.5 py-1.5 text-foreground outline-none font-mono'

interface SettingRowLiveProps {
  setting: PlatformSetting
  inputType: 'text' | 'number'
  liveValue: string
  onLiveChange: (v: string) => void
  preview: React.ReactNode
}

function SettingRowLive({ setting, inputType, liveValue, onLiveChange, preview }: SettingRowLiveProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave() {
    setStatus('saving')
    setErrorMsg('')
    const result = await updatePlatformSetting(setting.key, liveValue)
    if (result.error) {
      setStatus('error')
      setErrorMsg(result.error)
    } else {
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2500)
    }
  }

  return (
    <tr>
      <td className="px-3 py-2 border-b border-border w-[200px] align-middle">
        <div className="text-[11px] font-semibold text-foreground">
          {setting.description ?? setting.key}
        </div>
        <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{setting.key}</div>
      </td>
      <td className="px-3 py-2 border-b border-border w-[130px] align-middle">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
          {setting.value}
        </span>
      </td>
      <td className="px-3 py-2 border-b border-border align-middle">
        <div className="flex items-center gap-2">
          <input
            type={inputType}
            value={liveValue}
            min={inputType === 'number' ? 1 : undefined}
            max={inputType === 'number' ? 20 : undefined}
            onChange={(e) => {
              onLiveChange(e.target.value)
              if (status !== 'idle') setStatus('idle')
            }}
            className={`${inputCls} ${inputType === 'number' ? 'w-20' : 'w-32'}`}
          />
          <button
            onClick={handleSave}
            disabled={status === 'saving'}
            className="text-[10px] font-semibold px-3 py-1.5 rounded bg-primary text-primary-foreground border-none cursor-pointer disabled:opacity-50"
          >
            {status === 'saving' ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          {status === 'saved' && <span className="text-[10px] font-semibold text-[color:var(--c-bull)]">Kaydedildi</span>}
          {status === 'error' && <span className="text-[10px] font-semibold text-destructive">{errorMsg || 'Hata oluştu'}</span>}
        </div>
      </td>
      <td className="px-3 py-2 border-b border-border align-middle">
        <span className="text-[11px] font-mono font-semibold text-primary">
          {preview ?? <span className="text-muted-foreground/30">—</span>}
        </span>
      </td>
    </tr>
  )
}

// ── Toggle row ─────────────────────────────────────────────────────────────────

const BOOLEAN_KEYS = [
  'maintenance_mode', 'registration_enabled',
  'deposit_enabled', 'withdrawal_enabled', 'trading_enabled', 'kyc_required',
]
const MARKET_KEYS = ['market_open_time', 'market_close_time', 'market_timezone', 'market_open_days']
const KNOWN_KEYS  = [
  'customer_no_prefix', 'customer_no_length', 'account_code_prefix', 'account_code_length',
  ...BOOLEAN_KEYS, ...MARKET_KEYS,
]

const TOGGLE_LABELS: Record<string, { label: string; desc: string; danger?: boolean }> = {
  maintenance_mode:     { label: 'Bakım Modu',         desc: 'Tüm kullanıcılar bakım sayfasına yönlendirilir', danger: true },
  registration_enabled: { label: 'Yeni Kayıt',          desc: 'Yeni kullanıcı kaydına izin ver' },
  deposit_enabled:      { label: 'Para Yatırma',         desc: 'Kullanıcılar para yatırma talebi oluşturabilir' },
  withdrawal_enabled:   { label: 'Para Çekme',           desc: 'Kullanıcılar para çekme talebi oluşturabilir' },
  trading_enabled:      { label: 'Al/Sat İşlemleri',     desc: 'Kullanıcılar emir girebilir' },
  kyc_required:         { label: 'KYC Zorunluluğu',      desc: 'Girişte KYC tamamlanmadan platform kullanılamaz' },
}

function ToggleRow({ setting }: { setting: PlatformSetting }) {
  const meta     = TOGGLE_LABELS[setting.key]
  const isDanger = meta?.danger
  const [enabled, setEnabled] = useState(setting.value === 'true')
  const [status,  setStatus]  = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function toggle() {
    const next = !enabled
    setEnabled(next)
    setStatus('saving')
    const result = await updatePlatformSetting(setting.key, next ? 'true' : 'false')
    setStatus(result.error ? 'error' : 'saved')
    if (result.error) setEnabled(!next)
    else setTimeout(() => setStatus('idle'), 2500)
  }

  const activeColor = isDanger
    ? (enabled ? 'var(--c-bear)' : 'var(--c-bull)')
    : (enabled ? 'var(--c-bull)' : 'var(--c-border)')

  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-border last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-foreground">
            {meta?.label ?? setting.description ?? setting.key}
          </span>
          {isDanger && enabled && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: 'var(--c-bear)', background: 'var(--c-bear)18', border: '1px solid var(--c-bear)40' }}
            >
              AKTİF
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{meta?.desc ?? setting.description}</div>
        <div className="text-[9px] text-muted-foreground/40 font-mono mt-0.5">{setting.key}</div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {status === 'saved' && <span className="text-[10px] font-semibold text-[color:var(--c-bull)]">Kaydedildi</span>}
        {status === 'error' && <span className="text-[10px] font-semibold text-destructive">Hata</span>}
        <button
          onClick={toggle}
          disabled={status === 'saving'}
          className="relative border-none cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
          style={{ width: 44, height: 24, borderRadius: 99, background: activeColor, transition: 'background 0.2s' }}
        >
          <span
            className="absolute top-[3px] rounded-full bg-card"
            style={{ width: 18, height: 18, left: enabled ? 23 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.20)', transition: 'left 0.2s' }}
          />
        </button>
        <span className="text-[11px] font-bold min-w-[36px]" style={{ color: activeColor }}>
          {isDanger ? (enabled ? 'Aktif' : 'Kapalı') : (enabled ? 'Açık' : 'Kapalı')}
        </span>
      </div>
    </div>
  )
}

// ── Per-Category Market Hours ─────────────────────────────────────────────────

const WEEKDAYS = [
  { num: 1, short: 'Pzt' }, { num: 2, short: 'Sal' }, { num: 3, short: 'Çar' },
  { num: 4, short: 'Per' }, { num: 5, short: 'Cum' }, { num: 6, short: 'Cmt' },
  { num: 7, short: 'Paz' },
]

function MarketHoursRow({ row }: { row: MarketHours }) {
  const [enabled,   setEnabled]   = useState(row.is_enabled)
  const [openTime,  setOpenTime]  = useState(row.open_time.slice(0, 5))
  const [closeTime, setCloseTime] = useState(row.close_time.slice(0, 5))
  const [timezone,  setTimezone]  = useState(row.timezone)
  const [openDays,  setOpenDays]  = useState<number[]>(
    row.open_days.split(',').map(Number).filter(Boolean)
  )
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  function toggleDay(day: number) {
    setOpenDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort())
    setStatus('idle')
  }

  async function save() {
    setStatus('saving')
    const result = await updateMarketHours(row.id, {
      is_enabled: enabled,
      open_time:  openTime,
      close_time: closeTime,
      timezone,
      open_days:  openDays.sort().join(','),
    })
    setStatus(result.error ? 'error' : 'saved')
    if (!result.error) setTimeout(() => setStatus('idle'), 2500)
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden" style={{ opacity: enabled ? 1 : 0.65 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded bg-primary/10 text-primary">
            {row.category}
          </span>
          <span className="text-[12px] font-semibold text-foreground">{row.label}</span>
        </div>
        <div className="flex items-center gap-2.5">
          {status === 'saved' && <span className="text-[10px] font-semibold text-[color:var(--c-bull)]">Kaydedildi ✓</span>}
          {status === 'error' && <span className="text-[10px] font-semibold text-destructive">Hata</span>}
          <button
            onClick={() => { setEnabled(e => !e); setStatus('idle') }}
            title={enabled ? 'Kapat' : 'Aç'}
            className="relative border-none cursor-pointer flex-shrink-0"
            style={{ width: 36, height: 20, borderRadius: 99, background: enabled ? 'var(--c-primary)' : 'var(--c-border)', transition: 'background 0.2s' }}
          >
            <span
              className="absolute top-[2px] rounded-full bg-card"
              style={{ width: 16, height: 16, left: enabled ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }}
            />
          </button>
          <span className={`text-[10px] font-bold min-w-[30px] ${enabled ? 'text-primary' : 'text-muted-foreground'}`}>
            {enabled ? 'Açık' : 'Kapalı'}
          </span>
        </div>
      </div>

      {/* Config */}
      <div className="px-4 py-3 flex flex-wrap gap-4 items-start">
        {/* Times */}
        <div className="flex items-center gap-2">
          <div>
            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Açılış</div>
            <input
              type="time" value={openTime}
              onChange={e => { setOpenTime(e.target.value); setStatus('idle') }}
              disabled={!enabled}
              className="bg-background border border-border rounded text-[12px] font-mono text-foreground outline-none px-2 py-1.5 w-[100px]"
            />
          </div>
          <span className="text-muted-foreground mt-5">–</span>
          <div>
            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Kapanış</div>
            <input
              type="time" value={closeTime}
              onChange={e => { setCloseTime(e.target.value); setStatus('idle') }}
              disabled={!enabled}
              className="bg-background border border-border rounded text-[12px] font-mono text-foreground outline-none px-2 py-1.5 w-[100px]"
            />
          </div>
        </div>

        {/* Timezone */}
        <div>
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Saat Dilimi</div>
          <input
            type="text" value={timezone}
            onChange={e => { setTimezone(e.target.value); setStatus('idle') }}
            disabled={!enabled}
            placeholder="Europe/Istanbul"
            className="bg-background border border-border rounded text-[11px] font-mono text-foreground outline-none px-2 py-1.5 w-[170px]"
          />
        </div>

        {/* Days */}
        <div>
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Açık Günler</div>
          <div className="flex gap-1">
            {WEEKDAYS.map(({ num, short }) => {
              const active = openDays.includes(num)
              return (
                <button
                  key={num}
                  onClick={() => toggleDay(num)}
                  disabled={!enabled}
                  className="w-8 h-8 rounded-full border-none text-[9px] font-bold cursor-pointer disabled:cursor-not-allowed transition-all"
                  style={{
                    background: active ? 'var(--c-primary)' : 'var(--c-border)',
                    color:      active ? 'var(--c-card)'    : 'var(--c-text-3)',
                  }}
                >
                  {short}
                </button>
              )
            })}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-end pb-0.5">
          <button
            onClick={save}
            disabled={status === 'saving'}
            className="text-[11px] font-semibold px-4 py-1.5 rounded bg-primary text-primary-foreground border-none cursor-pointer disabled:opacity-60"
          >
            {status === 'saving' ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MarketHoursSection({ rows }: { rows: MarketHours[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-[12px] text-muted-foreground">
        Piyasa saati kaydı bulunamadı. SQL migration çalıştırıldığından emin olun.
      </div>
    )
  }
  return (
    <div className="p-4 flex flex-col gap-3">
      {rows.map(row => <MarketHoursRow key={row.id} row={row} />)}
    </div>
  )
}

// ── Simple setting row (self-managed value) ───────────────────────────────────

function SettingRow({ setting }: { setting: PlatformSetting }) {
  const [value, setValue] = useState(setting.value)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave() {
    setStatus('saving')
    setErrorMsg('')
    const result = await updatePlatformSetting(setting.key, value)
    if (result.error) { setStatus('error'); setErrorMsg(result.error) }
    else { setStatus('saved'); setTimeout(() => setStatus('idle'), 2500) }
  }

  return (
    <tr>
      <td className="px-3 py-2 border-b border-border w-[200px] align-middle">
        <div className="text-[11px] font-semibold text-foreground">{setting.description ?? setting.key}</div>
        <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{setting.key}</div>
      </td>
      <td className="px-3 py-2 border-b border-border w-[130px] align-middle">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">{setting.value}</span>
      </td>
      <td className="px-3 py-2 border-b border-border align-middle">
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => { setValue(e.target.value); if (status !== 'idle') setStatus('idle') }}
            className={`${inputCls} w-32`}
          />
          <button
            onClick={handleSave}
            disabled={status === 'saving'}
            className="text-[10px] font-semibold px-3 py-1.5 rounded bg-primary text-primary-foreground border-none cursor-pointer disabled:opacity-50"
          >
            {status === 'saving' ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          {status === 'saved' && <span className="text-[10px] font-semibold text-[color:var(--c-bull)]">Kaydedildi</span>}
          {status === 'error' && <span className="text-[10px] font-semibold text-destructive">{errorMsg || 'Hata'}</span>}
        </div>
      </td>
      <td className="px-3 py-2 border-b border-border align-middle">
        <span className="text-muted-foreground/30">—</span>
      </td>
    </tr>
  )
}

// ── Table header ──────────────────────────────────────────────────────────────

const TABLE_TH_CLS = 'px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide'

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="bg-muted/50 border-b border-border px-4 py-2">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlatformSettingsClient({ settings, marketHours }: Props) {
  const map: Record<string, PlatformSetting> = {}
  for (const s of settings) map[s.key] = s

  const [custPrefix, setCustPrefix] = useState(map['customer_no_prefix']?.value ?? '')
  const [custLength, setCustLength] = useState(Number(map['customer_no_length']?.value ?? 7))
  const [accPrefix,  setAccPrefix]  = useState(map['account_code_prefix']?.value ?? '')
  const [accLength,  setAccLength]  = useState(Number(map['account_code_length']?.value ?? 8))

  const tableHead = (
    <thead>
      <tr className="bg-muted border-b border-border">
        {['Ayar', 'Mevcut Değer', 'Yeni Değer', 'Önizleme'].map((h) => (
          <th key={h} className={TABLE_TH_CLS}>{h}</th>
        ))}
      </tr>
    </thead>
  )

  return (
    <div className="p-2 flex flex-col gap-2">

      {/* Müşteri Numarası */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <SectionHeader label="Müşteri Numarası" />
        <table className="w-full border-collapse">
          {tableHead}
          <tbody>
            {map['customer_no_prefix'] && (
              <SettingRowLive
                setting={map['customer_no_prefix']}
                inputType="text"
                liveValue={custPrefix}
                onLiveChange={setCustPrefix}
                preview={<CustomerNoPreview prefix={custPrefix} length={custLength} />}
              />
            )}
            {map['customer_no_length'] && (
              <SettingRowLive
                setting={map['customer_no_length']}
                inputType="number"
                liveValue={String(custLength)}
                onLiveChange={(v) => setCustLength(Number(v) || 1)}
                preview={<CustomerNoPreview prefix={custPrefix} length={custLength} />}
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Hesap Kodu */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <SectionHeader label="Hesap Kodu" />
        <table className="w-full border-collapse">
          {tableHead}
          <tbody>
            {map['account_code_prefix'] && (
              <SettingRowLive
                setting={map['account_code_prefix']}
                inputType="text"
                liveValue={accPrefix}
                onLiveChange={setAccPrefix}
                preview={<AccountCodePreview prefix={accPrefix} length={accLength} />}
              />
            )}
            {map['account_code_length'] && (
              <SettingRowLive
                setting={map['account_code_length']}
                inputType="number"
                liveValue={String(accLength)}
                onLiveChange={(v) => setAccLength(Number(v) || 1)}
                preview={<AccountCodePreview prefix={accPrefix} length={accLength} />}
              />
            )}
          </tbody>
        </table>
      </div>

      {/* İşlem Kontrolleri */}
      {BOOLEAN_KEYS.some(k => map[k]) && (
        <div className="bg-card border border-border rounded overflow-hidden">
          <SectionHeader label="İşlem Kontrolleri" />
          {BOOLEAN_KEYS.filter(k => map[k]).map(k => (
            <ToggleRow key={k} setting={map[k]} />
          ))}
        </div>
      )}

      {/* Piyasa Saatleri */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <SectionHeader label="Piyasa Saatleri" />
        <MarketHoursSection rows={marketHours} />
      </div>

      {/* Diğer Ayarlar */}
      {settings.filter(s => !KNOWN_KEYS.includes(s.key)).length > 0 && (
        <div className="bg-card border border-border rounded overflow-hidden">
          <SectionHeader label="Diğer Ayarlar" />
          <table className="w-full border-collapse">
            {tableHead}
            <tbody>
              {settings
                .filter(s => !KNOWN_KEYS.includes(s.key))
                .map((s) => <SettingRow key={s.key} setting={s} />)
              }
            </tbody>
          </table>
        </div>
      )}

      {settings.length > 0 && (
        <div className="px-1">
          <span className="text-[10px] text-muted-foreground">
            Son güncelleme:{' '}
            {new Date(
              settings.reduce((latest, s) =>
                s.updated_at > latest ? s.updated_at : latest,
                settings[0].updated_at
              )
            ).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        </div>
      )}
    </div>
  )
}
