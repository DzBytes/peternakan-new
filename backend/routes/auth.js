// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const emailService = require('../emailService');
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev_albarakah';

function normalizeRole(role) {
  return String(role || 'PELANGGAN').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'PELANGGAN';
}

router.post('/register', async (req, res) => {
  try {
    const { nama_lengkap, email, password, no_hp } = req.body;
    if (!nama_lengkap || !email || !password) {
      return res.status(400).json({ error: 'Nama, email, dan password wajib diisi' });
    }
    const existing = await query('SELECT ID_PELANGGAN FROM T_PELANGGAN WHERE EMAIL = ?', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email sudah terdaftar' });
    }
    const hash = await bcrypt.hash(password, 10);
    const verifyToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
    await query(
      'INSERT INTO T_PELANGGAN (NAMA_LENGKAP, EMAIL, PASSWORD_HASH, NO_HP, ROLE, VERIFY_TOKEN, VERIFY_EXPIRES) VALUES (?, ?, ?, ?, "PELANGGAN", ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
      [nama_lengkap, email, hash, no_hp || null, verifyToken]
    );
    await emailService.sendVerificationEmail(email, nama_lengkap, verifyToken);
    res.status(201).json({ message: 'Registrasi berhasil. Silakan cek email untuk verifikasi.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }
    const users = await query('SELECT * FROM T_PELANGGAN WHERE EMAIL = ?', [email]);
    if (users.rows.length === 0) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }
    const user = users.rows[0];
    if (user.STATUS === 'N') {
      return res.status(403).json({ error: 'Akun dinonaktifkan' });
    }
    if (user.EMAIL_VERIFIED === 0) {
      return res.status(403).json({ error: 'Email belum diverifikasi. Silakan cek inbox.' });
    }
    const valid = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!valid) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }
    await query('UPDATE T_PELANGGAN SET STATUS = ? WHERE ID_PELANGGAN = ?', ['A', user.ID_PELANGGAN]);
    const role = normalizeRole(user.ROLE);
    const token = jwt.sign(
      { id: user.ID_PELANGGAN, email: user.EMAIL, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.ID_PELANGGAN, name: user.NAMA_LENGKAP, nama: user.NAMA_LENGKAP, email: user.EMAIL, role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    const users = await query(
      'SELECT * FROM T_PELANGGAN WHERE VERIFY_TOKEN = ? AND VERIFY_EXPIRES > NOW()',
      [token]
    );
    if (users.rows.length === 0) {
      return res.status(400).json({ error: 'Token tidak valid atau expired' });
    }
    await query(
      'UPDATE T_PELANGGAN SET EMAIL_VERIFIED = 1, STATUS = ?, VERIFY_TOKEN = NULL, VERIFY_EXPIRES = NULL WHERE ID_PELANGGAN = ?',
      ['A', users.rows[0].ID_PELANGGAN]
    );
    res.json({ message: 'Email berhasil diverifikasi' });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

module.exports = router;
