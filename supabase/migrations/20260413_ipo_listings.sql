-- IPO Listings tablosu
CREATE TABLE IF NOT EXISTS ipo_listings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Şirket bilgileri
  ticker                TEXT NOT NULL,
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  logo_url              TEXT,
  source_url            TEXT,
  badge                 TEXT DEFAULT '',
  -- Durum
  status                TEXT NOT NULL DEFAULT 'taslak' CHECK (status IN ('aktif', 'taslak', 'gecmis')),
  -- Başvuru tarihleri
  basvuru_baslangic     DATE,
  basvuru_bitis         DATE,
  borsa_giris           DATE,
  -- Fiyatlama
  fiyat_alt             NUMERIC(14,4),
  fiyat_ust             NUMERIC(14,4),
  lot_fiyat             NUMERIC(14,4),
  pazar                 TEXT,           -- Ana Pazar, Yıldız Pazar, GİP, vb.
  tavan_gun             INTEGER,        -- Kaç gün tavan bekleniyor
  -- Lot
  min_lot               INTEGER DEFAULT 1,
  max_lot               INTEGER,
  -- Halka arz detayları
  halka_arz_orani       NUMERIC(5,2),   -- Yüzde (ör. 15.00)
  halka_arz_buyuklugu   TEXT,           -- Metin (ör. "₺450 milyon")
  -- İçerik
  sirket_aciklamasi     TEXT,
  tahsisat_dagilimi     JSONB DEFAULT '[]'::jsonb,
  finansal_tablo        JSONB DEFAULT '[]'::jsonb,
  -- Meta
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at otomatik güncelle
CREATE OR REPLACE FUNCTION update_ipo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ipo_listings_updated_at
  BEFORE UPDATE ON ipo_listings
  FOR EACH ROW EXECUTE FUNCTION update_ipo_updated_at();

-- RLS
ALTER TABLE ipo_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON ipo_listings FOR ALL USING (true);
