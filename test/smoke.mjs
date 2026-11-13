/**
 * MemoVida · Prueba de humo de extremo a extremo
 * Levanta su propio servidor en un puerto y una base de datos temporales,
 * prueba todos los módulos y comprueba la persistencia tras reiniciar.
 *   node test/smoke.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memovida-test-'));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  \x1b[32m✔\x1b[0m ${name}`); }
  else { fail++; console.log(`  \x1b[31m✘\x1b[0m ${name} ${extra}`); }
};
const section = t => console.log(`\n\x1b[36m${t}\x1b[0m`);

let child = null;
function start() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR }, stdio: ['ignore', 'pipe', 'pipe']
    });
    const t = setTimeout(() => reject(new Error('El servidor no arrancó')), 15000);
    child.stdout.on('data', d => {
      if (String(d).includes('MemoVida está funcionando')) { clearTimeout(t); setTimeout(resolve, 250); }
    });
    child.stderr.on('data', d => process.stderr.write(String(d)));
    child.on('exit', c => { if (c) reject(new Error('servidor salió con código ' + c)); });
  });
}
function stop() {
  return new Promise(resolve => {
    if (!child) return resolve();
    child.on('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(); }, 3000);
  });
}

async function api(method, url, { token, body } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function main() {
  await start();

  section('1 · Salud y autenticación');
  const health = await api('GET', '/api/health');
  ok('GET /api/health responde', health.status === 200 && health.data.ok === true);
  ok('ruta protegida sin token → 401', (await api('GET', '/api/bootstrap')).status === 401);
  ok('contraseña incorrecta → 401', (await api('POST', '/api/auth/login', { body: { email: 'ana@memovida.app', password: 'mal' } })).status === 401);

  const loginAna = await api('POST', '/api/auth/login', { body: { email: 'ana@memovida.app', password: 'ana1234' } });
  ok('login cuidadora (scrypt)', loginAna.status === 200 && !!loginAna.data.token);
  const ana = loginAna.data.token;
  const loginRosa = await api('POST', '/api/auth/login', { body: { email: 'rosa@memovida.app', password: 'rosa1234' } });
  ok('login paciente', loginRosa.status === 200);
  const rosa = loginRosa.data.token;
  const rosaPid = loginRosa.data.patients[0].id;

  const reg = await api('POST', '/api/auth/register', { body: { name: 'Pedro', email: `pedro${Date.now()}@test.app`, password: 'pedro123', role: 'cuidador' } });
  ok('registro de cuidador nuevo', reg.status === 200 && reg.data.user.role === 'cuidador');
  const pedro = reg.data.token;
  ok('registro con correo duplicado → 409', (await api('POST', '/api/auth/register', { body: { name: 'X', email: 'ana@memovida.app', password: 'xxxxxx', role: 'cuidador' } })).status === 409);
  ok('contraseña corta → 400', (await api('POST', '/api/auth/register', { body: { name: 'X', email: 'corto@test.app', password: '123', role: 'cuidador' } })).status === 400);

  section('2 · Bootstrap y permisos');
  const boot = await api('GET', '/api/bootstrap', { token: ana });
  ok('bootstrap trae todos los módulos', ['patient', 'people', 'memories', 'reminders', 'routines', 'doseLogs', 'moods', 'games', 'alerts', 'notes', 'due', 'stats'].every(k => k in boot.data));
  ok('datos demo cargados', boot.data.people.length === 4 && boot.data.memories.length === 6 && boot.data.reminders.length === 6);
  ok('estadísticas de adherencia con 7 días', boot.data.stats.adherence.length === 7);
  const pid = boot.data.patient.id;
  ok('cuidador sin vincular → 403', (await api('GET', `/api/bootstrap?patientId=${pid}`, { token: pedro })).status === 403);
  ok('paciente no puede crear recordatorios → 403', (await api('POST', '/api/reminders', { token: rosa, body: { patientId: pid, title: 'x', times: ['09:00'] } })).status === 403);
  const linked = await api('POST', '/api/patients/link', { token: pedro, body: { code: boot.data.patient.code } });
  ok('vinculación por código', linked.status === 200 && linked.data.patients.length === 1);
  ok('código inexistente → 404', (await api('POST', '/api/patients/link', { token: pedro, body: { code: 'ZZZZZZ' } })).status === 404);
  ok('tras vincular ya tiene acceso', (await api('GET', `/api/bootstrap?patientId=${pid}`, { token: pedro })).status === 200);

  section('3 · CRUD (personas, recuerdos, recordatorios, rutinas, notas)');
  const per = await api('POST', '/api/people', { token: ana, body: { patientId: pid, name: 'Dr. Sanz', relation: 'Neurólogo', phone: '910555111' } });
  ok('crear persona', per.status === 200 && per.data.row.name === 'Dr. Sanz');
  const perId = per.data.row.id;
  ok('editar persona', (await api('PATCH', `/api/people/${perId}`, { token: ana, body: { name: 'Dr. Sanz López', relation: 'Neurólogo', phone: '910555111' } })).data.row.name === 'Dr. Sanz López');
  ok('persona sin nombre → 400', (await api('POST', '/api/people', { token: ana, body: { patientId: pid, name: '' } })).status === 400);
  ok('borrar persona', (await api('DELETE', `/api/people/${perId}`, { token: ana })).status === 200);

  const mem = await api('POST', '/api/memories', { token: ana, body: { patientId: pid, title: 'Verano en el pueblo', year: 1965, description: 'La siega con mis hermanos.' } });
  ok('crear recuerdo', mem.status === 200 && mem.data.row.year === 1965);
  const rem = await api('POST', '/api/reminders', { token: ana, body: { patientId: pid, title: 'Prueba de aviso', type: 'medicacion', dose: '1 mg', times: ['00:05'], days: [0, 1, 2, 3, 4, 5, 6] } });
  ok('crear recordatorio', rem.status === 200 && rem.data.row.times[0] === '00:05');
  ok('recordatorio sin hora → 400', (await api('POST', '/api/reminders', { token: ana, body: { patientId: pid, title: 'mal', times: [] } })).status === 400);
  const remId = rem.data.row.id;
  const rt = await api('POST', '/api/routines', { token: ana, body: { patientId: pid, title: 'Prueba', period: 'tarde', steps: [{ label: 'Paso A', icon: '1️⃣' }, { label: 'Paso B', icon: '2️⃣' }] } });
  ok('crear rutina con pasos', rt.status === 200 && rt.data.row.steps.length === 2);
  const note = await api('POST', '/api/notes', { token: ana, body: { patientId: pid, text: 'Nota de prueba', category: 'conducta' } });
  ok('crear nota del cuidador', note.status === 200 && note.data.row.authorName === 'Ana Martínez');
  ok('paciente no ve las notas privadas', (await api('GET', '/api/bootstrap', { token: rosa })).data.notes.length === 0);

  section('4 · Medicación, rutinas, ánimo y juegos (uso del paciente)');
  const due = await api('GET', '/api/reminders/due', { token: rosa });
  ok('aviso pendiente de las 00:05 aparece', due.status === 200 && due.data.due.some(d => d.reminderId === remId));
  const dose = await api('POST', '/api/doses', { token: rosa, body: { reminderId: remId, time: '00:05', status: 'tomada' } });
  ok('confirmar toma', dose.status === 200 && dose.data.log.status === 'tomada');
  ok('la toma sale de pendientes', !(await api('GET', '/api/reminders/due', { token: rosa })).data.due.some(d => d.reminderId === remId));
  const dose2 = await api('POST', '/api/doses', { token: rosa, body: { reminderId: remId, time: '00:05', status: 'tomada' } });
  ok('confirmar dos veces no duplica el registro', dose2.data.log.id === dose.data.log.id);
  const stepId = rt.data.row.steps[0].id;
  const step = await api('POST', `/api/routines/${rt.data.row.id}/step`, { token: rosa, body: { stepId, done: true } });
  ok('marcar paso de rutina', step.status === 200 && step.data.log.steps.includes(stepId));
  ok('desmarcar paso', !(await api('POST', `/api/routines/${rt.data.row.id}/step`, { token: rosa, body: { stepId, done: false } })).data.log.steps.includes(stepId));
  const mood = await api('POST', '/api/moods', { token: rosa, body: { value: 5, note: 'Muy bien' } });
  ok('registrar ánimo', mood.status === 200 && mood.data.mood.value === 5);
  const mood2 = await api('POST', '/api/moods', { token: rosa, body: { value: 4 } });
  ok('un ánimo por día (se actualiza)', mood2.data.mood.id === mood.data.mood.id);
  const game = await api('POST', '/api/games', { token: rosa, body: { game: 'parejas', level: 2, correct: 7, total: 8, durationMs: 90000 } });
  ok('guardar puntuación de juego', game.status === 200 && game.data.score.score === 88);
  ok('juego inexistente → 400', (await api('POST', '/api/games', { token: rosa, body: { game: 'hack', total: 1 } })).status === 400);

  section('5 · Seguridad: SOS, geocerca y alertas');
  const sos = await api('POST', '/api/alerts/sos', { token: rosa, body: { lat: 40.4168, lng: -3.7038, note: 'No sé dónde estoy' } });
  ok('SOS crea alerta', sos.status === 200 && sos.data.alert.type === 'sos');
  ok('el cuidador ve el SOS', (await api('GET', '/api/bootstrap', { token: ana })).data.alerts.some(a => a.id === sos.data.alert.id));
  const ack = await api('PATCH', `/api/alerts/${sos.data.alert.id}`, { token: ana, body: { status: 'resuelta', response: 'Voy para allá' } });
  ok('atender y resolver alerta', ack.status === 200 && ack.data.alert.status === 'resuelta' && ack.data.alert.resolvedBy === 'Ana Martínez');
  const inside = await api('POST', '/api/locations', { token: rosa, body: { lat: 40.4169, lng: -3.7039, accuracy: 12 } });
  ok('geocerca: dentro de casa', inside.status === 200 && inside.data.location.inside === true, JSON.stringify(inside.data));
  const outside = await api('POST', '/api/locations', { token: rosa, body: { lat: 40.4500, lng: -3.7500, accuracy: 15 } });
  ok('geocerca: fuera de casa', outside.data.location.inside === false && outside.data.location.distance > 300);
  ok('salir de la zona genera alerta', (await api('GET', '/api/bootstrap', { token: ana })).data.alerts.some(a => a.type === 'zona'));
  ok('coordenadas inválidas → 400', (await api('POST', '/api/locations', { token: rosa, body: { lat: 'abc', lng: null } })).status === 400);

  section('6 · Tiempo real (SSE)');
  const sseOk = await new Promise(async resolve => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { ctrl.abort(); resolve(false); }, 6000);
    try {
      const res = await fetch(`${BASE}/api/stream?token=${ana}`, { signal: ctrl.signal });
      const reader = res.body.getReader();
      await reader.read(); // evento "hola"
      setTimeout(() => api('POST', '/api/alerts/sos', { token: rosa, body: { note: 'prueba sse' } }), 200);
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += Buffer.from(value).toString();
        if (buf.includes('event: alerta') && buf.includes('prueba sse')) { clearTimeout(timer); ctrl.abort(); resolve(true); break; }
      }
    } catch { clearTimeout(timer); resolve(false); }
  });
  ok('el SOS llega al cuidador en vivo por SSE', sseOk);

  section('7 · Informes');
  const rep = await api('GET', '/api/reports/weekly', { token: ana });
  ok('informe semanal con datos reales', rep.status === 200 && rep.data.medication.scheduled > 0 && rep.data.days.length === 7);
  ok('informe incluye cognición y ánimo', rep.data.cognition.sessions > 0 && rep.data.mood.entries > 0);
  const csv = await api('GET', '/api/reports/export.csv', { token: ana });
  ok('exportación CSV', csv.status === 200 && String(csv.data).includes('seccion') && csv.headers.get('content-type').includes('text/csv'));
  ok('paciente no puede exportar informes → 403', (await api('GET', '/api/reports/weekly', { token: rosa })).status === 403);

  section('8 · Ajustes y accesibilidad');
  const st = await api('PATCH', `/api/patients/${rosaPid}`, { token: rosa, body: { settings: { fontScale: 1.4, contrast: true, voice: false }, tzOffset: -60 } });
  ok('el paciente ajusta su accesibilidad', st.status === 200 && st.data.patient.settings.fontScale === 1.4 && st.data.patient.tzOffset === -60);
  const geo = await api('PATCH', `/api/patients/${rosaPid}`, { token: ana, body: { home: { enabled: true, lat: 40.42, lng: -3.70, radius: 500, label: 'Casa' } } });
  ok('el cuidador configura la zona segura', geo.status === 200 && geo.data.patient.home.radius === 500);
  ok('el paciente no puede cambiar la geocerca', (await api('PATCH', `/api/patients/${rosaPid}`, { token: rosa, body: { home: { enabled: false, radius: 5000 } } })).data.patient.home.radius === 500);
  ok('validación de foto inválida → 400', (await api('POST', '/api/people', { token: ana, body: { patientId: pid, name: 'X', photo: 'javascript:alert(1)' } })).status === 400);

  section('9 · Persistencia tras reiniciar el servidor');
  await stop();
  await start();
  const me = await api('GET', '/api/auth/me', { token: ana });
  ok('la sesión sobrevive al reinicio', me.status === 200 && me.data.user.email === 'ana@memovida.app');
  const boot2 = await api('GET', '/api/bootstrap', { token: ana });
  ok('los datos creados siguen ahí', boot2.data.memories.some(m => m.title === 'Verano en el pueblo') && boot2.data.reminders.some(r => r.id === remId));
  ok('el historial de tomas se conserva', boot2.data.doseLogs.some(l => l.reminderId === remId && l.status === 'tomada'));
  const logout = await api('POST', '/api/auth/logout', { token: pedro });
  ok('logout invalida el token', logout.status === 200 && (await api('GET', '/api/auth/me', { token: pedro })).status === 401);

  await stop();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`\n${'─'.repeat(46)}`);
  console.log(`  ${pass} pruebas correctas · ${fail} fallidas`);
  console.log('─'.repeat(46));
  process.exit(fail ? 1 : 0);
}

main().catch(async e => { console.error('\n\x1b[31mError en la prueba:\x1b[0m', e.message); await stop(); process.exit(1); });
