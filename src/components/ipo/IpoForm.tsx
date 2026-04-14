'use client'

import type { IpoListing } from '@/actions/ipo'
import { useState } from 'react'
import Link from 'next/link'

interface Props {
  action:   (fd: FormData) => Promise<void>
  initial?: Partial<IpoListing>
}

const PAZAR_OPTIONS = [
  'Ana Pazar',
  'Yıldız Pazar',
  'Gelişen İşletmeler Pazarı (GİP)',
  'BIST 100',
  'Diğer',
]

const TAHSISAT_PLACEHOLDER = JSON.stringify([
  { "kategori": "Bireysel Yatırımcılar", "oran": "%60" },
  { "kategori": "Kurumsal Yatırımcılar", "oran": "%40" }
], null, 2)

const FINANSAL_PLACEHOLDER = JSON.stringify([
  { "donem": "2024", "gelir": "₺1.2 Mrd", "netKar": "₺210 Mn" },
  { "donem": "2023", "gelir": "₺980 Mn",  "netKar": "₺165 Mn" }
], null, 2)

export function IpoForm({ action, initial = {} }: Props) {
  const [status, setStatus] = useState(initial.status ?? 'taslak')
  const [tahsisatJson, setTahsisatJson] = useState(
    initial.tahsisat_dagilimi ? JSON.stringify(initial.tahsisat_dagilimi, null, 2) : ''
  )
  const [finansalJson, setFinansalJson] = useState(
    initial.finansal_tablo ? JSON.stringify(initial.finansal_tablo, null, 2) : ''
  )
  const [jsonError, setJsonError] = useState<string | null>(null)

  function validateJsonFields(): boolean {
    try {
      if (tahsisatJson.trim()) JSON.parse(tahsisatJson)
      if (finansalJson.trim()) JSON.parse(finansalJson)
      setJsonError(null)
      return true
    } catch {
      setJsonError('Tahsisat Dağılımı veya Finansal Tablo JSON formatı hatalı.')
      return false
    }
  }

  return (
    <form
      action={action}
      onSubmit={(e) => { if (!validateJsonFields()) e.preventDefault() }}
      className="flex flex-col gap-4"
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      {/* ── Şirket Bilgileri ─────────────────────────────────────── */}
      <Section title="Şirket Bilgileri">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Şirket Adı *" required>
            <Input name="name" defaultValue={initial.name ?? ''} placeholder="Örn: Anadolu Teknoloji A.Ş." required />
          </Field>
          <Field label="Ticker (Sembol) *" required>
            <Input name="ticker" defaultValue={initial.ticker ?? ''} placeholder="ANTK" required className="uppercase" />
          </Field>
          <Field label="Logo URL">
            <Input name="logo_url" defaultValue={initial.logo_url ?? ''} placeholder="https://..." type="url" />
          </Field>
          <Field label="Kaynak URL (halkarz.com vb.)">
            <Input name="source_url" defaultValue={initial.source_url ?? ''} placeholder="https://halkarz.com/..." type="url" />
          </Field>
          <Field label="Slug (URL)">
            <Input name="slug" defaultValue={initial.slug ?? ''} placeholder="anadolu-teknoloji (boş bırakılırsa otomatik)" />
          </Field>
          <Field label="Etiket (Badge)">
            <Input name="badge" defaultValue={initial.badge ?? ''} placeholder="Örn: YENİ, HOT, SPK ONAYLANDI" />
          </Field>
        </div>
      </Section>

      {/* ── Durum ───────────────────────────────────────────────── */}
      <Section title="Durum">
        <div className="flex flex-wrap gap-3">
          {([
            { value: 'taslak',             label: 'Taslak',               color: 'var(--c-primary)'  },
            { value: 'talep_toplaniyor',   label: 'Talep Toplanıyor',     color: '#1E6FCC'           },
            { value: 'dagitim_bekleniyor', label: 'Dağıtım Bekleniyor',   color: '#D97706'           },
            { value: 'dagitildi',          label: 'Dağıtıldı',            color: 'var(--c-bull)'     },
            { value: 'gecmis',             label: 'Geçmiş',               color: 'var(--c-text-3)'   },
            { value: 'iptal',              label: 'İptal',                color: 'var(--c-bear)'     },
          ]).map(s => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value={s.value}
                checked={status === s.value}
                onChange={() => setStatus(s.value as any)}
                className="accent-primary"
              />
              <span className="text-[12px] font-semibold" style={{ color: s.color }}>
                {s.label}
              </span>
            </label>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          <strong>Taslak:</strong> admin görür · <strong>Talep Toplanıyor:</strong> başvurular açık · <strong>Dağıtım Bekleniyor:</strong> başvuru kapandı · <strong>Dağıtıldı:</strong> lotlar verildi
        </p>
      </Section>

      {/* ── Tarihler ────────────────────────────────────────────── */}
      <Section title="Başvuru ve Listeleme Tarihleri">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başvuru Başlangıcı">
            <Input name="basvuru_baslangic" defaultValue={initial.basvuru_baslangic ?? ''} type="date" />
          </Field>
          <Field label="Başvuru Bitişi">
            <Input name="basvuru_bitis" defaultValue={initial.basvuru_bitis ?? ''} type="date" />
          </Field>
          <Field label="Dağıtım Tarihi" hint="Lot dağıtımının gerçekleşeceği tarih">
            <Input name="dagitim_tarihi" defaultValue={(initial as any).dagitim_tarihi ?? ''} type="date" />
          </Field>
          <Field label="Dağıtım Yöntemi" hint="Örn: Eşit, Oransal, Kura">
            <Input name="dagitim_yontemi" defaultValue={(initial as any).dagitim_yontemi ?? ''} placeholder="Eşit" />
          </Field>
          <Field label="Borsa Girişi (İlk İşlem Tarihi)">
            <Input name="borsa_giris" defaultValue={initial.borsa_giris ?? ''} type="date" />
          </Field>
        </div>
      </Section>

      {/* ── Fiyatlama ────────────────────────────────────────────── */}
      <Section title="Fiyatlama">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Fiyat Aralığı Alt (₺)">
            <Input name="fiyat_alt" defaultValue={initial.fiyat_alt ?? ''} type="number" step="0.0001" min="0" placeholder="Örn: 28.00" />
          </Field>
          <Field label="Fiyat Aralığı Üst (₺)">
            <Input name="fiyat_ust" defaultValue={initial.fiyat_ust ?? ''} type="number" step="0.0001" min="0" placeholder="Örn: 32.00" />
          </Field>
          <Field label="Kesin Lot Fiyatı (₺)">
            <Input name="lot_fiyat" defaultValue={initial.lot_fiyat ?? ''} type="number" step="0.0001" min="0" placeholder="Belirlendikten sonra" />
          </Field>
          <Field label="Pazar">
            <select
              name="pazar"
              defaultValue={initial.pazar ?? ''}
              className="w-full h-7 px-2 text-[12px] bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Seçiniz...</option>
              {PAZAR_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Tavan Beklentisi (gün)" hint="Kaç gün tavan gitmesi bekleniyor?">
            <Input name="tavan_gun" defaultValue={initial.tavan_gun ?? ''} type="number" min="0" max="365" placeholder="Örn: 3" />
          </Field>
          <Field label="Günlük Artış Oranı (%)" hint="Her gün giriş fiyatının kaç % üzerine çıkacak (default: 10)">
            <Input name="gunluk_artis_orani" defaultValue={(initial as any).gunluk_artis_orani ?? 10} type="number" min="0" max="100" step="0.5" placeholder="Örn: 10" />
          </Field>
          <Field label="Gün İçi Dalgalanma (%)" hint="Gün içi simülasyon için rastgele hareket aralığı (default: 2)">
            <Input name="intraday_volatility" defaultValue={(initial as any).intraday_volatility ?? 2} type="number" min="0" max="20" step="0.5" placeholder="Örn: 2" />
          </Field>
          <Field label="Yapay Halka Arz" hint="TFG platformuna özgü, tavan mekanizması aktif olacak">
            <label className="flex items-center gap-2 h-7 cursor-pointer">
              <input
                type="checkbox"
                name="is_synthetic"
                value="true"
                defaultChecked={(initial as any).is_synthetic ?? false}
                className="w-3.5 h-3.5 rounded"
              />
              <span className="text-[12px] text-foreground">Yapay (Sentetik) Halka Arz</span>
            </label>
          </Field>
        </div>
      </Section>

      {/* ── Lot Bilgisi ─────────────────────────────────────────── */}
      <Section title="Lot Limitleri">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum Lot">
            <Input name="min_lot" defaultValue={initial.min_lot ?? 1} type="number" min="1" />
          </Field>
          <Field label="Maksimum Lot" hint="Boş bırakılırsa sınırsız">
            <Input name="max_lot" defaultValue={initial.max_lot ?? ''} type="number" min="1" placeholder="Ör: 10000" />
          </Field>
        </div>
      </Section>

      {/* ── Halka Arz Detayları ──────────────────────────────────── */}
      <Section title="Halka Arz Detayları">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Halka Arz Oranı (%)" hint="Şirket sermayesinin kaçta kaçı arz ediliyor?">
            <Input name="halka_arz_orani" defaultValue={initial.halka_arz_orani ?? ''} type="number" step="0.01" min="0" max="100" placeholder="Örn: 15.00" />
          </Field>
          <Field label="Halka Arz Büyüklüğü" hint="Metin olarak (ör: ₺450 milyon)">
            <Input name="halka_arz_buyuklugu" defaultValue={initial.halka_arz_buyuklugu ?? ''} placeholder="Ör: ₺450 milyon" />
          </Field>
        </div>
      </Section>

      {/* ── Şirket Açıklaması ────────────────────────────────────── */}
      <Section title="Şirket Açıklaması">
        <textarea
          name="sirket_aciklamasi"
          defaultValue={initial.sirket_aciklamasi ?? ''}
          rows={5}
          placeholder="Şirket hakkında yatırımcılara gösterilecek açıklama metni..."
          className="w-full px-3 py-2 text-[12px] bg-background border border-border rounded resize-y text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
        />
      </Section>

      {/* ── Tahsisat Dağılımı ────────────────────────────────────── */}
      <Section title="Tahsisat Dağılımı (JSON)" hint="Dizi formatında girin">
        <textarea
          value={tahsisatJson}
          onChange={e => setTahsisatJson(e.target.value)}
          name="tahsisat_dagilimi"
          rows={6}
          placeholder={TAHSISAT_PLACEHOLDER}
          className="w-full px-3 py-2 text-[11px] font-mono bg-muted border border-border rounded resize-y text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Her satır: <code className="bg-muted px-1 rounded">{`{ "kategori": "...", "oran": "..." }`}</code>
        </p>
      </Section>

      {/* ── Finansal Tablo ───────────────────────────────────────── */}
      <Section title="Finansal Tablo (JSON)" hint="Dizi formatında girin">
        <textarea
          value={finansalJson}
          onChange={e => setFinansalJson(e.target.value)}
          name="finansal_tablo"
          rows={6}
          placeholder={FINANSAL_PLACEHOLDER}
          className="w-full px-3 py-2 text-[11px] font-mono bg-muted border border-border rounded resize-y text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Her satır: <code className="bg-muted px-1 rounded">{`{ "donem": "2024", "gelir": "₺1.2 Mrd", "netKar": "₺210 Mn" }`}</code>
        </p>
      </Section>

      {/* ── JSON hata ────────────────────────────────────────────── */}
      {jsonError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded px-3 py-2 text-[11px] text-destructive font-medium">
          {jsonError}
        </div>
      )}

      {/* ── Butonlar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Link
          href="/dashboard/ipo"
          className="text-[12px] font-semibold px-4 py-2 rounded border border-border bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          İptal
        </Link>
        <button
          type="submit"
          className="text-[12px] font-semibold px-5 py-2 rounded bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          Değişiklikleri Kaydet
        </button>
      </div>
    </form>
  )
}

/* ── Alt bileşenler ────────────────────────────────────────────── */

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-card border border-border rounded">
      <div className="border-b border-border px-3 py-1.5 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
        {hint && <span className="text-[10px] text-muted-foreground">— {hint}</span>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        {label} {required && <span className="text-destructive">*</span>}
        {hint && <span className="normal-case text-[9px] ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-7 px-2 text-[12px] bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
    />
  )
}
