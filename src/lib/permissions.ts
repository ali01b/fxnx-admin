export const PERMISSIONS = [
  // ── Kullanıcılar ──────────────────────────────────────────
  'users.view',
  'users.edit',
  'users.create',
  'users.suspend',
  'users.assign_role',
  // ── KYC ──────────────────────────────────────────────────
  'kyc.view',
  'kyc.approve',
  'kyc.reject',
  // ── Para Yatırma ──────────────────────────────────────────
  'deposits.view',
  'deposits.approve',
  'deposits.reject',
  // ── Para Çekme ────────────────────────────────────────────
  'withdrawals.view',
  'withdrawals.approve',
  'withdrawals.reject',
  // ── Trading ───────────────────────────────────────────────
  'trading.view',
  'trading.close',
  // ── Enstrümanlar ──────────────────────────────────────────
  'instruments.view',
  'instruments.edit',
  'instruments.create',
  // ── IB Yönetimi ───────────────────────────────────────────
  'ib.view',
  'ib.create',
  'ib.edit_rates',
  'ib.assign_client',
  'ib.mark_paid',
  // ── Halka Arz ─────────────────────────────────────────────
  'ipo.view',
  'ipo.create',
  'ipo.edit',
  'ipo.delete',
  // ── Platform ──────────────────────────────────────────────
  'platform.settings',
  'platform.reports',
  // ── Roller ────────────────────────────────────────────────
  'roles.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Kullanıcılar',
    permissions: ['users.view', 'users.edit', 'users.create', 'users.suspend', 'users.assign_role'],
  },
  {
    label: 'KYC',
    permissions: ['kyc.view', 'kyc.approve', 'kyc.reject'],
  },
  {
    label: 'Para Yatırma',
    permissions: ['deposits.view', 'deposits.approve', 'deposits.reject'],
  },
  {
    label: 'Para Çekme',
    permissions: ['withdrawals.view', 'withdrawals.approve', 'withdrawals.reject'],
  },
  {
    label: 'Trading',
    permissions: ['trading.view', 'trading.close'],
  },
  {
    label: 'Enstrümanlar',
    permissions: ['instruments.view', 'instruments.edit', 'instruments.create'],
  },
  {
    label: 'IB Yönetimi',
    permissions: ['ib.view', 'ib.create', 'ib.edit_rates', 'ib.assign_client', 'ib.mark_paid'],
  },
  {
    label: 'Halka Arz',
    permissions: ['ipo.view', 'ipo.create', 'ipo.edit', 'ipo.delete'],
  },
  {
    label: 'Platform',
    permissions: ['platform.settings', 'platform.reports'],
  },
  {
    label: 'Roller',
    permissions: ['roles.manage'],
  },
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  'users.view':         'Kullanıcıları görüntüle',
  'users.edit':         'Kullanıcı bilgilerini düzenle',
  'users.create':       'Yeni kullanıcı oluştur',
  'users.suspend':      'Kullanıcıyı askıya al / aktifleştir',
  'users.assign_role':  'Kullanıcıya rol ata',
  'kyc.view':           'KYC belgelerini görüntüle',
  'kyc.approve':        'KYC\'yi onayla',
  'kyc.reject':         'KYC\'yi reddet',
  'deposits.view':      'Para yatırma taleplerini görüntüle',
  'deposits.approve':   'Para yatırmayı onayla',
  'deposits.reject':    'Para yatırmayı reddet',
  'withdrawals.view':   'Para çekme taleplerini görüntüle',
  'withdrawals.approve':'Para çekmeyi onayla',
  'withdrawals.reject': 'Para çekmeyi reddet',
  'trading.view':       'Pozisyonları görüntüle',
  'trading.close':      'Pozisyon kapat',
  'instruments.view':   'Enstrümanları görüntüle',
  'instruments.edit':   'Enstrüman düzenle',
  'instruments.create': 'Enstrüman ekle',
  'ib.view':            'IB listesini görüntüle',
  'ib.create':          'Yeni IB oluştur',
  'ib.edit_rates':      'Komisyon oranlarını düzenle',
  'ib.assign_client':   'Müşteri ata / çıkar',
  'ib.mark_paid':       'Komisyonları ödendi işaretle',
  'ipo.view':           'Halka arzları görüntüle',
  'ipo.create':         'Yeni halka arz oluştur',
  'ipo.edit':           'Halka arz düzenle',
  'ipo.delete':         'Halka arz sil',
  'platform.settings':  'Platform ayarlarını düzenle',
  'platform.reports':   'Raporları görüntüle',
  'roles.manage':       'Rolleri ve yetkileri yönet',
}
