/**
 * MemoVida · Utilidades HTTP + micro-router (sin Express)
 */
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

export function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Datos demasiado grandes')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'JSON no válido')); }
    });
    req.on('error', () => reject(new HttpError(400, 'Error de lectura')));
  });
}

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler, opts = {}) {
    const keys = [];
    const rx = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, m => {
      keys.push(m.slice(1));
      return '([^/]+)';
    }) + '/?$');
    this.routes.push({ method, rx, keys, handler, opts });
    return this;
  }
  get(p, h, o) { return this.add('GET', p, h, o); }
  post(p, h, o) { return this.add('POST', p, h, o); }
  patch(p, h, o) { return this.add('PATCH', p, h, o); }
  del(p, h, o) { return this.add('DELETE', p, h, o); }
  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.rx.exec(pathname);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      return { route: r, params };
    }
    return null;
  }
}

/* ---------- Validación / saneado ---------- */
export function str(v, { max = 500, required = false, name = 'campo' } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `Falta ${name}`);
    return '';
  }
  const s = String(v).trim().slice(0, max);
  if (required && !s) throw new HttpError(400, `Falta ${name}`);
  return s;
}

export function num(v, { min = -Infinity, max = Infinity, def = 0 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function bool(v, def = false) {
  if (v === undefined || v === null) return def;
  return v === true || v === 'true' || v === 1 || v === '1';
}

export function arr(v, max = 60) {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

export function timeStr(v) {
  const s = String(v || '');
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}

export function dateStr(v) {
  const s = String(v || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Foto: URL local o data-URL de imagen (máx. ~600 KB). */
export function photo(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (s.length > 700000) throw new HttpError(400, 'La foto es demasiado grande');
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)) return s;
  if (/^(\/|https?:\/\/)[^\s"'<>]{1,400}$/.test(s)) return s;
  throw new HttpError(400, 'Formato de foto no válido');
}

export const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
