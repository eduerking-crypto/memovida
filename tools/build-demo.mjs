/**
 * MemoVida · Compilador de la demo estática
 *
 * Copia `public/` a `docs/` y adapta el backend real (`src/`) para que se
 * ejecute dentro del navegador:
 *   · node:fs / path / crypto / url  →  shims sobre localStorage
 *   · bus.js (SSE)                   →  bus en memoria
 *   · fetch('/api/*')                →  router real en el navegador
 *
 * El resultado sirve para GitHub Pages y para empaquetarlo en el APK.
 *
 *   node tools/build-demo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public');
const CORE = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs');

const log = (...a) => console.log('  ', ...a);

function rimraf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function copyDir(from, to) {
  mkdir(to);
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, ent.name), b = path.join(to, ent.name);
    if (ent.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}
const read = p => fs.readFileSync(p, 'utf8');
const write = (p, s) => { mkdir(path.dirname(p)); fs.writeFileSync(p, s); };

console.log('\n🧠  Construyendo MemoVida demo estática…\n');

/* ─────────────── 1. Estáticos ─────────────── */
rimraf(OUT);
copyDir(SRC, OUT);
log('public/ → docs/');

/* ─────────────── 2. Núcleo del servidor en el navegador ─────────────── */
const SHIM = {
  'node:fs': '../shims/fs.js',
  'node:path': '../shims/path.js',
  'node:crypto': '../shims/crypto.js',
  'node:url': '../shims/url.js'
};

for (const file of ['db.js', 'auth.js', 'http.js', 'api.js', 'seed.js', 'engine.js']) {
  let code = read(path.join(CORE, file));
  for (const [spec, shim] of Object.entries(SHIM)) {
    code = code.replaceAll(`from '${spec}'`, `from '${shim}'`);
  }
  write(path.join(OUT, 'js', 'core', file), code);
}
log('src/*.js → docs/js/core/*.js (imports adaptados)');

/* ─────────────── 3. Shims de Node ─────────────── */

write(path.join(OUT, 'js', 'shims', 'fs.js'), `/**
 * Shim de node:fs sobre localStorage. La demo no tiene disco:
 * toda la "base de datos" vive en el navegador del usuario.
 */
const KEY = 'memovida.demo.db.v1';

export default {
  mkdirSync() {},
  existsSync() { return localStorage.getItem(KEY) !== null; },
  readFileSync() {
    const v = localStorage.getItem(KEY);
    if (v === null) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; }
    return v;
  },
  writeFileSync(_p, data) {
    try { localStorage.setItem(KEY, typeof data === 'string' ? data : String(data)); }
    catch (e) { console.warn('[demo] almacenamiento lleno', e); }
  },
  renameSync() {},
  statSync() { return { size: 0, isDirectory: () => false }; },
  createReadStream() { return null; }
};
`);

write(path.join(OUT, 'js', 'shims', 'path.js'), `/** Shim mínimo de node:path (la demo no toca el disco). */
const clean = p => String(p).replace(/\\\\/g, '/').replace(/\\/{2,}/g, '/');
export default {
  sep: '/',
  dirname(p) { const s = clean(p).replace(/\\/+$/, ''); const i = s.lastIndexOf('/'); return i <= 0 ? '/' : s.slice(0, i); },
  join(...parts) { return clean(parts.filter(Boolean).join('/')); },
  resolve(...parts) { return clean(parts.filter(Boolean).join('/')); },
  extname(p) { const s = clean(p); const i = s.lastIndexOf('.'); return i < 0 ? '' : s.slice(i); }
};
`);

write(path.join(OUT, 'js', 'shims', 'url.js'), `/** Shim de node:url para el navegador. */
export function fileURLToPath(u) { return String(u).replace(/^file:\\/\\/(\\/)?/, ''); }
export function pathToFileURL(p) { return new URL('file://' + p); }
`);

write(path.join(OUT, 'js', 'shims', 'crypto.js'), `/**
 * Shim de node:crypto. En el navegador no hay scrypt síncrono, así que
 * usamos un KDF síncrono equivalente en propósito (SHA-256 iterado + salt).
 * La demo es local: no hay secretos que proteger frente a un servidor.
 */
const HEX = '0123456789abcdef';
const hex = bytes => { let s = ''; for (const b of bytes) s += HEX[b >> 4] + HEX[b & 15]; return s; };

class Bytes extends Uint8Array {
  toString(enc) { return enc === 'hex' ? hex(this) : new TextDecoder().decode(this); }
}

export function randomBytes(n) {
  const b = new Bytes(n);
  (globalThis.crypto || {}).getRandomValues
    ? globalThis.crypto.getRandomValues(b)
    : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
  return b;
}

export function randomInt(max) {
  return randomBytes(4).reduce((a, b) => (a * 256 + b) % max, 0);
}

export function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/* ── SHA-256 (compacto, síncrono) ── */
const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

function sha256(data) {
  const len = data.length;
  const padded = new Uint8Array((((len + 9) >> 6) + 1) << 6);
  padded.set(data);
  padded[len] = 0x80;
  const bits = len * 8;
  new DataView(padded.buffer).setUint32(padded.length - 4, bits >>> 0);
  new DataView(padded.buffer).setUint32(padded.length - 8, Math.floor(bits / 4294967296));

  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const W = new Uint32Array(64);
  const view = new DataView(padded.buffer);

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i-15],7) ^ rotr(W[i-15],18) ^ (W[i-15] >>> 3);
      const s1 = rotr(W[i-2],17) ^ rotr(W[i-2],19) ^ (W[i-2] >>> 10);
      W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
  return out;
}

function concat(...parts) {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const enc = new TextEncoder();

/** KDF síncrono determinista (sustituye a scryptSync en la demo). */
export function scryptSync(password, salt, keylen = 64) {
  const base = enc.encode(String(password) + '\\u0000' + String(salt));
  let h = sha256(base);
  for (let i = 0; i < 2048; i++) h = sha256(concat(h, base, new Uint8Array([i & 255, (i >> 8) & 255])));
  let out = new Uint8Array(0);
  while (out.length < keylen) { out = concat(out, h); h = sha256(h); }
  return new Bytes(out.slice(0, keylen));
}

export default { randomBytes, randomInt, scryptSync, timingSafeEqual };
export { hex };
`);

/* ─────────────── 4. Bus en memoria (sustituye a SSE) ─────────────── */
write(path.join(OUT, 'js', 'core', 'bus.js'), `/**
 * Bus en tiempo real de la demo: en vez de SSE, los "EventSource"
 * locales se suscriben a este módulo dentro de la misma pestaña.
 */
const streams = new Set();

export function attachStream(es) { streams.add(es); }
export function detachStream(es) { streams.delete(es); }

export function subscribe() { /* no-op: la demo no abre sockets */ }

function send(es, event, data) {
  try { es._emit(event, data); } catch { streams.delete(es); }
}

export function emitToPatient(patientId, event, data) {
  const payload = { ...data, patientId, ts: Date.now() };
  for (const es of streams) if (!es._closed) send(es, event, payload);
}

export function refreshPermissions() { /* todos ven todo en un solo dispositivo */ }

export function clientCount() { return streams.size; }
`);

/* ─────────────── 5. Servidor de API en el navegador ─────────────── */
write(path.join(OUT, 'js', 'core', 'demo-server.js'), `/**
 * Router de MemoVida ejecutándose EN EL NAVEGADOR.
 * Reutiliza src/api.js tal cual: misma validación, mismos permisos,
 * misma lógica de dominio. Solo cambia el transporte (fetch → función).
 */
import { loadDB, flush } from './db.js';
import { seed } from './seed.js';
import { router } from './api.js';
import { HttpError } from './http.js';
import { userFromToken, touchUser } from './auth.js';
import { startEngine } from './engine.js';

loadDB();
seed();
startEngine(20000);

const save = () => { try { flush(); } catch (e) { console.warn('[demo] no se pudo guardar', e); } };
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });

export async function handle(method, pathname, search, body, token) {
  const match = router.match(method, pathname);
  if (!match) return { status: 404, body: { error: 'Ruta no encontrada', path: pathname } };

  const user = userFromToken(token);
  try {
    if (match.route.opts.auth !== false) {
      if (!user) throw new HttpError(401, 'Sesión no válida. Vuelve a entrar.');
      touchUser(user);
    }
    const ctx = {
      query: new URLSearchParams(search || ''),
      params: match.params,
      body: body || {},
      user, token
    };
    const out = await match.route.handler(ctx);
    if (out && out.__raw) {
      return { status: 200, raw: out.body, contentType: out.contentType, filename: out.filename };
    }
    return { status: 200, body: out ?? { ok: true } };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message, ...err.extra } };
    console.error('[demo-api]', err);
    return { status: 500, body: { error: 'Error interno del servidor' } };
  }
}

export function resetDemo() { try { localStorage.clear(); location.reload(); } catch { /* noop */ } }
`);

/* ─────────────── 6. Puente fetch / EventSource ─────────────── */
write(path.join(OUT, 'js', 'demo-boot.js'), `/* MemoVida · Arranque de la demo estática.
   Intercepta /api/* para responder con el backend que corre en esta pestaña. */
(function () {
  'use strict';
  if (typeof window.process === 'undefined') window.process = { env: {} };
  if (typeof window.Buffer === 'undefined') {
    window.Buffer = {
      from(input, enc) {
        if (typeof input === 'string') {
          if (enc === 'hex') {
            const out = new Uint8Array(input.length >> 1);
            for (let i = 0; i < out.length; i++) out[i] = parseInt(input.substr(i * 2, 2), 16);
            return out;
          }
          return new TextEncoder().encode(input);
        }
        return new Uint8Array(input);
      },
      isBuffer: v => v instanceof Uint8Array,
      byteLength(s) { return new TextEncoder().encode(String(s)).length; },
      concat(list) {
        const n = list.reduce((a, b) => a + b.length, 0);
        const out = new Uint8Array(n);
        let o = 0;
        for (const b of list) { out.set(b, o); o += b.length; }
        return out;
      }
    };
  }
  var CORE = new URL('js/core/', document.baseURI).href;
  var ready = null;
  function api() { return ready || (ready = import(CORE + 'demo-server.js')); }

  /* ── fetch → router local ── */
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    init = init || {};
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    var u;
    try { u = new URL(url, document.baseURI); } catch (e) { return nativeFetch ? nativeFetch(input, init) : Promise.reject(e); }
    if (!u.pathname.startsWith('/api/')) {
      return nativeFetch ? nativeFetch(input, init) : Promise.reject(new Error('sin fetch'));
    }
    var method = String(init.method || 'GET').toUpperCase();
    var body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = {}; } }
    var headers = init.headers || {};
    var auth = headers.Authorization || headers.authorization || '';
    var token = String(auth).replace(/^Bearer\\s+/i, '') || u.searchParams.get('token') || '';
    return api().then(function (mod) {
      return mod.handle(method, u.pathname, u.search, body, token);
    }).then(function (res) {
      if (res.raw !== undefined) {
        return new Response(res.raw, { status: 200, headers: { 'Content-Type': res.contentType || 'text/csv; charset=utf-8' } });
      }
      return new Response(JSON.stringify(res.body), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    });
  };

  /* ── EventSource → bus local ── */
  function DemoEventSource(url) {
    var self = this;
    this.url = String(url);
    this._closed = false;
    this._target = new EventTarget();
    this.addEventListener = this._target.addEventListener.bind(this._target);
    this.removeEventListener = this._target.removeEventListener.bind(this._target);
    this.dispatchEvent = this._target.dispatchEvent.bind(this._target);
    this._emit = function (type, data) {
      var ev = new Event(type);
      ev.data = JSON.stringify(data);
      self._target.dispatchEvent(ev);
    };
    import(CORE + 'bus.js').then(function (bus) { if (!self._closed) bus.attachStream(self); });
  }
  DemoEventSource.prototype.close = function () {
    this._closed = true;
    var self = this;
    import(CORE + 'bus.js').then(function (bus) { bus.detachStream(self); });
  };
  window.EventSource = DemoEventSource;

  /* ── Imágenes: \"\/img\/x\" → \"img\/x\" ──
     GitHub Pages sirve la app en /memovida/, así que una ruta absoluta
     apunta fuera del proyecto. Lo corregimos también en tiempo de ejecución
     para que un HTML o JS cacheado por el navegador no rompa las fotos. */
  function fixImg(root) {
    if (!root || !root.querySelectorAll) return;
    var imgs = root.querySelectorAll('img[src^="/img/"]');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].setAttribute('src', imgs[i].getAttribute('src').replace(/^\\/img\\//, 'img/'));
    }
    var icons = root.querySelectorAll('link[href^="/img/"]');
    for (var j = 0; j < icons.length; j++) {
      icons[j].setAttribute('href', icons[j].getAttribute('href').replace(/^\\/img\\//, 'img/'));
    }
  }
  fixImg(document);
  document.addEventListener('DOMContentLoaded', function () { fixImg(document); });
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.tagName === 'IMG' && /^\\/img\\//.test(n.getAttribute('src') || '')) fixImg(n.parentNode || document);
          else if (n.querySelector && n.querySelector('img[src^="/img/"]')) fixImg(n);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ── Descarga de CSV (enlace <a download> hacia /api/...) ── */
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var a = el.closest('a[href*="/api/reports/export.csv"]');
    if (!a) return;
    e.preventDefault();
    var u = new URL(a.getAttribute('href'), document.baseURI);
    api().then(function (mod) {
      return mod.handle('GET', u.pathname, u.search, {}, u.searchParams.get('token') || '');
    }).then(function (res) {
      var blob = new Blob([res.raw || ''], { type: res.contentType || 'text/csv; charset=utf-8' });
      var dl = URL.createObjectURL(blob);
      var tmp = document.createElement('a');
      tmp.href = dl;
      tmp.download = res.filename || 'memovida.csv';
      document.body.appendChild(tmp);
      tmp.click();
      tmp.remove();
      setTimeout(function () { URL.revokeObjectURL(dl); }, 5000);
    });
  }, true);

  /* Primer uso: limpia el "modo demo" de la URL */
  if (location.search.indexOf('demo') >= 0) {
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* noop */ }
  }
})();
`);

/* ─────────────── 7. index.html y manifest relativos ─────────────── */
let html = read(path.join(OUT, 'index.html'));
html = html
  .replace(/(href|src)="\/(?!\/)/g, '$1="')          // /css/... → css/...
  .replace('href="manifest.webmanifest"', 'href="manifest.webmanifest"')
  .replace('<script type="module" src="js/app.js"></script>',
    '<script src="js/demo-boot.js"></script>\n  <script type="module" src="js/app.js"></script>');
write(path.join(OUT, 'index.html'), html);
log('index.html → rutas relativas + demo-boot.js');

let manifest = read(path.join(OUT, 'manifest.webmanifest'));
manifest = manifest
  .replace('"start_url": "/"', '"start_url": "./"')
  .replace('"scope": "/"', '"scope": "./"')
  .replace('"src": "/img/logo.svg"', '"src": "img/logo.svg"');
write(path.join(OUT, 'manifest.webmanifest'), manifest);

/* ─────────────── 8. Service worker relativo ─────────────── */
write(path.join(OUT, 'sw.js'), `/* MemoVida · Service worker de la demo estática (caché de estáticos) */
const CACHE = 'memovida-demo-v4';
const ASSETS = ['./', './index.html', './css/styles.css', './js/app.js',
  './js/demo-boot.js', './img/logo.svg', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
`);

/* ─────────────── 9. Registro del SW relativo ─────────────── */
const appJsPath = path.join(OUT, 'js', 'app.js');
let appJs = read(appJsPath);
appJs = appJs.replace("navigator.serviceWorker.register('/sw.js')", "navigator.serviceWorker.register('./sw.js')");
write(appJsPath, appJs);

/* ─────────────── 9b. Rutas de imágenes relativas ─────────────── */
/* GitHub Pages sirve la app en /memovida/, así que "/img/x.jpg" no existe. */
(function relativeImages(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { relativeImages(p); continue; }
    if (!e.name.endsWith('.js') || e.name === 'demo-boot.js') continue;
    const before = read(p);
    const after = before.replace(/(['"`])\/img\//g, '$1img/');
    if (after !== before) write(p, after);
  }
})(path.join(OUT, 'js'));

/* ─────────────── 10. Extras ─────────────── */
write(path.join(OUT, '.nojekyll'), '');
write(path.join(OUT, '404.html'), `<!DOCTYPE html><html lang="es"><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=./"><title>MemoVida</title>
<p>Redirigiendo a <a href="./">MemoVida</a>…</p></html>`);

const count = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
console.log(`\n✅  Demo lista en docs/ (${count(OUT)} archivos)`);
console.log('    Preview:  node tools/serve-demo.mjs\n');
