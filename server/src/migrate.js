import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { DB_NAME, dbConfig } from './db.js';

export const CATEGORIES = [
  ['food', 'Alimentación', 'expense', '🍽️'],
  ['transport', 'Transporte', 'expense', '🚌'],
  ['housing', 'Vivienda', 'expense', '🏠'],
  ['education', 'Educación', 'expense', '📚'],
  ['entertainment', 'Entretenimiento', 'expense', '🎬'],
  ['health', 'Salud', 'expense', '💊'],
  ['utilities', 'Servicios públicos', 'expense', '💡'],
  ['shopping', 'Compras', 'expense', '🛍️'],
  ['other_expense', 'Otros gastos', 'expense', '📦'],
  ['salary', 'Salario', 'income', '💼'],
  ['freelance', 'Trabajo independiente', 'income', '🧑‍💻'],
  ['investments', 'Inversiones', 'income', '📈'],
  ['gifts', 'Regalos', 'income', '🎁'],
  ['other_income', 'Otros ingresos', 'income', '💰'],
];

const conn = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.query(`USE \`${DB_NAME}\``);

const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
await conn.query(schema);

await conn.query(
  `INSERT INTO categories (id, name, type, icon, sort_order) VALUES ?
   ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), icon = VALUES(icon), sort_order = VALUES(sort_order)`,
  [CATEGORIES.map((c, i) => [...c, i])],
);

await conn.end();
console.log(`Base de datos "${DB_NAME}" lista (${CATEGORIES.length} categorías).`);
