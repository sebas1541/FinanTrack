import mysql from 'mysql2/promise';

// DB_* tiene prioridad; si no está, se usan las variables que inyecta el MySQL de Railway (MYSQL*).
const env = (name, railwayName, fallback) => process.env[name] ?? process.env[railwayName] ?? fallback;

export const DB_NAME = env('DB_NAME', 'MYSQLDATABASE', 'finantrack');

export const dbConfig = {
  host: env('DB_HOST', 'MYSQLHOST', '127.0.0.1'),
  port: Number(env('DB_PORT', 'MYSQLPORT', 3306)),
  user: env('DB_USER', 'MYSQLUSER', 'root'),
  password: env('DB_PASSWORD', 'MYSQLPASSWORD', ''),
  timezone: 'Z',
  dateStrings: ['DATE'],
  decimalNumbers: true,
};

export const pool = mysql.createPool({
  ...dbConfig,
  database: DB_NAME,
  connectionLimit: 10,
});

// NOW(3) debe estar en UTC, igual que las fechas que envía Node (timezone: 'Z').
// Sin esto, el pull incremental se desfasa según la zona horaria del servidor MySQL.
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

/** Ejecuta fn dentro de una transacción SQL y libera la conexión al terminar. */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
