/**
 * Capturador de pantallas de MemoVida (solo desarrollo).
 * Usa Chrome headless vía DevTools Protocol, sin dependencias npm.
 *
 *   node tools/shots.mjs                 # guarda en build/shots/
 *   node tools/shots.mjs --width 390     # vista móvil
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build', 'shots');
const PORT = 9333;
const BASE = process.env.BASE || 'http://localhost:3000';

const args = process.argv.slice(2);
const argOf = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const WIDTH = Number(argOf('width', 1440));
const HEIGHT = Number(argOf('height', 950));

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));
if (!CHROME) { console.error('No encontré Chrome/Edge'); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-shot-'));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--hide-scrollbars', '--force-device-scale-factor=1',
  `--window-size=${WIDTH},${HEIGHT}`, 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function version() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return r.json();
    } catch { /* aún no */ }
    await sleep(250);
  }
  throw new Error('Chrome no arrancó');
}

let ws, id = 0;
const pending = new Map();
const events = [];

async function connect(url) {
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  };
}

function send(method, params = {}) {
  const mid = ++id;
  return new Promise((resolve, reject) => {
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

const evaluate = async (expression, awaitPromise = true) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
};

async function shot(name, fullPage = false, keepModals = false) {
  // Los avisos de medicación salen solos: los quitamos solo para la captura.
  if (!keepModals) await evaluate(`(() => {
    document.querySelectorAll('.modal-backdrop').forEach(n => n.remove());
    document.body.style.overflow = '';
    return 1;
  })()`).catch(() => {});
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage });
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log('  ', name, '→', path.relative(ROOT, file));
}

async function goto(url) {
  await send('Page.navigate', { url });
  await sleep(500);
}

async function login(email, password, pidIndex = 0) {
  const data = await evaluate(`(async () => {
    const r = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:${JSON.stringify(email)}, password:${JSON.stringify(password)}}) });
    const j = await r.json();
    if (!r.ok) return { error: j.error };
    localStorage.setItem('memovida.token', j.token);
    if (j.patients && j.patients[${pidIndex}]) localStorage.setItem('memovida.pid', j.patients[${pidIndex}].id);
    return { ok: true, role: j.user.role, patients: (j.patients||[]).length };
  })()`);
  if (data?.error) throw new Error(data.error);
  await send('Page.reload', { ignoreCache: true });
  await sleep(1400);
  return data;
}

async function clearSession() {
  await evaluate(`(() => { localStorage.removeItem('memovida.token'); localStorage.removeItem('memovida.pid'); return 1; })()`);
}

async function run() {
  console.log('\n📸 Capturas', `${WIDTH}×${HEIGHT}`, '→', path.relative(ROOT, OUT), '\n');

  /* ── login ── */
  await goto(BASE + '/');
  await sleep(900);
  await shot('00-acceso');

  /* ── paciente ── */
  await login('rosa@memovida.app', 'rosa1234');
  await goto(BASE + '/#/');
  await sleep(1600);
  await shot('01-paciente-inicio');
  await shot('01b-paciente-inicio-full', true);

  await evaluate(`(document.querySelector('.aa-btn')||{click(){}}).click(); 1`);
  await sleep(600);
  await shot('01c-accesibilidad', false, true);
  await evaluate(`(() => { document.querySelectorAll('.modal-backdrop').forEach(n => n.remove()); document.body.style.overflow = ''; return 1; })()`);
  await sleep(250);

  await evaluate(`(() => { document.body.classList.add('night'); return 1; })()`);
  await shot('01d-modo-noche');
  await evaluate(`(() => { document.body.classList.remove('night'); document.body.classList.add('hc'); return 1; })()`);
  await shot('01e-alto-contraste');
  await evaluate(`(() => { document.body.classList.remove('hc'); return 1; })()`);
  await sleep(200);

  const rutas = [
    ['#/orientacion', '02-orientacion'],
    ['#/medicacion', '03-medicacion'],
    ['#/personas', '04-personas'],
    ['#/recuerdos', '05-recuerdos'],
    ['#/rutina', '06-rutina'],
    ['#/juegos', '07-juegos'],
    ['#/calma', '08-calma'],
    ['#/animo', '09-animo'],
    ['#/ayuda', '10-ayuda']
  ];
  for (const [hash, name] of rutas) {
    await evaluate(`location.hash = ${JSON.stringify(hash)}; 1`);
    await sleep(700);
    await shot(name);
  }

  /* ── cuidador ── */
  await clearSession();
  await goto(BASE + '/');
  await sleep(700);
  await login('ana@memovida.app', 'ana1234');
  await goto(BASE + '/#/panel');
  await sleep(1500);
  await shot('20-cuidador-panel');
  await shot('20b-cuidador-panel-full', true);

  const care = [
    ['#/alertas', '21-alertas'],
    ['#/recordatorios', '22-recordatorios'],
    ['#/rutinas', '23-rutinas'],
    ['#/personas', '24-personas'],
    ['#/recuerdos', '25-recuerdos'],
    ['#/progreso', '26-progreso'],
    ['#/diario', '27-diario'],
    ['#/informes', '28-informes'],
    ['#/ajustes', '29-ajustes']
  ];
  for (const [hash, name] of care) {
    await evaluate(`location.hash = ${JSON.stringify(hash)}; 1`);
    await sleep(700);
    await shot(name);
  }

  /* ── errores de consola / excepciones ── */
  const logs = events.filter(e => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map(e => e.params.entry.text);
  const exs = events.filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);
  const cons = events.filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
    .map(e => e.params.args.map(a => a.value ?? a.description).join(' '));
  const errs = [...new Set([...logs, ...exs, ...cons])];
  if (errs.length) console.log('\n⚠️  Errores:\n' + errs.slice(0, 12).join('\n'));
  else console.log('\n✅ Sin errores de consola');
}

try {
  await version();
  const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
  await connect(target.webSocketDebuggerUrl);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH < 700 });
  await run();
} catch (e) {
  console.error('\n❌', e.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* noop */ }
  chrome.kill();
}
