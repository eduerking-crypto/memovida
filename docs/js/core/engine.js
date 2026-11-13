/**
 * MemoVida · Motor de avisos
 * Cada 30 s revisa la hora local de cada paciente:
 *  · emite el aviso cuando llega la hora (modal + voz en el modo paciente)
 *  · genera alerta al cuidador si se supera el tiempo de gracia
 *  · detecta inactividad prolongada
 */
import { db, byId, insert, update, where, patientNow, localDateStr, localTimeStr, nowISO } from './db.js';
import { emitToPatient } from './bus.js';
import { dueReminders } from './api.js';

const notified = new Set(); // recordatorio:patientId:fecha:hora

function alertOnce(patient, key, type, message, extra = {}) {
  if (db.alerts.some(a => a.key === key)) return null;
  const alert = insert('alerts', {
    patientId: patient.id, key, type, message, status: 'nueva', at: nowISO(), ...extra
  });
  emitToPatient(patient.id, 'alerta', { alert, patientName: patient.name });
  return alert;
}

export function tick() {
  for (const p of db.patients) {
    let due = [];
    try { due = dueReminders(p); } catch { continue; }
    const day = localDateStr(patientNow(p));
    const grace = p.settings?.graceMinutes ?? 20;

    for (const d of due) {
      const k = `${p.id}:${day}:${d.reminderId}:${d.time}`;
      if (d.overdueMin <= 2 && !notified.has(k)) {
        notified.add(k);
        emitToPatient(p.id, 'recordatorio', { due: d, patientName: p.name });
      }
      if (d.overdueMin >= grace) {
        alertOnce(p, `dosis:${d.reminderId}:${day}:${d.time}`, 'dosis',
          `Sin confirmar: "${d.title}" de las ${d.time}${d.dose ? ' (' + d.dose + ')' : ''}.`,
          { reminderId: d.reminderId, time: d.time, date: day });
      }
    }

    // Inactividad: sin abrir la app más de 36 h
    const user = p.userId ? byId('users', p.userId) : null;
    const seen = user?.lastSeen || p.lastSeen;
    if (seen && Date.now() - new Date(seen).getTime() > 36 * 3600000) {
      alertOnce(p, `inactividad:${day}`, 'inactividad',
        `${p.preferredName || p.name} no usa la aplicación desde hace más de 36 horas.`);
    }

    // Limpieza diaria del registro de avisos ya emitidos
    if (notified.size > 500) notified.clear();
  }
}

export function startEngine(intervalMs = 30000) {
  tick();
  const t = setInterval(() => { try { tick(); } catch (e) { console.error('[engine]', e); } }, intervalMs);
  t.unref?.();
  return t;
}
