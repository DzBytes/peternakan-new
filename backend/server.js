const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const midtransClient = require('midtrans-client');
const db = require('./db');
const email = require('./emailService');
require('dotenv').config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev_albarakah';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

app.use(express.json());
app.use(cors({ origin: FRONTEND_URL }));

function httpError(message, status = 500) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ error: err.message || 'Terjadi kesalahan server' });
}

function midtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  const clientKey = process.env.MIDTRANS_CLIENT_KEY || '';
  const explicitProd = String(process.env.MIDTRANS_PROD || '').trim();
  const inferredProduction = midtransKeyMode(serverKey) === 'production' && midtransKeyMode(clientKey) === 'production';
  return {
    isProduction: explicitProd ? explicitProd === 'true' : inferredProduction,
    modeSource: explicitProd ? 'MIDTRANS_PROD' : 'key-prefix',
    serverKey,
    clientKey,
  };
}

function isMidtransReady() {
  const config = midtransConfig();
  return Boolean(config.serverKey && config.clientKey);
}

function midtransKeyMode(value) {
  return String(value || '').startsWith('SB-Mid-') ? 'sandbox' : 'production';
}

function describeMidtransMode() {
  const config = midtransConfig();
  return config.isProduction ? 'production' : 'sandbox';
}

function createSnap() {
  const config = midtransConfig();
  if (!config.serverKey || !config.clientKey) {
    throw httpError('Midtrans belum aktif atau masih review. Gunakan pembayaran tunai untuk testing.', 503);
  }
  const expectedMode = describeMidtransMode();
  if (midtransKeyMode(config.serverKey) !== expectedMode || midtransKeyMode(config.clientKey) !== expectedMode) {
    throw httpError(
      `Konfigurasi Midtrans tidak cocok: MIDTRANS_PROD=${config.isProduction} tetapi prefix key tidak sesuai mode ${expectedMode}.`,
      400
    );
  }
  return new midtransClient.Snap({
    isProduction: config.isProduction,
    serverKey: config.serverKey,
  });
}

async function createMidtransTransaction(parameter) {
  try {
    const snap = createSnap();
    return await snap.createTransaction(parameter);
  } catch (err) {
    const msg = String(err.message || '');
    const isUnauthorized = msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('access denied');
    if (isUnauthorized) {
      throw httpError(
        'Midtrans menolak transaksi (401). Cek pasangan Server Key dan Client Key, mode MIDTRANS_PROD, dan status aktivasi akun. Jika Midtrans masih review, gunakan Uang Tunai untuk testing atau pakai sandbox key dengan MIDTRANS_PROD=false.',
        401
      );
    }
    throw err;
  }
}

function validateMidtransConfig() {
  if (!isMidtransReady()) {
    console.warn('Midtrans keys belum lengkap. Pembayaran online dinonaktifkan, pembayaran tunai tetap bisa dipakai.');
  }
}
validateMidtransConfig();

function normalizePaymentMethod(value) {
  const method = String(value || '').toUpperCase();
  if (['TUNAI', 'CASH', 'UANG_TUNAI'].includes(method)) return 'TUNAI';
  if (['CICILAN_TUNAI', 'SETORAN_TUNAI', 'CASH_INSTALLMENT'].includes(method)) return 'CICILAN_TUNAI';
  if (['CICILAN_MIDTRANS', 'SETORAN_MIDTRANS', 'CICILAN', 'SETORAN'].includes(method)) return 'CICILAN_MIDTRANS';
  return 'MIDTRANS';
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount);
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw httpError('Keranjang masih kosong', 400);
  }

  return items.map((item) => {
    const hewanId = Number(item.id_hewan || item.ID_HEWAN || item.id);
    const qty = Number.parseInt(item.qty || item.JUMLAH || 1, 10);
    if (!Number.isInteger(hewanId) || hewanId <= 0) {
      throw httpError(`ID hewan tidak valid untuk item ${item.nama || item.name || '-'}`, 400);
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      throw httpError(`Jumlah tidak valid untuk ${item.nama || item.name || '-'}`, 400);
    }
    return {
      id: hewanId,
      qty,
      nama: item.nama || item.name || '',
      harga: money(item.harga || item.price || item.HARGA),
      is_patungan: item.is_patungan === 'Y' || item.is_patungan === true ? 'Y' : 'N',
    };
  });
}

function normalizeEmailList(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[,\n;]/);
  return [...new Set(list.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean))];
}

function buildAlamat({ nama, alamat_kirim, phone, catatan }) {
  return [nama, alamat_kirim, phone, catatan]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' | ') || null;
}

async function sendAppNotification(conn, idPelanggan, judul, pesan, tipe = 'INFO') {
  await conn.execute(
    'INSERT INTO T_NOTIFIKASI (ID_PELANGGAN, JUDUL, PESAN, TIPE) VALUES (?, ?, ?, ?)',
    [idPelanggan, judul, pesan, tipe]
  );
}

function normalizeRole(role) {
  return String(role || 'PELANGGAN').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'PELANGGAN';
}

async function createPembayaran(conn, { id_pesanan = null, id_setoran = null, nominal, metode, status, ref = null }) {
  const [result] = await conn.execute(
    `INSERT INTO T_PEMBAYARAN (ID_PESANAN, ID_SETORAN, NOMINAL, METODE, STATUS, REF_BAYAR)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id_pesanan, id_setoran, nominal, metode, status, ref]
  );
  return result.insertId;
}

async function lockAndReserveItems(conn, rawItems) {
  const items = normalizeItems(rawItems);
  const lockedItems = [];

  for (const item of items) {
    const [rows] = await conn.execute(
      'SELECT ID_HEWAN, NAMA, HARGA, STOK, STATUS FROM T_HEWAN WHERE ID_HEWAN = ? FOR UPDATE',
      [item.id]
    );
    const hewan = rows[0];
    if (!hewan || hewan.STATUS !== 'A') {
      throw httpError(`${item.nama || 'Hewan'} tidak tersedia`, 400);
    }
    if (Number(hewan.STOK) < item.qty) {
      throw httpError(`Stok tidak cukup untuk ${item.nama || hewan.NAMA}. Tersisa ${hewan.STOK}`, 400);
    }

    await conn.execute('UPDATE T_HEWAN SET STOK = STOK - ? WHERE ID_HEWAN = ?', [item.qty, item.id]);
    lockedItems.push({
      ...item,
      nama: item.nama || hewan.NAMA,
      harga: item.harga || Number(hewan.HARGA),
    });
  }

  return lockedItems;
}

async function handleSuccessfulSetoran(conn, id_setoran) {
  const [setorans] = await conn.execute('SELECT * FROM T_SETORAN WHERE ID_SETORAN = ?', [id_setoran]);
  if (!setorans.length) return;
  const setoran = setorans[0];

  if (setoran.STATUS !== 'LUNAS') {
    await conn.execute('UPDATE T_SETORAN SET STATUS = "LUNAS" WHERE ID_SETORAN = ?', [id_setoran]);
  }
  await conn.execute('UPDATE T_PEMBAYARAN SET STATUS = "LUNAS" WHERE ID_SETORAN = ?', [id_setoran]);

  if (setoran.ID_TABUNGAN) {
    const [sumRows] = await conn.execute(
      'SELECT COALESCE(SUM(NOMINAL), 0) AS TOTAL_SETORAN FROM T_SETORAN WHERE ID_TABUNGAN = ? AND STATUS = "LUNAS"',
      [setoran.ID_TABUNGAN]
    );
    const totalTerkumpul = Number(sumRows[0].TOTAL_SETORAN || 0);
    await conn.execute('UPDATE T_TABUNGAN_QURBAN SET TERKUMPUL = ? WHERE ID_TABUNGAN = ?', [totalTerkumpul, setoran.ID_TABUNGAN]);

    const [tabungans] = await conn.execute('SELECT * FROM T_TABUNGAN_QURBAN WHERE ID_TABUNGAN = ? FOR UPDATE', [setoran.ID_TABUNGAN]);
    if (!tabungans.length) return;
    const tabungan = tabungans[0];
    const target = Number(tabungan.TARGET_NOMINAL || 0);

    if (target > 0 && totalTerkumpul >= target && tabungan.STATUS === 'A') {
      let orderId = tabungan.ID_PESANAN;

      if (tabungan.ID_HEWAN && !orderId) {
        const [hewans] = await conn.execute(
          'SELECT ID_HEWAN, NAMA, HARGA, STOK, STATUS FROM T_HEWAN WHERE ID_HEWAN = ? FOR UPDATE',
          [tabungan.ID_HEWAN]
        );
        const hewan = hewans[0];
        if (!hewan || hewan.STATUS !== 'A' || Number(hewan.STOK) <= 0) {
          await sendAppNotification(
            conn,
            tabungan.ID_PELANGGAN,
            'Stok target tabungan habis',
            `Tabungan ${tabungan.NAMA_TABUNGAN || ''} sudah lunas, tetapi hewan target belum tersedia. Admin perlu mengonfirmasi pengganti.`,
            'STOK'
          );
          return;
        }

        await conn.execute('UPDATE T_HEWAN SET STOK = STOK - 1 WHERE ID_HEWAN = ?', [tabungan.ID_HEWAN]);
        const [order] = await conn.execute(
          `INSERT INTO T_PESANAN (ID_PELANGGAN, JENIS_LAYANAN, TOTAL, METODE_BAYAR, STATUS, ALAMAT_KIRIM)
           VALUES (?, 'QURBAN', ?, 'TABUNGAN', 'Dikonfirmasi', 'Pesanan otomatis dari Tabungan Qurban')`,
          [tabungan.ID_PELANGGAN, target]
        );
        orderId = order.insertId;
        await conn.execute(
          `INSERT INTO T_DETAIL_PESANAN (ID_PESANAN, ID_HEWAN, JUMLAH, HARGA_SATUAN, IS_PATUNGAN)
           VALUES (?, ?, 1, ?, 'N')`,
          [orderId, tabungan.ID_HEWAN, hewan.HARGA]
        );
        await createPembayaran(conn, {
          id_pesanan: orderId,
          nominal: target,
          metode: 'TABUNGAN',
          status: 'LUNAS',
          ref: `TAB-${tabungan.ID_TABUNGAN}`,
        });
      }

      await conn.execute(
        'UPDATE T_TABUNGAN_QURBAN SET STATUS = "S", ID_PESANAN = ? WHERE ID_TABUNGAN = ?',
        [orderId || null, tabungan.ID_TABUNGAN]
      );
      await sendAppNotification(
        conn,
        tabungan.ID_PELANGGAN,
        'Tabungan qurban lunas',
        `Tabungan ${tabungan.NAMA_TABUNGAN || ''} sudah mencapai target.`,
        'PAYMENT'
      );
    }
    return;
  }

  if (setoran.ID_PESANAN) {
    const [orders] = await conn.execute(
      'SELECT ID_PESANAN, ID_PELANGGAN, TOTAL FROM T_PESANAN WHERE ID_PESANAN = ? FOR UPDATE',
      [setoran.ID_PESANAN]
    );
    if (!orders.length) return;
    const order = orders[0];
    const [sumRows] = await conn.execute(
      'SELECT COALESCE(SUM(NOMINAL), 0) AS TOTAL_SETORAN FROM T_SETORAN WHERE ID_PESANAN = ? AND STATUS = "LUNAS"',
      [setoran.ID_PESANAN]
    );
    const totalSetoran = Number(sumRows[0].TOTAL_SETORAN || 0);
    const totalPesanan = Number(order.TOTAL || 0);

    if (totalSetoran >= totalPesanan) {
      await conn.execute('UPDATE T_PESANAN SET STATUS = "Dikonfirmasi" WHERE ID_PESANAN = ?', [setoran.ID_PESANAN]);
      await sendAppNotification(
        conn,
        order.ID_PELANGGAN,
        'Pesanan qurban lunas',
        `Setoran pesanan ORD-${setoran.ID_PESANAN} sudah lunas.`,
        'PAYMENT'
      );
    } else {
      await conn.execute('UPDATE T_PESANAN SET STATUS = "Cicilan Aktif" WHERE ID_PESANAN = ?', [setoran.ID_PESANAN]);
      await sendAppNotification(
        conn,
        order.ID_PELANGGAN,
        'Setoran qurban diterima',
        `Setoran ORD-${setoran.ID_PESANAN} sebesar Rp ${Number(setoran.NOMINAL).toLocaleString('id-ID')} sudah dicatat.`,
        'PAYMENT'
      );
    }
  }
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token tidak valid atau kadaluarsa' });
  }

  try {
    let result = await db.query(
      'SELECT ID_PELANGGAN, NAMA_LENGKAP, EMAIL, STATUS, ROLE FROM T_PELANGGAN WHERE ID_PELANGGAN = ?',
      [payload.id]
    );

    if (!result.rows.length && payload.email) {
      result = await db.query(
        'SELECT ID_PELANGGAN, NAMA_LENGKAP, EMAIL, STATUS, ROLE FROM T_PELANGGAN WHERE EMAIL = ?',
        [payload.email]
      );
    }

    if (!result.rows.length) {
      return res.status(401).json({
        error: 'Sesi login tidak cocok dengan data pelanggan. Silakan logout lalu login ulang sebelum testing pembayaran tunai.',
        code: 'STALE_SESSION',
      });
    }

    const user = result.rows[0];
    if (user.STATUS !== 'A') {
      return res.status(403).json({ error: 'Akun belum aktif. Silakan verifikasi email terlebih dahulu.' });
    }

    req.user = {
      ...payload,
      tokenId: payload.id,
      id: user.ID_PELANGGAN,
      email: user.EMAIL,
      name: user.NAMA_LENGKAP,
      role: normalizeRole(user.ROLE),
    };
    return next();
  } catch (err) {
    return sendError(res, err);
  }
}

async function adminMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token admin tidak ditemukan' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token admin tidak valid atau kadaluarsa' });
  }

  try {
    if (normalizeRole(payload.role) !== 'ADMIN') return res.status(403).json({ error: 'Akses admin ditolak' });
    const lookupSql = payload.id
      ? 'SELECT ID_PELANGGAN, NAMA_LENGKAP, EMAIL, STATUS, ROLE FROM T_PELANGGAN WHERE ID_PELANGGAN = ?'
      : 'SELECT ID_PELANGGAN, NAMA_LENGKAP, EMAIL, STATUS, ROLE FROM T_PELANGGAN WHERE EMAIL = ?';
    const lookupValue = payload.id || payload.email;
    if (!lookupValue) return res.status(401).json({ error: 'Token admin tidak lengkap. Silakan login ulang.' });
    const result = await db.query(
      lookupSql,
      [lookupValue]
    );
    const user = result.rows[0];
    if (!user || user.STATUS !== 'A' || normalizeRole(user.ROLE) !== 'ADMIN') {
      return res.status(403).json({ error: 'Akun ini tidak terdaftar sebagai admin aktif.' });
    }
    req.admin = { id: user.ID_PELANGGAN, name: user.NAMA_LENGKAP, email: user.EMAIL, role: 'ADMIN' };
    return next();
  } catch (err) {
    return sendError(res, err);
  }
}

function normalizeOrderStatus(status) {
  const value = String(status || '').trim();
  const aliases = {
    'Pembayaran Disetujui': 'Dikonfirmasi',
    'Pembayaran Dibatalkan': 'Dibatalkan',
  };
  return aliases[value] || value;
}

async function restoreOrderStock(conn, idPesanan) {
  const [details] = await conn.execute('SELECT ID_HEWAN, JUMLAH FROM T_DETAIL_PESANAN WHERE ID_PESANAN = ?', [idPesanan]);
  for (const detail of details) {
    await conn.execute('UPDATE T_HEWAN SET STOK = STOK + ? WHERE ID_HEWAN = ?', [detail.JUMLAH, detail.ID_HEWAN]);
  }
}

async function updateOrderStatus(conn, idPesanan, status, catatan = '') {
  const finalStatus = normalizeOrderStatus(status);
  const [orders] = await conn.execute('SELECT * FROM T_PESANAN WHERE ID_PESANAN = ? FOR UPDATE', [idPesanan]);
  if (!orders.length) throw httpError('Pesanan tidak ditemukan', 404);
  const order = orders[0];

  if (finalStatus === 'Dibatalkan' && order.STATUS !== 'Dibatalkan') {
    await restoreOrderStock(conn, idPesanan);
  }

  await conn.execute('UPDATE T_PESANAN SET STATUS = ? WHERE ID_PESANAN = ?', [finalStatus, idPesanan]);
  await sendAppNotification(
    conn,
    order.ID_PELANGGAN,
    `Status pesanan ORD-${idPesanan}`,
    catatan || `Status pesanan Anda berubah menjadi ${finalStatus}.`,
    finalStatus === 'Dibatalkan' ? 'ALERT' : 'INFO'
  );
  return finalStatus;
}

// AUTH ROUTES
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nama, email: userEmail, password, no_hp } = req.body;
    if (!nama || !userEmail || !password) return res.status(400).json({ error: 'Data wajib diisi' });
    const existing = await db.query('SELECT ID_PELANGGAN FROM T_PELANGGAN WHERE EMAIL = ?', [userEmail]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email sudah terdaftar' });

    const hash = await bcrypt.hash(password, 12);
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO T_PELANGGAN (NAMA_LENGKAP, EMAIL, PASSWORD_HASH, NO_HP, STATUS, ROLE, VERIFY_TOKEN, VERIFY_EXPIRES)
       VALUES (?, ?, ?, ?, 'P', 'PELANGGAN', ?, ?)`,
      [nama, userEmail, hash, no_hp || null, token, expires]
    );
    await email.sendVerificationEmail(userEmail, nama, token);
    res.json({ success: true, message: 'Registrasi sukses. Cek email untuk verifikasi.' });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token kosong' });
    const result = await db.query('SELECT * FROM T_PELANGGAN WHERE VERIFY_TOKEN = ? AND STATUS = "P"', [token]);
    if (!result.rows.length) return res.status(400).send('Token tidak valid');

    const user = result.rows[0];
    await db.query(
      'UPDATE T_PELANGGAN SET STATUS = "A", EMAIL_VERIFIED = 1, VERIFY_TOKEN = NULL WHERE ID_PELANGGAN = ?',
      [user.ID_PELANGGAN]
    );
    await email.sendWelcomeEmail(user.EMAIL, user.NAMA_LENGKAP);
    res.send('<h1>Verifikasi berhasil. Silakan login di aplikasi.</h1>');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email: userEmail, password } = req.body;
    if (!userEmail || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });
    const result = await db.query('SELECT * FROM T_PELANGGAN WHERE EMAIL = ?', [userEmail]);
    if (!result.rows.length) return res.status(401).json({ error: 'Email tidak ditemukan' });
    const user = result.rows[0];
    if (!await bcrypt.compare(password, user.PASSWORD_HASH)) return res.status(401).json({ error: 'Password salah' });
    if (user.STATUS !== 'A') {
      return res.status(403).json({ error: 'Akun belum aktif. Silakan verifikasi email terlebih dahulu.', needVerify: true });
    }

    const role = normalizeRole(user.ROLE);
    const token = jwt.sign(
      { id: user.ID_PELANGGAN, email: user.EMAIL, name: user.NAMA_LENGKAP, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.ID_PELANGGAN, name: user.NAMA_LENGKAP, email: user.EMAIL, role } });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email: userEmail } = req.body;
    if (!userEmail) return res.status(400).json({ error: 'Email wajib diisi' });
    const result = await db.query('SELECT * FROM T_PELANGGAN WHERE EMAIL = ?', [userEmail]);
    if (!result.rows.length) return res.json({ message: 'Jika email terdaftar, link verifikasi akan dikirim.' });
    const user = result.rows[0];
    if (user.STATUS === 'A' && user.EMAIL_VERIFIED === 1) return res.json({ message: 'Akun sudah aktif.' });
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.query(
      'UPDATE T_PELANGGAN SET VERIFY_TOKEN = ?, VERIFY_EXPIRES = ? WHERE ID_PELANGGAN = ?',
      [token, expires, user.ID_PELANGGAN]
    );
    await email.sendVerificationEmail(user.EMAIL, user.NAMA_LENGKAP, token);
    res.json({ message: 'Email verifikasi berhasil dikirim ulang.' });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email: userEmail } = req.body;
    if (!userEmail) return res.status(400).json({ error: 'Email wajib diisi' });
    const result = await db.query('SELECT * FROM T_PELANGGAN WHERE EMAIL = ?', [userEmail]);
    if (result.rows.length) {
      const user = result.rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await db.query(
        'UPDATE T_PELANGGAN SET RESET_TOKEN = ?, RESET_EXPIRES = ? WHERE ID_PELANGGAN = ?',
        [token, expires, user.ID_PELANGGAN]
      );
      await email.sendPasswordResetEmail(user.EMAIL, user.NAMA_LENGKAP, token);
    }
    res.json({ message: 'Jika email terdaftar, link reset password telah dikirim.' });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 8) {
      return res.status(400).json({ error: 'Token dan password minimal 8 karakter wajib diisi' });
    }
    const result = await db.query('SELECT * FROM T_PELANGGAN WHERE RESET_TOKEN = ? AND RESET_EXPIRES > NOW()', [token]);
    if (!result.rows.length) return res.status(400).json({ error: 'Token tidak valid atau kadaluarsa' });
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'UPDATE T_PELANGGAN SET PASSWORD_HASH = ?, RESET_TOKEN = NULL, RESET_EXPIRES = NULL WHERE ID_PELANGGAN = ?',
      [hash, result.rows[0].ID_PELANGGAN]
    );
    res.json({ message: 'Password berhasil diperbarui.' });
  } catch (err) {
    sendError(res, err);
  }
});

// HEWAN ROUTES
app.get('/api/hewan', async (req, res) => {
  try {
    const { jenis } = req.query;
    let sql = 'SELECT * FROM V_STOK_HEWAN';
    const params = [];
    if (jenis) {
      sql += ' WHERE JENIS = ?';
      params.push(String(jenis).toUpperCase());
    }
    sql += ' ORDER BY JENIS, HARGA';
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/stock/check', async (req, res) => {
  try {
    const { items = [] } = req.body;
    const checked = [];
    for (const item of items) {
      const id = Number(item.id_hewan || item.id);
      if (!Number.isInteger(id) || id <= 0) {
        checked.push({ id: item.id, stok: 0, available: false });
        continue;
      }
      const result = await db.query('SELECT ID_HEWAN, STOK, STATUS FROM T_HEWAN WHERE ID_HEWAN = ?', [id]);
      const row = result.rows[0];
      checked.push({
        id,
        stok: row ? Number(row.STOK) : 0,
        available: Boolean(row && row.STATUS === 'A' && Number(row.STOK) > 0),
      });
    }
    res.json({ items: checked });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/pesanan/:id_pelanggan', authMiddleware, async (req, res) => {
  try {
    const idPelanggan = Number(req.params.id_pelanggan);
    if (idPelanggan !== req.user.id && idPelanggan !== req.user.tokenId) {
      return res.status(403).json({ error: 'Tidak boleh mengakses pesanan pelanggan lain' });
    }
    const result = await db.query(
      `SELECT
         v.*,
         (SELECT pb.STATUS FROM T_PEMBAYARAN pb WHERE pb.ID_PESANAN = v.ID_PESANAN ORDER BY pb.ID_PEMBAYARAN DESC LIMIT 1) AS STATUS_BAYAR,
         (SELECT pb.METODE FROM T_PEMBAYARAN pb WHERE pb.ID_PESANAN = v.ID_PESANAN ORDER BY pb.ID_PEMBAYARAN DESC LIMIT 1) AS METODE_PEMBAYARAN_TERAKHIR
       FROM V_PESANAN_LENGKAP v
       WHERE v.ID_PELANGGAN = ?
       ORDER BY TGL_PESAN DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

async function createOrder(req, res, source) {
  const isOnline = source === 'midtrans';
  if (isOnline && !isMidtransReady()) {
    throw httpError('Midtrans belum aktif atau masih review. Gunakan pembayaran tunai untuk testing.', 503);
  }

  const body = req.body || {};
  let method = normalizePaymentMethod(body.tipe_bayar || body.metode_bayar || body.metode);
  if (!isOnline && method === 'MIDTRANS') method = 'TUNAI';
  if (isOnline && method === 'TUNAI') method = 'MIDTRANS';

  const isInstallment = method === 'CICILAN_TUNAI' || method === 'CICILAN_MIDTRANS';
  const jenis = String(body.layanan || 'QURBAN').toUpperCase() === 'AQIQAH' ? 'AQIQAH' : 'QURBAN';
  if (isInstallment && jenis !== 'QURBAN') {
    throw httpError('Setoran/cicilan pesanan hanya tersedia untuk qurban.', 400);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const items = await lockAndReserveItems(conn, body.items);
    const total = items.reduce((sum, item) => sum + item.harga * item.qty, 0);
    const alamatField = buildAlamat(body);
    const setoranAwal = isInstallment ? money(body.nominal_setoran_awal || body.setoran_awal || body.deposit) : total;

    if (isInstallment && (!setoranAwal || setoranAwal > total)) {
      throw httpError('Nominal setoran awal harus lebih dari 0 dan tidak boleh melebihi total pesanan.', 400);
    }

    const initialStatus = isInstallment
      ? 'Menunggu Pembayaran Setoran'
      : (isOnline ? 'Menunggu Pembayaran' : 'Menunggu Konfirmasi');

    const [orderResult] = await conn.execute(
      `INSERT INTO T_PESANAN (ID_PELANGGAN, JENIS_LAYANAN, TGL_PELAKSANAAN, ALAMAT_KIRIM, TOTAL, METODE_BAYAR, STATUS)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, jenis, body.tgl_pelaksanaan || null, alamatField, total, method, initialStatus]
    );
    const idPesanan = orderResult.insertId;

    for (const item of items) {
      await conn.execute(
        `INSERT INTO T_DETAIL_PESANAN (ID_PESANAN, ID_HEWAN, JUMLAH, HARGA_SATUAN, IS_PATUNGAN)
         VALUES (?, ?, ?, ?, ?)`,
        [idPesanan, item.id, item.qty, item.harga, item.is_patungan]
      );
    }

    const hasPatungan = jenis === 'QURBAN' && items.some((item) => item.is_patungan === 'Y');
    const patunganEmails = hasPatungan ? normalizeEmailList(body.patungan_members || body.email_patungan) : [];
    if (hasPatungan) {
      const maxUndangan = Math.max(0, 6);
      for (const emailTujuan of patunganEmails.slice(0, maxUndangan)) {
        const [targetUsers] = await conn.execute('SELECT ID_PELANGGAN FROM T_PELANGGAN WHERE EMAIL = ? LIMIT 1', [emailTujuan]);
        const idTujuan = targetUsers[0]?.ID_PELANGGAN || null;
        const nominalPorsi = Math.round(total / 7);
        await conn.execute(
          `INSERT INTO T_PATUNGAN_QURBAN (ID_PESANAN, ID_PEMINTA, ID_PELANGGAN_TUJUAN, EMAIL_TUJUAN, NOMINAL_PORSI, STATUS)
           VALUES (?, ?, ?, ?, ?, 'MENUNGGU')`,
          [idPesanan, req.user.id, idTujuan, emailTujuan, nominalPorsi]
        );
        if (idTujuan) {
          await sendAppNotification(
            conn,
            idTujuan,
            `Undangan patungan ORD-${idPesanan}`,
            `${req.user.name} mengundang Anda untuk patungan qurban sapi. Silakan setujui atau tolak di dashboard.`,
            'PATUNGAN'
          );
        }
      }
    }

    let idSetoran = null;
    let refBayar = `ORD-${idPesanan}`;
    let grossAmount = total;
    let snapItems = items.map((item) => ({
      id: String(item.id),
      price: Math.round(item.harga),
      quantity: item.qty,
      name: item.nama.slice(0, 50),
    }));

    if (isInstallment) {
      const setoranStatus = 'Menunggu Pembayaran';
      const [setoranResult] = await conn.execute(
        `INSERT INTO T_SETORAN (ID_PESANAN, NOMINAL, METODE, STATUS)
         VALUES (?, ?, ?, ?)`,
        [idPesanan, setoranAwal, isOnline ? 'MIDTRANS' : 'TUNAI', setoranStatus]
      );
      idSetoran = setoranResult.insertId;
      refBayar = `SET-ORD-${idSetoran}`;
      grossAmount = setoranAwal;
      snapItems = [{ id: refBayar, price: Math.round(setoranAwal), quantity: 1, name: `Setoran awal ORD-${idPesanan}` }];
      await conn.execute('UPDATE T_SETORAN SET REF_BAYAR = ? WHERE ID_SETORAN = ?', [refBayar, idSetoran]);
      await createPembayaran(conn, {
        id_pesanan: idPesanan,
        id_setoran: idSetoran,
        nominal: setoranAwal,
        metode: isOnline ? 'MIDTRANS' : 'TUNAI',
        status: 'Menunggu Pembayaran',
        ref: refBayar,
      });

    } else {
      await createPembayaran(conn, {
        id_pesanan: idPesanan,
        nominal: total,
        metode: isOnline ? 'MIDTRANS' : 'TUNAI',
        status: 'Menunggu Pembayaran',
        ref: refBayar,
      });

      if (!isOnline) {
        await sendAppNotification(
          conn,
          req.user.id,
          `Pesanan ORD-${idPesanan} menunggu verifikasi`,
          `Pesanan berhasil dibuat. Pembayaran tunai sebesar Rp ${Number(total).toLocaleString('id-ID')} menunggu verifikasi admin.`,
          'PAYMENT'
        );
      }
    }

    let transaction = null;
    if (isOnline) {
      transaction = await createMidtransTransaction({
        transaction_details: { order_id: refBayar, gross_amount: Math.round(grossAmount) },
        item_details: snapItems,
        customer_details: { first_name: req.user.name, email: req.user.email },
      });
    }

    await conn.commit();

    if (!isOnline) {
      try {
        await email.sendOrderConfirmationEmail(req.user.email, req.user.name || '', `ORD-${idPesanan}`, items, total);
      } catch (mailErr) {
        console.error('Gagal mengirim email konfirmasi pesanan:', mailErr.message);
      }
    }

    const config = midtransConfig();
    return res.json({
      success: true,
      id_pesanan: idPesanan,
      id_setoran: idSetoran,
      total,
      nominal_bayar: grossAmount,
      metode: method,
      token: transaction ? transaction.token : null,
      redirect_url: transaction ? transaction.redirect_url : null,
      clientKey: config.clientKey,
      isProduction: config.isProduction,
      message: isOnline ? 'Transaksi Midtrans dibuat.' : 'Pesanan berhasil dicatat.',
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

app.post('/api/payment/snap', authMiddleware, async (req, res) => {
  try {
    await createOrder(req, res, 'midtrans');
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/payment/cash', authMiddleware, async (req, res) => {
  try {
    await createOrder(req, res, 'cash');
  } catch (err) {
    sendError(res, err);
  }
});

async function validateSetoranTarget(conn, userId, { id_tabungan = null, id_pesanan = null, nominal }) {
  const idTabungan = id_tabungan ? Number(id_tabungan) : null;
  const idPesanan = id_pesanan ? Number(id_pesanan) : null;
  if ((idTabungan && idPesanan) || (!idTabungan && !idPesanan)) {
    throw httpError('Setoran harus terkait ke tabungan atau pesanan qurban.', 400);
  }

  if (idPesanan) {
    const [orders] = await conn.execute(
      `SELECT
         p.*,
         COALESCE(s.TOTAL_SETORAN, 0) AS TOTAL_SETORAN,
         COALESCE(b.TOTAL_PEMBAYARAN, 0) AS TOTAL_PEMBAYARAN
       FROM T_PESANAN p
       LEFT JOIN (
         SELECT ID_PESANAN, SUM(NOMINAL) AS TOTAL_SETORAN
         FROM T_SETORAN
         WHERE STATUS = 'LUNAS' AND ID_PESANAN IS NOT NULL
         GROUP BY ID_PESANAN
       ) s ON s.ID_PESANAN = p.ID_PESANAN
       LEFT JOIN (
         SELECT ID_PESANAN, SUM(NOMINAL) AS TOTAL_PEMBAYARAN
         FROM T_PEMBAYARAN
         WHERE STATUS = 'LUNAS' AND ID_SETORAN IS NULL
         GROUP BY ID_PESANAN
       ) b ON b.ID_PESANAN = p.ID_PESANAN
       WHERE p.ID_PESANAN = ? AND p.ID_PELANGGAN = ?
       FOR UPDATE`,
      [idPesanan, userId]
    );
    if (!orders.length) throw httpError('Pesanan tidak ditemukan.', 404);
    const order = orders[0];
    if (order.JENIS_LAYANAN !== 'QURBAN') {
      throw httpError('Setoran pesanan hanya tersedia untuk qurban.', 400);
    }
    const paidBySetoran = Number(order.TOTAL_SETORAN || 0);
    const paidByPayment = Number(order.TOTAL_PEMBAYARAN || 0);
    const dibayar = paidBySetoran > 0 ? paidBySetoran : paidByPayment;
    const sisa = Math.max(Number(order.TOTAL || 0) - dibayar, 0);
    if (sisa <= 0) throw httpError('Pesanan ini sudah lunas.', 400);
    if (nominal > sisa) throw httpError(`Nominal melebihi sisa pembayaran Rp ${sisa.toLocaleString('id-ID')}.`, 400);
    return { type: 'pesanan', id: idPesanan, refPrefix: 'SET-ORD' };
  }

  const [tabs] = await conn.execute(
    'SELECT * FROM T_TABUNGAN_QURBAN WHERE ID_TABUNGAN = ? AND ID_PELANGGAN = ? FOR UPDATE',
    [idTabungan, userId]
  );
  if (!tabs.length) throw httpError('Tabungan tidak ditemukan.', 404);
  const tabungan = tabs[0];
  if (tabungan.STATUS !== 'A') throw httpError('Tabungan ini sudah tidak aktif.', 400);

  const [sumRows] = await conn.execute(
    'SELECT COALESCE(SUM(NOMINAL), 0) AS TOTAL_SETORAN FROM T_SETORAN WHERE ID_TABUNGAN = ? AND STATUS = "LUNAS"',
    [idTabungan]
  );
  const sisa = Math.max(Number(tabungan.TARGET_NOMINAL || 0) - Number(sumRows[0].TOTAL_SETORAN || 0), 0);
  if (sisa <= 0) throw httpError('Tabungan ini sudah mencapai target.', 400);
  if (sisa > 0 && nominal > sisa) {
    throw httpError(`Nominal melebihi sisa target tabungan Rp ${sisa.toLocaleString('id-ID')}.`, 400);
  }
  return { type: 'tabungan', id: idTabungan, refPrefix: 'SET-TAB' };
}

async function createSetoran(req, res, source) {
  const isOnline = source === 'midtrans';
  if (isOnline && !isMidtransReady()) {
    throw httpError('Midtrans belum aktif atau masih review. Gunakan setoran tunai untuk testing.', 503);
  }

  const nominal = money(req.body.nominal);
  if (!nominal) throw httpError('Nominal setoran tidak valid.', 400);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const target = await validateSetoranTarget(conn, req.user.id, { ...req.body, nominal });
    const status = 'Menunggu Pembayaran';
    const column = target.type === 'tabungan' ? 'ID_TABUNGAN' : 'ID_PESANAN';

    const [setoranResult] = await conn.execute(
      `INSERT INTO T_SETORAN (${column}, NOMINAL, METODE, STATUS) VALUES (?, ?, ?, ?)`,
      [target.id, nominal, isOnline ? 'MIDTRANS' : 'TUNAI', status]
    );
    const idSetoran = setoranResult.insertId;
    const refBayar = `${target.refPrefix}-${idSetoran}`;
    await conn.execute('UPDATE T_SETORAN SET REF_BAYAR = ? WHERE ID_SETORAN = ?', [refBayar, idSetoran]);
    await createPembayaran(conn, {
      id_pesanan: target.type === 'pesanan' ? target.id : null,
      id_setoran: idSetoran,
      nominal,
      metode: isOnline ? 'MIDTRANS' : 'TUNAI',
      status,
      ref: refBayar,
    });

    let transaction = null;
    if (isOnline) {
      transaction = await createMidtransTransaction({
        transaction_details: { order_id: refBayar, gross_amount: Math.round(nominal) },
        item_details: [{ id: refBayar, price: Math.round(nominal), quantity: 1, name: `Setoran ${target.type}` }],
        customer_details: { first_name: req.user.name, email: req.user.email },
      });
    }

    await conn.commit();
    const config = midtransConfig();
    res.json({
      success: true,
      id_setoran: idSetoran,
      token: transaction ? transaction.token : null,
      redirect_url: transaction ? transaction.redirect_url : null,
      clientKey: config.clientKey,
      isProduction: config.isProduction,
      message: isOnline ? 'Transaksi setoran Midtrans dibuat.' : 'Setoran tunai dicatat dan menunggu verifikasi admin.',
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

app.post('/api/payment/setor/snap', authMiddleware, async (req, res) => {
  try {
    await createSetoran(req, res, 'midtrans');
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/payment/setor/cash', authMiddleware, async (req, res) => {
  try {
    await createSetoran(req, res, 'cash');
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/setoran/pesanan/:id_pesanan', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*
       FROM T_SETORAN s
       JOIN T_PESANAN p ON p.ID_PESANAN = s.ID_PESANAN
       WHERE s.ID_PESANAN = ? AND p.ID_PELANGGAN = ?
       ORDER BY s.TGL_SETOR DESC`,
      [req.params.id_pesanan, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/setoran/tabungan/:id_tabungan', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*
       FROM T_SETORAN s
       JOIN T_TABUNGAN_QURBAN t ON t.ID_TABUNGAN = s.ID_TABUNGAN
       WHERE s.ID_TABUNGAN = ? AND t.ID_PELANGGAN = ?
       ORDER BY s.TGL_SETOR DESC`,
      [req.params.id_tabungan, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/patungan/invitations', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pq.*, p.TOTAL, p.STATUS AS STATUS_PESANAN, pl.NAMA_LENGKAP AS NAMA_PEMINTA, h.NAMA AS NAMA_HEWAN
       FROM T_PATUNGAN_QURBAN pq
       JOIN T_PESANAN p ON p.ID_PESANAN = pq.ID_PESANAN
       JOIN T_PELANGGAN pl ON pl.ID_PELANGGAN = pq.ID_PEMINTA
       LEFT JOIN T_DETAIL_PESANAN d ON d.ID_PESANAN = p.ID_PESANAN
       LEFT JOIN T_HEWAN h ON h.ID_HEWAN = d.ID_HEWAN
       WHERE (pq.ID_PELANGGAN_TUJUAN = ? OR pq.EMAIL_TUJUAN = ?)
       ORDER BY pq.TGL_BUAT DESC`,
      [req.user.id, req.user.email]
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/patungan/pesanan/:id_pesanan', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pq.*
       FROM T_PATUNGAN_QURBAN pq
       JOIN T_PESANAN p ON p.ID_PESANAN = pq.ID_PESANAN
       WHERE pq.ID_PESANAN = ? AND p.ID_PELANGGAN = ?
       ORDER BY pq.TGL_BUAT DESC`,
      [req.params.id_pesanan, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/patungan/:id/respond', authMiddleware, async (req, res) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!['DISETUJUI', 'DITOLAK'].includes(status)) return res.status(400).json({ error: 'Status patungan tidak valid' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT pq.*, p.ID_PELANGGAN AS ID_PEMILIK
       FROM T_PATUNGAN_QURBAN pq
       JOIN T_PESANAN p ON p.ID_PESANAN = pq.ID_PESANAN
       WHERE pq.ID_PATUNGAN = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!rows.length) throw httpError('Undangan patungan tidak ditemukan', 404);
    const invite = rows[0];
    if (invite.ID_PELANGGAN_TUJUAN && invite.ID_PELANGGAN_TUJUAN !== req.user.id) {
      throw httpError('Undangan ini bukan untuk akun Anda', 403);
    }
    if (!invite.ID_PELANGGAN_TUJUAN && String(invite.EMAIL_TUJUAN).toLowerCase() !== String(req.user.email).toLowerCase()) {
      throw httpError('Undangan ini bukan untuk email Anda', 403);
    }
    await conn.execute(
      'UPDATE T_PATUNGAN_QURBAN SET ID_PELANGGAN_TUJUAN = ?, STATUS = ?, TGL_RESPON = NOW() WHERE ID_PATUNGAN = ?',
      [req.user.id, status, req.params.id]
    );
    await sendAppNotification(
      conn,
      invite.ID_PEMILIK,
      `Patungan ${status === 'DISETUJUI' ? 'disetujui' : 'ditolak'}`,
      `${req.user.name} ${status === 'DISETUJUI' ? 'menyetujui' : 'menolak'} undangan patungan ORD-${invite.ID_PESANAN}.`,
      'PATUNGAN'
    );
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    sendError(res, err);
  } finally {
    conn.release();
  }
});

// TABUNGAN
app.post('/api/tabungan', authMiddleware, async (req, res) => {
  try {
    const { nama_tabungan, nama_qurban, jenis_target, jenis, target_nominal, target, id_hewan = null } = req.body;
    const nama = nama_tabungan || nama_qurban;
    const jenisTarget = String(jenis_target || jenis || 'KAMBING').toUpperCase();
    const targetNominal = money(target_nominal || target);

    if (!nama || !targetNominal) throw httpError('Nama dan target tabungan wajib diisi.', 400);
    if (!['SAPI', 'KAMBING', 'DOMBA'].includes(jenisTarget)) throw httpError('Jenis target tidak valid.', 400);

    const result = await db.query(
      `INSERT INTO T_TABUNGAN_QURBAN (ID_PELANGGAN, NAMA_TABUNGAN, JENIS_TARGET, TARGET_NOMINAL, ID_HEWAN, STATUS)
       VALUES (?, ?, ?, ?, ?, 'A')`,
      [req.user.id, nama, jenisTarget, targetNominal, id_hewan || null]
    );
    res.json({ success: true, id_tabungan: result.insertId });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/tabungan/:id_pelanggan', authMiddleware, async (req, res) => {
  try {
    const idPelanggan = Number(req.params.id_pelanggan);
    if (idPelanggan !== req.user.id && idPelanggan !== req.user.tokenId) {
      return res.status(403).json({ error: 'Tidak boleh mengakses tabungan pelanggan lain' });
    }
    const result = await db.query(
      `SELECT
         t.*,
         COALESCE(s.TOTAL_SETORAN, 0) AS TERKUMPUL_REAL,
         h.NAMA AS NAMA_HEWAN_TARGET
       FROM T_TABUNGAN_QURBAN t
       LEFT JOIN T_HEWAN h ON h.ID_HEWAN = t.ID_HEWAN
       LEFT JOIN (
         SELECT ID_TABUNGAN, SUM(NOMINAL) AS TOTAL_SETORAN
         FROM T_SETORAN
         WHERE STATUS = 'LUNAS'
         GROUP BY ID_TABUNGAN
       ) s ON s.ID_TABUNGAN = t.ID_TABUNGAN
       WHERE t.ID_PELANGGAN = ? AND t.STATUS = 'A'
       ORDER BY t.TGL_BUAT DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/tabungan/setor', authMiddleware, (req, res) => {
  return res.status(400).json({ error: 'Gunakan /api/payment/setor/cash atau /api/payment/setor/snap untuk setoran.' });
});

app.get('/api/jadwal', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT ID_JADWAL, TANGGAL, TEMPAT FROM T_JADWAL_PEMOTONGAN WHERE STATUS = "A" ORDER BY TANGGAL ASC, TEMPAT ASC'
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

// ADMIN ROUTES
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email: inputEmail, password } = req.body;
    if (!inputEmail || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });
    const result = await db.query('SELECT * FROM T_PELANGGAN WHERE EMAIL = ? AND ROLE = "ADMIN"', [inputEmail]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Email atau password admin salah' });
    }
    const user = result.rows[0];
    if (user.STATUS !== 'A' || !await bcrypt.compare(password, user.PASSWORD_HASH)) {
      return res.status(401).json({ error: 'Email atau password admin salah' });
    }
    const token = jwt.sign({ id: user.ID_PELANGGAN, role: 'ADMIN', email: user.EMAIL, name: user.NAMA_LENGKAP }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, admin: { id: user.ID_PELANGGAN, email: user.EMAIL, name: user.NAMA_LENGKAP, role: 'ADMIN' } });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/admin/midtrans-status', adminMiddleware, async (req, res) => {
  const config = midtransConfig();
  res.json({
    isProduction: config.isProduction,
    ready: isMidtransReady(),
    expectedMode: describeMidtransMode(),
    modeSource: config.modeSource,
    serverKeyMode: midtransKeyMode(config.serverKey),
    clientKeyMode: midtransKeyMode(config.clientKey),
    serverKeyPrefix: config.serverKey ? config.serverKey.slice(0, 12) + '...' : '',
    clientKeyPrefix: config.clientKey ? config.clientKey.slice(0, 12) + '...' : '',
    snapScriptUrl: config.isProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js',
    notificationUrl: `${BASE_URL}/api/payment/webhook`,
  });
});

app.get('/api/admin/dashboard', adminMiddleware, async (req, res) => {
  try {
    const [summary, lowStock, recentOrders] = await Promise.all([
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM T_PELANGGAN) AS pelanggan,
           (SELECT COUNT(*) FROM T_HEWAN WHERE STATUS = 'A') AS hewan,
           (SELECT COUNT(*) FROM T_PESANAN) AS pesanan,
           (SELECT COALESCE(SUM(NOMINAL), 0) FROM T_PEMBAYARAN WHERE STATUS = 'LUNAS') AS pemasukan,
           (SELECT COUNT(*) FROM T_PESANAN WHERE STATUS IN ('Menunggu Pembayaran','Menunggu Konfirmasi','Menunggu Pembayaran Setoran','Cicilan Aktif')) AS butuh_tindak_lanjut`
      ),
      db.query('SELECT * FROM T_HEWAN WHERE STATUS = "A" AND STOK <= 5 ORDER BY STOK ASC, NAMA ASC LIMIT 8'),
      db.query(
        `SELECT v.*, pl.NAMA_LENGKAP, pl.NO_HP
         FROM V_PESANAN_LENGKAP v
         JOIN T_PELANGGAN pl ON pl.ID_PELANGGAN = v.ID_PELANGGAN
         ORDER BY v.TGL_PESAN DESC
         LIMIT 8`
      ),
    ]);
    res.json({ summary: summary.rows[0], lowStock: lowStock.rows, recentOrders: recentOrders.rows });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/admin/hewan', adminMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM T_HEWAN ORDER BY STATUS DESC, JENIS, ID_HEWAN DESC');
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/admin/hewan', adminMiddleware, async (req, res) => {
  try {
    const jenis = String(req.body.JENIS || req.body.jenis || '').toUpperCase();
    const nama = req.body.NAMA || req.body.nama;
    const berat = req.body.BERAT_INFO || req.body.berat || null;
    const harga = money(req.body.HARGA || req.body.harga);
    const stok = Number.parseInt(req.body.STOK ?? req.body.stok ?? 0, 10);
    const grade = req.body.GRADE || req.body.grade || 'A';
    const share = Number.parseInt(req.body.SHARE ?? req.body.share ?? 1, 10);
    const kategori = req.body.KATEGORI || req.body.kategori || 'qurban';
    const status = req.body.STATUS || req.body.status || 'A';
    if (!['SAPI', 'KAMBING', 'DOMBA'].includes(jenis) || !nama || !harga || !Number.isInteger(stok)) {
      throw httpError('Data hewan tidak valid', 400);
    }
    const result = await db.query(
      `INSERT INTO T_HEWAN (JENIS, NAMA, BERAT_INFO, HARGA, STOK, GRADE, SHARE, KATEGORI, STATUS)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [jenis, nama, berat, harga, stok, grade, share || 1, kategori, status]
    );
    res.json({ success: true, id_hewan: result.insertId });
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/admin/hewan/:id', adminMiddleware, async (req, res) => {
  try {
    const jenis = String(req.body.JENIS || req.body.jenis || '').toUpperCase();
    const nama = req.body.NAMA || req.body.nama;
    const berat = req.body.BERAT_INFO || req.body.berat || null;
    const harga = money(req.body.HARGA || req.body.harga);
    const stok = Number.parseInt(req.body.STOK ?? req.body.stok ?? 0, 10);
    const grade = req.body.GRADE || req.body.grade || 'A';
    const share = Number.parseInt(req.body.SHARE ?? req.body.share ?? 1, 10);
    const kategori = req.body.KATEGORI || req.body.kategori || 'qurban';
    const status = req.body.STATUS || req.body.status || 'A';
    if (!['SAPI', 'KAMBING', 'DOMBA'].includes(jenis) || !nama || !harga || !Number.isInteger(stok)) {
      throw httpError('Data hewan tidak valid', 400);
    }
    await db.query(
      `UPDATE T_HEWAN
       SET JENIS = ?, NAMA = ?, BERAT_INFO = ?, HARGA = ?, STOK = ?, GRADE = ?, SHARE = ?, KATEGORI = ?, STATUS = ?
       WHERE ID_HEWAN = ?`,
      [jenis, nama, berat, harga, stok, grade, share || 1, kategori, status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete('/api/admin/hewan/:id', adminMiddleware, async (req, res) => {
  try {
    await db.query('UPDATE T_HEWAN SET STATUS = "N" WHERE ID_HEWAN = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/admin/pesanan', adminMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         v.*,
         pl.NAMA_LENGKAP,
         pl.EMAIL,
         pl.NO_HP,
         (SELECT pb.STATUS FROM T_PEMBAYARAN pb WHERE pb.ID_PESANAN = v.ID_PESANAN ORDER BY pb.ID_PEMBAYARAN DESC LIMIT 1) AS STATUS_BAYAR,
         (SELECT pb.METODE FROM T_PEMBAYARAN pb WHERE pb.ID_PESANAN = v.ID_PESANAN ORDER BY pb.ID_PEMBAYARAN DESC LIMIT 1) AS METODE_PEMBAYARAN_TERAKHIR
       FROM V_PESANAN_LENGKAP v
       JOIN T_PELANGGAN pl ON pl.ID_PELANGGAN = v.ID_PELANGGAN
       ORDER BY v.TGL_PESAN DESC`
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/admin/pesanan/:id/status', adminMiddleware, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const status = await updateOrderStatus(conn, req.params.id, req.body.status, req.body.catatan);
    await conn.commit();
    res.json({ success: true, status });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    sendError(res, err);
  } finally {
    conn.release();
  }
});

app.get('/api/admin/pembayaran', adminMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         pb.*,
         ps.JENIS_LAYANAN,
         ps.STATUS AS STATUS_PESANAN,
         COALESCE(pl.NAMA_LENGKAP, plt.NAMA_LENGKAP) AS NAMA_LENGKAP,
         COALESCE(pl.EMAIL, plt.EMAIL) AS EMAIL,
         st.ID_TABUNGAN,
         st.STATUS AS STATUS_SETORAN
       FROM T_PEMBAYARAN pb
       LEFT JOIN T_PESANAN ps ON ps.ID_PESANAN = pb.ID_PESANAN
       LEFT JOIN T_PELANGGAN pl ON pl.ID_PELANGGAN = ps.ID_PELANGGAN
       LEFT JOIN T_SETORAN st ON st.ID_SETORAN = pb.ID_SETORAN
       LEFT JOIN T_TABUNGAN_QURBAN tb ON tb.ID_TABUNGAN = st.ID_TABUNGAN
       LEFT JOIN T_PELANGGAN plt ON plt.ID_PELANGGAN = tb.ID_PELANGGAN
       ORDER BY pb.TGL_BAYAR DESC, pb.ID_PEMBAYARAN DESC`
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/admin/pembayaran/:id/status', adminMiddleware, async (req, res) => {
  const status = String(req.body.status || '').trim();
  if (!['LUNAS', 'Gagal', 'Menunggu Pembayaran'].includes(status)) {
    return res.status(400).json({ error: 'Status pembayaran tidak valid' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [payments] = await conn.execute('SELECT * FROM T_PEMBAYARAN WHERE ID_PEMBAYARAN = ? FOR UPDATE', [req.params.id]);
    if (!payments.length) throw httpError('Pembayaran tidak ditemukan', 404);
    const payment = payments[0];
    await conn.execute('UPDATE T_PEMBAYARAN SET STATUS = ? WHERE ID_PEMBAYARAN = ?', [status, req.params.id]);

    if (payment.ID_SETORAN) {
      await conn.execute('UPDATE T_SETORAN SET STATUS = ? WHERE ID_SETORAN = ?', [status, payment.ID_SETORAN]);
      if (status === 'LUNAS') await handleSuccessfulSetoran(conn, payment.ID_SETORAN);
    } else if (payment.ID_PESANAN) {
      if (status === 'LUNAS') {
        await updateOrderStatus(conn, payment.ID_PESANAN, 'Dikonfirmasi', `Pembayaran ORD-${payment.ID_PESANAN} disetujui admin.`);
      } else if (status === 'Gagal') {
        await updateOrderStatus(conn, payment.ID_PESANAN, 'Dibatalkan', `Pembayaran ORD-${payment.ID_PESANAN} dibatalkan admin.`);
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    sendError(res, err);
  } finally {
    conn.release();
  }
});

app.get('/api/admin/pelanggan', adminMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         p.ID_PELANGGAN, p.NAMA_LENGKAP, p.EMAIL, p.NO_HP, p.STATUS, p.EMAIL_VERIFIED, p.TGL_DAFTAR,
         COUNT(ps.ID_PESANAN) AS TOTAL_PESANAN,
         COALESCE(SUM(ps.TOTAL), 0) AS TOTAL_TRANSAKSI
       FROM T_PELANGGAN p
       LEFT JOIN T_PESANAN ps ON ps.ID_PELANGGAN = p.ID_PELANGGAN
       GROUP BY p.ID_PELANGGAN
       ORDER BY p.TGL_DAFTAR DESC`
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/admin/pelanggan/:id/status', adminMiddleware, async (req, res) => {
  try {
    const status = String(req.body.status || '').toUpperCase();
    if (!['A', 'P', 'N'].includes(status)) throw httpError('Status pelanggan tidak valid', 400);
    await db.query('UPDATE T_PELANGGAN SET STATUS = ? WHERE ID_PELANGGAN = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/admin/tabungan', adminMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, p.NAMA_LENGKAP, p.EMAIL, h.NAMA AS NAMA_HEWAN_TARGET,
        COALESCE(s.TOTAL_SETORAN, 0) AS TERKUMPUL_REAL
       FROM T_TABUNGAN_QURBAN t
       JOIN T_PELANGGAN p ON p.ID_PELANGGAN = t.ID_PELANGGAN
       LEFT JOIN T_HEWAN h ON h.ID_HEWAN = t.ID_HEWAN
       LEFT JOIN (
         SELECT ID_TABUNGAN, SUM(NOMINAL) AS TOTAL_SETORAN
         FROM T_SETORAN
         WHERE STATUS = 'LUNAS'
         GROUP BY ID_TABUNGAN
       ) s ON s.ID_TABUNGAN = t.ID_TABUNGAN
       ORDER BY t.TGL_BUAT DESC`
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/admin/notifikasi', adminMiddleware, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const idPelanggan = Number(req.body.id_pelanggan);
    const judul = String(req.body.judul || 'Pengingat Al-Barakah').trim();
    const pesan = String(req.body.pesan || '').trim();
    const tipe = String(req.body.tipe || 'INFO').trim();
    if (!idPelanggan || !pesan) throw httpError('Pelanggan dan pesan wajib diisi', 400);
    await sendAppNotification(conn, idPelanggan, judul, pesan, tipe);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  } finally {
    conn.release();
  }
});

app.get('/api/admin/patungan', adminMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pq.*, pp.NAMA_LENGKAP AS NAMA_PEMINTA, pt.NAMA_LENGKAP AS NAMA_TUJUAN, p.STATUS AS STATUS_PESANAN
       FROM T_PATUNGAN_QURBAN pq
       JOIN T_PELANGGAN pp ON pp.ID_PELANGGAN = pq.ID_PEMINTA
       LEFT JOIN T_PELANGGAN pt ON pt.ID_PELANGGAN = pq.ID_PELANGGAN_TUJUAN
       JOIN T_PESANAN p ON p.ID_PESANAN = pq.ID_PESANAN
       ORDER BY pq.TGL_BUAT DESC`
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/admin/jadwal', adminMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT ID_JADWAL, TANGGAL, TEMPAT FROM T_JADWAL_PEMOTONGAN ORDER BY TANGGAL ASC, TEMPAT ASC');
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/admin/jadwal', adminMiddleware, async (req, res) => {
  try {
    const { tanggal, tempat, kuota = 0 } = req.body;
    if (!tanggal || !tempat) throw httpError('Tanggal dan tempat wajib diisi', 400);
    const result = await db.query(
      'INSERT INTO T_JADWAL_PEMOTONGAN (TANGGAL, TEMPAT, KUOTA, STATUS) VALUES (?, ?, ?, "A")',
      [tanggal, tempat, Number.parseInt(kuota, 10) || 0]
    );
    res.json({ success: true, id_jadwal: result.insertId });
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/admin/jadwal/:id', adminMiddleware, async (req, res) => {
  try {
    const { tanggal, tempat, kuota = 0, status = 'A' } = req.body;
    if (!tanggal || !tempat) throw httpError('Tanggal dan tempat wajib diisi', 400);
    await db.query(
      'UPDATE T_JADWAL_PEMOTONGAN SET TANGGAL = ?, TEMPAT = ?, KUOTA = ?, STATUS = ? WHERE ID_JADWAL = ?',
      [tanggal, tempat, Number.parseInt(kuota, 10) || 0, status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete('/api/admin/jadwal/:id', adminMiddleware, async (req, res) => {
  try {
    await db.query('UPDATE T_JADWAL_PEMOTONGAN SET STATUS = "N" WHERE ID_JADWAL = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/admin/laporan', adminMiddleware, async (req, res) => {
  try {
    const [daily, service, stock] = await Promise.all([
      db.query('SELECT * FROM V_LAPORAN_KEUANGAN_HARIAN ORDER BY PERIODE_TANGGAL DESC LIMIT 30'),
      db.query(
        `SELECT ps.JENIS_LAYANAN, COUNT(*) AS TOTAL_PESANAN, COALESCE(SUM(pb.NOMINAL), 0) AS PEMASUKAN
         FROM T_PESANAN ps
         LEFT JOIN T_PEMBAYARAN pb ON pb.ID_PESANAN = ps.ID_PESANAN AND pb.STATUS = 'LUNAS'
         GROUP BY ps.JENIS_LAYANAN`
      ),
      db.query('SELECT JENIS, SUM(STOK) AS TOTAL_STOK, COUNT(*) AS JUMLAH_VARIAN FROM T_HEWAN WHERE STATUS = "A" GROUP BY JENIS'),
    ]);
    res.json({ daily: daily.rows, service: service.rows, stock: stock.rows });
  } catch (err) {
    sendError(res, err);
  }
});

// MIDTRANS WEBHOOK
function parseTrailingId(orderId) {
  const part = String(orderId || '').split('-').pop();
  const id = Number.parseInt(part, 10);
  return Number.isInteger(id) ? id : null;
}

app.post('/api/payment/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = body;

    if (order_id && status_code && gross_amount && signature_key) {
      const expected = crypto
        .createHash('sha512')
        .update(order_id + status_code + gross_amount + (process.env.MIDTRANS_SERVER_KEY || ''))
        .digest('hex');
      if (expected !== signature_key) return res.status(400).send('Signature tidak valid');
    }

    if (!order_id) return res.status(400).send('Missing order_id');
    const status = String(transaction_status || '').toLowerCase();
    const isSuccess = ['capture', 'settlement', 'success'].includes(status);
    const isFailed = ['deny', 'cancel', 'expire', 'failure'].includes(status);

    if (!isSuccess && !isFailed) return res.json({ success: true });

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      if (isSuccess) {
        if (String(order_id).startsWith('ORD-')) {
          const idPesanan = parseTrailingId(order_id);
          const [orders] = await conn.execute('SELECT ID_PELANGGAN FROM T_PESANAN WHERE ID_PESANAN = ? FOR UPDATE', [idPesanan]);
          await conn.execute('UPDATE T_PEMBAYARAN SET STATUS = "LUNAS" WHERE REF_BAYAR = ?', [order_id]);
          await conn.execute('UPDATE T_PESANAN SET STATUS = "Dikonfirmasi" WHERE ID_PESANAN = ?', [idPesanan]);
          if (orders.length) {
            await sendAppNotification(conn, orders[0].ID_PELANGGAN, 'Pembayaran berhasil', `Pesanan ORD-${idPesanan} sudah dibayar.`, 'PAYMENT');
          }
        } else if (String(order_id).startsWith('SET-TAB-') || String(order_id).startsWith('SET-ORD-')) {
          const idSetoran = parseTrailingId(order_id);
          await handleSuccessfulSetoran(conn, idSetoran);
        }
      }

      if (isFailed) {
        if (String(order_id).startsWith('ORD-')) {
          const idPesanan = parseTrailingId(order_id);
          await conn.execute('UPDATE T_PEMBAYARAN SET STATUS = "Gagal" WHERE REF_BAYAR = ?', [order_id]);
          await conn.execute('UPDATE T_PESANAN SET STATUS = "Dibatalkan" WHERE ID_PESANAN = ?', [idPesanan]);
          const [details] = await conn.execute('SELECT ID_HEWAN, JUMLAH FROM T_DETAIL_PESANAN WHERE ID_PESANAN = ?', [idPesanan]);
          for (const detail of details) {
            await conn.execute('UPDATE T_HEWAN SET STOK = STOK + ? WHERE ID_HEWAN = ?', [detail.JUMLAH, detail.ID_HEWAN]);
          }
        } else if (String(order_id).startsWith('SET-TAB-') || String(order_id).startsWith('SET-ORD-')) {
          const idSetoran = parseTrailingId(order_id);
          await conn.execute('UPDATE T_SETORAN SET STATUS = "Gagal" WHERE ID_SETORAN = ?', [idSetoran]);
          await conn.execute('UPDATE T_PEMBAYARAN SET STATUS = "Gagal" WHERE REF_BAYAR = ?', [order_id]);
        }
      }

      await conn.commit();
      conn.release();
    } catch (err) {
      try { await conn.rollback(); } catch {}
      conn.release();
      throw err;
    }

    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/notifikasi/:id_pelanggan', authMiddleware, async (req, res) => {
  try {
    const idPelanggan = Number(req.params.id_pelanggan);
    if (idPelanggan !== req.user.id && idPelanggan !== req.user.tokenId) {
      return res.status(403).json({ error: 'Tidak boleh mengakses notifikasi pelanggan lain' });
    }
    const result = await db.query(
      'SELECT * FROM T_NOTIFIKASI WHERE ID_PELANGGAN = ? ORDER BY TGL_KIRIM DESC LIMIT 20',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    sendError(res, err);
  }
});

async function ensureDefaultAdminAccount() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@albarakah.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin12345';
  const result = await db.query('SELECT ID_PELANGGAN, ROLE FROM T_PELANGGAN WHERE EMAIL = ?', [adminEmail]);
  const hash = await bcrypt.hash(adminPassword, 12);
  if (result.rows.length) {
    await db.query(
      'UPDATE T_PELANGGAN SET ROLE = "ADMIN", STATUS = "A", EMAIL_VERIFIED = 1, PASSWORD_HASH = ? WHERE EMAIL = ?',
      [hash, adminEmail]
    );
    return;
  }
  await db.query(
    `INSERT INTO T_PELANGGAN (NAMA_LENGKAP, EMAIL, PASSWORD_HASH, NO_HP, STATUS, EMAIL_VERIFIED, ROLE)
     VALUES ('Administrator', ?, ?, NULL, 'A', 1, 'ADMIN')`,
    [adminEmail, hash]
  );
}

db.init().then(async () => {
  await ensureDefaultAdminAccount();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server Al-Barakah berjalan di http://localhost:${PORT}`));
}).catch((err) => {
  console.error('Gagal konek database:', err.message);
  process.exit(1);
});
