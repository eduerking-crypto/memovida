/**
 * MemoVida · API REST completa
 * Todos los endpoints validan entrada y comprueban permisos por paciente.
 */
import {
  db, insert, byId, update, remove, where, persist, uid, nowISO,
  patientNow, localDateStr, localTimeStr, distanceMeters
} from './db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, publicUser,
  accessiblePatients, canAccess, isCaregiver, makeCode, touchUser
} from './auth.js';
import {
  Router, HttpError, str, num, bool, arr, timeStr, dateStr, photo, EMAIL_RX
} from './http.js';
import { emitToPatient, refreshPermissions } from './bus.js';

export const router = new Router();

/* ═════════════════ helpers de dominio ═════════════════ */

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function ctxPatient(ctx, id) {
  const pid = id || ctx.body?.patientId || ctx.query.get('patientId') ||
    accessiblePatients(ctx.user)[0]?.id;
  if (!pid) throw new HttpError(400, 'Falta patientId');
  if (!canAccess(ctx.user, pid)) throw new HttpError(403, 'No tienes acceso a este paciente');
  const p = byId('patients', pid);
  if (!p) throw new HttpError(404, 'Paciente no encontrado');
  return p;
}

function ownedRow(ctx, coll, id) {
  const row = byId(coll, id);
  if (!row) throw new HttpError(404, 'No encontrado');
  if (!canAccess(ctx.user, row.patientId)) throw new HttpError(403, 'Sin acceso');
  return row;
}

function requireCaregiver(ctx) {
  if (!isCaregiver(ctx.user)) throw new HttpError(403, 'Solo el cuidador puede hacer esto');
}

function todayOf(p) { return localDateStr(patientNow(p)); }

function shiftDate(dateString, days) {
  const d = new Date(dateString + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(dateString) { return new Date(dateString + 'T12:00:00Z').getUTCDay(); }

/** Tomas programadas para un día concreto. */
function scheduledFor(p, day) {
  const wd = weekdayOf(day);
  return where('reminders', r =>
    r.patientId === p.id && r.active &&
    (!r.startDate || r.startDate <= day) &&
    (r.createdAt || '').slice(0, 10) <= day &&
    (r.days || [0, 1, 2, 3, 4, 5, 6]).includes(wd)
  ).flatMap(r => (r.times || []).map(t => ({ reminder: r, time: t })));
}

/** Avisos pendientes AHORA (hora local del paciente). */
export function dueReminders(p) {
  const now = patientNow(p);
  const day = localDateStr(now), hhmm = localTimeStr(now);
  const logs = where('doseLogs', l => l.patientId === p.id && l.date === day);
  const out = [];
  for (const item of scheduledFor(p, day)) {
    if (item.time > hhmm) continue;
    const log = logs.find(l => l.reminderId === item.reminder.id && l.time === item.time);
    if (log && (log.status === 'tomada' || log.status === 'omitida')) continue;
    if (log?.status === 'pospuesta' && log.snoozeUntil && log.snoozeUntil > now.toISOString()) continue;
    const [h1, m1] = item.time.split(':').map(Number);
    const [h2, m2] = hhmm.split(':').map(Number);
    out.push({
      reminderId: item.reminder.id,
      title: item.reminder.title,
      type: item.reminder.type,
      dose: item.reminder.dose || '',
      notes: item.reminder.notes || '',
      time: item.time,
      overdueMin: (h2 * 60 + m2) - (h1 * 60 + m1)
    });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

function stats(p) {
  const today = todayOf(p);
  const days = [...Array(7)].map((_, i) => shiftDate(today, i - 6));
  const logs = where('doseLogs', l => l.patientId === p.id);
  const adherence = days.map(day => {
    const due = scheduledFor(p, day).length;
    const taken = logs.filter(l => l.date === day && l.status === 'tomada').length;
    const missed = logs.filter(l => l.date === day && l.status === 'omitida').length;
    return { date: day, weekday: WEEKDAYS[weekdayOf(day)].slice(0, 3), due, taken, missed, pct: due ? Math.round(taken / due * 100) : null };
  });
  const valid = adherence.filter(a => a.pct !== null);
  const games = where('gameScores', g => g.patientId === p.id && g.date >= days[0]);
  const moods = where('moods', m => m.patientId === p.id && m.date >= days[0]);
  const routines = where('routines', r => r.patientId === p.id);
  const rLogs = where('routineLogs', l => l.patientId === p.id && l.date === today);
  const totalSteps = routines.reduce((s, r) => s + (r.steps || []).length, 0);
  const doneSteps = rLogs.reduce((s, l) => s + (l.steps || []).length, 0);
  const loc = where('locations', l => l.patientId === p.id).sort((a, b) => b.at.localeCompare(a.at))[0] || null;
  return {
    today,
    adherence,
    adherenceAvg: valid.length ? Math.round(valid.reduce((s, a) => s + a.pct, 0) / valid.length) : null,
    gamesCount: games.length,
    gamesAvg: games.length ? Math.round(games.reduce((s, g) => s + g.score, 0) / games.length) : null,
    gamesMinutes: Math.round(games.reduce((s, g) => s + (g.durationMs || 0), 0) / 60000),
    moodAvg: moods.length ? +(moods.reduce((s, m) => s + m.value, 0) / moods.length).toFixed(1) : null,
    routinePct: totalSteps ? Math.round(doneSteps / totalSteps * 100) : 0,
    openAlerts: where('alerts', a => a.patientId === p.id && a.status !== 'resuelta').length,
    lastLocation: loc
  };
}

function bootstrap(p, user) {
  const today = todayOf(p);
  const now = patientNow(p);
  const caregiver = isCaregiver(user);
  const sortDesc = (a, b) => (b.at || b.createdAt || '').localeCompare(a.at || a.createdAt || '');
  return {
    patient: p,
    role: user.role,
    today,
    now: localTimeStr(now),
    weekday: WEEKDAYS[now.getUTCDay()],
    serverTime: nowISO(),
    people: where('people', x => x.patientId === p.id),
    memories: where('memories', x => x.patientId === p.id).sort((a, b) => (a.year || 0) - (b.year || 0)),
    reminders: where('reminders', x => x.patientId === p.id).sort((a, b) => (a.times?.[0] || '').localeCompare(b.times?.[0] || '')),
    routines: where('routines', x => x.patientId === p.id),
    doseLogs: where('doseLogs', x => x.patientId === p.id && x.date >= shiftDate(today, -13)),
    routineLogs: where('routineLogs', x => x.patientId === p.id && x.date === today),
    moods: where('moods', x => x.patientId === p.id).sort(sortDesc).slice(0, 30),
    games: where('gameScores', x => x.patientId === p.id).sort(sortDesc).slice(0, 120),
    alerts: where('alerts', x => x.patientId === p.id).sort(sortDesc).slice(0, 40),
    notes: caregiver ? where('notes', x => x.patientId === p.id).sort(sortDesc).slice(0, 80) : [],
    due: dueReminders(p),
    stats: stats(p),
    caregivers: db.users.filter(u => u.role === 'cuidador' && (u.linkedPatientIds || []).includes(p.id))
      .map(u => ({ id: u.id, name: u.name, email: u.email }))
  };
}

function createAlert(p, type, message, extra = {}) {
  const alert = insert('alerts', {
    patientId: p.id, type, message, status: 'nueva', at: nowISO(), ...extra
  });
  emitToPatient(p.id, 'alerta', { alert, patientName: p.name });
  return alert;
}

/* ═════════════════ AUTH ═════════════════ */

router.post('/api/auth/register', async ctx => {
  const name = str(ctx.body.name, { required: true, max: 80, name: 'el nombre' });
  const email = str(ctx.body.email, { required: true, max: 120, name: 'el correo' }).toLowerCase();
  const password = str(ctx.body.password, { required: true, max: 200, name: 'la contraseña' });
  const role = ctx.body.role === 'cuidador' ? 'cuidador' : 'paciente';
  if (!EMAIL_RX.test(email)) throw new HttpError(400, 'Correo no válido');
  if (password.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
  if (db.users.some(u => u.email === email)) throw new HttpError(409, 'Ya existe una cuenta con ese correo');

  const user = insert('users', {
    name, email, role, password: hashPassword(password),
    linkedPatientIds: [], lastSeen: nowISO()
  });
  let patient = null;
  if (role === 'paciente') {
    patient = insert('patients', newPatientDoc({ name, userId: user.id }));
    user.patientId = patient.id;
  }
  persist();
  const token = createSession(user.id);
  return { token, user: publicUser(user), patients: accessiblePatients(user), patient };
}, { auth: false });

router.post('/api/auth/login', async ctx => {
  const email = str(ctx.body.email, { required: true, name: 'el correo' }).toLowerCase();
  const password = str(ctx.body.password, { required: true, name: 'la contraseña' });
  const user = db.users.find(u => u.email === email);
  if (!user || !verifyPassword(password, user.password)) throw new HttpError(401, 'Correo o contraseña incorrectos');
  touchUser(user);
  const token = createSession(user.id);
  return { token, user: publicUser(user), patients: accessiblePatients(user) };
}, { auth: false });

router.post('/api/auth/logout', async ctx => { destroySession(ctx.token); return { ok: true }; });

router.get('/api/auth/me', async ctx => ({
  user: publicUser(ctx.user), patients: accessiblePatients(ctx.user)
}));

router.patch('/api/auth/me', async ctx => {
  const patch = {};
  if (ctx.body.name !== undefined) patch.name = str(ctx.body.name, { max: 80, required: true, name: 'el nombre' });
  if (ctx.body.password) {
    const pw = str(ctx.body.password, { max: 200 });
    if (pw.length < 6) throw new HttpError(400, 'Contraseña demasiado corta');
    if (!verifyPassword(str(ctx.body.currentPassword), ctx.user.password)) throw new HttpError(403, 'La contraseña actual no es correcta');
    patch.password = hashPassword(pw);
  }
  update('users', ctx.user.id, patch);
  return { user: publicUser(ctx.user) };
});

/* ═════════════════ PACIENTES ═════════════════ */

function newPatientDoc({ name, userId = null }) {
  return {
    userId, name, preferredName: name.split(' ')[0],
    birthDate: '', photo: '', phone: '', address: '',
    bloodType: '', allergies: '', conditions: '', notes: '',
    anchorPhrase: 'Estás en tu casa. Estás a salvo.',
    emergencyContacts: [],
    home: { enabled: false, lat: null, lng: null, radius: 250, label: 'Casa' },
    settings: { fontScale: 1, contrast: false, night: false, voice: true, graceMinutes: 20, shareLocation: false },
    tzOffset: 0, code: makeCode(), lastSeen: nowISO()
  };
}

router.get('/api/patients', async ctx => ({ patients: accessiblePatients(ctx.user) }));

router.post('/api/patients', async ctx => {
  requireCaregiver(ctx);
  const name = str(ctx.body.name, { required: true, max: 80, name: 'el nombre' });
  const p = insert('patients', newPatientDoc({ name }));
  ctx.user.linkedPatientIds = [...(ctx.user.linkedPatientIds || []), p.id];
  persist();
  refreshPermissions(ctx.user);
  return { patient: p };
});

router.get('/api/patients/:id', async ctx => ({ patient: ctxPatient(ctx, ctx.params.id) }));

router.patch('/api/patients/:id', async ctx => {
  const p = ctxPatient(ctx, ctx.params.id);
  const b = ctx.body, patch = {};
  const s = b.settings || {};
  // Ajustes de accesibilidad: los puede cambiar el propio paciente
  const settings = { ...p.settings };
  if (s.fontScale !== undefined) settings.fontScale = num(s.fontScale, { min: 0.85, max: 1.9, def: 1 });
  for (const k of ['contrast', 'night', 'voice', 'shareLocation']) if (s[k] !== undefined) settings[k] = bool(s[k]);
  if (isCaregiver(ctx.user) && s.graceMinutes !== undefined) settings.graceMinutes = num(s.graceMinutes, { min: 5, max: 180, def: 20 });
  patch.settings = settings;
  if (b.tzOffset !== undefined) patch.tzOffset = num(b.tzOffset, { min: -840, max: 840, def: 0 });

  if (isCaregiver(ctx.user)) {
    for (const k of ['name', 'preferredName', 'phone', 'address', 'bloodType', 'allergies', 'conditions', 'notes', 'anchorPhrase'])
      if (b[k] !== undefined) patch[k] = str(b[k], { max: k === 'notes' || k === 'anchorPhrase' ? 600 : 160 });
    if (b.birthDate !== undefined) patch.birthDate = dateStr(b.birthDate) || '';
    if (b.photo !== undefined) patch.photo = photo(b.photo);
    if (b.emergencyContacts !== undefined) {
      patch.emergencyContacts = arr(b.emergencyContacts, 8).map(c => ({
        name: str(c.name, { max: 80 }), phone: str(c.phone, { max: 40 }), relation: str(c.relation, { max: 60 })
      })).filter(c => c.name);
    }
    if (b.home) {
      patch.home = {
        enabled: bool(b.home.enabled),
        lat: b.home.lat === null || b.home.lat === '' ? null : num(b.home.lat, { min: -90, max: 90 }),
        lng: b.home.lng === null || b.home.lng === '' ? null : num(b.home.lng, { min: -180, max: 180 }),
        radius: num(b.home.radius, { min: 50, max: 5000, def: 250 }),
        label: str(b.home.label, { max: 60 }) || 'Casa'
      };
    }
  }
  const updated = update('patients', p.id, patch);
  emitToPatient(p.id, 'paciente', { patient: updated });
  return { patient: updated };
});

router.post('/api/patients/link', async ctx => {
  requireCaregiver(ctx);
  const code = str(ctx.body.code, { required: true, max: 12, name: 'el código' }).toUpperCase();
  const p = db.patients.find(x => x.code === code);
  if (!p) throw new HttpError(404, 'No hay ningún paciente con ese código');
  const ids = new Set(ctx.user.linkedPatientIds || []);
  ids.add(p.id);
  ctx.user.linkedPatientIds = [...ids];
  persist();
  refreshPermissions(ctx.user);
  return { patient: p, patients: accessiblePatients(ctx.user) };
});

router.del('/api/patients/:id/link', async ctx => {
  requireCaregiver(ctx);
  const p = ctxPatient(ctx, ctx.params.id);
  ctx.user.linkedPatientIds = (ctx.user.linkedPatientIds || []).filter(x => x !== p.id);
  persist();
  refreshPermissions(ctx.user);
  return { ok: true, patients: accessiblePatients(ctx.user) };
});

router.get('/api/bootstrap', async ctx => bootstrap(ctxPatient(ctx), ctx.user));

/* ═════════════════ CRUD genérico con permisos ═════════════════ */

function crud(path, coll, sanitize, { caregiverOnly = true, after = null } = {}) {
  router.get(`/api/${path}`, async ctx => {
    const p = ctxPatient(ctx);
    return { [coll]: where(coll, x => x.patientId === p.id) };
  });
  router.post(`/api/${path}`, async ctx => {
    if (caregiverOnly) requireCaregiver(ctx);
    const p = ctxPatient(ctx);
    const doc = sanitize(ctx.body, null, ctx);
    const row = insert(coll, { patientId: p.id, ...doc });
    after?.(p, row, 'crear', ctx);
    emitToPatient(p.id, 'cambio', { coll });
    return { [coll.slice(0, -1)]: row, row };
  });
  router.patch(`/api/${path}/:id`, async ctx => {
    if (caregiverOnly) requireCaregiver(ctx);
    const row = ownedRow(ctx, coll, ctx.params.id);
    const p = byId('patients', row.patientId);
    const doc = sanitize(ctx.body, row, ctx);
    const updated = update(coll, row.id, doc);
    after?.(p, updated, 'editar', ctx);
    emitToPatient(p.id, 'cambio', { coll });
    return { row: updated };
  });
  router.del(`/api/${path}/:id`, async ctx => {
    if (caregiverOnly) requireCaregiver(ctx);
    const row = ownedRow(ctx, coll, ctx.params.id);
    remove(coll, row.id);
    emitToPatient(row.patientId, 'cambio', { coll });
    return { ok: true };
  });
}

crud('people', 'people', b => ({
  name: str(b.name, { required: true, max: 80, name: 'el nombre' }),
  relation: str(b.relation, { max: 60 }),
  phone: str(b.phone, { max: 40 }),
  photo: photo(b.photo),
  description: str(b.description, { max: 400 }),
  memory: str(b.memory, { max: 400 })
}));

crud('memories', 'memories', b => ({
  title: str(b.title, { required: true, max: 120, name: 'el título' }),
  year: b.year ? num(b.year, { min: 1900, max: 2100 }) : null,
  place: str(b.place, { max: 100 }),
  description: str(b.description, { max: 1200 }),
  photo: photo(b.photo),
  tags: arr(b.tags, 8).map(t => str(t, { max: 30 })).filter(Boolean)
}));

crud('reminders', 'reminders', (b, prev) => {
  const times = arr(b.times, 8).map(timeStr).filter(Boolean).sort();
  if (!times.length) throw new HttpError(400, 'Indica al menos una hora válida (HH:MM)');
  const days = arr(b.days, 7).map(d => num(d, { min: 0, max: 6 })).filter((d, i, a) => a.indexOf(d) === i);
  return {
    title: str(b.title, { required: true, max: 120, name: 'el título' }),
    type: ['medicacion', 'cita', 'comida', 'actividad', 'otro'].includes(b.type) ? b.type : 'otro',
    dose: str(b.dose, { max: 80 }),
    notes: str(b.notes, { max: 400 }),
    times,
    days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
    startDate: dateStr(b.startDate) || (prev?.startDate ?? null),
    active: b.active === undefined ? (prev?.active ?? true) : bool(b.active, true),
    icon: str(b.icon, { max: 24 })
  };
});

crud('routines', 'routines', b => ({
  title: str(b.title, { required: true, max: 100, name: 'el título' }),
  period: ['mañana', 'tarde', 'noche'].includes(b.period) ? b.period : 'mañana',
  steps: arr(b.steps, 20).map(s => ({
    id: s.id || uid('stp'),
    label: str(s.label, { max: 120 }),
    icon: str(s.icon, { max: 24 }) || 'check-circle'
  })).filter(s => s.label)
}));

crud('notes', 'notes', (b, prev, ctx) => ({
  text: str(b.text, { required: true, max: 2000, name: 'la nota' }),
  category: ['conducta', 'sueño', 'médica', 'ánimo', 'alimentación', 'otra'].includes(b.category) ? b.category : 'otra',
  authorId: ctx.user.id,
  authorName: ctx.user.name,
  at: prev?.at || nowISO()
}));

/* ═════════════════ TOMAS / MEDICACIÓN ═════════════════ */

router.get('/api/reminders/due', async ctx => {
  const p = ctxPatient(ctx);
  return { due: dueReminders(p), now: localTimeStr(patientNow(p)), today: todayOf(p) };
});

router.post('/api/doses', async ctx => {
  const p = ctxPatient(ctx);
  const r = ownedRow(ctx, 'reminders', str(ctx.body.reminderId, { required: true }));
  const time = timeStr(ctx.body.time) || localTimeStr(patientNow(p));
  const status = ['tomada', 'omitida', 'pospuesta'].includes(ctx.body.status) ? ctx.body.status : 'tomada';
  const date = todayOf(p);
  const existing = db.doseLogs.find(l => l.patientId === p.id && l.reminderId === r.id && l.date === date && l.time === time);
  const patch = {
    status, at: nowISO(), by: ctx.user.name,
    snoozeUntil: status === 'pospuesta'
      ? new Date(Date.now() + num(ctx.body.minutes, { min: 1, max: 120, def: 10 }) * 60000).toISOString()
      : null
  };
  const log = existing ? update('doseLogs', existing.id, patch)
    : insert('doseLogs', { patientId: p.id, reminderId: r.id, reminderTitle: r.title, date, time, ...patch });
  if (status !== 'pospuesta') {
    // cierra la alerta de dosis olvidada si existía
    const key = `dosis:${r.id}:${date}:${time}`;
    db.alerts.filter(a => a.key === key && a.status !== 'resuelta')
      .forEach(a => update('alerts', a.id, { status: 'resuelta', resolvedAt: nowISO(), resolvedBy: ctx.user.name }));
  }
  emitToPatient(p.id, 'dosis', { log, stats: stats(p) });
  return { log, stats: stats(p) };
});

/* ═════════════════ RUTINAS ═════════════════ */

router.post('/api/routines/:id/step', async ctx => {
  const r = ownedRow(ctx, 'routines', ctx.params.id);
  const p = byId('patients', r.patientId);
  const date = todayOf(p);
  const stepId = str(ctx.body.stepId, { required: true });
  if (!(r.steps || []).some(s => s.id === stepId)) throw new HttpError(400, 'Paso no válido');
  let log = db.routineLogs.find(l => l.patientId === p.id && l.routineId === r.id && l.date === date);
  if (!log) log = insert('routineLogs', { patientId: p.id, routineId: r.id, date, steps: [] });
  const steps = new Set(log.steps || []);
  if (bool(ctx.body.done, true)) steps.add(stepId); else steps.delete(stepId);
  update('routineLogs', log.id, { steps: [...steps], at: nowISO() });
  emitToPatient(p.id, 'rutina', { routineId: r.id, stats: stats(p) });
  return { log: byId('routineLogs', log.id), stats: stats(p) };
});

router.post('/api/routines/:id/reset', async ctx => {
  const r = ownedRow(ctx, 'routines', ctx.params.id);
  const p = byId('patients', r.patientId);
  const log = db.routineLogs.find(l => l.patientId === p.id && l.routineId === r.id && l.date === todayOf(p));
  if (log) update('routineLogs', log.id, { steps: [] });
  emitToPatient(p.id, 'rutina', { routineId: r.id });
  return { ok: true };
});

/* ═════════════════ ÁNIMO Y JUEGOS ═════════════════ */

router.post('/api/moods', async ctx => {
  const p = ctxPatient(ctx);
  const value = num(ctx.body.value, { min: 1, max: 5, def: 3 });
  const date = todayOf(p);
  const prev = db.moods.find(m => m.patientId === p.id && m.date === date);
  const doc = { value, note: str(ctx.body.note, { max: 300 }), date, at: nowISO() };
  const mood = prev ? update('moods', prev.id, doc) : insert('moods', { patientId: p.id, ...doc });
  emitToPatient(p.id, 'animo', { mood });
  return { mood };
});

const GAMES = ['parejas', 'caras', 'secuencia', 'refranes', 'numeros', 'orden'];
router.post('/api/games', async ctx => {
  const p = ctxPatient(ctx);
  const game = GAMES.includes(ctx.body.game) ? ctx.body.game : null;
  if (!game) throw new HttpError(400, 'Juego no válido');
  const total = num(ctx.body.total, { min: 1, max: 200, def: 1 });
  const correct = num(ctx.body.correct, { min: 0, max: total, def: 0 });
  const row = insert('gameScores', {
    patientId: p.id, game,
    level: num(ctx.body.level, { min: 1, max: 3, def: 1 }),
    score: num(ctx.body.score, { min: 0, max: 100, def: Math.round(correct / total * 100) }),
    correct, total,
    durationMs: num(ctx.body.durationMs, { min: 0, max: 7200000, def: 0 }),
    date: todayOf(p), at: nowISO()
  });
  emitToPatient(p.id, 'juego', { score: row, stats: stats(p) });
  return { score: row, stats: stats(p) };
});

/* ═════════════════ ALERTAS / SOS / UBICACIÓN ═════════════════ */

router.post('/api/alerts/sos', async ctx => {
  const p = ctxPatient(ctx);
  const lat = ctx.body.lat != null ? num(ctx.body.lat, { min: -90, max: 90 }) : null;
  const lng = ctx.body.lng != null ? num(ctx.body.lng, { min: -180, max: 180 }) : null;
  const alert = createAlert(p, 'sos',
    `${p.preferredName || p.name} ha pedido ayuda.`,
    { lat, lng, note: str(ctx.body.note, { max: 300 }) });
  return { alert };
});

router.patch('/api/alerts/:id', async ctx => {
  const a = ownedRow(ctx, 'alerts', ctx.params.id);
  const status = ['nueva', 'vista', 'resuelta'].includes(ctx.body.status) ? ctx.body.status : 'vista';
  const updated = update('alerts', a.id, {
    status, resolvedBy: ctx.user.name,
    resolvedAt: status === 'resuelta' ? nowISO() : a.resolvedAt || null,
    response: str(ctx.body.response, { max: 300 }) || a.response || ''
  });
  emitToPatient(a.patientId, 'alerta', { alert: updated });
  return { alert: updated };
});

router.post('/api/locations', async ctx => {
  const p = ctxPatient(ctx);
  const lat = num(ctx.body.lat, { min: -90, max: 90, def: NaN });
  const lng = num(ctx.body.lng, { min: -180, max: 180, def: NaN });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, 'Ubicación no válida');
  let inside = null, distance = null;
  if (p.home?.enabled && Number.isFinite(p.home.lat) && Number.isFinite(p.home.lng)) {
    distance = Math.round(distanceMeters({ lat: p.home.lat, lng: p.home.lng }, { lat, lng }));
    inside = distance <= (p.home.radius || 250);
  }
  const loc = insert('locations', {
    patientId: p.id, lat, lng, inside, distance,
    accuracy: num(ctx.body.accuracy, { min: 0, max: 100000, def: 0 }), at: nowISO()
  });
  emitToPatient(p.id, 'ubicacion', { location: loc });
  if (inside === false) {
    const last = where('alerts', a => a.patientId === p.id && a.type === 'zona' && a.status !== 'resuelta')
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    const cooldown = !last || (Date.now() - new Date(last.at).getTime()) > 10 * 60000;
    if (cooldown) createAlert(p, 'zona',
      `${p.preferredName || p.name} está fuera de la zona segura (${distance} m de ${p.home.label || 'casa'}).`,
      { lat, lng, distance });
  }
  // mantener el histórico acotado
  const all = where('locations', l => l.patientId === p.id).sort((a, b) => b.at.localeCompare(a.at));
  all.slice(500).forEach(l => remove('locations', l.id));
  return { location: loc };
});

/* ═════════════════ INFORMES ═════════════════ */

function weeklyReport(p, from) {
  const today = todayOf(p);
  const start = from || shiftDate(today, -6);
  const days = [];
  for (let d = start; d <= today; d = shiftDate(d, 1)) days.push(d);
  const logs = where('doseLogs', l => l.patientId === p.id && l.date >= start);
  const games = where('gameScores', g => g.patientId === p.id && g.date >= start);
  const moods = where('moods', m => m.patientId === p.id && m.date >= start);
  const alerts = where('alerts', a => a.patientId === p.id && a.at.slice(0, 10) >= start);
  const notes = where('notes', n => n.patientId === p.id && (n.at || '').slice(0, 10) >= start);
  const due = days.reduce((s, d) => s + scheduledFor(p, d).length, 0);
  const taken = logs.filter(l => l.status === 'tomada').length;
  return {
    patient: { id: p.id, name: p.name, birthDate: p.birthDate, code: p.code },
    from: start, to: today, days,
    medication: {
      scheduled: due, taken, missed: logs.filter(l => l.status === 'omitida').length,
      adherence: due ? Math.round(taken / due * 100) : null,
      detail: days.map(d => ({
        date: d,
        due: scheduledFor(p, d).length,
        taken: logs.filter(l => l.date === d && l.status === 'tomada').length
      }))
    },
    cognition: {
      sessions: games.length,
      minutes: Math.round(games.reduce((s, g) => s + (g.durationMs || 0), 0) / 60000),
      avgScore: games.length ? Math.round(games.reduce((s, g) => s + g.score, 0) / games.length) : null,
      byGame: GAMES.map(g => {
        const rows = games.filter(x => x.game === g);
        return {
          game: g, sessions: rows.length,
          avgScore: rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : null
        };
      }).filter(x => x.sessions)
    },
    mood: {
      entries: moods.length,
      avg: moods.length ? +(moods.reduce((s, m) => s + m.value, 0) / moods.length).toFixed(1) : null,
      detail: moods.map(m => ({ date: m.date, value: m.value, note: m.note }))
    },
    safety: {
      alerts: alerts.length,
      sos: alerts.filter(a => a.type === 'sos').length,
      zone: alerts.filter(a => a.type === 'zona').length,
      missedDose: alerts.filter(a => a.type === 'dosis').length
    },
    notes: notes.map(n => ({ date: (n.at || '').slice(0, 10), category: n.category, text: n.text, author: n.authorName })),
    generatedAt: nowISO()
  };
}

router.get('/api/reports/weekly', async ctx => {
  requireCaregiver(ctx);
  const p = ctxPatient(ctx);
  return weeklyReport(p, dateStr(ctx.query.get('from')));
});

router.get('/api/reports/export.csv', async ctx => {
  requireCaregiver(ctx);
  const p = ctxPatient(ctx);
  const r = weeklyReport(p, dateStr(ctx.query.get('from')));
  const rows = [['seccion', 'fecha', 'clave', 'valor']];
  rows.push(['paciente', '', 'nombre', p.name]);
  rows.push(['periodo', r.from, 'hasta', r.to]);
  r.medication.detail.forEach(d => {
    rows.push(['medicacion', d.date, 'programadas', d.due]);
    rows.push(['medicacion', d.date, 'tomadas', d.taken]);
  });
  rows.push(['medicacion', '', 'adherencia_%', r.medication.adherence ?? '']);
  r.mood.detail.forEach(m => rows.push(['animo', m.date, 'valor_1_5', m.value]));
  r.cognition.byGame.forEach(g => {
    rows.push(['cognicion', '', g.game + '_sesiones', g.sessions]);
    rows.push(['cognicion', '', g.game + '_puntuacion', g.avgScore ?? '']);
  });
  rows.push(['seguridad', '', 'alertas', r.safety.alerts]);
  rows.push(['seguridad', '', 'sos', r.safety.sos]);
  r.notes.forEach(n => rows.push(['nota', n.date, n.category, n.text]));
  const csv = rows.map(r2 => r2.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  return { __raw: true, contentType: 'text/csv; charset=utf-8', body: '\uFEFF' + csv, filename: `memovida-${p.name.replace(/\s+/g, '-').toLowerCase()}-${r.to}.csv` };
});

router.get('/api/health', async () => ({
  ok: true, app: 'MemoVida', version: '1.0.0',
  users: db.users.length, patients: db.patients.length, time: nowISO()
}), { auth: false });
