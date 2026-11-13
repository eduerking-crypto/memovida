/**
 * MemoVida · CRUD genérico accesible para el cuidador
 * Un único generador de pantallas (lista + búsqueda + formulario modal)
 * para personas, recuerdos, recordatorios, rutinas y notas.
 */
import {
  h, frag, mount, clear, toast, modal, confirmDialog, field, textInput, textArea,
  select, photoPicker, avatar, esc
} from './ui.js';
import { api } from './api.js';
import * as store from './store.js';
import { renderMain } from './app.js';

export const PICTOS = [
  ['pill', 'Pastilla'], ['heart', 'Corazón'], ['droplet', 'Agua'], ['walk', 'Paseo'],
  ['home', 'Casa'], ['moon', 'Noche'], ['sun', 'Sol'], ['sunrise', 'Amanecer'],
  ['coffee', 'Café'], ['utensils', 'Comida'], ['bowl', 'Cena'], ['bed', 'Cama'],
  ['toothbrush', 'Aseo'], ['shirt', 'Vestirse'], ['plant', 'Plantas'], ['dog', 'Mascota'],
  ['music', 'Música'], ['book', 'Lectura'], ['phone', 'Llamada'], ['calendar', 'Cita'],
  ['bell', 'Aviso'], ['brain', 'Mente'], ['lock', 'Cerrar'], ['check-circle', 'Tarea']
];

const DIAS = [['1', 'L'], ['2', 'M'], ['3', 'X'], ['4', 'J'], ['5', 'V'], ['6', 'S'], ['0', 'D']];

/* ── Editores especiales ── */
function timesEditor(initial = []) {
  let times = [...initial];
  const wrap = h('div', { class: 'times-editor' });
  const input = h('input', { class: 'input', type: 'time', style: { maxWidth: '150px' } });
  function paint() {
    mount(wrap,
      ...times.map((t, i) => h('span', { class: 'time-pill' }, t,
        h('button', { type: 'button', 'aria-label': `Quitar ${t}`, onClick: () => { times.splice(i, 1); paint(); } }, '✕'))),
      input,
      h('button', {
        type: 'button', class: 'btn', onClick: () => {
          if (!input.value) return toast('Elige una hora', 'err');
          if (!times.includes(input.value)) times.push(input.value);
          times.sort(); input.value = ''; paint();
        }
      }, '＋ Añadir hora')
    );
  }
  paint();
  return { node: wrap, getValue: () => times };
}

function daysEditor(initial = [0, 1, 2, 3, 4, 5, 6]) {
  const set = new Set(initial.map(Number));
  const wrap = h('div', { class: 'days-picker', role: 'group', 'aria-label': 'Días de la semana' },
    DIAS.map(([v, label]) => h('button', {
      type: 'button', class: 'day-chip', 'aria-pressed': String(set.has(Number(v))),
      'aria-label': { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' }[v],
      onClick: e => {
        const n = Number(v);
        if (set.has(n)) set.delete(n); else set.add(n);
        e.currentTarget.setAttribute('aria-pressed', String(set.has(n)));
      }
    }, label))
  );
  return { node: wrap, getValue: () => [...set] };
}

function stepsEditor(initial = []) {
  let steps = initial.map(s => ({ ...s }));
  const wrap = h('div', { class: 'stack', style: { gap: '.5rem' } });
  function paint() {
    mount(wrap,
      ...steps.map((s, i) => h('div', { class: 'step-edit-row' },
        select(PICTOS, s.icon || 'check-circle', { 'aria-label': 'Pictograma del paso ' + (i + 1), onChange: e => s.icon = e.target.value }),
        h('input', { class: 'input', value: s.label || '', placeholder: 'Describe el paso', 'aria-label': 'Texto del paso ' + (i + 1), onInput: e => s.label = e.target.value }),
        h('div', { class: 'row', style: { gap: '.2rem' } },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Subir', disabled: i === 0, onClick: () => { [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; paint(); } }, '↑'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bajar', disabled: i === steps.length - 1, onClick: () => { [steps[i + 1], steps[i]] = [steps[i], steps[i + 1]]; paint(); } }, '↓'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Eliminar paso', onClick: () => { steps.splice(i, 1); paint(); } }, '🗑️')
        )
      )),
      h('button', { type: 'button', class: 'btn', onClick: () => { steps.push({ label: '', icon: '✅' }); paint(); } }, '＋ Añadir paso')
    );
  }
  paint();
  return { node: wrap, getValue: () => steps.filter(s => (s.label || '').trim()) };
}

function contactsEditor(initial = []) {
  let rows = initial.map(c => ({ ...c }));
  const wrap = h('div', { class: 'stack', style: { gap: '.5rem' } });
  function paint() {
    mount(wrap,
      ...rows.map((c, i) => h('div', { class: 'step-edit-row', style: { gridTemplateColumns: '1fr 1fr 1fr auto' } },
        h('input', { class: 'input', value: c.name || '', placeholder: 'Nombre', 'aria-label': 'Nombre del contacto', onInput: e => c.name = e.target.value }),
        h('input', { class: 'input', value: c.phone || '', placeholder: 'Teléfono', 'aria-label': 'Teléfono', onInput: e => c.phone = e.target.value }),
        h('input', { class: 'input', value: c.relation || '', placeholder: 'Parentesco', 'aria-label': 'Parentesco', onInput: e => c.relation = e.target.value }),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Eliminar contacto', onClick: () => { rows.splice(i, 1); paint(); } }, '🗑️')
      )),
      h('button', { type: 'button', class: 'btn', onClick: () => { rows.push({ name: '', phone: '', relation: '' }); paint(); } }, '＋ Añadir contacto')
    );
  }
  paint();
  return { node: wrap, getValue: () => rows.filter(c => (c.name || '').trim()) };
}

/* ── Formulario declarativo ── */
export function buildForm(fields, initial = {}) {
  const getters = {};
  const nodes = fields.map(f => {
    const val = initial[f.name] ?? f.default ?? '';
    if (f.type === 'photo') { const p = photoPicker(val, { label: f.label }); getters[f.name] = p.getValue; return p.node; }
    if (f.type === 'times') { const e = timesEditor(val || []); getters[f.name] = e.getValue; return field(f.label, e.node, f.hint); }
    if (f.type === 'days') { const e = daysEditor(val); getters[f.name] = e.getValue; return field(f.label, e.node, f.hint); }
    if (f.type === 'steps') { const e = stepsEditor(val || []); getters[f.name] = e.getValue; return field(f.label, e.node, f.hint); }
    if (f.type === 'contacts') { const e = contactsEditor(val || []); getters[f.name] = e.getValue; return field(f.label, e.node, f.hint); }
    if (f.type === 'checkbox') {
      const input = h('input', { type: 'checkbox', checked: !!val });
      getters[f.name] = () => input.checked;
      return h('label', { class: 'checkbox' }, input, f.label);
    }
    if (f.type === 'textarea') { const c = textArea(val, { placeholder: f.placeholder || '' }); getters[f.name] = () => c.value; return field(f.label, c, f.hint); }
    if (f.type === 'select') { const c = select(f.options, val); getters[f.name] = () => c.value; return field(f.label, c, f.hint); }
    if (f.type === 'tags') { const c = textInput((val || []).join(', '), { placeholder: 'familia, viajes, verano' }); getters[f.name] = () => c.value.split(',').map(s => s.trim()).filter(Boolean); return field(f.label, c, f.hint); }
    const c = textInput(val, { type: f.type || 'text', placeholder: f.placeholder || '', step: f.step, min: f.min, max: f.max });
    getters[f.name] = () => f.type === 'number' ? (c.value === '' ? null : Number(c.value)) : c.value;
    return field(f.label, c, f.hint);
  });
  return { node: h('div', {}, nodes), read: () => Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()])) };
}

/* ── Pantalla CRUD ── */
export function crudScreen({ coll, title, icon, subtitle, fields, items, renderItem, addLabel = 'Añadir', emptyText = 'Todavía no hay nada. Añade el primero.', extra = null, sort }) {
  let query = '';
  const listWrap = h('div', {});
  const search = textInput('', { type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar en ' + title, onInput: e => { query = e.target.value.toLowerCase(); paint(); } });

  function currentItems() {
    const list = [...(items() || [])];
    if (sort) list.sort(sort);
    if (!query) return list;
    return list.filter(it => JSON.stringify(it).toLowerCase().includes(query));
  }

  async function save(item, values) {
    const pid = store.state.patientId;
    try {
      if (item) await api.update(coll, item.id, values);
      else await api.create(coll, { patientId: pid, ...values });
      toast(item ? 'Cambios guardados' : 'Creado correctamente', 'ok');
      await store.refresh();
      renderMain();
    } catch (e) { toast(e.message, 'err'); throw e; }
  }

  function openForm(item = null) {
    const form = buildForm(fields, item || {});
    const m = modal({
      title: (item ? 'Editar · ' : 'Nuevo · ') + title.replace(/s$/, ''),
      wide: fields.length > 6,
      body: form.node,
      actions: [
        { label: 'Cancelar' },
        {
          label: item ? 'Guardar cambios' : 'Crear', kind: 'primary', onClick: async close => {
            try { await save(item, form.read()); close(); } catch { /* el toast ya avisó */ }
          }
        }
      ]
    });
    return m;
  }

  async function del(item) {
    const ok = await confirmDialog({
      title: 'Eliminar', danger: true,
      text: `¿Seguro que quieres eliminar «${item.title || item.name || item.text?.slice(0, 40) || 'este elemento'}»? No se puede deshacer.`,
      okLabel: 'Sí, eliminar'
    });
    if (!ok) return;
    try { await api.remove(coll, item.id); toast('Eliminado', 'ok'); await store.refresh(); renderMain(); }
    catch (e) { toast(e.message, 'err'); }
  }

  function paint() {
    const list = currentItems();
    mount(listWrap, list.length
      ? h('div', { class: 'list' }, list.map(it => renderItem(it, { edit: () => openForm(it), remove: () => del(it) })))
      : h('div', { class: 'empty' }, query ? 'Nada coincide con la búsqueda.' : emptyText));
  }
  paint();

  return frag(
    h('div', { class: 'care-head' },
      h('div', {},
        h('h1', {}, `${icon} ${title}`),
        subtitle ? h('p', { class: 'muted', style: { margin: '.2rem 0 0' } }, subtitle) : null
      ),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--primary', onClick: () => openForm() }, '＋ ' + addLabel)
      )
    ),
    h('div', { class: 'toolbar' }, h('div', { class: 'grow', style: { maxWidth: '320px' } }, search), extra),
    listWrap
  );
}

/* ── Bloque de fila estándar ── */
export function rowActions({ edit, remove }) {
  return h('div', { class: 'row', style: { gap: '.3rem' } },
    h('button', { class: 'icon-btn', title: 'Editar', 'aria-label': 'Editar', onClick: edit }, '✏️'),
    h('button', { class: 'icon-btn', title: 'Eliminar', 'aria-label': 'Eliminar', onClick: remove }, '🗑️')
  );
}
