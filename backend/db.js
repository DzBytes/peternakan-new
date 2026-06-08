const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

async function init() {
  pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT || '3306'),
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'albarakah',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    charset:            'utf8mb4',
  });
  // Test connection
  const conn = await pool.getConnection();
  console.log('✅ MySQL (XAMPP) connection pool ready');
  conn.release();
}

/**
 * Run a parameterised query.
 * @param {string} sql  – SQL string with ? placeholders
 * @param {Array}  params
 * @returns {Promise<{rows: Array, fields: Array, affectedRows: number, insertId: number}>}
 */
async function query(sql, params = []) {
  const [rows, fields] = await pool.execute(sql, params);
  return {
    rows,
    fields,
    affectedRows: rows.affectedRows,
    insertId:     rows.insertId,
  };
}

module.exports = { init, query };
// Expose lower-level connection for transactions when needed
module.exports.getConnection = async function() {
  if (!pool) await init();
  return pool.getConnection();
};
