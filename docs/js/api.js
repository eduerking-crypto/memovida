/**
 * MemoVida · Cliente de la API
 * Usa URLs relativas: funciona igual en localhost y tras un proxy.
 */
const TOKEN_KEY = 'memovida.token';
let token = localStorage.getItem(TOKEN_KEY) || null;

export function getToken() { return token; }
export function setToken(t) {
  token = t || null;
  if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (e) {
    window.dispatchEvent(new CustomEvent('mv:offline', { detail: true }));
    throw new ApiError('No hay conexión con el servidor. Revisa tu red.', 0);
  }
  window.dispatchEvent(new CustomEvent('mv:offline', { detail: false }));
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent('mv:sesion-caducada'));
    }
    throw new ApiError(data?.error || `Error ${res.status}`, res.status);
  }
  return data;
}

export const api = {
  get: p => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  patch: (p, b) => request('PATCH', p, b ?? {}),
  del: p => request('DELETE', p),

  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  register: payload => request('POST', '/api/auth/register', payload),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/auth/me'),

  bootstrap: pid => request('GET', '/api/bootstrap' + (pid ? `?patientId=${encodeURIComponent(pid)}` : '')),
  updatePatient: (id, patch) => request('PATCH', `/api/patients/${id}`, patch),
  createPatient: name => request('POST', '/api/patients', { name }),
  link: code => request('POST', '/api/patients/link', { code }),
  unlink: id => request('DELETE', `/api/patients/${id}/link`),

  create: (coll, doc) => request('POST', `/api/${coll}`, doc),
  update: (coll, id, doc) => request('PATCH', `/api/${coll}/${id}`, doc),
  remove: (coll, id) => request('DELETE', `/api/${coll}/${id}`),

  due: pid => request('GET', `/api/reminders/due?patientId=${encodeURIComponent(pid)}`),
  dose: payload => request('POST', '/api/doses', payload),
  step: (rid, stepId, done) => request('POST', `/api/routines/${rid}/step`, { stepId, done }),
  resetRoutine: rid => request('POST', `/api/routines/${rid}/reset`),
  mood: (patientId, value, note) => request('POST', '/api/moods', { patientId, value, note }),
  game: payload => request('POST', '/api/games', payload),
  sos: payload => request('POST', '/api/alerts/sos', payload),
  ackAlert: (id, status, response) => request('PATCH', `/api/alerts/${id}`, { status, response }),
  location: payload => request('POST', '/api/locations', payload),
  weekly: (pid, from) => request('GET', `/api/reports/weekly?patientId=${encodeURIComponent(pid)}` + (from ? `&from=${from}` : '')),

  streamUrl: () => `/api/stream?token=${encodeURIComponent(token || '')}`,
  csvUrl: (pid, from) => `/api/reports/export.csv?patientId=${encodeURIComponent(pid)}&token=${encodeURIComponent(token || '')}` + (from ? `&from=${from}` : '')
};
