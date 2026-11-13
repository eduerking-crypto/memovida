/**
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
