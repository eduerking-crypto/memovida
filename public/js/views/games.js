/**
 * MemoVida · Estimulación cognitiva: 6 juegos adaptativos
 * Principio de aprendizaje sin error: nunca se dice "mal", se muestra
 * la respuesta correcta y se puede reintentar. Sin límite de tiempo.
 */
import {
  h, frag, clear, mount, toast, speak, modal, avatar, onDispose,
  beep, chord, soft, addTicker
} from '../ui.js';
import { api } from '../api.js';
import * as store from '../store.js';
import { go } from '../app.js';

const D = () => store.state.data || {};
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = (a, n) => shuffle(a).slice(0, n);
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const GAME_META = {
  parejas: { icon: '🃏', title: 'Parejas', desc: 'Encuentra las dos cartas iguales.', skill: 'Memoria visual' },
  caras: { icon: '👨‍👩‍👧', title: '¿Quién es?', desc: 'Reconoce a tu familia por su foto.', skill: 'Reconocimiento' },
  secuencia: { icon: '🎵', title: 'Colores y sonidos', desc: 'Repite la secuencia que se ilumina.', skill: 'Atención' },
  refranes: { icon: '💬', title: 'Completar refranes', desc: 'Termina el dicho de siempre.', skill: 'Lenguaje' },
  numeros: { icon: '🔢', title: 'Números', desc: 'Cuenta y resuelve cuentas sencillas.', skill: 'Cálculo' },
  orden: { icon: '📋', title: 'Ordena tu día', desc: 'Pon los pasos en el orden correcto.', skill: 'Planificación' }
};

/* ═════════ Hub ═════════ */
export function hub() {
  const scores = D().games || [];
  return frag(
    h('div', { class: 'page-head' },
      h('button', { class: 'btn btn--ghost page-back', onClick: () => go('#/'), 'aria-label': 'Volver al inicio' },
        h('span', { 'aria-hidden': 'true' }, '←'), h('span', {}, 'Inicio')),
      h('h1', { class: 'page-title' }, 'Ejercitar la mente'),
      h('div', { class: 'page-head-actions' },
        h('button', { class: 'btn btn--soft', onClick: () => speak('Elige un juego. No hay prisa y puedes intentarlo tantas veces como quieras.', { force: true }) }, '🔊 Escuchar')
      )
    ),
    h('p', { class: 'muted', style: { fontSize: '1.05rem' } }, 'Elige uno. No hay prisa, no se pierde nada y puedes repetir cuando quieras.'),
    h('div', { class: 'games-grid' }, Object.entries(GAME_META).map(([key, g]) => {
      const mine = scores.filter(s => s.game === key);
      const best = mine.length ? Math.max(...mine.map(s => s.score)) : null;
      return h('button', { class: 'game-card', onClick: () => { soft(); go('#/juegos/' + key); } },
        h('span', { class: 'ic', 'aria-hidden': 'true' }, g.icon),
        h('b', {}, g.title),
        h('span', { class: 'muted' }, g.desc),
        h('span', { class: 'tag', style: { justifySelf: 'start' } }, g.skill),
        best !== null ? h('span', { class: 'muted small' }, `Tu mejor marca: ${best} puntos · ${mine.length} ${mine.length === 1 ? 'vez' : 'veces'}`) : h('span', { class: 'muted small' }, 'Aún no lo has jugado')
      );
    }))
  );
}

/* ═════════ Carcasa común de juego ═════════ */
function makeGame(key, start) {
  const meta = GAME_META[key];
  return function render() {
    let level = Number(localStorage.getItem('memovida.level.' + key) || 1);
    let disposed = false;
    let session = null;
    const board = h('div', {});
    const hud = h('div', { class: 'game-hud' });
    const startedAt = { t: Date.now() };

    onDispose(() => { disposed = true; session?.cancel?.(); });

    const tabs = h('div', { class: 'level-tabs', role: 'group', 'aria-label': 'Dificultad' },
      [1, 2, 3].map(l => h('button', {
        class: 'level-tab', 'aria-pressed': String(l === level),
        onClick: () => { level = l; localStorage.setItem('memovida.level.' + key, String(l)); [...tabs.children].forEach((c, i) => c.setAttribute('aria-pressed', String(i + 1 === l))); begin(); }
      }, ['Fácil', 'Medio', 'Un poco más'][l - 1]))
    );

    async function finish({ correct, total, extra = '' }) {
      if (disposed) return;
      const score = Math.max(20, Math.round(correct / Math.max(1, total) * 100));
      const durationMs = Date.now() - startedAt.t;
      try { await api.game({ patientId: store.patient().id, game: key, level, correct, total, score, durationMs }); store.refresh().catch(() => {}); }
      catch (e) { toast('No se pudo guardar la puntuación: ' + e.message, 'err'); }
      const stars = score >= 85 ? '⭐⭐⭐' : score >= 60 ? '⭐⭐' : '⭐';
      const msg = score >= 85 ? '¡Excelente trabajo!' : score >= 60 ? '¡Muy bien!' : 'Lo has hecho con ganas, eso es lo importante.';
      chord();
      speak(`${msg} Has conseguido ${correct} de ${total}.`);
      mount(board, h('div', { class: 'game-done' },
        h('div', { class: 'big', 'aria-hidden': 'true' }, '🎉'),
        h('div', { class: 'game-score' }, `${correct} de ${total}`),
        h('div', { style: { fontSize: '2rem' }, 'aria-hidden': 'true' }, stars),
        h('p', { style: { fontSize: '1.25rem', fontWeight: '700', margin: 0 } }, msg),
        extra ? h('p', { class: 'muted', style: { margin: 0 } }, extra) : null,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn--primary btn--xl', onClick: begin }, '🔁 Otra vez'),
          h('button', { class: 'btn btn--xl', onClick: () => go('#/juegos') }, '🎮 Otro juego')
        )
      ));
    }

    function begin() {
      session?.cancel?.();
      clear(board);
      clear(hud);
      startedAt.t = Date.now();
      session = start({
        level, board, hud, finish,
        isDisposed: () => disposed,
        say: t => speak(t)
      }) || {};
    }

    const wrap = frag(
      h('div', { class: 'game-head' },
        h('div', { class: 'row' },
          h('button', { class: 'btn', onClick: () => go('#/juegos') }, '⬅️ Juegos'),
          h('h1', { class: 'page-title' }, `${meta.icon} ${meta.title}`)
        ),
        h('div', { class: 'row' }, tabs,
          h('button', { class: 'btn btn--soft', onClick: () => speak(session?.instructions || meta.desc, { force: true }) }, '🔊 Cómo se juega')
        )
      ),
      hud,
      h('div', { class: 'card', style: { marginTop: '.8rem' } }, h('div', { class: 'card-body' }, board))
    );
    begin();
    return wrap;
  };
}

function pill(text) { return h('span', { class: 'hud-pill' }, text); }
function updateHud(hud, values) { mount(hud, values.map(pill)); }

/* ═════════ 1 · PAREJAS ═════════ */
const OBJETOS = ['🌻', '🐕', '🏠', '🚗', '🎂', '🎵', '🌳', '🍎', '🐈', '⚽', '☂️', '🌞'];
const parejas = makeGame('parejas', ({ level, board, hud, finish, say }) => {
  const nPairs = [4, 6, 8][level - 1];
  const fotos = (D().people || []).filter(p => p.photo).slice(0, 4);
  const items = shuffle([
    ...fotos.map(p => ({ kind: 'img', value: p.photo, label: p.name })),
    ...shuffle(OBJETOS).map(e => ({ kind: 'emoji', value: e, label: 'dibujo' }))
  ]).slice(0, nPairs);

  const deck = shuffle([...items, ...items].map((it, i) => ({ ...it, uid: i, key: it.value })));
  let flipped = [], matched = 0, attempts = 0, lock = false;
  updateHud(hud, [`Parejas: 0 / ${nPairs}`, 'Intentos: 0']);
  say('Busca las dos cartas iguales. Pulsa una carta para verla.');

  const cols = nPairs <= 4 ? 4 : 4;
  const grid = h('div', { class: 'board', style: { gridTemplateColumns: `repeat(${cols}, minmax(70px, 130px))` } });

  deck.forEach(card => {
    const face = card.kind === 'img'
      ? h('div', { class: 'mcard-face' }, h('img', { src: card.value, alt: card.label }))
      : h('div', { class: 'mcard-face', 'aria-hidden': 'true' }, card.value);
    const btn = h('button', {
      class: 'mcard', 'aria-label': 'Carta tapada',
      onClick: () => flip(btn, card)
    }, h('div', { class: 'mcard-inner' }, h('div', { class: 'mcard-back', 'aria-hidden': 'true' }, '❓'), face));
    grid.appendChild(btn);
  });

  function flip(btn, card) {
    if (lock || btn.classList.contains('flipped') || btn.classList.contains('matched')) return;
    btn.classList.add('flipped');
    btn.setAttribute('aria-label', card.kind === 'img' ? 'Foto de ' + card.label : 'Carta con dibujo');
    beep(520 + rnd(120), 90, 'sine', 0.05);
    flipped.push({ btn, card });
    if (flipped.length < 2) return;
    attempts++;
    const [a, b] = flipped;
    if (a.card.key === b.card.key) {
      matched++;
      a.btn.classList.add('matched'); b.btn.classList.add('matched');
      a.btn.disabled = b.btn.disabled = true;
      flipped = [];
      soft();
      updateHud(hud, [`Parejas: ${matched} / ${nPairs}`, `Intentos: ${attempts}`]);
      if (matched === nPairs) setTimeout(() => finish({ correct: nPairs, total: nPairs, extra: `Lo has conseguido en ${attempts} intentos.` }), 500);
    } else {
      lock = true;
      setTimeout(() => {
        a.btn.classList.remove('flipped'); b.btn.classList.remove('flipped');
        a.btn.setAttribute('aria-label', 'Carta tapada'); b.btn.setAttribute('aria-label', 'Carta tapada');
        flipped = []; lock = false;
        updateHud(hud, [`Parejas: ${matched} / ${nPairs}`, `Intentos: ${attempts}`]);
      }, 1100);
    }
  }

  mount(board, h('p', { class: 'center muted', style: { marginTop: 0 } }, 'Pulsa dos cartas. Si son iguales, se quedan abiertas.'), grid);
  return { instructions: 'Pulsa dos cartas para verlas. Si son iguales se quedan abiertas. Encuentra todas las parejas. No hay prisa.', cancel: () => { lock = true; } };
});

/* ═════════ 2 · ¿QUIÉN ES? ═════════ */
const caras = makeGame('caras', ({ level, board, hud, finish, say }) => {
  const people = (D().people || []).filter(p => p.photo);
  if (people.length < 3) {
    mount(board, h('div', { class: 'empty' }, 'Para jugar hacen falta al menos 3 personas con foto. Pide a tu familia que las añada en «Personas cercanas».'));
    return { instructions: 'Necesitas tres personas con foto para jugar.' };
  }
  const rounds = 6;
  const askRelation = level === 3;
  let i = 0, correct = 0;
  const order = shuffle([...Array(rounds)].map((_, k) => people[k % people.length]));

  function round() {
    if (i >= rounds) return finish({ correct, total: rounds });
    const target = order[i];
    const nOpts = level === 1 ? 3 : 4;
    const pool = askRelation ? [...new Set(people.map(p => p.relation || 'Persona cercana'))] : people.map(p => p.name);
    const answer = askRelation ? (target.relation || 'Persona cercana') : target.name;
    const others = pick(pool.filter(x => x !== answer), Math.max(2, nOpts - 1));
    const opts = shuffle([answer, ...others]).slice(0, Math.max(3, nOpts));
    updateHud(hud, [`Ronda ${i + 1} de ${rounds}`, `Aciertos: ${correct}`]);
    const q = askRelation ? `¿Quién es ${target.name} para ti?` : '¿Quién es esta persona?';
    say(q);

    const options = h('div', { class: 'quiz-options' }, opts.map(o => h('button', {
      class: 'opt',
      onClick: e => {
        [...options.children].forEach(c => c.disabled = true);
        const ok = o === answer;
        if (ok) { correct++; e.currentTarget.classList.add('correct'); chord(); say(`¡Sí! Es ${target.name}, ${target.relation || 'tu persona cercana'}.`); }
        else {
          e.currentTarget.classList.add('wrong');
          [...options.children].find(c => c.textContent === answer)?.classList.add('correct');
          soft();
          say(`Es ${target.name}, ${target.relation || 'tu persona cercana'}. No pasa nada, ya lo sabes.`);
        }
        i++;
        setTimeout(round, 1900);
      }
    }, o)));

    mount(board,
      h('img', { class: 'quiz-photo', src: target.photo, alt: 'Persona de la foto' }),
      h('p', { class: 'quiz-q' }, q),
      options
    );
  }
  round();
  return { instructions: 'Mira la foto y pulsa el nombre de la persona. Si te equivocas, te diremos quién es. No pasa nada.' };
});

/* ═════════ 3 · SECUENCIA DE COLORES ═════════ */
const COLORES = [
  { name: 'Verde', color: '#2e8b57', freq: 392, icon: '🌿' },
  { name: 'Rojo', color: '#c0392b', freq: 494, icon: '🍎' },
  { name: 'Azul', color: '#2b6cb0', freq: 587, icon: '💧' },
  { name: 'Amarillo', color: '#d4a017', freq: 698, icon: '🌞' }
];
const secuencia = makeGame('secuencia', ({ level, board, hud, finish, say, isDisposed }) => {
  const len = [3, 4, 5][level - 1];
  const rounds = 4;
  let r = 0, correct = 0, seq = [], idx = 0, acceptInput = false, tries = 0, cancelled = false;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!cancelled && !isDisposed()) fn(); }, ms); timers.add(t); return t; };

  const buttons = COLORES.map((c, i) => h('button', {
    class: 'simon-btn', style: { background: c.color }, disabled: true,
    'aria-label': c.name,
    onClick: () => press(i)
  }, c.icon));
  const grid = h('div', { class: 'simon' }, buttons);
  const status = h('p', { class: 'center', style: { fontSize: '1.25rem', fontWeight: '700' } }, 'Mira los colores que se encienden');
  mount(board, status, grid, h('p', { class: 'center muted' }, 'Después repítelos pulsando en el mismo orden.'));

  function light(i, ms = 520) {
    buttons[i].classList.add('lit');
    beep(COLORES[i].freq, ms - 80, 'sine', 0.1);
    later(() => buttons[i].classList.remove('lit'), ms);
  }

  async function playSeq() {
    acceptInput = false;
    buttons.forEach(b => b.disabled = true);
    status.textContent = 'Mira y escucha…';
    say('Mira la secuencia');
    for (let k = 0; k < seq.length; k++) {
      if (cancelled || isDisposed()) return;
      await sleep(620);
      light(seq[k]);
    }
    later(() => {
      acceptInput = true; idx = 0;
      buttons.forEach(b => b.disabled = false);
      status.textContent = 'Ahora te toca a ti';
      say('Ahora te toca a ti');
    }, 620 * seq.length + 200);
  }

  function nextRound() {
    if (r >= rounds) return finish({ correct, total: rounds });
    r++;
    tries = 0;
    seq = [...Array(len)].map(() => rnd(4));
    updateHud(hud, [`Ronda ${r} de ${rounds}`, `Aciertos: ${correct}`]);
    playSeq();
  }

  function press(i) {
    if (!acceptInput) return;
    light(i, 300);
    if (i === seq[idx]) {
      idx++;
      if (idx === seq.length) {
        acceptInput = false; buttons.forEach(b => b.disabled = true);
        correct++; chord();
        status.textContent = '¡Muy bien! 🎉';
        say('¡Muy bien!');
        later(nextRound, 1500);
      }
    } else {
      acceptInput = false; buttons.forEach(b => b.disabled = true);
      tries++;
      soft();
      if (tries >= 2) {
        status.textContent = 'Vamos con otra secuencia';
        say('Vamos con otra, no pasa nada.');
        later(nextRound, 1600);
      } else {
        status.textContent = 'Casi. Mira otra vez 🙂';
        say('Casi. Mira otra vez.');
        later(playSeq, 1600);
      }
    }
  }

  nextRound();
  return {
    instructions: 'Se encenderán unos colores con sonido. Después repítelos pulsando en el mismo orden.',
    cancel: () => { cancelled = true; timers.forEach(clearTimeout); timers.clear(); }
  };
});

/* ═════════ 4 · REFRANES ═════════ */
const REFRANES = [
  ['A quien madruga…', 'Dios le ayuda', ['el sueño se le va', 'le pica el gallo']],
  ['Más vale pájaro en mano…', 'que ciento volando', ['que dos en el nido', 'que gato en el tejado']],
  ['No por mucho madrugar…', 'amanece más temprano', ['se llega antes', 'llueve más fuerte']],
  ['Al mal tiempo…', 'buena cara', ['paraguas nuevo', 'mejor quedarse']],
  ['En boca cerrada…', 'no entran moscas', ['no hay palabras', 'se guarda el pan']],
  ['A caballo regalado…', 'no le mires el diente', ['no le pongas silla', 'hay que herrarlo']],
  ['Quien mucho abarca…', 'poco aprieta', ['todo lo pierde', 'nunca descansa']],
  ['De tal palo…', 'tal astilla', ['tal madera', 'tal camino']],
  ['Ojos que no ven…', 'corazón que no siente', ['manos que no trabajan', 'no hay quien lo diga']],
  ['Aunque la mona se vista de seda…', 'mona se queda', ['seda parece', 'bien se ve']],
  ['Cuando el río suena…', 'agua lleva', ['piedras trae', 'peces hay']],
  ['Perro ladrador…', 'poco mordedor', ['mucho corredor', 'buen guardián']]
];
const refranes = makeGame('refranes', ({ level, board, hud, finish, say }) => {
  const rounds = 6;
  const pool = level === 1 ? REFRANES.slice(0, 6) : level === 2 ? REFRANES.slice(0, 9) : REFRANES;
  const chosen = pick(pool, rounds);
  let i = 0, correct = 0;

  function round() {
    if (i >= rounds) return finish({ correct, total: rounds });
    const [inicio, buena, malas] = chosen[i];
    const opts = shuffle([buena, ...pick(malas, level === 1 ? 2 : 2)]);
    updateHud(hud, [`Refrán ${i + 1} de ${rounds}`, `Aciertos: ${correct}`]);
    say('Completa el refrán: ' + inicio);
    const options = h('div', { class: 'quiz-options' }, opts.map(o => h('button', {
      class: 'opt',
      onClick: e => {
        [...options.children].forEach(c => c.disabled = true);
        if (o === buena) { correct++; e.currentTarget.classList.add('correct'); chord(); say('¡Eso es! ' + inicio + ' ' + buena); }
        else {
          e.currentTarget.classList.add('wrong');
          [...options.children].find(c => c.textContent === buena)?.classList.add('correct');
          soft(); say('El refrán dice: ' + inicio + ' ' + buena);
        }
        i++;
        setTimeout(round, 2200);
      }
    }, '…' + o)));
    mount(board, h('p', { class: 'quiz-q' }, `«${inicio}»`), options,
      h('p', { class: 'center muted' }, 'Pulsa el final correcto del refrán.'));
  }
  round();
  return { instructions: 'Lee el principio del refrán y pulsa cómo termina. Son los dichos de toda la vida.' };
});

/* ═════════ 5 · NÚMEROS ═════════ */
const numeros = makeGame('numeros', ({ level, board, hud, finish, say }) => {
  const rounds = 6;
  let i = 0, correct = 0;
  const ICONS = ['🍎', '🌼', '🐟', '⭐', '🍪', '🎈'];

  function makeQuestion() {
    if (level === 1) {
      const n = 3 + rnd(6), ic = ICONS[rnd(ICONS.length)];
      return { text: '¿Cuántos hay?', visual: [...Array(n)].map(() => ic), answer: n, options: shuffle([n, n + 1, Math.max(1, n - 1)]) };
    }
    if (level === 2) {
      const a = 2 + rnd(9), b = 2 + rnd(9), ans = a + b;
      return { text: `¿Cuánto es ${a} + ${b}?`, visual: null, answer: ans, options: shuffle([ans, ans + 1, Math.max(1, ans - 2)]) };
    }
    const a = 10 + rnd(10), b = 1 + rnd(8), ans = a - b;
    return { text: `¿Cuánto es ${a} − ${b}?`, visual: null, answer: ans, options: shuffle([ans, ans + 2, Math.max(0, ans - 1)]) };
  }

  function round() {
    if (i >= rounds) return finish({ correct, total: rounds });
    const q = makeQuestion();
    updateHud(hud, [`Pregunta ${i + 1} de ${rounds}`, `Aciertos: ${correct}`]);
    say(q.text);
    const options = h('div', { class: 'quiz-options', style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
      q.options.map(o => h('button', {
        class: 'opt', style: { fontSize: '1.8rem' },
        onClick: e => {
          [...options.children].forEach(c => c.disabled = true);
          if (o === q.answer) { correct++; e.currentTarget.classList.add('correct'); chord(); say('¡Correcto!'); }
          else {
            e.currentTarget.classList.add('wrong');
            [...options.children].find(c => Number(c.textContent) === q.answer)?.classList.add('correct');
            soft(); say(`La respuesta es ${q.answer}. No pasa nada.`);
          }
          i++;
          setTimeout(round, 1800);
        }
      }, String(o))));
    mount(board,
      q.visual ? h('div', { class: 'count-grid', 'aria-label': `${q.visual.length} dibujos` }, q.visual.map(v => h('span', { 'aria-hidden': 'true' }, v))) : null,
      h('p', { class: 'quiz-q' }, q.text),
      options
    );
  }
  round();
  return { instructions: 'Cuenta los dibujos o resuelve la cuenta y pulsa el número correcto.' };
});

/* ═════════ 6 · ORDENA TU DÍA ═════════ */
const orden = makeGame('orden', ({ level, board, hud, finish, say }) => {
  const rutinas = D().routines || [];
  const base = rutinas.find(r => r.period === 'mañana')?.steps || [
    { id: 'a', label: 'Levantarme de la cama', icon: '🛏️' },
    { id: 'b', label: 'Lavarme la cara', icon: '🪥' },
    { id: 'c', label: 'Vestirme', icon: '👕' },
    { id: 'd', label: 'Desayunar', icon: '☕' },
    { id: 'e', label: 'Tomar la pastilla', icon: '💊' },
    { id: 'f', label: 'Salir a pasear', icon: '🚶‍♀️' }
  ];
  const n = [4, 5, 6][level - 1];
  const correctOrder = base.slice(0, n);
  const shown = shuffle(correctOrder);
  let next = 0, errors = 0;
  updateHud(hud, [`Pasos: 0 / ${n}`, 'Fallos: 0']);
  say('Pulsa los pasos en el orden en que los haces cada día. Empieza por el primero.');

  const list = h('ul', { class: 'order-list' }, shown.map(s => h('li', {}, h('button', {
    class: 'order-item',
    onClick: e => {
      const btn = e.currentTarget;
      if (btn.classList.contains('picked')) return;
      if (s.id === correctOrder[next].id) {
        btn.classList.add('picked');
        btn.disabled = true;
        btn.prepend(h('span', { class: 'order-num' }, String(next + 1)));
        next++;
        soft();
        updateHud(hud, [`Pasos: ${next} / ${n}`, `Fallos: ${errors}`]);
        if (next === n) { chord(); setTimeout(() => finish({ correct: Math.max(1, n - errors), total: n, extra: errors ? `Solo ${errors} despistes. ¡Muy bien!` : '¡Perfecto, sin ningún despiste!' }), 700); }
      } else {
        errors++;
        soft();
        btn.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 });
        updateHud(hud, [`Pasos: ${next} / ${n}`, `Fallos: ${errors}`]);
        say(`Ese va más tarde. Ahora toca: ${correctOrder[next].label}`);
        toast(`Ahora toca: ${correctOrder[next].label}`, 'info', 3000);
      }
    }
  }, h('span', { 'aria-hidden': 'true', style: { fontSize: '1.8rem' } }, s.icon || '✅'), h('span', {}, s.label)))));

  mount(board, h('p', { class: 'center muted', style: { marginTop: 0 } }, 'Pulsa primero lo que haces al levantarte, y después lo siguiente.'), list);
  return { instructions: 'Pulsa los pasos de la mañana en el orden correcto, del primero al último.' };
});

/* ═════════ Registro ═════════ */
const REGISTRY = { parejas, caras, secuencia, refranes, numeros, orden };

export function play(key) {
  const game = REGISTRY[key];
  if (!game) return h('div', { class: 'empty' }, 'Ese juego no existe. Vuelve a la lista.');
  return game();
}
