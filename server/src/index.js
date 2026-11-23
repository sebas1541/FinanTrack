import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';
import receiptRoutes from './routes/receipts.js';
import pushRoutes from './routes/push.js';
import { pushEnabled, startWeeklyScheduler, TIMEZONE } from './push.js';

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en el archivo .env');
  process.exit(1);
}

const app = express();
// En desarrollo el cliente llega por el proxy de Vite (loopback). En Railway hay un proxy delante:
// TRUST_PROXY=1 hace que req.ip sea la IP real del usuario (lo necesita el límite de intentos).
const trustProxy = process.env.TRUST_PROXY ?? 'loopback';
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Las vistas previas de facturas usan URLs blob: (URL.createObjectURL)
        'img-src': ["'self'", 'data:', 'blob:'],
      },
    },
  }),
);
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/categories', requireAuth, async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, type, icon FROM categories ORDER BY sort_order');
  res.json(rows);
});

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/push', pushRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Producción: el mismo servidor entrega el cliente compilado (client/dist), así todo queda en un solo origen.
const CLIENT_DIST = path.resolve(process.env.CLIENT_DIST ?? fileURLToPath(new URL('../../client/dist', import.meta.url)));
if (existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  const noCache = (res) => res.setHeader('Cache-Control', 'no-cache');
  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      setHeaders: (res, filePath) => {
        // Los archivos de /assets llevan hash en el nombre; el service worker y el manifiesto no.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else noCache(res);
      },
    }),
  );
  // Sin service worker activo el navegador envía el POST de "Compartir" directo al servidor.
  app.post('/share-target', (_req, res) => res.redirect(303, '/transactions/new'));
  // Rutas del cliente (React Router): siempre index.html
  app.get('/{*splat}', (_req, res) => {
    noCache(res);
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// Express 5 envía aquí también los errores de los handlers async.
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(413).json({ status: 'error', error: 'La imagen supera el tamaño máximo (5 MB)' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API de FinanTrack en http://localhost:${port}`);
  if (existsSync(path.join(CLIENT_DIST, 'index.html'))) console.log(`Cliente compilado servido desde ${CLIENT_DIST}`);
  console.log(pushEnabled ? `Web Push activo (resumen semanal: lunes 8:00, ${TIMEZONE})` : 'Web Push desactivado: faltan claves VAPID en .env');
  startWeeklyScheduler();
});
