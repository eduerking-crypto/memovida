/**
 * MemoVida · Pantalla de acceso
 */
import { h, field, textInput, toast, speak } from '../ui.js';
import { api } from '../api.js';
import { afterLogin } from '../store.js';

export function renderAuth(onDone) {
  let mode = 'login';           // login | registro
  let role = 'paciente';
  const email = textInput('', { type: 'email', autocomplete: 'username', placeholder: 'tucorreo@ejemplo.com', required: true });
  const pass = textInput('', { type: 'password', autocomplete: 'current-password', placeholder: '••••••••', required: true });
  const name = textInput('', { autocomplete: 'name', placeholder: 'Nombre y apellidos' });
  const errorBox = h('div', { class: 'auth-error', role: 'alert', style: { display: 'none' } });
  const submitBtn = h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'submit' }, 'Entrar');
  const nameField = field('Tu nombre', name);
  nameField.style.display = 'none';

  function setMode(m) {
    mode = m;
    nameField.style.display = m === 'registro' ? '' : 'none';
    submitBtn.textContent = m === 'registro' ? 'Crear mi cuenta' : 'Entrar';
    pass.autocomplete = m === 'registro' ? 'new-password' : 'current-password';
    toggle.textContent = m === 'registro' ? 'Ya tengo cuenta · Entrar' : 'No tengo cuenta · Crear una';
    roleTabs.style.display = m === 'registro' ? '' : 'none';
    errorBox.style.display = 'none';
  }

  const roleTabs = h('div', { class: 'role-tabs', role: 'group', 'aria-label': 'Tipo de cuenta' },
    ...[['paciente', '🧑‍🦳 Soy la persona con Alzheimer'], ['cuidador', '🤝 Soy familiar o cuidador']].map(([r, label]) =>
      h('button', {
        type: 'button', class: 'role-tab', 'aria-pressed': String(r === role),
        onClick: e => {
          role = r;
          [...roleTabs.children].forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget)));
        }
      }, label))
  );

  const toggle = h('button', { class: 'btn btn--ghost btn--block', type: 'button', onClick: () => setMode(mode === 'login' ? 'registro' : 'login') }, 'No tengo cuenta · Crear una');

  async function submit(e) {
    e.preventDefault();
    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Un momento…';
    try {
      const payload = mode === 'login'
        ? await api.login(email.value.trim(), pass.value)
        : await api.register({ name: name.value.trim(), email: email.value.trim(), password: pass.value, role });
      await afterLogin(payload);
      toast(`Hola, ${payload.user.name.split(' ')[0]} 👋`, 'ok');
      onDone();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = '';
      speak(err.message, { force: true });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'registro' ? 'Crear mi cuenta' : 'Entrar';
    }
  }

  async function demo(kind) {
    const creds = kind === 'paciente'
      ? { email: 'rosa@memovida.app', password: 'rosa1234' }
      : { email: 'ana@memovida.app', password: 'ana1234' };
    try {
      submitBtn.disabled = true;
      const payload = await api.login(creds.email, creds.password);
      await afterLogin(payload);
      onDone();
    } catch (err) { toast(err.message, 'err'); }
    finally { submitBtn.disabled = false; }
  }

  const form = h('form', { class: 'stack', onSubmit: submit },
    errorBox,
    roleTabs,
    nameField,
    field('Correo electrónico', email),
    field('Contraseña', pass, 'Mínimo 6 caracteres.'),
    submitBtn,
    toggle
  );

  const card = h('div', { class: 'auth-card' },
    h('h2', {}, 'Bienvenido a MemoVida'),
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Entra para continuar. Si es la primera vez, prueba la demostración.'),
    form,
    h('div', { class: 'demo-box' },
      h('p', {}, 'Demostración con datos reales de ejemplo (Rosa, 78 años, y su hija Ana):'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--soft', type: 'button', onClick: () => demo('paciente') }, '🧑‍🦳 Entrar como Rosa'),
        h('button', { class: 'btn btn--soft', type: 'button', onClick: () => demo('cuidador') }, '🤝 Entrar como Ana')
      )
    )
  );

  setMode('login');

  return h('div', { class: 'auth-wrap' },
    h('section', { class: 'auth-hero' },
      h('div', { class: 'logo-row' }, h('img', { src: '/img/logo.svg', alt: '', width: 46, height: 46 }), 'MemoVida'),
      h('h1', {}, 'Recordar lo importante, cada día.'),
      h('p', {}, 'Un acompañante digital para personas con Alzheimer y para quienes las cuidan. Sencillo de usar, con voz, sin prisas y sin errores que frustren.'),
      h('ul', {},
        ...[
          ['🕒', 'Orientación: qué día es, dónde estoy y qué toca ahora'],
          ['💊', 'Medicación con avisos hablados y confirmación en un toque'],
          ['👨‍👩‍👧', 'Reconocer a la familia con fotos y recuerdos'],
          ['🧠', 'Seis juegos de estimulación cognitiva adaptativos'],
          ['🆘', 'Botón de ayuda y zona segura con aviso al cuidador'],
          ['📊', 'Panel del cuidador con adherencia, ánimo e informes']
        ].map(([ic, txt]) => h('li', {}, h('span', { 'aria-hidden': 'true' }, ic), h('span', {}, txt)))
      ),
      h('p', { class: 'small', style: { opacity: .8 } }, 'Herramienta de apoyo. No sustituye el criterio de un profesional sanitario.')
    ),
    h('section', { class: 'auth-side' }, card)
  );
}
