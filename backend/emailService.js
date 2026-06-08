const nodemailer = require('nodemailer');
require('dotenv').config();

// ── Transporter ──────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,   // your-email@gmail.com
    pass: process.env.GMAIL_PASS,   // Gmail App Password (bukan password biasa)
  },
});

// ── Template helpers ─────────────────────────────────────
const logoHtml = `
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#2d6a4f,#40916c);border-radius:14px;padding:12px 20px;">
      <span style="font-size:28px;">🐄</span>
      <span style="font-family:Georgia,serif;font-weight:700;font-size:20px;color:#fff;margin-left:8px;">Al-Barakah</span>
    </div>
    <div style="font-size:11px;color:#52b788;letter-spacing:2px;margin-top:4px;font-weight:600;">AQIQAH &amp; QURBAN</div>
  </div>
`;

function baseTemplate(title, bodyHtml) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fff4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,0.1);max-width:100%;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1b4332,#2d6a4f);padding:32px 40px;text-align:center;">
          ${logoHtml}
          <h1 style="color:#fff;margin:0;font-family:Georgia,serif;font-size:22px;">${title}</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          ${bodyHtml}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f0fff4;padding:20px 40px;text-align:center;border-top:1px solid #c6f6d5;">
          <p style="margin:0;font-size:12px;color:#52b788;">© ${new Date().getFullYear()} Al-Barakah Aqiqah &amp; Qurban. Semua hak dilindungi.</p>
          <p style="margin:6px 0 0;font-size:11px;color:#a0aec0;">Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Send Verification Email ──────────────────────────────
async function sendVerificationEmail(toEmail, namaLengkap, token) {
  const verifyUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/api/auth/verify-email?token=${token}`;

  const body = `
    <p style="color:#4a5568;font-size:15px;line-height:1.7;">Assalamu'alaikum <strong>${namaLengkap}</strong>,</p>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;">
      Terima kasih telah mendaftar di <strong>Al-Barakah</strong>. Untuk mengaktifkan akun Anda,
      silakan klik tombol di bawah ini:
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verifyUrl}" style="background:linear-gradient(135deg,#2d6a4f,#40916c);color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        ✅ Verifikasi Akun Saya
      </a>
    </div>
    <p style="color:#718096;font-size:13px;line-height:1.6;">
      Atau salin link ini ke browser Anda:<br>
      <a href="${verifyUrl}" style="color:#2d6a4f;word-break:break-all;">${verifyUrl}</a>
    </p>
    <div style="background:#fff5f5;border-left:4px solid #e53e3e;padding:12px 16px;border-radius:0 8px 8px 0;margin-top:24px;">
      <p style="margin:0;font-size:13px;color:#c53030;">
        ⏰ Link ini akan kadaluarsa dalam <strong>24 jam</strong>.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from:    `"Al-Barakah 🐄" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: '✅ Verifikasi Email – Al-Barakah Aqiqah & Qurban',
    html:    baseTemplate('Verifikasi Email Anda', body),
  });
}

// ── Send Welcome Email (after verified) ─────────────────
async function sendWelcomeEmail(toEmail, namaLengkap) {
  const body = `
    <p style="color:#4a5568;font-size:15px;line-height:1.7;">Assalamu'alaikum <strong>${namaLengkap}</strong>,</p>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;">
      Akun Anda telah <strong style="color:#2d6a4f;">berhasil diverifikasi</strong>! 🎉<br>
      Selamat datang di keluarga besar <strong>Al-Barakah</strong>.
    </p>
    <div style="background:#f0fff4;border-radius:14px;padding:20px 24px;margin:24px 0;">
      <p style="margin:0 0 10px;font-weight:700;color:#2d6a4f;font-size:14px;">Yang bisa Anda lakukan sekarang:</p>
      <ul style="margin:0;padding-left:20px;color:#4a5568;font-size:14px;line-height:2;">
        <li>🐄 Pilih hewan qurban berkualitas</li>
        <li>🐐 Pesan paket aqiqah lengkap</li>
        <li>🏦 Mulai tabungan qurban tahunan</li>
      </ul>
    </div>
    <div style="text-align:center;margin-top:28px;">
      <a href="${process.env.BASE_URL || 'http://localhost:3000'}" style="background:linear-gradient(135deg,#c47a1a,#e08b20);color:#fff;padding:13px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        🛒 Mulai Belanja
      </a>
    </div>
  `;

  await transporter.sendMail({
    from:    `"Al-Barakah 🐄" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: '🎉 Selamat Datang di Al-Barakah!',
    html:    baseTemplate('Akun Berhasil Diaktifkan', body),
  });
}

// ── Send Password Reset Email ────────────────────────────
async function sendPasswordResetEmail(toEmail, namaLengkap, token) {
  const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  const body = `
    <p style="color:#4a5568;font-size:15px;line-height:1.7;">Assalamu'alaikum <strong>${namaLengkap}</strong>,</p>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;">
      Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah untuk membuat password baru:
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" style="background:linear-gradient(135deg,#e53e3e,#c53030);color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        🔑 Reset Password Saya
      </a>
    </div>
    <div style="background:#fff5f5;border-left:4px solid #e53e3e;padding:12px 16px;border-radius:0 8px 8px 0;margin-top:24px;">
      <p style="margin:0;font-size:13px;color:#c53030;">
        ⏰ Link ini akan kadaluarsa dalam <strong>1 jam</strong>.<br>
        Jika Anda tidak meminta reset password, abaikan email ini.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from:    `"Al-Barakah 🐄" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: '🔑 Reset Password – Al-Barakah',
    html:    baseTemplate('Reset Password', body),
  });
}

// ── Send Order Confirmation ──────────────────────────────
async function sendOrderConfirmationEmail(toEmail, namaLengkap, orderId, items, total) {
  const itemRows = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${i.nama}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${i.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">Rp ${(i.harga * i.qty).toLocaleString('id-ID')}</td>
    </tr>`
  ).join('');

  const body = `
    <p style="color:#4a5568;font-size:15px;line-height:1.7;">Assalamu'alaikum <strong>${namaLengkap}</strong>,</p>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;">
      Pesanan Anda telah kami terima dan sedang diproses. Berikut detailnya:
    </p>
    <div style="background:#f0fff4;border-radius:10px;padding:14px 18px;margin:16px 0;">
      <strong style="color:#2d6a4f;">ID Pesanan:</strong>
      <span style="font-family:monospace;font-size:15px;color:#1a202c;"> ${orderId}</span>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:16px 0;">
      <thead>
        <tr style="background:#f7fafc;">
          <th style="padding:10px 12px;text-align:left;color:#718096;font-weight:600;">Hewan</th>
          <th style="padding:10px 12px;text-align:center;color:#718096;font-weight:600;">Qty</th>
          <th style="padding:10px 12px;text-align:right;color:#718096;font-weight:600;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:12px;font-weight:700;font-size:15px;">Total</td>
          <td style="padding:12px;font-weight:700;font-size:15px;text-align:right;color:#2d6a4f;">Rp ${total.toLocaleString('id-ID')}</td>
        </tr>
      </tfoot>
    </table>
    <p style="color:#718096;font-size:13px;">Tim kami akan menghubungi Anda untuk konfirmasi lebih lanjut via WhatsApp.</p>
  `;

  await transporter.sendMail({
    from:    `"Al-Barakah 🐄" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: `📦 Konfirmasi Pesanan #${orderId} – Al-Barakah`,
    html:    baseTemplate('Pesanan Diterima', body),
  });
}

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
};
