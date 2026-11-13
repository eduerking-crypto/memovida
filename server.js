/**
 * MemoVida · Servidor HTTP (Node.js puro, cero dependencias)
 *   node server.js         → http://localhost:3000
 *   PORT=8080 node server.js
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDB, flush } from './src/db.js';
import { seed } from './src/seed.js';
import { router } from './src/api.js';
import { HttpError, json, readBody } from './src/http.js';
import { userFromToken, touchUser } from './src/auth.js';
import { subscribe } from './src/bus.js';
import { startEngine } from './src/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

loadDB();
seed();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8'
};

const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "connect-src 'self'", "media-src 'self' blob: data:",
  "font-src 'self'", "manifest-src 'self'", "worker-src 'self'",
  "base-uri 'self'", "form-action 'self'", "frame-ancestors *"
].join('; ');

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC, rel));
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403).end('Prohibido'); return; }

  let target = filePath;
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    if (path.extname(rel)) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('No encontrado'); return; }
    target = path.join(PUBLIC, 'index.html'); // SPA
  }
  const ext = path.extname(target).toLowerCase();
  const stat = fs.statSync(target);
  const isAsset = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.woff2'].includes(ext);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : (isAsset ? 'public, max-age=86400' : 'no-cache'),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': CSP,
    'Referrer-Policy': 'no-referrer'
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(target).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  if (!pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    return serveStatic(req, res, pathname);
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || '';
  const user = userFromToken(token);

  // Canal en tiempo real
  if (pathname === '/api/stream') {
    if (!user) { json(res, 401, { error: 'No autenticado' }); return; }
    subscribe(req, res, user);
    return;
  }

  const match = router.match(req.method, pathname);
  if (!match) { json(res, 404, { error: 'Ruta no encontrada', path: pathname }); return; }

  try {
    if (match.route.opts.auth !== false) {
      if (!user) throw new HttpError(401, 'Sesión no válida. Vuelve a entrar.');
      touchUser(user);
    }
    const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    const ctx = { req, res, url, query: url.searchParams, params: match.params, body, user, token };
    const out = await match.route.handler(ctx);
    if (out && out.__raw) {
      res.writeHead(200, {
        'Content-Type': out.contentType,
        'Content-Disposition': `attachment; filename="${out.filename || 'archivo'}"`,
        'Cache-Control': 'no-store'
      });
      res.end(out.body);
      return;
    }
    json(res, 200, out ?? { ok: true });
  } catch (err) {
    if (err instanceof HttpError) json(res, err.status, { error: err.message, ...err.extra });
    else { console.error('[api]', err); json(res, 500, { error: 'Error interno del servidor' }); }
  }
});

server.listen(PORT, HOST, () => {
  console.log('──────────────────────────────────────────────');
  console.log('  🧠  MemoVida está funcionando');
  console.log(`  →  http://localhost:${PORT}`);
  console.log('  Paciente : rosa@memovida.app / rosa1234');
  console.log('  Cuidadora: ana@memovida.app  / ana1234');
  console.log('──────────────────────────────────────────────');
});

startEngine(30000);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { console.log('\n[server] Guardando datos…'); flush(); process.exit(0); });
}
process.on('exit', () => { try { flush(); } catch { /* noop */ } });
