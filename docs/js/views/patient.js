/**
 * MemoVida · MODO PACIENTE
 * Ocho acciones máximo por pantalla, botones grandes, voz y feedback amable.
 */
import {
  h, frag, toast, speak, modal, confirmDialog, avatar, addTicker, announce,
  hora, fechaLarga, fechaCorta, horaEnPalabras, parteDelDia, estacion, estacionIcono,
  saludo, edad, desdeIso, chord, soft
} from '../ui.js';
import { api } from '../api.js';
import * as store from '../store.js';
import { go, pedirAyuda, showReminder } from '../app.js';

const D = () => store.state.data || {};
const P = () => store.patient() || {};
const refreshView = () => store.refresh().then(() => import('../app.js').then(m => m.renderMain())).catch(() => {});

/* ── Cabecera de página ── */
function head(title, { lectura = '', extra = null } = {}) {
  return h('div', { class: 'page-head' },
    h('button', { class: 'btn', onClick: () => go('#/'), 'aria-label': 'Volver al inicio' }, '⬅️ Inicio'),
    h('h1', { class: 'page-title' }, title),
    lectura ? h('button', { class: 'btn btn--soft', onClick: () => speak(lectura, { force: true }) }, '🔊 Escuchar') : null,
    extra
  );
}

const MOODS = [
  { v: 1, face: '😢', label: 'Muy mal' },
  { v: 2, face: '🙁', label: 'Regular' },
  { v: 3, face: '😐', label: 'Normal' },
  { v: 4, face: '🙂', label: 'Bien' },
  { v: 5, face: '😄', label: 'Muy bien' }
];

/* ═════════ 1 · INICIO ═════════ */
export function inicio() {
  const p = P(), d = D();
  const nombre = p.preferredName || p.name?.split(' ')[0] || '';
  const pendientes = (d.due || []).length;
  const pct = d.stats?.routinePct ?? 0;
  const moodHoy = (d.moods || []).find(m => m.date === d.today);

  const tile = (icon, label, sub, path, opts = {}) => h('button', {
    class: ['tile', opts.brand && 'tile--brand', opts.alert && 'tile--alert'].filter(Boolean).join(' '),
    onClick: () => { soft(); go(path); }
  },
    h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'tile-label' }, label),
    sub ? h('span', { class: 'tile-sub' }, sub) : null,
    opts.badge ? h('span', { class: 'tile-badge' }, opts.badge) : null
  );

  const proximo = (d.reminders || [])
    .filter(r => r.active && (r.days || []).includes(new Date().getDay()))
    .flatMap(r => r.times.map(t => ({ t, r })))
    .filter(x => x.t > hora())
    .sort((a, b) => a.t.localeCompare(b.t))[0];

  return frag(
    h('p', { class: 'greet' },
      h('span', {}, `${saludo()}, ${nombre} 👋`),
      h('small', {}, `${fechaLarga()} · ${horaEnPalabras()}`)
    ),

    pendientes
      ? h('div', { class: 'card', style: { marginBottom: '1rem', borderColor: 'var(--accent)', borderWidth: '3px' } },
        h('div', { class: 'card-body between' },
          h('div', {},
            h('b', { style: { fontSize: '1.2rem' } }, `🔔 Tienes ${pendientes} ${pendientes === 1 ? 'aviso pendiente' : 'avisos pendientes'}`),
            h('div', { class: 'muted' }, d.due[0].title + ' · ' + d.due[0].time)
          ),
          h('button', { class: 'btn btn--primary btn--lg', onClick: () => showReminder(d.due[0]) }, 'Ver el aviso')
        ))
      : null,

    h('div', { class: 'tiles' },
      tile('🕒', '¿Qué día es?', 'La fecha, la hora y dónde estás', '#/orientacion', { brand: true }),
      tile('💊', 'Mis medicinas', 'Lo que toca hoy', '#/medicacion', { alert: pendientes > 0, badge: pendientes ? `${pendientes} pendiente${pendientes > 1 ? 's' : ''}` : null }),
      tile('👨‍👩‍👧', '¿Quién es quién?', 'Tu familia y tus amigos', '#/personas'),
      tile('📖', 'Mis recuerdos', 'Fotos e historias de tu vida', '#/recuerdos'),
      tile('✅', 'Mi día', pct ? `${pct}% completado` : 'Tu rutina paso a paso', '#/rutina'),
      tile('🧠', 'Ejercitar la mente', 'Seis juegos tranquilos', '#/juegos'),
      tile('🌬️', 'Calmarme', 'Respirar despacio y tranquilo', '#/calma'),
      tile('🙂', '¿Cómo me siento?', moodHoy ? 'Ya lo has contado hoy' : 'Cuéntaselo a tu familia', '#/animo')
    ),

    h('div', { class: 'card', style: { marginTop: '1.2rem' } },
      h('div', { class: 'card-body stack' },
        h('div', { class: 'between' },
          h('b', { style: { fontSize: '1.15rem' } }, '🧭 Para orientarte'),
          h('button', { class: 'btn btn--soft', onClick: () => speak(`${saludo()} ${nombre}. Hoy es ${fechaLarga()}. Son ${horaEnPalabras()}. ${p.anchorPhrase || ''}`, { force: true }) }, '🔊 Escuchar')
        ),
        h('p', { style: { margin: 0, fontSize: '1.15rem' } }, p.anchorPhrase || 'Estás en tu casa. Estás a salvo.'),
        proximo
          ? h('p', { class: 'muted', style: { margin: 0 } }, `🔔 Lo próximo: ${proximo.r.title} a las ${proximo.t}.`)
          : h('p', { class: 'muted', style: { margin: 0 } }, 'No queda ningún aviso para hoy. Puedes descansar.')
      )
    ),

    !moodHoy ? h('div', { class: 'card', style: { marginTop: '1rem' } },
      h('div', { class: 'card-body stack' },
        h('b', { style: { fontSize: '1.15rem' } }, '¿Cómo te sientes ahora mismo?'),
        moodRow(async v => {
          await api.mood(p.id, v, '');
          chord();
          toast('Gracias por contarlo 💚', 'ok');
          speak('Gracias por contarlo. Tu familia lo verá.');
          refreshView();
        })
      )) : null
  );
}

function moodRow(onPick, selected = null) {
  return h('div', { class: 'mood-row', role: 'group', 'aria-label': 'Cómo te sientes' },
    MOODS.map(m => h('button', {
      class: 'mood-btn', 'aria-pressed': String(selected === m.v),
      onClick: () => onPick(m.v)
    }, h('span', { class: 'face', 'aria-hidden': 'true' }, m.face), h('span', { class: 'lbl' }, m.label)))
  );
}

/* ═════════ 2 · ORIENTACIÓN ═════════ */
export function orientacion() {
  const p = P(), d = D();
  const bigTime = h('div', { class: 'orient-time' }, hora());
  const bigDate = h('div', { class: 'orient-date' }, fechaLarga());
  const part = h('div', { class: 'orient-part' }, `Es ${parteDelDia()}`);
  addTicker(() => { bigTime.textContent = hora(); bigDate.textContent = fechaLarga(); part.textContent = `Es ${parteDelDia()}`; });

  const años = edad(p.birthDate);
  const texto = () => `${saludo()}. Hoy es ${fechaLarga()}. Son ${horaEnPalabras()}. ${p.anchorPhrase || ''} ${años ? `Tienes ${años} años.` : ''}`;

  const citasHoy = (d.reminders || []).filter(r => r.active && r.type === 'cita' && (r.days || []).includes(new Date().getDay()));

  return frag(
    head('¿Qué día es hoy?', { lectura: '' , extra: h('button', { class: 'btn btn--soft', onClick: () => speak(texto(), { force: true }) }, '🔊 Escuchar') }),
    h('div', { class: 'orient' },
      h('div', { class: 'orient-hero' }, bigTime, bigDate, part),
      h('div', { class: 'orient-anchor' }, p.anchorPhrase || 'Estás en tu casa. Estás a salvo.'),
      h('div', { class: 'orient-grid' },
        h('div', { class: 'orient-card' }, h('span', { class: 'ic', 'aria-hidden': 'true' }, estacionIcono()), h('div', {}, h('b', {}, estacion()), h('span', {}, 'Estamos en esta estación'))),
        h('div', { class: 'orient-card' }, h('span', { class: 'ic', 'aria-hidden': 'true' }, '🏠'), h('div', {}, h('b', {}, 'Estás en casa'), h('span', {}, p.address || 'Tu casa'))),
        h('div', { class: 'orient-card' }, h('span', { class: 'ic', 'aria-hidden': 'true' }, '🧑‍🦳'), h('div', {}, h('b', {}, `Eres ${p.name}`), h('span', {}, años ? `${años} años` : 'Tu ficha está en «Pedir ayuda»'))),
        h('div', { class: 'orient-card' }, h('span', { class: 'ic', 'aria-hidden': 'true' }, parteDelDia() === 'la noche' ? '🌙' : '☀️'), h('div', {}, h('b', {}, parteDelDia() === 'la noche' ? 'Es de noche' : 'Es de día'), h('span', {}, parteDelDia() === 'la noche' ? 'Puedes descansar' : 'Puedes hacer tus cosas')))
      ),
      citasHoy.length ? h('div', { class: 'card' }, h('div', { class: 'card-body stack' },
        h('b', { style: { fontSize: '1.2rem' } }, '📅 Hoy viene o tienes:'),
        ...citasHoy.map(c => h('p', { style: { margin: 0, fontSize: '1.15rem' } }, `${c.times.join(' y ')} · ${c.title}${c.notes ? ' — ' + c.notes : ''}`))
      )) : null,
      h('div', { class: 'card' }, h('div', { class: 'card-body' },
        h('div', { class: 'between' },
          h('div', {}, h('b', { style: { fontSize: '1.15rem' } }, '¿No te aclaras? No pasa nada.'),
            h('p', { class: 'muted', style: { margin: '.3rem 0 0' } }, 'Respira despacio o pide ayuda. Estamos contigo.')),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn btn--lg', onClick: () => go('#/calma') }, '🌬️ Calmarme'),
            h('button', { class: 'btn btn--danger btn--lg', onClick: pedirAyuda }, '🆘 Pedir ayuda')
          )
        )
      ))
    )
  );
}

/* ═════════ 3 · MEDICACIÓN Y AVISOS ═════════ */
export function medicacion() {
  const p = P(), d = D();
  const hoy = new Date().getDay();
  const ahora = hora();
  const logs = (d.doseLogs || []).filter(l => l.date === d.today);

  const items = (d.reminders || [])
    .filter(r => r.active && (r.days || []).includes(hoy))
    .flatMap(r => (r.times || []).map(t => {
      const log = logs.find(l => l.reminderId === r.id && l.time === t);
      const estado = log?.status === 'tomada' ? 'done'
        : log?.status === 'omitida' ? 'missed'
          : t <= ahora ? 'pending' : 'future';
      return { r, t, log, estado };
    }))
    .sort((a, b) => a.t.localeCompare(b.t));

  const hechas = items.filter(i => i.estado === 'done').length;

  async function marcar(item, status) {
    try {
      await api.dose({ patientId: p.id, reminderId: item.r.id, time: item.t, status, minutes: 10 });
      if (status === 'tomada') { chord(); speak('Muy bien. Queda anotado.'); toast('¡Muy bien! ✅', 'ok'); }
      else if (status === 'pospuesta') { toast('Te avisaré en 10 minutos ⏰', 'ok'); }
      else { toast('De acuerdo, lo anoto para tu familia', 'info'); }
      refreshView();
    } catch (e) { toast(e.message, 'err'); }
  }

  return frag(
    head('Mis medicinas y avisos', {
      extra: h('button', {
        class: 'btn btn--soft',
        onClick: () => speak(items.length
          ? `Hoy tienes ${items.length} avisos. Has hecho ${hechas}. ` + items.map(i => `${i.t}: ${i.r.title}. ${i.estado === 'done' ? 'Ya está hecho' : i.estado === 'pending' ? 'Está pendiente' : 'Todavía no es la hora'}`).join('. ')
          : 'Hoy no tienes avisos.', { force: true })
      }, '🔊 Escuchar')
    }),
    h('div', { class: 'card', style: { marginBottom: '1rem' } },
      h('div', { class: 'card-body' },
        h('div', { class: 'between' },
          h('b', { style: { fontSize: '1.2rem' } }, `Hoy: ${hechas} de ${items.length} hechos`),
          h('span', { class: 'muted' }, fechaLarga())
        ),
        h('div', { class: 'progress', style: { marginTop: '.6rem' }, role: 'progressbar', 'aria-valuenow': String(items.length ? Math.round(hechas / items.length * 100) : 0), 'aria-valuemin': '0', 'aria-valuemax': '100' },
          h('div', { class: 'progress-bar', style: { width: `${items.length ? hechas / items.length * 100 : 0}%` } }))
      )
    ),
    items.length ? h('div', { class: 'stack' }, items.map(item => {
      const icon = item.r.icon || (item.r.type === 'medicacion' ? '💊' : item.r.type === 'cita' ? '📅' : '🔔');
      return h('div', { class: 'dose-card ' + (item.estado === 'future' ? '' : item.estado) },
        h('span', { class: 'dose-icon', 'aria-hidden': 'true' }, icon),
        h('div', { class: 'dose-info' },
          h('div', { class: 'dose-time' }, item.t),
          h('div', { class: 'dose-title' }, item.r.title),
          item.r.dose ? h('div', {}, item.r.dose) : null,
          item.r.notes ? h('div', { class: 'muted small' }, item.r.notes) : null,
          h('div', { class: 'muted small' },
            item.estado === 'done' ? '✅ Hecho' : item.estado === 'missed' ? '❌ Hoy no se tomó' : item.estado === 'pending' ? '⏳ Toca ahora' : '🕒 Más tarde')
        ),
        item.estado === 'done'
          ? h('button', { class: 'btn btn--lg', onClick: () => speak(`${item.r.title}. Ya está hecho hoy.`, { force: true }) }, '🔊 Escuchar')
          : h('div', { class: 'dose-actions' },
            h('button', { class: 'btn btn--primary btn--lg', onClick: () => marcar(item, 'tomada') }, '✅ Ya lo he hecho'),
            item.estado === 'pending' ? h('button', { class: 'btn btn--lg', onClick: () => marcar(item, 'pospuesta') }, '⏰ En 10 min') : null,
            item.estado === 'pending' ? h('button', {
              class: 'btn btn--lg', onClick: async () => {
                const ok = await confirmDialog({ title: 'Hoy no', text: `¿Hoy no vas a hacer «${item.r.title}»? Se lo avisaremos a tu familia.`, okLabel: 'Sí, hoy no', big: true });
                if (ok) marcar(item, 'omitida');
              }
            }, '❌ Hoy no') : null
          )
      );
    })) : h('div', { class: 'empty' }, 'Hoy no tienes ningún aviso. Disfruta del día 🙂')
  );
}

/* ═════════ 4 · PERSONAS ═════════ */
export function personas() {
  const d = D();
  const people = d.people || [];
  const texto = people.map(p => `${p.name} es ${p.relation}. ${p.description || ''}`).join('. ');
  return frag(
    head('¿Quién es quién?', { extra: h('button', { class: 'btn btn--soft', onClick: () => speak(texto || 'Todavía no hay personas guardadas.', { force: true }) }, '🔊 Escuchar') }),
    people.length ? h('div', { class: 'people-grid' }, people.map(per =>
      h('article', { class: 'person' },
        avatar(per),
        h('div', { class: 'person-body' },
          h('h2', { class: 'person-name' }, per.name),
          h('span', { class: 'person-rel' }, per.relation || 'Persona cercana'),
          per.description ? h('p', { class: 'person-desc' }, per.description) : null,
          per.memory ? h('p', { class: 'person-memory' }, '💭 ' + per.memory) : null,
          h('div', { class: 'btn-row', style: { marginTop: '.7rem' } },
            per.phone ? h('a', { class: 'btn btn--primary', href: 'tel:' + per.phone.replace(/\s+/g, '') }, '📞 Llamar') : null,
            h('button', {
              class: 'btn', onClick: () => speak(`${per.name}. ${per.relation || ''}. ${per.description || ''} ${per.memory || ''}`, { force: true })
            }, '🔊 Escuchar')
          )
        )
      )
    )) : h('div', { class: 'empty' }, 'Tu familia todavía no ha añadido fotos. Pídeles que las pongan desde su panel.')
  );
}

/* ═════════ 5 · RECUERDOS ═════════ */
const TAG_ICON = { familia: '👨‍👩‍👧', viajes: '✈️', verano: '🏖️', trabajo: '🏫', mascota: '🐕', fiesta: '🎉' };
export function recuerdos() {
  const mems = D().memories || [];
  return frag(
    head('Mis recuerdos', {
      extra: h('button', { class: 'btn btn--soft', onClick: () => speak(mems.map(m => `${m.year || ''}. ${m.title}. ${m.description}`).join('. ').slice(0, 580) || 'Aún no hay recuerdos.', { force: true }) }, '🔊 Escuchar')
    }),
    mems.length ? h('div', { class: 'mem-grid' }, mems.map(m =>
      h('article', { class: 'mem-card' },
        m.photo ? h('img', { class: 'mem-photo', src: m.photo, alt: m.title, loading: 'lazy' })
          : h('div', { class: 'mem-placeholder', 'aria-hidden': 'true' }, TAG_ICON[(m.tags || [])[0]] || '📷'),
        h('div', { class: 'mem-body' },
          m.year ? h('div', { class: 'mem-year' }, `${m.year}${m.place ? ' · ' + m.place : ''}`) : null,
          h('h2', { class: 'mem-title' }, m.title),
          h('p', { class: 'mem-text' }, m.description),
          h('button', { class: 'btn', style: { marginTop: 'auto' }, onClick: () => speak(`${m.title}. ${m.year ? 'Año ' + m.year + '.' : ''} ${m.description}`, { force: true }) }, '🔊 Escuchar')
        )
      )
    )) : h('div', { class: 'empty' }, 'Todavía no hay recuerdos guardados. Tu familia puede añadirlos desde su panel.')
  );
}

/* ═════════ 6 · MI DÍA (rutinas) ═════════ */
export function rutina() {
  const p = P(), d = D();
  const routines = d.routines || [];
  const logs = d.routineLogs || [];
  const order = { mañana: 0, tarde: 1, noche: 2 };
  const sorted = [...routines].sort((a, b) => (order[a.period] ?? 9) - (order[b.period] ?? 9));

  async function toggle(r, step, done) {
    try {
      await api.step(r.id, step.id, done);
      if (done) { soft(); speak(step.label + '. Hecho.'); }
      const data = await store.refresh();
      const cont = document.getElementById('routine-' + r.id);
      if (cont) cont.replaceWith(routineCard(data.routines.find(x => x.id === r.id), data.routineLogs));
    } catch (e) { toast(e.message, 'err'); }
  }

  function routineCard(r, currentLogs) {
    const log = (currentLogs || []).find(l => l.routineId === r.id);
    const done = new Set(log?.steps || []);
    const pct = r.steps.length ? Math.round(done.size / r.steps.length * 100) : 0;
    const icon = { mañana: '🌅', tarde: '🌇', noche: '🌙' }[r.period] || '📋';
    return h('section', { class: 'card routine', id: 'routine-' + r.id },
      h('div', { class: 'routine-head' },
        h('h3', {}, `${icon} ${r.title}`),
        h('div', { class: 'row' },
          h('b', {}, `${done.size} / ${r.steps.length}`),
          h('button', { class: 'btn', onClick: () => speak(`${r.title}. ` + r.steps.map((s, i) => `Paso ${i + 1}: ${s.label}. ${done.has(s.id) ? 'Hecho' : 'Pendiente'}`).join('. '), { force: true }) }, '🔊'),
          done.size ? h('button', {
            class: 'btn', onClick: async () => {
              if (await confirmDialog({ title: 'Empezar otra vez', text: '¿Quieres desmarcar todos los pasos?', okLabel: 'Sí, empezar', big: true })) {
                await api.resetRoutine(r.id); refreshView();
              }
            }
          }, '↺') : null
        )
      ),
      h('div', { class: 'progress', style: { margin: '.8rem 1rem 0' }, role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': `Progreso de ${r.title}` },
        h('div', { class: 'progress-bar', style: { width: pct + '%' } })),
      h('ul', { class: 'steps' }, r.steps.map(s => h('li', {},
        h('button', {
          class: 'step', 'aria-pressed': String(done.has(s.id)),
          onClick: () => toggle(r, s, !done.has(s.id))
        },
          h('span', { class: 'step-check', 'aria-hidden': 'true' }, done.has(s.id) ? '✅' : '⬜'),
          h('span', { class: 'step-icon', 'aria-hidden': 'true' }, s.icon || '✅'),
          h('span', { class: 'step-label' }, s.label)
        )
      ))),
      pct === 100 ? h('p', { class: 'center', style: { padding: '0 1rem 1rem', fontWeight: '800' } }, '🎉 ¡Has terminado esta rutina! Muy bien.') : null
    );
  }

  return frag(
    head('Mi día', { extra: h('button', { class: 'btn btn--soft', onClick: () => speak('Vamos a hacer tu día paso a paso. Marca cada cosa cuando la termines.', { force: true }) }, '🔊 Escuchar') }),
    sorted.length ? frag(...sorted.map(r => routineCard(r, logs)))
      : h('div', { class: 'empty' }, 'Tu familia todavía no ha creado tu rutina del día.')
  );
}

/* ═════════ 7 · CALMARME ═════════ */
export function calma() {
  const p = P();
  let running = false, startAt = 0, lastPhase = '';
  const circle = h('div', { class: 'breath-circle' }, h('span', {}, '🌬️'));
  const label = h('div', { class: 'breath-text' }, 'Pulsa «Empezar» cuando quieras');
  const counter = h('p', { class: 'muted', style: { margin: 0 } }, 'Respirar despacio ayuda a estar tranquilo.');
  const btn = h('button', { class: 'btn btn--primary btn--xl' }, '▶️ Empezar a respirar');

  // 4 s inhalar · 4 s sostener · 6 s exhalar
  addTicker(() => {
    if (!running) return;
    const t = ((Date.now() - startAt) / 1000) % 14;
    const cycle = Math.floor((Date.now() - startAt) / 14000) + 1;
    let phase, txt, cls;
    if (t < 4) { phase = 'in'; txt = 'Toma aire por la nariz…'; cls = 'in'; }
    else if (t < 8) { phase = 'hold'; txt = 'Aguanta un momento…'; cls = 'in'; }
    else { phase = 'out'; txt = 'Suelta el aire despacio…'; cls = 'out'; }
    circle.className = 'breath-circle ' + cls;
    label.textContent = txt;
    counter.textContent = `Respiración número ${cycle}`;
    if (phase !== lastPhase) {
      lastPhase = phase;
      speak(txt, { force: true, rate: 0.8 });
      if (phase === 'in') soft();
    }
  });

  btn.addEventListener('click', () => {
    running = !running;
    if (running) { startAt = Date.now(); lastPhase = ''; btn.textContent = '⏹️ Parar'; }
    else { btn.textContent = '▶️ Empezar a respirar'; circle.className = 'breath-circle'; label.textContent = 'Muy bien. Has respirado un rato.'; speak('Muy bien. Has respirado un rato. ¿Te encuentras mejor?', { force: true }); }
  });

  const frases = [
    ['🏠', 'Estás en tu casa. Estás a salvo.'],
    ['💚', 'Tu familia te quiere y viene a verte.'],
    ['🕰️', 'No hay prisa. Puedes ir despacio.'],
    ['🎵', 'Recuerda una canción que te gustaba. Tararéala bajito.']
  ];

  return frag(
    head('Calmarme', { extra: h('button', { class: 'btn btn--soft', onClick: () => speak('Vamos a respirar despacio juntos. No hay prisa. Estás a salvo.', { force: true }) }, '🔊 Escuchar') }),
    h('div', { class: 'card' }, h('div', { class: 'breath' }, circle, label, counter, btn)),
    h('div', { class: 'grid2', style: { marginTop: '1rem' } },
      frases.map(([ic, txt]) => h('div', { class: 'orient-card' },
        h('span', { class: 'ic', 'aria-hidden': 'true' }, ic),
        h('div', {}, h('b', { style: { fontSize: '1.1rem' } }, txt),
          h('button', { class: 'btn btn--ghost small', onClick: () => speak(txt, { force: true }) }, '🔊 Escuchar'))
      ))
    ),
    h('div', { class: 'card', style: { marginTop: '1rem' } }, h('div', { class: 'card-body between' },
      h('b', { style: { fontSize: '1.15rem' } }, '¿Sigues necesitando ayuda?'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--lg', onClick: () => go('#/recuerdos') }, '📖 Ver mis recuerdos'),
        h('button', { class: 'btn btn--danger btn--lg', onClick: pedirAyuda }, '🆘 Pedir ayuda')
      )
    ))
  );
}

/* ═════════ 8 · ÁNIMO ═════════ */
export function animo() {
  const p = P(), d = D();
  const hoy = (d.moods || []).find(m => m.date === d.today);
  const nota = h('textarea', { class: 'textarea', placeholder: 'Si quieres, cuenta por qué (opcional)', value: hoy?.note || '' });

  async function guardar(v) {
    try {
      await api.mood(p.id, v, nota.value.trim());
      chord();
      const m = MOODS.find(x => x.v === v);
      speak(`Has dicho que te sientes ${m.label}. Gracias por contarlo.`);
      toast('Guardado 💚 Tu familia lo verá', 'ok');
      refreshView();
    } catch (e) { toast(e.message, 'err'); }
  }

  const historial = (d.moods || []).slice(0, 7);
  return frag(
    head('¿Cómo me siento?', { extra: h('button', { class: 'btn btn--soft', onClick: () => speak('¿Cómo te sientes hoy? Pulsa la cara que mejor te represente.', { force: true }) }, '🔊 Escuchar') }),
    h('div', { class: 'card' }, h('div', { class: 'card-body stack' },
      h('b', { style: { fontSize: '1.25rem' } }, 'Hoy me siento…'),
      moodRow(guardar, hoy?.value),
      nota,
      h('button', { class: 'btn btn--primary btn--lg', onClick: () => guardar(hoy?.value || 3) }, '💾 Guardar cómo me siento')
    )),
    historial.length ? h('div', { class: 'card', style: { marginTop: '1rem' } },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, '📅 Los últimos días')),
      h('div', { class: 'card-body' }, h('div', { class: 'grid3' },
        historial.map(m => h('div', { class: 'orient-card' },
          h('span', { class: 'ic', 'aria-hidden': 'true' }, MOODS.find(x => x.v === m.value)?.face || '😐'),
          h('div', {}, h('b', {}, fechaCorta(desdeIso(m.date))), h('span', {}, MOODS.find(x => x.v === m.value)?.label || ''))
        ))
      ))
    ) : null
  );
}

/* ═════════ FICHA (dentro de Ayuda) ═════════ */
export function ficha() {
  const p = P();
  const años = edad(p.birthDate);
  const row = (k, v) => v ? h('div', { class: 'ficha-row' }, h('b', {}, k), h('span', {}, v)) : null;
  return frag(
    head('Mi ficha', {
      extra: h('button', { class: 'btn btn--soft no-print', onClick: () => window.print() }, '🖨️ Imprimir')
    }),
    h('div', { class: 'ficha' },
      h('div', { class: 'ficha-top' },
        p.photo ? h('img', { class: 'ficha-photo', src: p.photo, alt: p.name }) : avatar(p, 'ficha-photo'),
        h('div', {},
          h('h2', { style: { margin: 0, fontSize: '1.6rem' } }, p.name),
          años ? h('p', { style: { margin: '.2rem 0' } }, `${años} años · nacido el ${fechaCorta(desdeIso(p.birthDate))}`) : null,
          h('p', { class: 'muted', style: { margin: 0 } }, 'Ficha de identidad y emergencias · MemoVida')
        )
      ),
      h('div', { style: { marginTop: '1rem' } },
        row('Dirección', p.address),
        row('Teléfono', p.phone),
        row('Grupo sanguíneo', p.bloodType),
        row('Alergias', p.allergies),
        row('Diagnóstico / medicación', p.conditions),
        row('Notas importantes', p.notes)
      ),
      h('h3', {}, '📞 Contactos de emergencia'),
      ...(p.emergencyContacts || []).map(c => h('div', { class: 'help-item', style: { marginBottom: '.6rem' } },
        h('span', { class: 'ic', 'aria-hidden': 'true' }, '👤'),
        h('div', { style: { flex: 1 } }, h('b', {}, c.name), h('div', { class: 'muted' }, `${c.relation || ''} · ${c.phone}`)),
        h('a', { class: 'btn btn--primary no-print', href: 'tel:' + String(c.phone).replace(/\s+/g, '') }, '📞 Llamar')
      )),
      h('p', { class: 'muted small', style: { marginTop: '1rem' } }, `Código para la familia: ${p.code}`)
    )
  );
}

/* ═════════ AYUDA ═════════ */
export function ayuda() {
  const p = P();
  const contactos = p.emergencyContacts || [];
  return frag(
    head('Pedir ayuda'),
    h('div', { class: 'card', style: { borderColor: 'var(--danger)', borderWidth: '3px' } },
      h('div', { class: 'card-body stack center' },
        h('div', { style: { fontSize: '3.4rem' }, 'aria-hidden': 'true' }, '🆘'),
        h('b', { style: { fontSize: '1.4rem' } }, 'Si necesitas ayuda, pulsa el botón rojo.'),
        h('p', { class: 'muted', style: { margin: 0 } }, 'Avisaremos a tu familia en el momento, con tu ubicación.'),
        h('button', { class: 'btn btn--danger btn--xl btn--block', onClick: pedirAyuda }, '🆘 Avisar a mi familia')
      )
    ),
    h('h2', { style: { marginTop: '1.4rem' } }, '📞 Llamar por teléfono'),
    h('div', { class: 'stack' },
      contactos.length ? contactos.map(c => h('div', { class: 'help-item' },
        h('span', { class: 'ic', 'aria-hidden': 'true' }, '👤'),
        h('div', { style: { flex: 1 } }, h('b', { style: { fontSize: '1.2rem' } }, c.name), h('div', { class: 'muted' }, `${c.relation || ''} · ${c.phone}`)),
        h('a', { class: 'btn btn--primary btn--lg', href: 'tel:' + String(c.phone).replace(/\s+/g, '') }, '📞 Llamar')
      )) : h('div', { class: 'empty' }, 'Tu familia aún no ha añadido teléfonos de contacto.'),
      h('div', { class: 'help-item' },
        h('span', { class: 'ic', 'aria-hidden': 'true' }, '🚑'),
        h('div', { style: { flex: 1 } }, h('b', { style: { fontSize: '1.2rem' } }, 'Emergencias'), h('div', { class: 'muted' }, 'Policía, ambulancia y bomberos')),
        h('a', { class: 'btn btn--danger btn--lg', href: 'tel:112' }, '📞 112')
      )
    ),
    h('div', { class: 'btn-row', style: { marginTop: '1.2rem' } },
      h('button', { class: 'btn btn--lg', onClick: () => go('#/ficha') }, '🪪 Ver mi ficha'),
      h('button', { class: 'btn btn--lg', onClick: () => go('#/calma') }, '🌬️ Calmarme')
    )
  );
}
