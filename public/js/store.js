/**
 * MemoVida · Estado global, preferencias de accesibilidad y tiempo real
 */
import { api, getToken, setToken } from './api.js';
import { uiPrefs, toast } from './ui.js';

const PID_KEY = 'memovida.pid';
const cacheKey = pid => 'memovida.cache.' + pid;

export const state = {
  user: null,
  patients: [],
  patientId: null,
  data: null,
  offline: false,
  stream: null,
  lastSync: null
};

export const emit = (name, detail) => window.dispatchEvent(new CustomEvent('mv:' + name, { detail }));
export const on = (name, fn) => window.addEventListener('mv:' + name, e => fn(e.detail));

export function patient() { return state.data?.patient || state.patients.find(p => p.id === state.patientId) || null; }
export const isPatient = () => state.user?.role === 'paciente';
export const isCaregiver = () => state.user?.role === 'cuidador';

/* ── Accesibilidad ── */
export function applyPrefs() {
  const p = patient();
  const s = p?.settings || { fontScale: 1, contrast: false, night: false, voice: true };
  const root = document.documentElement;
  root.classList.toggle('mode-patient', isPatient());
  root.style.setProperty('--scale', String(s.fontScale || 1));
  document.body.classList.toggle('hc', !!s.contrast);
  document.body.classList.toggle('night', !!s.night);
  uiPrefs.voice = s.voice !== false;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', s.contrast ? '#000000' : (s.night ? '#10191c' : '#1f6f5c'));
}

export async function savePrefs(patch) {
  const p = patient();
  if (!p) return;
  const settings = { ...p.settings, ...patch };
  if (state.data) state.data.patient.settings = settings;
  applyPrefs();
  try { await api.updatePatient(p.id, { settings }); }
  catch (e) { toast(e.message, 'err'); }
}

/* ── Sesión ── */
export async function loadSession() {
  if (!getToken()) return false;
  try {
    const { user, patients } = await api.me();
    state.user = user;
    state.patients = patients;
    const saved = localStorage.getItem(PID_KEY);
    state.patientId = patients.some(p => p.id === saved) ? saved : (patients[0]?.id || null);
    return true;
  } catch {
    setToken(null);
    return false;
  }
}

export async function afterLogin(payload) {
  setToken(payload.token);
  state.user = payload.user;
  state.patients = payload.patients || [];
  state.patientId = state.patients[0]?.id || null;
  if (state.patientId) localStorage.setItem(PID_KEY, state.patientId);
  await refresh();
  connectStream();
}

export async function logout() {
  try { await api.logout(); } catch { /* da igual */ }
  setToken(null);
  disconnectStream();
  Object.assign(state, { user: null, patients: [], patientId: null, data: null });
  document.body.dataset.mode = 'login';
  document.documentElement.classList.remove('mode-patient');
}

/* ── Datos ── */
export function readCache(pid) {
  try { return JSON.parse(localStorage.getItem(cacheKey(pid)) || 'null'); } catch { return null; }
}

export async function refresh({ silent = true } = {}) {
  if (!state.patientId) { state.data = null; return null; }
  const cached = readCache(state.patientId);
  if (cached && !state.data) { state.data = cached; applyPrefs(); }
  try {
    const data = await api.bootstrap(state.patientId);
    state.data = data;
    state.lastSync = new Date();
    try { localStorage.setItem(cacheKey(state.patientId), JSON.stringify(data)); } catch { /* cuota llena */ }
    applyPrefs();
    // El navegador del paciente informa de su zona horaria real
    if (isPatient()) {
      const off = -new Date().getTimezoneOffset();
      if (data.patient.tzOffset !== off) {
        api.updatePatient(data.patient.id, { tzOffset: off })
          .then(r => { if (state.data) state.data.patient = r.patient; }).catch(() => {});
      }
    }
    emit('datos', data);
    return data;
  } catch (e) {
    if (!silent) toast(e.message, 'err');
    if (!state.data && cached) { state.data = cached; applyPrefs(); }
    throw e;
  }
}

export async function selectPatient(pid) {
  state.patientId = pid;
  localStorage.setItem(PID_KEY, pid);
  state.data = null;
  await refresh({ silent: false });
  disconnectStream();
  connectStream();
}

/* ── Tiempo real (SSE) ── */
export function connectStream() {
  if (!getToken() || state.stream) return;
  let es;
  try { es = new EventSource(api.streamUrl()); } catch { return; }
  state.stream = es;
  const relay = type => e => {
    let detail = null;
    try { detail = JSON.parse(e.data); } catch { return; }
    emit(type, detail);
  };
  ['alerta', 'recordatorio', 'dosis', 'cambio', 'animo', 'juego', 'ubicacion', 'paciente', 'rutina']
    .forEach(t => es.addEventListener(t, relay(t)));
  es.onerror = () => { /* EventSource reintenta solo */ };
}

export function disconnectStream() {
  try { state.stream?.close(); } catch { /* noop */ }
  state.stream = null;
}

/* ── Geolocalización compartida ── */
export function currentLocation(timeout = 12000) {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    );
  });
}

let geoTimer = null;
export function startLocationSharing() {
  stopLocationSharing();
  const send = async () => {
    const p = patient();
    if (!p || !isPatient() || !p.settings?.shareLocation) return;
    const loc = await currentLocation();
    if (loc) { try { await api.location({ patientId: p.id, ...loc }); } catch { /* sin red */ } }
  };
  send();
  geoTimer = setInterval(send, 5 * 60000);
}
export function stopLocationSharing() { if (geoTimer) clearInterval(geoTimer); geoTimer = null; }
