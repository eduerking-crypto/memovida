/**
 * MemoVida · Aplicación (router + carcasa + comportamientos globales)
 */
import {
  h, mount, clear, toast, speak, stopSpeaking, modal, confirmDialog, announce,
  hora, fechaLarga, fechaCorta, saludo, tickers, clearTickers, beep, closeAllModals
} from './ui.js';
import { api } from './api.js';
import * as store from './store.js';
import { renderAuth } from './views/auth.js';
import * as P from './views/patient.js';
import * as C from './views/caregiver.js';
import * as G from './views/games.js';

const app = document.getElementById('app');

/* ═════════ Rutas ═════════ */
const PATIENT_ROUTES = [
  { path: '#/', title: 'Inicio', view: P.inicio },
  { path: '#/orientacion', title: '¿Qué día es hoy?', view: P.orientacion },
  { path: '#/medicacion', title: 'Mis medicinas y avisos', view: P.medicacion },
  { path: '#/personas', title: '¿Quién es quién?', view: P.personas },
  { path: '#/recuerdos', title: 'Mis recuerdos', view: P.recuerdos },
  { path: '#/rutina', title: 'Mi día', view: P.rutina },
  { path: '#/juegos', title: 'Ejercitar la mente', view: G.hub },
  { path: '#/calma', title: 'Calmarme', view: P.calma },
  { path: '#/animo', title: '¿Cómo me siento?', view: P.animo },
  { path: '#/ficha', title: 'Mi ficha', view: P.ficha },
  { path: '#/ayuda', title: 'Pedir ayuda', view: P.ayuda }
];

const CARE_ROUTES = [
  { path: '#/panel', title: 'Panel de hoy', icon: '📊', view: C.panel },
  { path: '#/alertas', title: 'Alertas', icon: '🚨', view: C.alertas },
  { path: '#/recordatorios', title: 'Medicación y avisos', icon: '💊', view: C.recordatorios },
  { path: '#/rutinas', title: 'Rutinas del día', icon: '✅', view: C.rutinas },
  { path: '#/personas', title: 'Personas cercanas', icon: '👨‍👩‍👧', view: C.personas },
  { path: '#/recuerdos', title: 'Álbum de recuerdos', icon: '📖', view: C.recuerdos },
  { path: '#/progreso', title: 'Progreso cognitivo', icon: '🧠', view: C.progreso },
  { path: '#/diario', title: 'Diario del cuidador', icon: '📝', view: C.diario },
  { path: '#/informes', title: 'Informes', icon: '📄', view: C.informes },
  { path: '#/ajustes', title: 'Ajustes y zona segura', icon: '⚙️', view: C.ajustes },
  { path: '#/pacientes', title: 'Personas a mi cargo', icon: '🧑‍🦳', view: C.pacientes }
];

function resolveRoute() {
  const hash = location.hash || '#/';
  if (store.isPatient()) {
    const game = /^#\/juegos\/([a-z]+)$/.exec(hash);
    if (game) return { title: 'Juego', view: () => G.play(game[1]), path: hash };
    return PATIENT_ROUTES.find(r => r.path === hash) || PATIENT_ROUTES[0];
  }
  return CARE_ROUTES.find(r => r.path === hash) || CARE_ROUTES[0];
}

export function go(path) {
  if (location.hash === path) renderMain();
  else location.hash = path;
}

/* ═════════ Controles de accesibilidad ═════════
   Un solo botón «Aa» abre una hoja con todo explicado en palabras:
   menos iconos sueltos en la barra y menos dudas para la persona. */
const FONT_MIN = 0.85, FONT_MAX = 1.9, FONT_STEP = 0.15;
const pct = s => Math.round((s.fontScale || 1) * 100) + '%';

function a11yButton() {
  const p = store.patient();
  const s = p?.settings || {};
  const activo = s.contrast || s.night || (s.fontScale || 1) !== 1 || s.voice === false;
  return h('button', {
    class: 'icon-btn aa-btn' + (activo ? ' aa-btn--on' : ''),
    title: 'Accesibilidad: voz, tamaño de letra y contraste',
    'aria-label': 'Accesibilidad: voz, tamaño de letra y contraste',
    'aria-haspopup': 'dialog',
    onClick: openA11ySheet
  },
    h('span', { 'aria-hidden': 'true', class: 'aa-glyph' }, 'Aa'),
    h('span', { class: 'sr-only' }, 'Accesibilidad')
  );
}

export function openA11ySheet() {
  const body = h('div', { class: 'a11y-sheet' });

  const paint = () => {
    const p = store.patient();
    const s = p?.settings || {};
    const voz = s.voice !== false;
    const grande = (s.fontScale || 1) > 1;
    const pequena = (s.fontScale || 1) < 1;

    const toggle = (label, detalle, on, onClick) => h('button', {
      class: 'a11y-row', 'aria-pressed': String(!!on), onClick
    },
      h('span', { class: 'a11y-ico', 'aria-hidden': 'true' }, on ? '✅' : '⬜'),
      h('span', { class: 'a11y-txt' }, h('b', {}, label), h('small', {}, detalle)),
      h('span', { class: 'a11y-state' }, on ? 'Sí' : 'No')
    );

    clear(body);
    body.append(
      h('p', { class: 'muted', style: { margin: '0 0 .3rem' } },
        'Puedes cambiar cómo se ve MemoVida. Se guarda para la próxima vez.'),

      h('div', { class: 'a11y-group', role: 'group', 'aria-label': 'Tamaño de letra' },
        h('div', { class: 'between' },
          h('b', { style: { fontSize: '1.1rem' } }, 'Tamaño de la letra'),
          h('span', { class: 'a11y-value' }, pct(s))
        ),
        h('div', { class: 'a11y-size' },
          h('button', {
            class: 'btn btn--lg', 'aria-label': 'Texto más pequeño', disabled: pequena,
            onClick: async () => { await store.savePrefs({ fontScale: Math.max(FONT_MIN, (s.fontScale || 1) - FONT_STEP) }); paint(); }
          }, 'A−', h('span', { class: 'small' }, 'Más pequeño')),
          h('button', {
            class: 'btn btn--lg', 'aria-label': 'Texto normal', disabled: (s.fontScale || 1) === 1,
            onClick: async () => { await store.savePrefs({ fontScale: 1 }); paint(); }
          }, 'Aa', h('span', { class: 'small' }, 'Normal')),
          h('button', {
            class: 'btn btn--lg', 'aria-label': 'Texto más grande', disabled: grande,
            onClick: async () => { await store.savePrefs({ fontScale: Math.min(FONT_MAX, (s.fontScale || 1) + FONT_STEP) }); paint(); }
          }, 'A+', h('span', { class: 'small' }, 'Más grande'))
        )
      ),

      toggle('Leer en voz alta', 'La app te va contando lo que aparece en pantalla.', voz,
        async () => { await store.savePrefs({ voice: !voz }); if (!voz) speak('Voz activada', { force: true }); paint(); }),

      toggle('Letras muy contrastadas', 'Fondo negro y letras claras, más fáciles de ver.', s.contrast,
        async () => { await store.savePrefs({ contrast: !s.contrast }); paint(); }),

      toggle('Modo noche', 'Colores suaves para la tarde y la noche.', s.night,
        async () => { await store.savePrefs({ night: !s.night }); paint(); }),

      h('button', {
        class: 'btn btn--soft btn--block', style: { marginTop: '.4rem' },
        onClick: async () => {
          await store.savePrefs({ fontScale: 1, voice: true, contrast: false, night: false });
          paint(); speak('Todo vuelve a como estaba.', { force: true });
        }
      }, '↺ Volver a los ajustes de siempre')
    );
  };

  paint();
  const m = modal({
    title: 'Accesibilidad',
    body,
    actions: [{ label: 'Listo', kind: 'primary', big: store.isPatient(), onClick: close => close() }]
  });
  speak('Accesibilidad. Aquí puedes cambiar el tamaño de la letra, la voz y los colores.', { force: true });
  return m;
}

async function doLogout() {
  const yes = await confirmDialog({ title: 'Cerrar sesión', text: '¿Quieres salir de MemoVida?', okLabel: 'Sí, salir', big: store.isPatient() });
  if (!yes) return;
  stopSpeaking();
  await store.logout();
  location.hash = '#/';
  renderAuthScreen();
}

/* ═════════ SOS ═════════ */
export async function pedirAyuda() {
  const p = store.patient();
  const caregivers = store.state.data?.caregivers || [];
  const quien = caregivers.length ? caregivers.map(c => c.name.split(' ')[0]).join(' y ') : 'tu familia';
  const yes = await confirmDialog({
    title: '🆘 Pedir ayuda',
    text: `Vamos a avisar a ${quien} de que necesitas ayuda. ¿Quieres enviar el aviso?`,
    okLabel: 'Sí, avisar ahora', cancelLabel: 'No, estoy bien', danger: true, big: true
  });
  if (!yes) return;
  const loc = await store.currentLocation();
  try {
    await api.sos({ patientId: p.id, ...(loc || {}), note: 'Aviso enviado desde el botón de ayuda' });
    speak(`He avisado a ${quien}. Enseguida se pondrán en contacto contigo. Estás a salvo.`, { force: true });
    modal({
      title: '✅ Aviso enviado',
      className: 'reminder-modal',
      body: h('div', { class: 'stack center' },
        h('div', { class: 'big-icon', 'aria-hidden': 'true' }, '🤝'),
        h('p', { class: 'r-title' }, `${quien} ya sabe que necesitas ayuda.`),
        h('p', {}, 'Quédate donde estás, tranquilo. Si puedes, siéntate y respira despacio.'),
        loc ? h('p', { class: 'muted small' }, 'También hemos enviado tu ubicación.') : null
      ),
      actions: [{ label: 'Entendido', kind: 'primary', big: true }]
    });
    await store.refresh();
  } catch (e) { toast(e.message, 'err'); }
}

/* ═════════ Avisos de medicación ═════════ */
const shownReminders = new Map();
export function showReminder(d) {
  const key = `${d.reminderId}:${d.time}`;
  const last = shownReminders.get(key) || 0;
  if (Date.now() - last < 5 * 60000) return;   // no repetimos en 5 minutos
  shownReminders.set(key, Date.now());
  const icon = d.type === 'medicacion' ? '💊' : d.type === 'cita' ? '📅' : '🔔';
  const texto = `Es la hora. ${d.title}. ${d.dose || ''} ${d.notes || ''}`;
  beep(660, 200); setTimeout(() => beep(880, 260), 220);
  speak(texto);

  const p = store.patient();
  const m = modal({
    title: 'Es la hora',
    className: 'reminder-modal',
    dismissable: false,
    body: h('div', { class: 'stack center' },
      h('div', { class: 'big-icon', 'aria-hidden': 'true' }, icon),
      h('p', { class: 'r-title' }, d.title),
      d.dose ? h('p', { class: 'r-dose' }, d.dose) : null,
      h('p', { class: 'muted' }, `Estaba previsto para las ${d.time}.`),
      d.notes ? h('p', {}, d.notes) : null,
      h('button', { class: 'btn btn--ghost', onClick: () => speak(texto, { force: true }) }, '🔊 Repetir en voz alta')
    ),
    actions: [
      {
        label: '⏰ En 10 minutos', big: true, onClick: async close => {
          try { await api.dose({ patientId: p.id, reminderId: d.reminderId, time: d.time, status: 'pospuesta', minutes: 10 }); toast('Te lo recordaré en 10 minutos', 'ok'); }
          catch (e) { toast(e.message, 'err'); }
          close(); store.refresh().then(renderMain).catch(() => {});
        }
      },
      {
        label: '✅ Ya lo he hecho', kind: 'primary', big: true, onClick: async close => {
          try {
            await api.dose({ patientId: p.id, reminderId: d.reminderId, time: d.time, status: 'tomada' });
            speak('Muy bien. Queda anotado.');
            toast('¡Muy bien! Queda anotado ✅', 'ok');
          } catch (e) { toast(e.message, 'err'); }
          close(); store.refresh().then(renderMain).catch(() => {});
        }
      }
    ]
  });
  return m;
}

async function checkDue() {
  if (!store.isPatient() || !store.state.patientId) return;
  try {
    const { due } = await api.due(store.state.patientId);
    if (due.length) showReminder(due[0]);
  } catch { /* sin red */ }
}

/* ═════════ Carcasa ═════════ */
function patientShell() {
  const p = store.patient();
  const pendientes = (store.state.data?.due || []).length;
  const time = h('div', { class: 'clock-time' }, hora());
  const date = h('div', { class: 'clock-date' }, fechaCorta());
  const tick = () => { time.textContent = hora(); date.textContent = fechaCorta(); };
  setInterval(tick, 1000);

  return h('div', { class: 'shell' },
    h('header', { class: 'topbar patient-bar' },
      h('div', { class: 'brand' },
        h('img', { src: 'img/logo.svg', alt: '', width: 38, height: 38 }),
        h('span', { class: 'brand-name' }, 'MemoVida')
      ),
      h('div', { class: 'clock' }, time, date),
      h('div', { class: 'row topbar-actions' },
        a11yButton(),
        h('button', {
          class: 'icon-btn', title: 'Cerrar sesión', 'aria-label': 'Cerrar sesión', onClick: doLogout
        }, h('span', { 'aria-hidden': 'true' }, '🚪'))
      )
    ),
    h('div', { class: 'offline-bar', id: 'offline-bar', hidden: true }, '⚠️ Sin conexión. Mostrando los últimos datos guardados.'),
    h('main', { class: 'patient-main', id: 'main', tabindex: '-1' }),
    h('nav', { class: 'bottombar', 'aria-label': 'Navegación principal' },
      h('button', { class: 'bottom-btn bottom-btn--home', 'data-path': '#/', onClick: () => go('#/') },
        h('span', { class: 'bb-ic', 'aria-hidden': 'true' }, '🏠'), h('span', { class: 'bb-tx' }, 'Inicio')),
      h('button', { class: 'bottom-btn bottom-btn--meds', 'data-path': '#/medicacion', onClick: () => go('#/medicacion') },
        h('span', { class: 'bb-ic', 'aria-hidden': 'true' }, '💊'), h('span', { class: 'bb-tx' }, 'Mis medicinas'),
        pendientes ? h('span', { class: 'bb-badge', 'aria-label': `${pendientes} pendientes` }, String(pendientes)) : null),
      h('button', { class: 'bottom-btn bottom-btn--sos', onClick: pedirAyuda },
        h('span', { class: 'bb-ic', 'aria-hidden': 'true' }, '🆘'), h('span', { class: 'bb-tx' }, 'Pedir ayuda'))
    )
  );
}

const CARE_NAV = [
  {
    label: 'Hoy',
    items: [
      { path: '#/panel', title: 'Panel de hoy', icon: '📊' },
      { path: '#/alertas', title: 'Alertas', icon: '🚨' }
    ]
  },
  {
    label: 'Cuidados',
    items: [
      { path: '#/recordatorios', title: 'Medicación y avisos', icon: '💊' },
      { path: '#/rutinas', title: 'Rutinas del día', icon: '✅' },
      { path: '#/personas', title: 'Personas cercanas', icon: '👨‍👩‍👧' },
      { path: '#/recuerdos', title: 'Álbum de recuerdos', icon: '📖' }
    ]
  },
  {
    label: 'Seguimiento',
    items: [
      { path: '#/progreso', title: 'Progreso cognitivo', icon: '🧠' },
      { path: '#/diario', title: 'Diario del cuidador', icon: '📝' },
      { path: '#/informes', title: 'Informes', icon: '📄' }
    ]
  },
  {
    label: 'Configuración',
    items: [
      { path: '#/ajustes', title: 'Ajustes y zona segura', icon: '⚙️' },
      { path: '#/pacientes', title: 'Personas a mi cargo', icon: '🧑‍🦳' }
    ]
  }
];

function careShell() {
  const route = resolveRoute();
  const openAlerts = store.state.data?.stats?.openAlerts || 0;
  const p = store.patient();

  const groups = CARE_NAV.map(g => h('div', { class: 'care-nav-group' },
    h('div', { class: 'care-nav-label' }, g.label),
    g.items.map(r => h('a', {
      class: 'side-link', href: r.path, 'aria-current': r.path === route.path ? 'page' : undefined
    },
      h('span', { class: 'ic', 'aria-hidden': 'true' }, r.icon),
      h('span', { class: 'side-tx' }, r.title),
      r.path === '#/alertas' && openAlerts ? h('span', { class: 'count' }, String(openAlerts)) : null
    ))
  ));

  const sel = h('select', {
    'aria-label': 'Persona a mi cargo',
    onChange: async e => { await store.selectPatient(e.target.value); renderShell(); }
  }, store.state.patients.map(x => h('option', { value: x.id, selected: x.id === store.state.patientId }, x.name)));

  return h('div', { class: 'care-shell' },
    h('aside', { class: 'sidebar' },
      h('div', { class: 'brand' }, h('img', { src: 'img/logo.svg', alt: '', width: 34, height: 34 }), h('span', {}, 'MemoVida')),

      p ? h('div', { class: 'patient-card' },
        h('div', { class: 'patient-face', 'aria-hidden': 'true' }, (p.preferredName || p.name || '?').slice(0, 1).toUpperCase()),
        h('div', { class: 'patient-meta' },
          h('b', {}, p.preferredName || p.name),
          h('span', {}, `A tu cargo${p.birthDate ? ' · ' + (new Date().getFullYear() - new Date(p.birthDate).getFullYear()) + ' años' : ''}`)
        )
      ) : null,

      h('nav', { 'aria-label': 'Secciones del cuidador', class: 'care-nav' }, groups),

      h('div', { class: 'side-foot' },
        h('div', {}, store.state.user?.name || ''),
        h('div', { class: 'small' }, 'Cuidador/a'),
        h('button', { class: 'side-link', onClick: doLogout }, h('span', { class: 'ic' }, '🚪'), 'Cerrar sesión')
      )
    ),
    h('div', { class: 'care-body' },
      h('header', { class: 'topbar care-topbar' },
        h('div', { class: 'care-topbar-left' },
          store.state.patients.length
            ? h('div', { class: 'patient-select' }, h('span', { 'aria-hidden': 'true' }, '🧑‍🦳'), sel)
            : h('span', { class: 'muted' }, 'Sin personas vinculadas')
        ),
        h('div', { class: 'row topbar-actions' },
          h('button', { class: 'icon-btn', title: 'Actualizar datos', 'aria-label': 'Actualizar datos', onClick: () => store.refresh({ silent: false }).then(renderMain).catch(() => {}) }, '🔄'),
          a11yButton()
        )
      ),
      h('div', { class: 'offline-bar', id: 'offline-bar', hidden: true }, '⚠️ Sin conexión con el servidor.'),
      h('main', { class: 'care-main', id: 'main', tabindex: '-1' })
    )
  );
}

export function renderShell() {
  if (!store.state.user) return renderAuthScreen();
  stopSpeaking();
  document.body.dataset.mode = store.isPatient() ? 'paciente' : 'cuidador';
  store.applyPrefs();
  mount(app, store.isPatient() ? patientShell() : careShell());
  renderMain();
  updateOffline(store.state.offline);
}

export async function renderMain() {
  const main = document.getElementById('main');
  if (!main || !store.state.user) return;
  clearTickers();
  const route = resolveRoute();
  document.title = `${route.title} · MemoVida`;
  mount(main, h('p', { class: 'muted' }, 'Cargando…'));
  try {
    if (!store.state.data && store.state.patientId) await store.refresh();
    const view = await route.view();
    mount(main, view);
    announce(route.title);
    if (store.isPatient() && route.path !== '#/') speak(route.title);
  } catch (e) {
    mount(main, h('div', { class: 'card' }, h('div', { class: 'card-body stack' },
      h('h2', {}, 'No se pudo cargar esta pantalla'),
      h('p', { class: 'muted' }, e.message),
      h('button', { class: 'btn btn--primary', onClick: () => store.refresh({ silent: false }).then(renderMain).catch(() => {}) }, 'Reintentar')
    )));
  }
  main.focus({ preventScroll: true });
  markNav();
  window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
}

/* Marca la pestaña activa de la barra inferior del paciente */
function markNav() {
  const hash = location.hash || '#/';
  document.querySelectorAll('.bottombar .bottom-btn[data-path]').forEach(b => {
    if (b.dataset.path === hash) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

function renderAuthScreen() {
  document.body.dataset.mode = 'login';
  document.body.classList.remove('hc', 'night');
  mount(app, renderAuth(() => {
    location.hash = store.isPatient() ? '#/' : '#/panel';
    renderShell();
    if (store.isPatient()) { store.startLocationSharing(); checkDue(); }
  }));
}

function updateOffline(off) {
  store.state.offline = off;
  const bar = document.getElementById('offline-bar');
  if (bar) bar.hidden = !off;
}

/* ═════════ Eventos globales ═════════ */
let refreshTimer = null;
function scheduleRefresh(rerender = false) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    try { await store.refresh(); if (rerender) renderMain(); else if (!store.isPatient()) renderShell(); }
    catch { /* sin red */ }
  }, 350);
}

function wireEvents() {
  window.addEventListener('hashchange', () => { if (store.state.user) renderMain(); });
  window.addEventListener('mv:offline', e => updateOffline(e.detail));
  window.addEventListener('mv:sesion-caducada', () => {
    if (!store.state.user) return;
    store.logout().then(() => { renderAuthScreen(); toast('Tu sesión ha caducado. Vuelve a entrar.', 'err'); });
  });

  window.addEventListener('mv:alerta', e => {
    const { alert, patientName } = e.detail || {};
    if (!alert) return;
    if (store.isCaregiver()) {
      if (alert.status === 'nueva') {
        beep(880, 180); setTimeout(() => beep(660, 300), 200);
        const t = toast(`🚨 ${patientName || ''}: ${alert.message}`, 'alert', 12000);
        t?.addEventListener('click', () => go('#/alertas'));
        notify(`MemoVida · ${patientName || 'Aviso'}`, alert.message);
      }
      scheduleRefresh(location.hash === '#/alertas' || location.hash === '#/panel' || location.hash === '');
    } else {
      scheduleRefresh(false);
    }
  });

  window.addEventListener('mv:recordatorio', e => {
    const { due } = e.detail || {};
    if (!due) return;
    if (store.isPatient()) showReminder(due);
    else scheduleRefresh(false);
  });

  ['dosis', 'animo', 'juego', 'rutina', 'cambio', 'ubicacion'].forEach(evt =>
    window.addEventListener('mv:' + evt, () => {
      const here = location.hash || '#/';
      const affected = ['#/panel', '#/progreso', '#/alertas', '#/medicacion', '#/rutina', '#/ajustes', '#/'];
      scheduleRefresh(affected.includes(here));
    }));

  window.addEventListener('mv:paciente', () => { store.applyPrefs(); });
  window.addEventListener('mv:recargar-carcasa', () => { if (store.state.user) renderShell(); });

  // Reloj global de las vistas
  setInterval(() => { tickers.forEach(fn => { try { fn(); } catch { tickers.delete(fn); } }); }, 1000);
  // Comprobación de avisos aunque el SSE se caiga
  setInterval(checkDue, 60000);
}

function notify(title, body) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') new Notification(title, { body, icon: 'img/logo.svg' });
    else if (Notification.permission !== 'denied') Notification.requestPermission();
  } catch { /* opcional */ }
}

/* ═════════ Arranque ═════════ */
async function boot() {
  wireEvents();
  const ok = await store.loadSession();
  if (!ok) { renderAuthScreen(); return; }
  try { await store.refresh(); } catch { /* usa caché */ }
  if (!store.state.patientId) {
    document.body.dataset.mode = 'cuidador';
    mount(app, careShell());
    mount(document.getElementById('main'), await C.pacientes());
    store.connectStream();
    return;
  }
  if (!location.hash || (store.isPatient() && !PATIENT_ROUTES.some(r => r.path === location.hash) && !/^#\/juegos\//.test(location.hash))) {
    location.hash = store.isPatient() ? '#/' : '#/panel';
  }
  renderShell();
  store.connectStream();
  if (store.isPatient()) { store.startLocationSharing(); setTimeout(checkDue, 2500); }
  if ('serviceWorker' in navigator && window.self === window.top && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
