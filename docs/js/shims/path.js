/** Shim mínimo de node:path (la demo no toca el disco). */
const clean = p => String(p).replace(/\\/g, '/').replace(/\/{2,}/g, '/');
export default {
  sep: '/',
  dirname(p) { const s = clean(p).replace(/\/+$/, ''); const i = s.lastIndexOf('/'); return i <= 0 ? '/' : s.slice(0, i); },
  join(...parts) { return clean(parts.filter(Boolean).join('/')); },
  resolve(...parts) { return clean(parts.filter(Boolean).join('/')); },
  extname(p) { const s = clean(p); const i = s.lastIndexOf('.'); return i < 0 ? '' : s.slice(i); }
};
