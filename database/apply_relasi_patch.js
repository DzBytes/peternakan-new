const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });

const dbName = process.env.DB_NAME || 'albarakah';

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [dbName, table, column]
  );
  return rows.length > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    'SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1',
    [dbName, table]
  );
  return rows.length > 0;
}

async function addColumn(conn, table, column, ddl) {
  if (!await columnExists(conn, table, column)) {
    await conn.query(ddl);
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${dbName}\``);

  await conn.query(`CREATE TABLE IF NOT EXISTS T_PEMBAYARAN (
    ID_PEMBAYARAN INT AUTO_INCREMENT PRIMARY KEY,
    ID_PESANAN INT NULL,
    ID_SETORAN INT NULL,
    NOMINAL DECIMAL(15,2) NOT NULL,
    METODE VARCHAR(30) NOT NULL,
    STATUS VARCHAR(30) NOT NULL DEFAULT 'Menunggu Pembayaran',
    REF_BAYAR VARCHAR(100),
    TGL_BAYAR DATETIME NOT NULL DEFAULT NOW()
  )`);

  await conn.query(`CREATE TABLE IF NOT EXISTS T_LAPORAN_KEUANGAN (
    ID_LAPORAN INT AUTO_INCREMENT PRIMARY KEY,
    PERIODE_TANGGAL DATE NOT NULL,
    PEMASUKAN DECIMAL(15,2) NOT NULL DEFAULT 0,
    PENGELUARAN DECIMAL(15,2) NOT NULL DEFAULT 0,
    LABA_RUGI DECIMAL(15,2) NOT NULL DEFAULT 0,
    CATATAN TEXT,
    TGL_BUAT DATETIME NOT NULL DEFAULT NOW()
  )`);

  if (await tableExists(conn, 'T_TABUNGAN_QURBAN')) {
    await addColumn(conn, 'T_TABUNGAN_QURBAN', 'ID_HEWAN', 'ALTER TABLE T_TABUNGAN_QURBAN ADD COLUMN ID_HEWAN INT NULL AFTER TARGET_NOMINAL');
    await addColumn(conn, 'T_TABUNGAN_QURBAN', 'ID_PESANAN', 'ALTER TABLE T_TABUNGAN_QURBAN ADD COLUMN ID_PESANAN INT NULL AFTER ID_HEWAN');
  }

  if (await tableExists(conn, 'T_PELANGGAN')) {
    await addColumn(conn, 'T_PELANGGAN', 'ROLE', 'ALTER TABLE T_PELANGGAN ADD COLUMN ROLE ENUM("PELANGGAN","ADMIN") NOT NULL DEFAULT "PELANGGAN" AFTER NO_HP');
  }

  if (await tableExists(conn, 'T_SETORAN')) {
    try {
      await conn.query('ALTER TABLE T_SETORAN MODIFY ID_TABUNGAN INT NULL');
    } catch (err) {
      console.warn(`Lewati MODIFY ID_TABUNGAN: ${err.message}`);
    }
    await addColumn(conn, 'T_SETORAN', 'ID_PESANAN', 'ALTER TABLE T_SETORAN ADD COLUMN ID_PESANAN INT NULL AFTER ID_TABUNGAN');
    await addColumn(conn, 'T_SETORAN', 'REF_BAYAR', 'ALTER TABLE T_SETORAN ADD COLUMN REF_BAYAR VARCHAR(100) NULL AFTER STATUS');
  }

  await conn.query(`CREATE TABLE IF NOT EXISTS T_JADWAL_PEMOTONGAN (
    ID_JADWAL INT AUTO_INCREMENT PRIMARY KEY,
    TANGGAL DATE NOT NULL,
    TEMPAT VARCHAR(200) NOT NULL,
    KUOTA INT NOT NULL DEFAULT 0,
    STATUS CHAR(1) NOT NULL DEFAULT 'A'
  )`);

  await conn.query(`CREATE TABLE IF NOT EXISTS T_PATUNGAN_QURBAN (
    ID_PATUNGAN INT AUTO_INCREMENT PRIMARY KEY,
    ID_PESANAN INT NOT NULL,
    ID_PEMINTA INT NOT NULL,
    ID_PELANGGAN_TUJUAN INT NULL,
    EMAIL_TUJUAN VARCHAR(150) NOT NULL,
    NOMINAL_PORSI DECIMAL(15,2) NOT NULL DEFAULT 0,
    STATUS ENUM('MENUNGGU','DISETUJUI','DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
    TGL_BUAT DATETIME NOT NULL DEFAULT NOW(),
    TGL_RESPON DATETIME NULL
  )`);

  const [jadwalRows] = await conn.query('SELECT COUNT(*) AS total FROM T_JADWAL_PEMOTONGAN');
  if (!Number(jadwalRows[0].total)) {
    await conn.query(
      `INSERT INTO T_JADWAL_PEMOTONGAN (TANGGAL, TEMPAT, KUOTA) VALUES
       ('2026-06-17', 'Peternakan Pusat Al-Barakah', 20),
       ('2026-06-18', 'Masjid Al-Ikhlas', 12),
       ('2026-06-19', 'Peternakan Cabang', 15)`
    );
  }

  await conn.query('DROP VIEW IF EXISTS V_PESANAN_LENGKAP');
  await conn.query(`CREATE VIEW V_PESANAN_LENGKAP AS
    SELECT p.*, detail.NAMA_HEWAN,
      COALESCE(setoran.TOTAL_SETORAN, 0) AS TOTAL_SETORAN,
      COALESCE(bayar.TOTAL_PEMBAYARAN, 0) AS TOTAL_PEMBAYARAN,
      CASE
        WHEN COALESCE(setoran.TOTAL_SETORAN, 0) > 0 THEN COALESCE(setoran.TOTAL_SETORAN, 0)
        ELSE COALESCE(bayar.TOTAL_PEMBAYARAN, 0)
      END AS TOTAL_DIBAYAR,
      GREATEST(
        p.TOTAL - CASE
          WHEN COALESCE(setoran.TOTAL_SETORAN, 0) > 0 THEN COALESCE(setoran.TOTAL_SETORAN, 0)
          ELSE COALESCE(bayar.TOTAL_PEMBAYARAN, 0)
        END,
        0
      ) AS SISA_BAYAR
    FROM T_PESANAN p
    LEFT JOIN (
      SELECT d.ID_PESANAN,
        GROUP_CONCAT(CONCAT(h.NAMA, ' x', d.JUMLAH) ORDER BY d.ID_DETAIL SEPARATOR ', ') AS NAMA_HEWAN
      FROM T_DETAIL_PESANAN d
      JOIN T_HEWAN h ON h.ID_HEWAN = d.ID_HEWAN
      GROUP BY d.ID_PESANAN
    ) detail ON detail.ID_PESANAN = p.ID_PESANAN
    LEFT JOIN (
      SELECT ID_PESANAN, SUM(NOMINAL) AS TOTAL_SETORAN
      FROM T_SETORAN
      WHERE STATUS = 'LUNAS' AND ID_PESANAN IS NOT NULL
      GROUP BY ID_PESANAN
    ) setoran ON setoran.ID_PESANAN = p.ID_PESANAN
    LEFT JOIN (
      SELECT ID_PESANAN, SUM(NOMINAL) AS TOTAL_PEMBAYARAN
      FROM T_PEMBAYARAN
      WHERE STATUS = 'LUNAS' AND ID_SETORAN IS NULL AND ID_PESANAN IS NOT NULL
      GROUP BY ID_PESANAN
    ) bayar ON bayar.ID_PESANAN = p.ID_PESANAN`);

  await conn.query('DROP VIEW IF EXISTS V_LAPORAN_KEUANGAN_HARIAN');
  await conn.query(`CREATE VIEW V_LAPORAN_KEUANGAN_HARIAN AS
    SELECT DATE(TGL_BAYAR) AS PERIODE_TANGGAL,
      SUM(CASE WHEN STATUS = 'LUNAS' THEN NOMINAL ELSE 0 END) AS PEMASUKAN,
      0 AS PENGELUARAN,
      SUM(CASE WHEN STATUS = 'LUNAS' THEN NOMINAL ELSE 0 END) AS LABA_RUGI
    FROM T_PEMBAYARAN
    GROUP BY DATE(TGL_BAYAR)`);

  await conn.end();
  console.log('Patch relasi setoran/pembayaran berhasil diterapkan.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
