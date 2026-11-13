/**
 * MemoVida · Kit de interfaz accesible
 * h() construye DOM sin innerHTML peligroso, más diálogos con foco atrapado,
 * avisos, lectura en voz alta, gráficas SVG y selector de fotos.
 */

/* ── Preferencias compartidas (las fija store.js) ── */
export const uiPrefs = { voice: true };

/* ── Relojes de las vistas (los limpia el router al cambiar de pantalla) ── */
export const tickers = new Set();
export const disposers = new Set();
export function addTicker(fn) { tickers.add(fn); try { fn(); } catch { /* noop */ } return fn; }
export function onDispose(fn) { disposers.add(fn); return fn; }
export function clearTickers() {
  disposers.forEach(fn => { try { fn(); } catch { /* noop */ } });
  disposers.clear();
  tickers.clear();
}

/* ── Construcción de DOM ── */
import { pictoText, icon, iconNames } from './icons.js';
export { icon, iconNames };

export function append(parent, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false || k === true) continue;
    if (k instanceof Node) { parent.appendChild(k); continue; }
    // Los pictogramas se dibujan como SVG: nunca dependemos de fuentes de emoji
    for (const part of pictoText(String(k))) {
      parent.appendChild(part instanceof Node ? part : document.createTextNode(part));
    }
  }
  return parent;
}

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class' || k === 'className') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (k === 'text') append(el, [v]);
    else if (k === 'html') el.innerHTML = v; // solo SVG/markup generado por la app
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['checked', 'disabled', 'selected', 'multiple', 'readOnly'].includes(k)) el[k] = !!v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  return append(el, kids);
}

export function frag(...kids) { return append(document.createDocumentFragment(), kids); }
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function mount(el, ...kids) { return append(clear(el), kids); }
export function node(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── Anuncios y avisos ── */
export function announce(msg) {
  msg = String(msg ?? '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
  const live = document.getElementById('live');
  if (live) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 60); }
}

export function toast(msg, kind = 'info', ms = 4200) {
  const wrap = document.getElementById('toasts');
  if (!wrap) return;
  const t = h('div', { class: `toast toast--${kind}`, role: kind === 'err' || kind === 'alert' ? 'alert' : 'status' }, msg);
  wrap.appendChild(t);
  announce(msg);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, ms);
  return t;
}

/* ── Voz ── */
let cachedVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  cachedVoice = voices.find(v => /^es(-|_)?/i.test(v.lang)) || voices.find(v => /^es/i.test(v.lang)) || voices[0];
  return cachedVoice;
}
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => { cachedVoice = null; pickVoice(); };
}

const SIN_PICTO = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{25A0}-\u{25FF}]/gu;
export const textoPlano = s => String(s ?? '').replace(SIN_PICTO, '').replace(/\s{2,}/g, ' ').trim();

export function speak(text, { force = false, rate = 0.92 } = {}) {
  text = textoPlano(text);
  if (!('speechSynthesis' in window) || !text) return;
  if (!force && !uiPrefs.voice) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 600));
    const v = cachedVoice || pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang || 'es-ES';
    u.rate = rate; u.pitch = 1; u.volume = 1;
    speechSynthesis.speak(u);
  } catch { /* la voz es opcional */ }
}
export function stopSpeaking() { try { speechSynthesis.cancel(); } catch { /* noop */ } }
export const voiceAvailable = () => 'speechSynthesis' in window;

/* ── Sonidos suaves (Web Audio) ── */
let audioCtx = null;
export function beep(freq = 440, ms = 220, type = 'sine', gain = 0.09) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(gain, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + ms / 1000 + 0.02);
  } catch { /* silencio si no hay audio */ }
}
export function chord() { beep(523, 180); setTimeout(() => beep(659, 180), 130); setTimeout(() => beep(784, 260), 260); }
export function soft() { beep(300, 260, 'triangle', 0.06); }

/* ── Diálogos ── */
let openModals = [];
export function modal({ title, body, actions = [], wide = false, className = '', onClose, dismissable = true }) {
  const host = document.getElementById('modals');
  const prevFocus = document.activeElement;
  const titleId = 'dlg-' + Math.random().toString(36).slice(2, 8);

  const close = () => {
    backdrop.remove();
    openModals = openModals.filter(m => m !== close);
    document.body.style.overflow = openModals.length ? 'hidden' : '';
    if (prevFocus && document.contains(prevFocus)) prevFocus.focus();
    onClose?.();
  };

  const dialog = h('div', {
    class: ['modal', wide && 'modal--wide', className].filter(Boolean).join(' '),
    role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId
  },
    h('div', { class: 'modal-head' },
      h('h2', { id: titleId }, title),
      dismissable && h('button', { class: 'icon-btn', 'aria-label': 'Cerrar', onClick: close }, '✕')
    ),
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-foot' }, actions.map(a =>
      h('button', {
        class: `btn ${a.kind ? 'btn--' + a.kind : ''} ${a.big ? 'btn--xl' : ''}`,
        onClick: () => a.onClick ? a.onClick(close) : close()
      }, a.label))) : null
  );

  const backdrop = h('div', {
    class: 'modal-backdrop',
    onClick: e => { if (e.target === backdrop && dismissable) close(); }
  }, dialog);

  backdrop.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dismissable) { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const list = [...f].filter(x => !x.disabled && x.offsetParent !== null);
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  host.appendChild(backdrop);
  openModals.push(close);
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const target = dialog.querySelector('[data-autofocus]') || dialog.querySelector('input, select, textarea, button');
    target?.focus();
  }, 40);
  return { close, dialog };
}

export function confirmDialog({ title = '¿Estás seguro?', text = '', okLabel = 'Sí, continuar', cancelLabel = 'No, volver', danger = false, big = false }) {
  return new Promise(resolve => {
    let settled = false;
    const done = v => { if (!settled) { settled = true; resolve(v); } };
    const m = modal({
      title,
      body: h('p', { style: { margin: 0, fontSize: big ? '1.25rem' : '1rem' } }, text),
      actions: [
        { label: cancelLabel, big, onClick: close => { done(false); close(); } },
        { label: okLabel, kind: danger ? 'danger' : 'primary', big, onClick: close => { done(true); close(); } }
      ],
      onClose: () => done(false)
    });
    setTimeout(() => m.dialog.querySelector('.modal-foot .btn:last-child')?.focus(), 60);
  });
}

export function closeAllModals() { [...openModals].forEach(c => c()); }

/* ── Fechas y horas en español ── */
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const fechaLarga = (d = new Date()) =>
  cap(d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
export const fechaCorta = (d = new Date()) =>
  d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
export const hora = (d = new Date()) =>
  d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
export const fechaIso = (d = new Date()) => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export function desdeIso(s) { return new Date(s + 'T12:00:00'); }

const UNIDADES = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuna', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
export function numPalabra(n) {
  if (n < 30) return UNIDADES[n];
  const tens = ['treinta', 'cuarenta', 'cincuenta'];
  const t = Math.floor(n / 10) - 3, u = n % 10;
  return tens[t] + (u ? ' y ' + UNIDADES[u] : '');
}
export function parteDelDia(d = new Date()) {
  const h24 = d.getHours();
  if (h24 < 6) return 'la madrugada';
  if (h24 < 13) return 'la mañana';
  if (h24 < 20) return 'la tarde';
  return 'la noche';
}
export function saludo(d = new Date()) {
  const h24 = d.getHours();
  if (h24 < 6) return 'Buenas noches';
  if (h24 < 13) return 'Buenos días';
  if (h24 < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
export function horaEnPalabras(d = new Date()) {
  let hh = d.getHours() % 12; if (hh === 0) hh = 12;
  const mm = d.getMinutes();
  const parte = parteDelDia(d);
  const hTxt = hh === 1 ? 'la una' : 'las ' + numPalabra(hh);
  if (mm === 0) return `${hTxt} en punto de ${parte}`;
  if (mm === 30) return `${hTxt} y media de ${parte}`;
  if (mm === 15) return `${hTxt} y cuarto de ${parte}`;
  return `${hTxt} y ${numPalabra(mm)} de ${parte}`;
}
export function estacion(d = new Date()) {
  const m = d.getMonth(), day = d.getDate();
  const idx = (m * 100 + day);
  if (idx >= 321 && idx <= 620) return 'Primavera';
  if (idx >= 621 && idx <= 922) return 'Verano';
  if (idx >= 923 && idx <= 1220) return 'Otoño';
  return 'Invierno';
}
export const estacionIcono = d => ({ Primavera: '🌸', Verano: '☀️', Otoño: '🍂', Invierno: '❄️' }[estacion(d)]);
export function edad(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate + 'T12:00:00'), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

/* ── Avatares ── */
export function avatar(person, cls = 'person-photo') {
  if (person?.photo) return h('img', { class: cls, src: person.photo, alt: `Foto de ${person.name || ''}`, loading: 'lazy' });
  const initials = String(person?.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return h('div', { class: 'avatar-initials ' + cls, 'aria-hidden': 'true' }, initials);
}

/* ── Gráficas SVG (sin librerías) ── */
export function barChart(items, { height = 150, max = 100, unit = '%', color = 'var(--brand)' } = {}) {
  const w = 460, pad = 26, bw = items.length ? (w - pad * 2) / items.length : 0;
  const bars = items.map((it, i) => {
    const v = it.value == null ? 0 : Math.max(0, Math.min(max, it.value));
    const bh = (height - 42) * (v / max);
    const x = pad + i * bw + bw * 0.16, y = height - 26 - bh;
    return `<g>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.68).toFixed(1)}" height="${Math.max(bh, 1).toFixed(1)}" rx="5" fill="${it.color || color}" opacity="${it.value == null ? .25 : 1}"></rect>
      <text x="${(x + bw * 0.34).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="11" text-anchor="middle" fill="currentColor">${it.value == null ? '–' : esc(it.value) + (unit === '%' ? '' : '')}</text>
      <text x="${(x + bw * 0.34).toFixed(1)}" y="${height - 8}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">${esc(it.label)}</text>
    </g>`;
  }).join('');
  return node(`<svg class="chart" viewBox="0 0 ${w} ${height}" role="img" aria-label="Gráfica de barras: ${esc(items.map(i => `${i.label} ${i.value ?? 'sin datos'}`).join(', '))}">
    <line x1="${pad}" y1="${height - 26}" x2="${w - pad}" y2="${height - 26}" stroke="currentColor" opacity=".25"></line>${bars}</svg>`);
}

export function lineChart(points, { height = 150, max = 100, color = 'var(--accent)' } = {}) {
  const w = 460, pad = 28;
  if (!points.length) return h('p', { class: 'muted small' }, 'Todavía no hay datos.');
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => [pad + i * step, height - 28 - (height - 50) * (Math.max(0, Math.min(max, p.value)) / max)]);
  const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const dots = xy.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}"></circle>
    <text x="${x.toFixed(1)}" y="${height - 8}" font-size="10" text-anchor="middle" fill="currentColor" opacity=".7">${esc(points[i].label)}</text>`).join('');
  return node(`<svg class="chart" viewBox="0 0 ${w} ${height}" role="img" aria-label="Evolución: ${esc(points.map(p => `${p.label} ${p.value}`).join(', '))}">
    <line x1="${pad}" y1="${height - 28}" x2="${w - pad}" y2="${height - 28}" stroke="currentColor" opacity=".25"></line>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"></path>${dots}</svg>`);
}

/* ── Selector de fotos con recorte en el navegador ── */
export function photoPicker(initial = '', { label = 'Foto', onChange } = {}) {
  let value = initial || '';
  const preview = value
    ? h('img', { class: 'photo-preview', src: value, alt: 'Foto seleccionada' })
    : h('div', { class: 'photo-preview thumb--ph', 'aria-hidden': 'true' }, '🖼️');
  const input = h('input', { type: 'file', accept: 'image/*', class: 'input', style: { maxWidth: '230px' } });
  const removeBtn = h('button', { type: 'button', class: 'btn btn--ghost small', onClick: () => { value = ''; setPreview(''); onChange?.(''); } }, 'Quitar foto');

  function setPreview(src) {
    const next = src ? h('img', { class: 'photo-preview', src, alt: 'Foto seleccionada' })
      : h('div', { class: 'photo-preview thumb--ph', 'aria-hidden': 'true' }, '🖼️');
    preview.replaceWith(next);
    previewRef.el = next;
  }
  const previewRef = { el: preview };

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Elige un archivo de imagen', 'err'); return; }
    try {
      value = await resizeImage(file, 720, 0.82);
      const next = h('img', { class: 'photo-preview', src: value, alt: 'Foto seleccionada' });
      previewRef.el.replaceWith(next); previewRef.el = next;
      onChange?.(value);
      toast('Foto lista', 'ok', 2000);
    } catch { toast('No se pudo leer la imagen', 'err'); }
  });

  const wrap = h('div', { class: 'field' },
    h('label', {}, label),
    h('div', { class: 'photo-field' }, preview, h('div', { class: 'stack' }, input, removeBtn)),
    h('span', { class: 'hint' }, 'Se reduce automáticamente para que la app vaya rápida.')
  );
  return { node: wrap, getValue: () => value };
}

export function resizeImage(file, maxSide = 720, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── Campos de formulario declarativos ── */
export function field(label, control, hint) {
  const id = 'f-' + Math.random().toString(36).slice(2, 8);
  if (control instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tagName)) {
    control.id = id;
    if (!control.classList.contains('input') && !control.classList.contains('select') && !control.classList.contains('textarea'))
      control.classList.add(control.tagName === 'SELECT' ? 'select' : control.tagName === 'TEXTAREA' ? 'textarea' : 'input');
  }
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
}

export function textInput(value = '', props = {}) { return h('input', { class: 'input', type: 'text', value, ...props }); }
export function textArea(value = '', props = {}) { return h('textarea', { class: 'textarea', value, ...props }); }
export function select(options, value, props = {}) {
  return h('select', { class: 'select', ...props }, options.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return h('option', { value: v, selected: String(v) === String(value) }, l);
  }));
}
