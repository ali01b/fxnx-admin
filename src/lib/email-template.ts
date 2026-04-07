const BASE_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background-color: #f0f0f0; font-family: 'Lato', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; color: #1a1a1a; }
  .email-page { min-height: 100vh; padding: 40px 16px; }
  .email-wrap { max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.10); }
  .header { background: #ffffff; padding: 20px 40px; border-bottom: 3px solid #c0392b; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .header img { height: 44px; width: auto; display: block; }
  .header-meta { font-size: 9px; letter-spacing: 0.5px; text-transform: uppercase; color: #aaaaaa; text-align: right; line-height: 1.7; }
  .hero { background: #c0392b; padding: 36px 40px 32px; }
  .hero h1 { font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 0.2px; line-height: 1.25; margin-bottom: 8px; }
  .hero p { font-size: 13px; color: rgba(255,255,255,0.75); font-weight: 300; }
  .content { background: #ffffff; padding: 36px 40px 28px; border-left: 4px solid #c0392b; }
  .content-greeting { font-size: 14.5px; font-weight: 700; color: #1a1a1a; margin-bottom: 12px; }
  .content-body { font-size: 13.5px; color: #444444; line-height: 1.75; white-space: pre-wrap; }
  .pw-box { margin: 28px 0; background: #f9f9f9; border: 1px solid #e5e5e5; border-left: 4px solid #c0392b; border-radius: 4px; padding: 20px 24px; text-align: center; }
  .pw-label { font-size: 9.5px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #aaaaaa; margin-bottom: 12px; }
  .pw-value { font-size: 28px; font-weight: 900; letter-spacing: 0.18em; color: #1a1a1a; font-family: 'Courier New', monospace; }
  .pw-note { font-size: 11px; color: #aaaaaa; margin-top: 10px; }
  .alert { background: #fff8f8; border: 1px solid #f0dede; border-left: 3px solid #c0392b; padding: 14px 18px; margin: 24px 0; font-size: 13px; color: #555555; line-height: 1.65; }
  .alert strong { color: #1a1a1a; }
  .alert a { color: #c0392b; text-decoration: none; }
  .cta-wrap { text-align: center; padding: 20px 0 8px; }
  .cta-btn { display: inline-block; background: #c0392b; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 14px 52px; border-radius: 4px; }
  .security { background: #ffffff; padding: 22px 40px 26px; border-top: 1px solid #ebebeb; }
  .security-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #bbbbbb; margin-bottom: 12px; }
  .security-list { list-style: none; }
  .security-list li { display: flex; gap: 10px; align-items: flex-start; font-size: 12px; color: #666666; line-height: 1.8; margin-bottom: 2px; }
  .security-list li::before { content: ''; display: block; width: 4px; height: 4px; background: #c0392b; flex-shrink: 0; margin-top: 8px; }
  .wt-band { background: #1e1e1e; padding: 22px 40px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .wt-text h3 { font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 4px; }
  .wt-text p { font-size: 11.5px; color: #777777; line-height: 1.5; }
  .wt-btn { flex-shrink: 0; display: inline-block; background: #c0392b; color: #ffffff; text-decoration: none; font-size: 11.5px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; padding: 10px 20px; border-radius: 3px; white-space: nowrap; }
  .footer { background: #f9f9f9; padding: 24px 40px 28px; border-top: 3px solid #c0392b; }
  .footer-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid #e5e5e5; }
  .footer-top img { height: 36px; width: auto; display: block; }
  .footer-contact { font-size: 11px; color: #999999; text-align: right; line-height: 1.85; }
  .footer-contact a { color: #999999; text-decoration: none; }
  .footer-legal { font-size: 10px; color: #bbbbbb; line-height: 1.75; margin-bottom: 14px; }
  .footer-legal a { color: #bbbbbb; text-decoration: none; }
  .risk-box { background: #f2f2f2; border: 1px solid #e0e0e0; border-left: 3px solid #c0392b; padding: 14px 16px; margin-top: 14px; }
  .risk-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #999999; margin-bottom: 8px; }
  .risk-text { font-size: 10px; color: #aaaaaa; line-height: 1.75; margin-bottom: 6px; }
  .risk-text:last-child { margin-bottom: 0; }
  .mersis { font-size: 10px; color: #bbbbbb; margin-top: 12px; padding-top: 10px; border-top: 1px solid #e5e5e5; }
`

interface EmailTemplateOptions {
  heroTitle:    string
  heroSubtitle?: string
  greeting?:   string
  bodyText:    string
  /** Şifre kutusu göstermek için doldurun */
  password?:   string
  /** CTA butonu */
  ctaText?:    string
  ctaUrl?:     string
  /** Güvenlik uyarısı gösterilsin mi */
  showSecurity?: boolean
}

export function buildEmailHtml(opts: EmailTemplateOptions): string {
  const {
    heroTitle,
    heroSubtitle = '',
    greeting = 'Sayın Yatırımcımız,',
    bodyText,
    password,
    ctaText,
    ctaUrl,
    showSecurity = true,
  } = opts

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const passwordBlock = password ? `
    <div class="pw-box">
      <p class="pw-label">Yeni Şifreniz</p>
      <p class="pw-value">${password}</p>
      <p class="pw-note">Güvenliğiniz için giriş yaptıktan sonra şifrenizi değiştirmenizi öneririz.</p>
    </div>
    <div class="alert">
      <strong>Önemli:</strong> Bu işlemi siz talep etmediyseniz hesabınızın güvenliği risk altında olabilir.
      Lütfen derhal <a href="mailto:destek@tfg.istanbul">destek@tfg.istanbul</a> adresine bildirin.
    </div>
  ` : ''

  const ctaBlock = ctaText ? `
    <div class="cta-wrap">
      <a href="${ctaUrl ?? siteUrl + '/login'}" class="cta-btn">${ctaText}</a>
    </div>
  ` : ''

  const securityBlock = showSecurity ? `
  <div class="security">
    <p class="security-label">Güvenlik Bildirimi</p>
    <ul class="security-list">
      <li>TFG Istanbul hiçbir koşulda şifrenizi, PIN kodunuzu veya kişisel bilgilerinizi e-posta yoluyla talep etmez.</li>
      <li>Bu şifreyi yalnızca kendi cihazınızda kullanın; üçüncü şahıslarla paylaşmayın.</li>
      <li>Şüpheli bir durum yaşıyorsanız hesabınızı dondurmak için müşteri hizmetleriyle irtibata geçin.</li>
    </ul>
  </div>
  ` : ''

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TFG Istanbul – ${heroTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap" rel="stylesheet" />
  <style>${BASE_STYLES}</style>
</head>
<body>
<div class="email-page">
<div class="email-wrap">

  <div class="header">
    <img src="https://i.imgur.com/wbbajlK.png" alt="TFG Istanbul Menkul Değerler A.Ş" />
    <p class="header-meta">Sermaye Piyasası Kurulu<br>Denetiminde Faaliyet Gösterir</p>
  </div>

  <div class="hero">
    <h1>${heroTitle}</h1>
    ${heroSubtitle ? `<p>${heroSubtitle}</p>` : ''}
  </div>

  <div class="content">
    <p class="content-greeting">${greeting}</p>
    <p class="content-body">${bodyText}</p>
    ${passwordBlock}
    ${ctaBlock}
  </div>

  ${securityBlock}

  <div class="wt-band">
    <div class="wt-text">
      <h3>Online İşlem Platformu — WebTrader</h3>
      <p>Hisse senedi, varant, türev araç ve yatırım fonu işlemlerinizi gerçekleştirin.</p>
    </div>
    <a href="http://onlinesube.tfg.istanbul/" class="wt-btn">Platforma Giriş Yap</a>
  </div>

  <div class="footer">
    <div class="footer-top">
      <img src="https://i.imgur.com/wbbajlK.png" alt="TFG Istanbul" />
      <div class="footer-contact">
        Büyükdere Cad. No: [Adres], Şişli / İstanbul<br>
        <a href="tel:+902120000000">+90 (212) 000 00 00</a>
        &nbsp;|&nbsp;
        <a href="mailto:info@tfg.istanbul">info@tfg.istanbul</a><br>
        <a href="http://www.tfg.istanbul">www.tfg.istanbul</a>
      </div>
    </div>
    <p class="footer-legal">
      TFG Istanbul Menkul Değerler A.Ş, Sermaye Piyasası Kurulu (SPK) tarafından yetkilendirilmiş ve denetlenmekte olan bir aracı kurumdur.
      Bu elektronik ileti, 6362 sayılı Sermaye Piyasası Kanunu ile Ticari İletişim ve Ticari Elektronik İleti Hakkında Yönetmelik çerçevesinde gönderilmiştir.
      Bu ileti yalnızca alıcıya yöneliktir; izinsiz kullanılamaz veya dağıtılamaz.<br><br>
      &copy; 2025 TFG Istanbul Menkul Değerler A.Ş &mdash; Tüm hakları saklıdır.
    </p>
    <div class="risk-box">
      <p class="risk-label">Risk Açıklaması</p>
      <p class="risk-text">
        Burada yer alan yatırım, bilgi, yorum ve tavsiyeler "Yatırım Danışmanlığı" kapsamında değildir. Yatırım danışmanlığı hizmeti, aracı kurumlar, portföy yönetim şirketleri, mevduat kabul etmeyen bankalar ile müşteri arasında imzalanacak yatırım danışmanlığı sözleşmesi çerçevesinde sunulmaktadır.
      </p>
      <p class="risk-text">
        Borsa, VİOP, Forex ve CFD ticareti yüksek oranda kayıp riski içerir ve her yatırımcı için uygun olmayabilir.
      </p>
    </div>
    <p class="mersis">Mersis No: 0389070782000015</p>
  </div>

</div>
</div>
</body>
</html>`
}
