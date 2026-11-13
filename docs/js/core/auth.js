/**
 * MemoVida · Autenticación
 * scrypt + salt por usuario, comparación en tiempo constante,
 * sesiones por token de 256 bits con caducidad.
 */
import crypto from '../shims/crypto.js';
import { db, insert, persist, uid, nowISO } from './db.js';

const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const calc = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const known = Buffer.from(hash, 'hex');
  return known.length === calc.length && crypto.timingSafeEqual(known, calc);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  insert('sessions', {
    id: uid('ses'), token, userId,
    expiresAt: Date.now() + SESSION_DAYS * 86400000
  });
  return token;
}

export function destroySession(token) {
  const i = db.sessions.findIndex(s => s.token === token);
  if (i >= 0) { db.sessions.splice(i, 1); persist(); }
}

export function userFromToken(token) {
  if (!token) return null;
  const s = db.sessions.find(x => x.token === token && x.expiresAt > Date.now());
  if (!s) return null;
  return db.users.find(u => u.id === s.userId) || null;
}

export function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

/** Pacientes a los que este usuario tiene acceso. */
export function accessiblePatients(user) {
  if (!user) return [];
  if (user.role === 'paciente') return db.patients.filter(p => p.userId === user.id);
  return db.patients.filter(p => (user.linkedPatientIds || []).includes(p.id));
}

export function canAccess(user, patientId) {
  return accessiblePatients(user).some(p => p.id === patientId);
}

/** El cuidador puede editar; el paciente solo interactúa con su día. */
export function isCaregiver(user) { return user?.role === 'cuidador'; }

export function makeCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += abc[crypto.randomInt(abc.length)];
  return c;
}

export function touchUser(user) {
  user.lastSeen = nowISO();
  persist();
}
