/**
 * MemoVida · MODO CUIDADOR
 * Panel, CRUD, alertas en vivo, progreso, diario, informes y zona segura.
 */
import {
  h, frag, mount, clear, toast, modal, confirmDialog, field, textInput, textArea, select,
  avatar, barChart, lineChart, fechaCorta, fechaLarga, hora, desdeIso, edad, esc, announce
} from '../ui.js';
import { api } from '../api.js';
import * as store from '../store.js';
import { crudScreen, buildForm, rowActions, PICTOS } from '../crud.js';
import { renderMain, go } from '../app.js';

const D = () => store.state.data || {};
const P = () => store.patient() || {};
const S = () => D().stats || {};

/* ── Piezas reutilizables ── */
const head = (title, subtitle, actions = null) => h('div', { class: 'care-head' },
  h('div', {}, h('h1', {}, title), subtitle ? h('p', { class: 'muted', style: { margin: '.2rem 0 0' } }, subtitle) : null),
  actions ? h('div', { class: 'btn-row' }, actions) : null
);
const card = (title, body, actions = null) => h('section', { class: 'card' },
  h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, title), actions),
  h('div', { class: 'card-body' }, body)
);
const kpi = (label, value, sub = '', kind = '') => h('div', { class: 'kpi ' + (kind ? 'kpi--' + kind : '') },
  h('div', { class: 'kpi-label' }, label), h('div', { class: 'kpi-value' }, value), sub ? h('div', { class: 'kpi-sub' }, sub) : null
);
const badge = (text, kind = 'soft') => h('span', { class: 'badge badge--' + kind }, text);
const mapLink = (lat, lng, label = 'Ver en el mapa') => h('a', {
  class: 'btn btn--ghost small', target: '_blank', rel: 'noopener noreferrer',
  href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
}, '🗺️ ' + label);

const ALERT_ICON = { sos: '🆘', zona: '📍', dosis: '💊', inactividad: '💤' };
const ALERT_LABEL = { sos: 'Petición de ayuda', zona: 'Fuera de la zona segura', dosis: 'Toma sin confirmar', inactividad: 'Sin actividad' };
const GAME_LABEL = { parejas: 'Parejas', caras: '¿Quién es?', secuencia: 'Secuencia', refranes: 'Refranes', numeros: 'Números', orden: 'Ordena tu día' };
const DIAS_TXT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function estadoTomas() {
  const d = D();
  const hoy = new Date().getDay();
  const ahora = hora();
  const logs = (d.doseLogs || []).filter(l => l.date === d.today);
  return (d.reminders || [])
    .filter(r => r.active && (r.days || []).includes(hoy))
    .flatMap(r => (r.times || []).map(t => {
      const log = logs.find(l => l.reminderId === r.id && l.time === t);
      const estado = log?.status === 'tomada' ? 'tomada' : log?.status === 'omitida' ? 'omitida'
        : log?.status === 'pospuesta' ? 'pospuesta' : t <= ahora ? 'pendiente' : 'programada';
      return { r, t, log, estado };
    })).sort((a, b) => a.t.localeCompare(b.t));
}

const ESTADO_BADGE = {
  tomada: ['Tomada', 'done'], omitida: ['No tomada', 'new'], pospuesta: ['Pospuesta', 'viewed'],
  pendiente: ['Pendiente', 'viewed'], programada: ['Más tarde', 'info']
};

/* ═════════ PANEL ═════════ */
export function panel() {
  const d = D(), p = P(), s = S();
  const tomas = estadoTomas();
  const hechas = tomas.filter(t => t.estado === 'tomada').length;
  const pendientes = tomas.filter(t => t.estado === 'pendiente').length;
  const abiertas = (d.alerts || []).filter(a => a.status !== 'resuelta');
  const loc = s.lastLocation;
  const adherenciaKind = s.adherenceAvg == null ? '' : s.adherenceAvg >= 85 ? 'ok' : s.adherenceAvg >= 60 ? 'warn' : 'bad';
  const nombre = p.preferredName || p.name || '';

  const porJuego = Object.keys(GAME_LABEL).map(g => {
    const rows = (d.games || []).filter(x => x.game === g);
    return { label: GAME_LABEL[g].slice(0, 8), value: rows.length ? Math.round(rows.reduce((a, b) => a + b.score, 0) / rows.length) : null };
  });

  /* Estado general en una frase, lo primero que necesita saber el cuidador */
  const estado = abiertas.length ? 'atencion' : pendientes ? 'pendiente' : 'bien';
  const tituloEstado = estado === 'atencion' ? `${nombre} necesita atención`
    : estado === 'pendiente' ? 'Todo en orden, con tareas pendientes'
      : 'Todo tranquilo por ahora';
  const resumenEstado = estado === 'atencion'
    ? `${abiertas.length} ${abiertas.length === 1 ? 'alerta abierta' : 'alertas abiertas'}${pendientes ? ` y ${pendientes} ${pendientes === 1 ? 'toma pendiente' : 'tomas pendientes'}` : ''}.`
    : estado === 'pendiente'
      ? `${pendientes} ${pendientes === 1 ? 'toma pendiente' : 'tomas pendientes'} hoy. Ninguna alerta abierta.`
      : 'No hay alertas abiertas ni tomas pendientes.';

  const quick = (icon, label, path) => h('button', { class: 'quick-btn', onClick: () => go(path) },
    h('span', { class: 'quick-ic', 'aria-hidden': 'true' }, icon),
    h('span', {}, label)
  );

  return frag(
    head(`Panel de ${nombre}`, `${fechaLarga()} · actualizado a las ${hora()}`, [
      h('button', { class: 'btn', onClick: () => go('#/recordatorios') }, '＋ Recordatorio'),
      h('button', { class: 'btn', onClick: () => go('#/informes') }, '📄 Informe')
    ]),

    h('section', { class: `status-brief status-brief--${estado}` },
      h('div', { class: 'status-ico', 'aria-hidden': 'true' }, estado === 'atencion' ? '🚨' : estado === 'pendiente' ? '⏳' : '✅'),
      h('div', { class: 'status-txt' },
        h('b', {}, tituloEstado),
        h('p', {}, resumenEstado)
      ),
      h('div', { class: 'status-chips' },
        h('span', { class: 'chip' }, `💊 ${hechas}/${tomas.length} tomas`),
        h('span', { class: 'chip' }, `🧠 ${s.gamesCount ?? 0} juegos`),
        h('span', { class: 'chip' }, `✅ ${s.routinePct ?? 0}% rutina`),
        loc ? h('span', { class: 'chip' }, `📍 señal ${hora(new Date(loc.at))}`) : h('span', { class: 'chip chip--muted' }, '📍 sin señal')
      ),
      h('div', { class: 'status-actions' },
        abiertas.length ? h('button', { class: 'btn btn--primary', onClick: () => go('#/alertas') }, 'Ver alertas') : null,
        h('button', { class: 'btn', onClick: () => go('#/panel') }, 'Actualizar')
      )
    ),

    h('div', { class: 'kpis' },
      kpiRich('Adherencia 7 días', s.adherenceAvg == null ? '–' : s.adherenceAvg + '%', 'medicación confirmada', '💊', s.adherenceAvg, adherenciaKind),
      kpiRich('Tomas de hoy', `${hechas}/${tomas.length}`, pendientes ? `${pendientes} pendientes ahora` : 'todo confirmado', '✅', tomas.length ? Math.round(hechas / tomas.length * 100) : 100, pendientes ? 'warn' : 'ok'),
      kpiRich('Ánimo medio', s.moodAvg == null ? '–' : s.moodAvg + '/5', 'últimos 7 días', '🙂', s.moodAvg == null ? null : (s.moodAvg / 5) * 100, ''),
      kpiRich('Rutina de hoy', (s.routinePct ?? 0) + '%', 'pasos completados', '✅', s.routinePct ?? 0, (s.routinePct ?? 0) >= 100 ? 'ok' : '')
    ),

    h('div', { class: 'dash-grid' },
      /* ── Columna principal ── */
      h('div', { class: 'dash-main' },
        card('💊 Avisos de hoy',
          tomas.length ? h('table', { class: 'table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Hora'), h('th', {}, 'Aviso'), h('th', {}, 'Estado'))),
            h('tbody', {}, tomas.map(t => h('tr', {},
              h('td', { class: 'num' }, t.t),
              h('td', {}, h('b', {}, t.r.title), t.r.dose ? h('div', { class: 'muted small' }, t.r.dose) : null),
              h('td', {}, badge(...ESTADO_BADGE[t.estado]))
            )))
          ) : h('p', { class: 'muted' }, 'Hoy no hay avisos programados.'),
          h('button', { class: 'btn btn--ghost small', onClick: () => go('#/recordatorios') }, 'Gestionar avisos')),

        card('📈 Adherencia a la medicación', frag(
          barChart((s.adherence || []).map(a => ({ label: a.weekday, value: a.pct, color: a.pct == null ? undefined : a.pct >= 85 ? 'var(--ok)' : a.pct >= 60 ? 'var(--warn)' : 'var(--danger)' }))),
          h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: 'var(--ok)' } }), '≥85%'), h('span', {}, h('i', { style: { background: 'var(--warn)' } }), '60–84%'), h('span', {}, h('i', { style: { background: 'var(--danger)' } }), '<60%'))
        )),

        card('🧠 Rendimiento por juego', frag(
          barChart(porJuego),
          h('p', { class: 'muted small' }, 'Puntuación media de las sesiones guardadas.'),
          h('button', { class: 'btn small', onClick: () => go('#/progreso') }, 'Ver progreso completo')
        ))
      ),

      /* ── Columna lateral ── */
      h('div', { class: 'dash-side' },
        h('section', { class: 'card quick-card' },
          h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, '⚡ Acciones rápidas')),
          h('div', { class: 'quick-grid' },
            quick('💊', 'Nuevo aviso', '#/recordatorios'),
            quick('👤', 'Añadir persona', '#/personas'),
            quick('✅', 'Editar rutina', '#/rutinas'),
            quick('📝', 'Escribir diario', '#/diario')
          )
        ),

        card('🚨 Alertas recientes',
          abiertas.length
            ? h('div', { class: 'list' }, abiertas.slice(0, 3).map(a => alertItem(a, true)))
            : h('p', { class: 'muted' }, 'No hay alertas abiertas. Todo en orden ✅'),
          h('button', { class: 'btn btn--ghost small', onClick: () => go('#/alertas') }, 'Ver todas')),

        card('🙂 Estado de ánimo', frag(
          lineChart([...(d.moods || [])].slice(0, 7).reverse().map(m => ({ label: fechaCorta(desdeIso(m.date)).slice(0, 6), value: m.value * 20 })), { max: 100 }),
          h('p', { class: 'muted small' }, '1 = muy mal · 5 = muy bien. La gráfica está en escala de 0 a 100.')
        )),

        card('📍 Ubicación y zona segura', frag(
          p.home?.enabled
            ? h('p', {}, `Zona segura activa: ${p.home.label || 'Casa'} · radio de ${p.home.radius} m.`)
            : h('p', { class: 'muted' }, 'La zona segura está desactivada. Actívala en Ajustes.'),
          loc ? frag(
            h('p', {}, `Última señal: ${fechaCorta(new Date(loc.at))} ${hora(new Date(loc.at))} · `,
              loc.inside === null ? badge('sin geocerca', 'info') : loc.inside ? badge('Dentro de la zona', 'done') : badge(`Fuera (${loc.distance} m)`, 'new')),
            mapLink(loc.lat, loc.lng)
          ) : h('p', { class: 'muted' }, 'Sin señales de ubicación todavía. La persona debe activar «compartir ubicación» en su dispositivo.'),
          h('div', { style: { marginTop: '.6rem' } }, h('button', { class: 'btn small', onClick: () => go('#/ajustes') }, '⚙️ Configurar zona'))
        )),

        card('📝 Últimas notas del diario', (d.notes || []).length ? h('div', { class: 'list' }, (d.notes || []).slice(0, 3).map(n =>
          h('div', { class: 'list-item' }, h('div', { class: 'grow' },
            h('b', {}, badge(n.category, 'soft'), ' ', h('span', { class: 'muted small' }, fechaCorta(new Date(n.at)))),
            h('div', {}, n.text.length > 140 ? n.text.slice(0, 140) + '…' : n.text)))
        )) : h('p', { class: 'muted' }, 'Aún no hay notas.'),
          h('button', { class: 'btn btn--ghost small', onClick: () => go('#/diario') }, 'Abrir diario'))
      )
    )
  );
}

/* KPI con icono y barra fina: se lee de un vistazo */
function kpiRich(label, value, sub, icon, pctValue, kind = '') {
  const pct = pctValue == null ? null : Math.max(0, Math.min(100, Math.round(pctValue)));
  return h('div', { class: 'kpi kpi--rich ' + (kind ? 'kpi--' + kind : '') },
    h('div', { class: 'kpi-top' },
      h('span', { class: 'kpi-ico', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'kpi-label' }, label)
    ),
    h('div', { class: 'kpi-value' }, value),
    sub ? h('div', { class: 'kpi-sub' }, sub) : null,
    pct == null ? null : h('div', { class: 'kpi-bar', 'aria-hidden': 'true' },
      h('i', { style: { width: pct + '%' } }))
  );
}

/* ── Tarjeta de alerta ── */
function alertItem(a, compact = false) {
  const when = new Date(a.at);
  const acts = a.status === 'resuelta' ? [] : [
    a.status === 'nueva' ? h('button', {
      class: 'btn small', onClick: async () => {
        try { await api.ackAlert(a.id, 'vista'); toast('Marcada como vista', 'ok'); await store.refresh(); renderMain(); }
        catch (e) { toast(e.message, 'err'); }
      }
    }, '👁️ Vista') : null,
    h('button', {
      class: 'btn btn--primary small', onClick: async () => {
        const input = textArea('', { placeholder: '¿Qué has hecho? (opcional)' });
        modal({
          title: 'Resolver alerta',
          body: frag(h('p', {}, a.message), field('Nota de resolución', input)),
          actions: [{ label: 'Cancelar' }, {
            label: 'Marcar resuelta', kind: 'primary', onClick: async close => {
              try { await api.ackAlert(a.id, 'resuelta', input.value); toast('Alerta resuelta ✅', 'ok'); close(); await store.refresh(); renderMain(); }
              catch (e) { toast(e.message, 'err'); }
            }
          }]
        });
      }
    }, '✅ Resolver')
  ];
  return h('div', { class: 'alert-item ' + a.status },
    h('span', { class: 'ic', 'aria-hidden': 'true' }, ALERT_ICON[a.type] || '🔔'),
    h('div', { class: 'grow' },
      h('b', {}, ALERT_LABEL[a.type] || 'Aviso'),
      h('div', {}, a.message),
      h('div', { class: 'alert-meta' },
        `${fechaCorta(when)} · ${hora(when)}`,
        a.status === 'resuelta' ? ` · resuelta por ${a.resolvedBy || '—'}` : '',
        a.response ? ` · ${a.response}` : ''),
      (a.lat != null && a.lng != null && !compact) ? mapLink(a.lat, a.lng) : null
    ),
    h('div', { class: 'stack', style: { gap: '.3rem', alignItems: 'flex-end' } },
      badge(a.status === 'nueva' ? 'Nueva' : a.status === 'vista' ? 'Vista' : 'Resuelta', a.status === 'nueva' ? 'new' : a.status === 'vista' ? 'viewed' : 'done'),
      ...acts
    )
  );
}

/* ═════════ ALERTAS ═════════ */
export function alertas() {
  let filtro = 'abiertas';
  const wrap = h('div', { class: 'list' });
  const tabs = h('div', { class: 'btn-row' }, [['abiertas', 'Abiertas'], ['todas', 'Todas'], ['resueltas', 'Resueltas']].map(([k, label]) =>
    h('button', {
      class: 'btn', 'aria-pressed': String(k === filtro), onClick: e => {
        filtro = k;
        [...tabs.children].forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget)));
        paint();
      }
    }, label)));

  function paint() {
    const all = D().alerts || [];
    const list = all.filter(a => filtro === 'todas' ? true : filtro === 'abiertas' ? a.status !== 'resuelta' : a.status === 'resuelta');
    mount(wrap, list.length ? list.map(a => alertItem(a)) : h('div', { class: 'empty' }, 'No hay alertas en esta vista.'));
  }
  paint();

  return frag(
    head('🚨 Alertas', 'Avisos de ayuda, salidas de la zona segura y tomas sin confirmar. Se actualizan solos en tiempo real.'),
    h('div', { class: 'toolbar' }, tabs),
    wrap
  );
}

/* ═════════ RECORDATORIOS ═════════ */
export function recordatorios() {
  const screen = crudScreen({
    coll: 'reminders', title: 'Medicación y avisos', icon: '💊',
    subtitle: 'Lo que la persona verá en su pantalla con avisos hablados a su hora.',
    addLabel: 'Nuevo aviso',
    sort: (a, b) => (a.times?.[0] || '').localeCompare(b.times?.[0] || ''),
    fields: [
      { name: 'title', label: 'Título', required: true, placeholder: 'Pastilla de la memoria' },
      { name: 'type', label: 'Tipo', type: 'select', options: [['medicacion', 'Medicación'], ['cita', 'Cita o visita'], ['comida', 'Comida'], ['actividad', 'Actividad'], ['otro', 'Otro']] },
      { name: 'dose', label: 'Dosis o detalle', placeholder: 'Donepezilo 10 mg · 1 comprimido' },
      { name: 'times', label: 'Horas del aviso', type: 'times', hint: 'Puedes poner varias horas al día.' },
      { name: 'days', label: 'Días de la semana', type: 'days' },
      { name: 'icon', label: 'Pictograma', type: 'select', options: PICTOS, default: 'bell' },
      { name: 'notes', label: 'Instrucciones', type: 'textarea', placeholder: 'Tomar con el desayuno y un vaso de agua.' },
      { name: 'active', label: 'Activo', type: 'checkbox', default: true }
    ],
    items: () => D().reminders,
    emptyText: 'Añade el primer aviso: la medicación es lo más importante.',
    renderItem: (r, acts) => h('div', { class: 'list-item' },
      h('span', { class: 'thumb thumb--ph', 'aria-hidden': 'true' }, r.icon || '🔔'),
      h('div', { class: 'grow' },
        h('b', {}, r.title, ' ', r.active ? badge('activo', 'done') : badge('pausado', 'viewed')),
        h('div', { class: 'muted small' }, `${(r.times || []).join(' · ')} · ${(r.days || []).map(x => DIAS_TXT[x]).join('')} · ${r.type}`),
        r.dose ? h('div', { class: 'small' }, r.dose) : null
      ),
      h('button', {
        class: 'btn small', onClick: async () => {
          try { await api.update('reminders', r.id, { ...r, active: !r.active }); await store.refresh(); renderMain(); }
          catch (e) { toast(e.message, 'err'); }
        }
      }, r.active ? '⏸ Pausar' : '▶️ Activar'),
      rowActions(acts)
    )
  });

  const tomas = estadoTomas();
  const logs = (D().doseLogs || []).filter(l => l.date === D().today);
  return frag(screen, h('div', { style: { marginTop: '1.2rem' } },
    card('📋 Registro de hoy', tomas.length ? h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Hora'), h('th', {}, 'Aviso'), h('th', {}, 'Estado'), h('th', {}, 'Confirmado por'))),
      h('tbody', {}, tomas.map(t => h('tr', {},
        h('td', { class: 'num' }, t.t), h('td', {}, t.r.title),
        h('td', {}, badge(...ESTADO_BADGE[t.estado])),
        h('td', { class: 'muted small' }, t.log ? `${t.log.by || '—'} · ${hora(new Date(t.log.at))}` : '—')
      )))
    ) : h('p', { class: 'muted' }, 'Hoy no hay tomas programadas.'))
  ));
}

/* ═════════ RUTINAS ═════════ */
export function rutinas() {
  return crudScreen({
    coll: 'routines', title: 'Rutinas del día', icon: '✅',
    subtitle: 'Descompón el día en pasos sencillos con pictograma. La persona los marca uno a uno.',
    addLabel: 'Nueva rutina',
    fields: [
      { name: 'title', label: 'Título', required: true, placeholder: 'Por la mañana' },
      { name: 'period', label: 'Momento del día', type: 'select', options: [['mañana', 'Mañana'], ['tarde', 'Tarde'], ['noche', 'Noche']] },
      { name: 'steps', label: 'Pasos', type: 'steps', hint: 'Frases cortas, en primera persona: «Lavarme la cara».' }
    ],
    items: () => D().routines,
    renderItem: (r, acts) => {
      const log = (D().routineLogs || []).find(l => l.routineId === r.id);
      const done = (log?.steps || []).length;
      const pct = r.steps.length ? Math.round(done / r.steps.length * 100) : 0;
      return h('div', { class: 'list-item' },
        h('span', { class: 'thumb thumb--ph', 'aria-hidden': 'true' }, { mañana: '🌅', tarde: '🌇', noche: '🌙' }[r.period] || '📋'),
        h('div', { class: 'grow' },
          h('b', {}, r.title),
          h('div', { class: 'muted small' }, `${r.period} · ${r.steps.length} pasos · hoy ${done} hechos`),
          h('div', { class: 'progress', style: { marginTop: '.4rem', maxWidth: '320px' } }, h('div', { class: 'progress-bar', style: { width: pct + '%' } })),
          h('div', { class: 'muted small', style: { marginTop: '.3rem' } }, r.steps.map(s => `${s.icon} ${s.label}`).join(' → '))
        ),
        rowActions(acts)
      );
    }
  });
}

/* ═════════ PERSONAS ═════════ */
export function personas() {
  return crudScreen({
    coll: 'people', title: 'Personas cercanas', icon: '👨‍👩‍👧',
    subtitle: 'Fotos con nombre y parentesco. Se usan también en el juego «¿Quién es?».',
    addLabel: 'Nueva persona',
    fields: [
      { name: 'name', label: 'Nombre', required: true, placeholder: 'Ana' },
      { name: 'relation', label: 'Parentesco', placeholder: 'Tu hija' },
      { name: 'phone', label: 'Teléfono', placeholder: '+34 611 222 333' },
      { name: 'photo', label: 'Foto', type: 'photo' },
      { name: 'description', label: 'Descripción breve', type: 'textarea', placeholder: 'Vive cerca y viene cada tarde a las cinco.' },
      { name: 'memory', label: 'Recuerdo compartido', type: 'textarea', placeholder: 'Le enseñaste a montar en bici.' }
    ],
    items: () => D().people,
    emptyText: 'Añade al menos 3 personas con foto para poder jugar a reconocer caras.',
    renderItem: (p, acts) => h('div', { class: 'list-item' },
      p.photo ? h('img', { class: 'thumb', src: p.photo, alt: '' }) : h('span', { class: 'thumb thumb--ph', 'aria-hidden': 'true' }, '👤'),
      h('div', { class: 'grow' },
        h('b', {}, p.name, ' ', badge(p.relation || 'cercano', 'soft')),
        h('div', { class: 'muted small' }, p.phone || 'sin teléfono'),
        p.description ? h('div', { class: 'small' }, p.description) : null
      ),
      p.photo ? null : badge('sin foto', 'viewed'),
      rowActions(acts)
    )
  });
}

/* ═════════ RECUERDOS ═════════ */
export function recuerdos() {
  return crudScreen({
    coll: 'memories', title: 'Álbum de recuerdos', icon: '📖',
    subtitle: 'Terapia de reminiscencia: historias de su vida ordenadas por año, con foto y narración en voz alta.',
    addLabel: 'Nuevo recuerdo',
    sort: (a, b) => (a.year || 0) - (b.year || 0),
    fields: [
      { name: 'title', label: 'Título', required: true, placeholder: 'Mi boda con Manuel' },
      { name: 'year', label: 'Año', type: 'number', min: 1900, max: 2100 },
      { name: 'place', label: 'Lugar', placeholder: 'Segovia' },
      { name: 'photo', label: 'Foto', type: 'photo' },
      { name: 'description', label: 'La historia', type: 'textarea', placeholder: 'Nos casamos en primavera…' },
      { name: 'tags', label: 'Etiquetas', type: 'tags', hint: 'Separadas por comas: familia, viajes, trabajo…' }
    ],
    items: () => D().memories,
    renderItem: (m, acts) => h('div', { class: 'list-item' },
      m.photo ? h('img', { class: 'thumb', src: m.photo, alt: '' }) : h('span', { class: 'thumb thumb--ph', 'aria-hidden': 'true' }, '📷'),
      h('div', { class: 'grow' },
        h('b', {}, m.year ? `${m.year} · ` : '', m.title),
        h('div', { class: 'muted small' }, [m.place, (m.tags || []).join(', ')].filter(Boolean).join(' · ')),
        h('div', { class: 'small' }, (m.description || '').slice(0, 160) + ((m.description || '').length > 160 ? '…' : ''))
      ),
      rowActions(acts)
    )
  });
}

/* ═════════ PROGRESO COGNITIVO ═════════ */
export function progreso() {
  const games = D().games || [];
  const porJuego = Object.keys(GAME_LABEL).map(g => {
    const rows = games.filter(x => x.game === g);
    return {
      key: g, label: GAME_LABEL[g], sessions: rows.length,
      avg: rows.length ? Math.round(rows.reduce((a, b) => a + b.score, 0) / rows.length) : null,
      best: rows.length ? Math.max(...rows.map(r => r.score)) : null,
      minutes: Math.round(rows.reduce((a, b) => a + (b.durationMs || 0), 0) / 60000)
    };
  });
  const serie = [...games].slice(0, 14).reverse().map((g, i) => ({ label: String(i + 1), value: g.score }));

  return frag(
    head('🧠 Progreso cognitivo', 'Evolución de las sesiones de estimulación. Sirve de apoyo para el seguimiento clínico.'),
    h('div', { class: 'kpis' },
      kpi('Sesiones guardadas', String(games.length)),
      kpi('Puntuación media', games.length ? Math.round(games.reduce((a, b) => a + b.score, 0) / games.length) : '–'),
      kpi('Minutos de ejercicio', String(Math.round(games.reduce((a, b) => a + (b.durationMs || 0), 0) / 60000))),
      kpi('Juegos distintos', String(porJuego.filter(x => x.sessions).length) + ' / 6')
    ),
    h('div', { class: 'grid2' },
      card('📈 Evolución (últimas 14 sesiones)', frag(lineChart(serie), h('p', { class: 'muted small' }, 'Cada punto es una sesión, de la más antigua a la más reciente.'))),
      card('🎯 Media por juego', barChart(porJuego.map(x => ({ label: x.label.slice(0, 8), value: x.avg }))))
    ),
    h('div', { style: { marginTop: '1rem' } },
      card('📊 Detalle por juego', h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Juego'), h('th', { class: 'num' }, 'Sesiones'), h('th', { class: 'num' }, 'Media'), h('th', { class: 'num' }, 'Mejor'), h('th', { class: 'num' }, 'Min'))),
        h('tbody', {}, porJuego.map(x => h('tr', {},
          h('td', {}, x.label), h('td', { class: 'num' }, String(x.sessions)),
          h('td', { class: 'num' }, x.avg ?? '–'), h('td', { class: 'num' }, x.best ?? '–'), h('td', { class: 'num' }, String(x.minutes))
        )))
      ))
    ),
    h('div', { style: { marginTop: '1rem' } },
      card('🕒 Historial', games.length ? h('div', { style: { maxHeight: '340px', overflowY: 'auto' } }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), h('th', {}, 'Juego'), h('th', {}, 'Nivel'), h('th', { class: 'num' }, 'Aciertos'), h('th', { class: 'num' }, 'Puntos'))),
        h('tbody', {}, games.slice(0, 40).map(g => h('tr', {},
          h('td', { class: 'small' }, fechaCorta(desdeIso(g.date))),
          h('td', {}, GAME_LABEL[g.game] || g.game),
          h('td', {}, ['Fácil', 'Medio', 'Difícil'][g.level - 1] || g.level),
          h('td', { class: 'num' }, `${g.correct}/${g.total}`),
          h('td', { class: 'num' }, String(g.score))
        )))
      )) : h('p', { class: 'muted' }, 'Todavía no hay sesiones. La persona puede jugar desde su modo paciente.'))
    )
  );
}

/* ═════════ DIARIO ═════════ */
export function diario() {
  return crudScreen({
    coll: 'notes', title: 'Diario del cuidador', icon: '📝',
    subtitle: 'Observaciones del día a día. Solo las ve el equipo de cuidado, nunca la persona.',
    addLabel: 'Nueva nota',
    sort: (a, b) => (b.at || '').localeCompare(a.at || ''),
    fields: [
      { name: 'category', label: 'Categoría', type: 'select', options: [['conducta', 'Conducta'], ['sueño', 'Sueño'], ['médica', 'Médica'], ['ánimo', 'Ánimo'], ['alimentación', 'Alimentación'], ['otra', 'Otra']] },
      { name: 'text', label: 'Observación', type: 'textarea', required: true, placeholder: 'Al atardecer preguntó varias veces por su madre…' }
    ],
    items: () => D().notes,
    emptyText: 'Escribe la primera observación: ayudará mucho en la próxima consulta médica.',
    renderItem: (n, acts) => h('div', { class: 'list-item' },
      h('span', { class: 'thumb thumb--ph', 'aria-hidden': 'true' }, { conducta: '🧩', sueño: '😴', médica: '⚕️', ánimo: '🙂', alimentación: '🍽️', otra: '📌' }[n.category] || '📌'),
      h('div', { class: 'grow' },
        h('b', {}, badge(n.category, 'soft'), ' ', h('span', { class: 'muted small' }, `${fechaCorta(new Date(n.at))} · ${hora(new Date(n.at))} · ${n.authorName || ''}`)),
        h('div', {}, n.text)
      ),
      rowActions(acts)
    )
  });
}

/* ═════════ INFORMES ═════════ */
export async function informes() {
  const p = P();
  let dias = 7;
  const wrap = h('div', {});
  const rangeSel = select([['7', 'Últimos 7 días'], ['14', 'Últimos 14 días'], ['30', 'Últimos 30 días']], '7', {
    onChange: async e => { dias = Number(e.target.value); await paint(); }
  });
  const csvBtn = h('a', { class: 'btn', href: api.csvUrl(p.id, desde()), download: '' }, '⬇️ Descargar CSV');

  function desde() {
    const d = new Date(); d.setDate(d.getDate() - (dias - 1));
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  async function paint() {
    csvBtn.href = api.csvUrl(p.id, desde());
    mount(wrap, h('p', { class: 'muted' }, 'Generando informe…'));
    let r;
    try { r = await api.weekly(p.id, desde()); }
    catch (e) { mount(wrap, h('div', { class: 'empty' }, e.message)); return; }

    const años = edad(p.birthDate);
    mount(wrap, frag(
      h('div', { class: 'card', style: { marginBottom: '1rem' } }, h('div', { class: 'card-body' },
        h('div', { class: 'between' },
          h('div', {},
            h('h2', { style: { margin: 0 } }, `Informe de seguimiento · ${p.name}`),
            h('p', { class: 'muted', style: { margin: '.2rem 0 0' } },
              `${fechaCorta(desdeIso(r.from))} – ${fechaCorta(desdeIso(r.to))}${años ? ` · ${años} años` : ''} · generado el ${fechaCorta(new Date())}`)
          ),
          h('div', { class: 'print-only' }, 'MemoVida · herramienta de apoyo, no diagnóstica')
        ),
        p.conditions ? h('p', { style: { marginBottom: 0 } }, h('b', {}, 'Diagnóstico: '), p.conditions) : null
      )),
      h('div', { class: 'kpis' },
        kpi('Adherencia', r.medication.adherence == null ? '–' : r.medication.adherence + '%', `${r.medication.taken} de ${r.medication.scheduled} tomas`, r.medication.adherence >= 85 ? 'ok' : r.medication.adherence >= 60 ? 'warn' : 'bad'),
        kpi('Tomas no realizadas', String(r.medication.missed)),
        kpi('Sesiones cognitivas', String(r.cognition.sessions), `${r.cognition.minutes} minutos`),
        kpi('Ánimo medio', r.mood.avg == null ? '–' : r.mood.avg + ' / 5', `${r.mood.entries} registros`),
        kpi('Alertas', String(r.safety.alerts), `${r.safety.sos} SOS · ${r.safety.zone} zona · ${r.safety.missedDose} dosis`)
      ),
      h('div', { class: 'panel-grid' },
        card('💊 Medicación día a día', h('table', { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), h('th', { class: 'num' }, 'Programadas'), h('th', { class: 'num' }, 'Tomadas'), h('th', { class: 'num' }, '%'))),
          h('tbody', {}, r.medication.detail.map(x => h('tr', {},
            h('td', {}, fechaCorta(desdeIso(x.date))), h('td', { class: 'num' }, String(x.due)), h('td', { class: 'num' }, String(x.taken)),
            h('td', { class: 'num' }, x.due ? Math.round(x.taken / x.due * 100) + '%' : '–')
          )))
        )),
        card('🧠 Estimulación cognitiva', r.cognition.byGame.length ? h('table', { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Juego'), h('th', { class: 'num' }, 'Sesiones'), h('th', { class: 'num' }, 'Media'))),
          h('tbody', {}, r.cognition.byGame.map(g => h('tr', {}, h('td', {}, GAME_LABEL[g.game] || g.game), h('td', { class: 'num' }, String(g.sessions)), h('td', { class: 'num' }, g.avgScore ?? '–'))))
        ) : h('p', { class: 'muted' }, 'Sin sesiones en este periodo.')),
        card('🙂 Ánimo', r.mood.detail.length ? frag(
          lineChart(r.mood.detail.map(m => ({ label: fechaCorta(desdeIso(m.date)).slice(0, 6), value: m.value * 20 }))),
          h('ul', {}, r.mood.detail.filter(m => m.note).map(m => h('li', { class: 'small' }, `${fechaCorta(desdeIso(m.date))}: ${m.note}`)))
        ) : h('p', { class: 'muted' }, 'Sin registros de ánimo.')),
        card('📝 Notas del periodo', r.notes.length ? h('div', { class: 'list' }, r.notes.map(n =>
          h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('b', {}, badge(n.category, 'soft'), ' ', h('span', { class: 'muted small' }, n.date)), h('div', {}, n.text)))
        )) : h('p', { class: 'muted' }, 'Sin notas en este periodo.'))
      ),
      h('p', { class: 'muted small', style: { marginTop: '1rem' } },
        'Este informe resume los datos registrados en MemoVida por la persona y su familia. No constituye una valoración clínica ni un diagnóstico.')
    ));
  }

  await paint();
  return frag(
    head('📄 Informes', 'Para llevar a la consulta médica o compartir con la familia.', [
      rangeSel, csvBtn, h('button', { class: 'btn btn--primary', onClick: () => window.print() }, '🖨️ Imprimir / PDF')
    ]),
    wrap
  );
}

/* ═════════ AJUSTES ═════════ */
export function ajustes() {
  const p = P();

  /* Perfil */
  const perfil = buildForm([
    { name: 'name', label: 'Nombre completo', required: true },
    { name: 'preferredName', label: 'Cómo le gusta que la llamen', placeholder: 'Rosa' },
    { name: 'birthDate', label: 'Fecha de nacimiento', type: 'date' },
    { name: 'phone', label: 'Teléfono' },
    { name: 'address', label: 'Dirección' },
    { name: 'bloodType', label: 'Grupo sanguíneo' },
    { name: 'allergies', label: 'Alergias' },
    { name: 'conditions', label: 'Diagnóstico y medicación', type: 'textarea' },
    { name: 'anchorPhrase', label: 'Frase de anclaje', type: 'textarea', hint: 'Se muestra en orientación y se lee en voz alta. Ej.: «Estás en tu casa, en Madrid. Ana viene a las cinco».' },
    { name: 'notes', label: 'Notas para el cuidado', type: 'textarea' },
    { name: 'photo', label: 'Foto', type: 'photo' },
    { name: 'emergencyContacts', label: 'Contactos de emergencia', type: 'contacts' }
  ], p);

  /* Zona segura */
  const homeEnabled = h('input', { type: 'checkbox', checked: !!p.home?.enabled });
  const lat = textInput(p.home?.lat ?? '', { type: 'number', step: '0.000001', placeholder: '40.4168' });
  const lng = textInput(p.home?.lng ?? '', { type: 'number', step: '0.000001', placeholder: '-3.7038' });
  const radius = textInput(p.home?.radius ?? 250, { type: 'number', min: '50', max: '5000', step: '10' });
  const homeLabel = textInput(p.home?.label || 'Casa');
  const grace = textInput(p.settings?.graceMinutes ?? 20, { type: 'number', min: '5', max: '180' });
  const share = h('input', { type: 'checkbox', checked: !!p.settings?.shareLocation });

  const fontScale = select([['1', 'Normal'], ['1.15', 'Grande'], ['1.3', 'Muy grande'], ['1.6', 'Enorme']], String(p.settings?.fontScale ?? 1));
  const voice = h('input', { type: 'checkbox', checked: p.settings?.voice !== false });
  const contrast = h('input', { type: 'checkbox', checked: !!p.settings?.contrast });
  const night = h('input', { type: 'checkbox', checked: !!p.settings?.night });

  async function save(patch, msg) {
    try { await api.updatePatient(p.id, patch); await store.refresh(); toast(msg, 'ok'); renderMain(); }
    catch (e) { toast(e.message, 'err'); }
  }

  const codeBox = h('div', { class: 'row' },
    h('code', { style: { fontSize: '1.4rem', fontWeight: '800', letterSpacing: '.15em' } }, p.code),
    h('button', {
      class: 'btn small', onClick: async () => {
        try { await navigator.clipboard.writeText(p.code); toast('Código copiado', 'ok'); }
        catch { toast('Copia el código a mano: ' + p.code, 'info'); }
      }
    }, '📋 Copiar')
  );

  return frag(
    head('⚙️ Ajustes y zona segura', `Configuración de ${p.name}`),
    h('div', { class: 'panel-grid' },
      card('🧑‍🦳 Perfil y ficha de emergencia', frag(
        perfil.node,
        h('button', { class: 'btn btn--primary', onClick: () => save(perfil.read(), 'Perfil guardado') }, '💾 Guardar perfil')
      )),

      card('📍 Zona segura (geocerca)', frag(
        h('p', { class: 'muted small' }, 'Si la persona sale del radio indicado, recibirás una alerta. Requiere que su dispositivo comparta la ubicación.'),
        h('label', { class: 'checkbox' }, homeEnabled, 'Activar zona segura'),
        field('Nombre del lugar', homeLabel),
        h('div', { class: 'field-row' }, field('Latitud', lat), field('Longitud', lng)),
        field('Radio en metros', radius, 'Entre 50 y 5000 m. 250 m suele ir bien para un barrio.'),
        h('div', { class: 'btn-row' },
          h('button', {
            class: 'btn', onClick: async () => {
              const loc = await store.currentLocation();
              if (!loc) return toast('El navegador no ha dado permiso de ubicación', 'err');
              lat.value = loc.lat.toFixed(6); lng.value = loc.lng.toFixed(6);
              toast('Ubicación actual copiada', 'ok');
            }
          }, '📡 Usar mi ubicación actual'),
          h('button', {
            class: 'btn btn--primary', onClick: () => save({
              home: { enabled: homeEnabled.checked, lat: lat.value === '' ? null : Number(lat.value), lng: lng.value === '' ? null : Number(lng.value), radius: Number(radius.value), label: homeLabel.value }
            }, 'Zona segura guardada')
          }, '💾 Guardar zona')
        ),
        h('div', { class: 'divider' }),
        h('label', { class: 'checkbox' }, share, 'La persona comparte su ubicación (cada 5 min)'),
        h('p', { class: 'muted small' }, 'Se activa en el dispositivo de la persona; el navegador le pedirá permiso.'),
        h('button', { class: 'btn', onClick: () => save({ settings: { shareLocation: share.checked } }, 'Preferencia guardada') }, 'Guardar preferencia'),
        S().lastLocation ? h('div', { style: { marginTop: '.7rem' } }, mapLink(S().lastLocation.lat, S().lastLocation.lng, 'Última posición conocida')) : null
      )),

      card('🔔 Avisos y accesibilidad', frag(
        field('Minutos de gracia antes de alertar', grace, 'Si pasa la hora y no confirma la toma, te avisamos tras estos minutos.'),
        field('Tamaño de letra por defecto', fontScale),
        h('label', { class: 'checkbox' }, voice, 'Leer en voz alta'),
        h('label', { class: 'checkbox' }, contrast, 'Alto contraste'),
        h('label', { class: 'checkbox' }, night, 'Modo noche'),
        h('button', {
          class: 'btn btn--primary', onClick: () => save({
            settings: { graceMinutes: Number(grace.value), fontScale: Number(fontScale.value), voice: voice.checked, contrast: contrast.checked, night: night.checked }
          }, 'Ajustes guardados')
        }, '💾 Guardar ajustes')
      )),

      card('🔗 Vincular a más familiares', frag(
        h('p', {}, 'Comparte este código con otro cuidador. Debe entrar en MemoVida, crear una cuenta de cuidador y pulsar «Vincular».'),
        codeBox,
        h('div', { class: 'divider' }),
        h('b', {}, 'Cuidadores con acceso:'),
        h('ul', {}, (D().caregivers || []).map(c => h('li', {}, `${c.name} · ${c.email}`)))
      ))
    )
  );
}

/* ═════════ PERSONAS A MI CARGO ═════════ */
export function pacientes() {
  const codeInput = textInput('', { placeholder: 'ABC123', maxlength: '8', style: { textTransform: 'uppercase', maxWidth: '180px' } });
  const nameInput = textInput('', { placeholder: 'Nombre y apellidos' });

  async function vincular() {
    try {
      const r = await api.link(codeInput.value.trim().toUpperCase());
      store.state.patients = r.patients;
      await store.selectPatient(r.patient.id);
      toast('Persona vinculada ✅', 'ok');
      renderMain();
      location.hash = '#/panel';
      window.dispatchEvent(new CustomEvent('mv:recargar-carcasa'));
    } catch (e) { toast(e.message, 'err'); }
  }

  async function crear() {
    if (!nameInput.value.trim()) return toast('Escribe un nombre', 'err');
    try {
      const r = await api.createPatient(nameInput.value.trim());
      store.state.patients = [...store.state.patients, r.patient];
      await store.selectPatient(r.patient.id);
      toast('Perfil creado. Añade ahora su medicación y sus personas.', 'ok');
      location.hash = '#/ajustes';
      window.dispatchEvent(new CustomEvent('mv:recargar-carcasa'));
    } catch (e) { toast(e.message, 'err'); }
  }

  const lista = store.state.patients.length ? h('div', { class: 'list' }, store.state.patients.map(p =>
    h('div', { class: 'list-item' },
      p.photo ? h('img', { class: 'thumb', src: p.photo, alt: '' }) : h('span', { class: 'thumb thumb--ph', 'aria-hidden': 'true' }, '🧑‍🦳'),
      h('div', { class: 'grow' },
        h('b', {}, p.name, ' ', p.id === store.state.patientId ? badge('seleccionada', 'done') : null),
        h('div', { class: 'muted small' }, `Código ${p.code}${p.address ? ' · ' + p.address : ''}`)
      ),
      h('button', {
        class: 'btn small', onClick: async () => { await store.selectPatient(p.id); location.hash = '#/panel'; window.dispatchEvent(new CustomEvent('mv:recargar-carcasa')); }
      }, 'Abrir panel'),
      h('button', {
        class: 'icon-btn', title: 'Dejar de seguir', 'aria-label': 'Dejar de seguir a ' + p.name,
        onClick: async () => {
          const ok = await confirmDialog({ title: 'Dejar de seguir', text: `Dejarás de ver los datos de ${p.name}. Sus datos no se borran.`, okLabel: 'Sí, dejar de seguir', danger: true });
          if (!ok) return;
          try {
            const r = await api.unlink(p.id);
            store.state.patients = r.patients;
            store.state.patientId = r.patients[0]?.id || null;
            store.state.data = null;
            if (store.state.patientId) await store.refresh();
            window.dispatchEvent(new CustomEvent('mv:recargar-carcasa'));
            toast('Ya no sigues a esta persona', 'ok');
          } catch (e) { toast(e.message, 'err'); }
        }
      }, '🗑️')
    )
  )) : h('div', { class: 'empty' }, 'Todavía no sigues a nadie. Vincula con un código o crea un perfil nuevo.');

  return frag(
    head('🧑‍🦳 Personas a mi cargo', 'Puedes cuidar a varias personas y cambiar entre ellas desde la barra superior.'),
    h('div', { class: 'panel-grid' },
      card('Mis personas', lista),
      card('🔗 Vincular con un código', frag(
        h('p', { class: 'muted small' }, 'La persona (o su cuidador principal) encuentra el código en Ajustes → «Vincular a más familiares».'),
        h('div', { class: 'row' }, codeInput, h('button', { class: 'btn btn--primary', onClick: vincular }, 'Vincular'))
      )),
      card('＋ Crear un perfil nuevo', frag(
        h('p', { class: 'muted small' }, 'Para una persona que no va a usar la app directamente: tú gestionas todo desde el panel.'),
        h('div', { class: 'row' }, nameInput, h('button', { class: 'btn btn--primary', onClick: crear }, 'Crear perfil'))
      ))
    )
  );
}
