/**
 * MemoVida · Capa de persistencia
 * Base de datos documental en JSON con escritura atómica (tmp + rename).
 * Cero dependencias. Los datos sobreviven al reinicio del servidor.
 */
import fs from '../shims/fs.js';
import path from '../shims/path.js';
import crypto from '../shims/crypto.js';
import { fileURLToPath } from '../shims/url.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export const COLLECTIONS = [
  'users', 'sessions', 'patients', 'people', 'memories', 'reminders',
  'doseLogs', 'routines', 'routineLogs', 'moods', 'gameScores',
  'alerts', 'locations', 'notes'
];

export const db = {};

function emptyDB() {
  const o = { meta: { version: 1, createdAt: new Date().toISOString() } };
  for (const c of COLLECTIONS) o[c] = [];
  return o;
}

export function loadDB() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let parsed = null;
  if (fs.existsSync(DB_FILE)) {
    try { parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch (e) {
      const backup = DB_FILE + '.corrupto-' + Date.now();
      fs.renameSync(DB_FILE, backup);
      console.error('[db] JSON corrupto, copia en', backup);
    }
  }
  Object.assign(db, emptyDB(), parsed || {});
  for (const c of COLLECTIONS) if (!Array.isArray(db[c])) db[c] = [];
  // Purga de sesiones caducadas
  const now = Date.now();
  db.sessions = db.sessions.filter(s => s.expiresAt > now);
  return db;
}

let flushTimer = null;
export function persist() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 120);
}

export function flush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE); // atómico
}

export function uid(prefix = 'id') {
  return prefix + '_' + crypto.randomBytes(9).toString('hex');
}

export function nowISO() { return new Date().toISOString(); }

export function insert(coll, doc) {
  const row = { id: doc.id || uid(coll.slice(0, 3)), createdAt: nowISO(), ...doc };
  db[coll].push(row);
  persist();
  return row;
}

export function byId(coll, id) { return db[coll].find(r => r.id === id) || null; }

export function where(coll, fn) { return db[coll].filter(fn); }

export function update(coll, id, patch) {
  const row = byId(coll, id);
  if (!row) return null;
  Object.assign(row, patch, { id: row.id, updatedAt: nowISO() });
  persist();
  return row;
}

export function remove(coll, id) {
  const i = db[coll].findIndex(r => r.id === id);
  if (i < 0) return false;
  db[coll].splice(i, 1);
  persist();
  return true;
}

/** Fecha/hora local del paciente (su navegador informa del desplazamiento). */
export function patientNow(patient) {
  const offset = Number.isFinite(patient?.tzOffset) ? patient.tzOffset : 0; // minutos respecto a UTC
  return new Date(Date.now() + offset * 60000);
}
export function localDateStr(d) { return d.toISOString().slice(0, 10); }
export function localTimeStr(d) { return d.toISOString().slice(11, 16); }

/** Distancia Haversine en metros (geocerca). */
export function distanceMeters(a, b) {
  const R = 6371000, toRad = x => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
