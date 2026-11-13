/**
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
