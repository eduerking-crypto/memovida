/**
 * MemoVida · Bus de eventos en tiempo real (Server-Sent Events)
 * Cada conexión se suscribe a los pacientes que su usuario puede ver.
 */
import { accessiblePatients } from './auth.js';

const clients = new Set();

export function subscribe(req, res, user) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');
  const client = {
    res, userId: user.id,
    patientIds: accessiblePatients(user).map(p => p.id)
  };
  clients.add(client);
  send(client, 'hola', { ok: true, pacientes: client.patientIds, ts: Date.now() });

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* noop */ }
  }, 25000);

  req.on('close', () => { clearInterval(ping); clients.delete(client); });
}

function send(client, event, data) {
  try {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch { clients.delete(client); }
}

/** Envía un evento a todos los usuarios con acceso a ese paciente. */
export function emitToPatient(patientId, event, data) {
  const payload = { ...data, patientId, ts: Date.now() };
  for (const c of clients) {
    if (c.patientIds.includes(patientId)) send(c, event, payload);
  }
}

/** Refresca los permisos de las conexiones abiertas (p. ej. tras vincular). */
export function refreshPermissions(user) {
  const ids = accessiblePatients(user).map(p => p.id);
  for (const c of clients) if (c.userId === user.id) c.patientIds = ids;
}

export function clientCount() { return clients.size; }
