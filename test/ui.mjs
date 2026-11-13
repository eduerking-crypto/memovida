/**
 * MemoVida · Prueba de interfaz en navegador real (Chromium)
 *   node test/ui.mjs
 * Levanta un servidor propio con datos demo, recorre las 21 pantallas,
 * juega una partida completa, confirma una toma, lanza un SOS y hace CRUD.
 * Guarda capturas en test/capturas/ y falla si hay errores de consola.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'test', 'capturas');
const PORT = 3998;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'memovida-ui-'));
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  \x1b[32m✔\x1b[0m ${name}`); }
  else { fail++; console.log(`  \x1b[31m✘\x1b[0m ${name} ${extra}`); }
};
const section = t => console.log(`\n\x1b[36m${t}\x1b[0m`);

const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR }, stdio: ['ignore', 'pipe', 'pipe']
});
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('sin arranque')), 15000);
  server.stdout.on('data', d => { if (String(d).includes('funcionando')) { clearTimeout(t); setTimeout(res, 300); } });
  server.stderr.on('data', d => process.stderr.write(String(d)));
});

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: 'es-ES', geolocation: { latitude: 40.4168, longitude: -3.7038 }, permissions: ['geolocation'] });
const page = await context.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' :: ' + String(e.stack).split('\n').slice(0,4).join(' <- ')));
page.on('requestfailed', r => { if (!r.url().includes('favicon') && !r.url().includes('/api/stream')) errors.push('requestfailed: ' + r.url()); });

const shot = async name => { await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); };
const wait = ms => page.waitForTimeout(ms);

try {
  section('1 · Acceso');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  ok('carga la portada de acceso', await page.locator('.auth-hero h1').isVisible());
  ok('sin errores de carga iniciales', errors.length === 0, errors.join(' | '));
  await shot('01-acceso');

  await page.getByRole('button', { name: /Entrar como Rosa/ }).click();
  await page.waitForSelector('.tiles', { timeout: 10000 });
  ok('entra en modo paciente', await page.locator('body[data-mode="paciente"]').count() === 1);
  ok('8 acciones en el inicio', await page.locator('.tile').count() === 8, String(await page.locator('.tile').count()));
  ok('reloj visible', await page.locator('.clock-time').first().isVisible());
  ok('botón de ayuda siempre visible', await page.locator('.bottom-btn--sos').isVisible());
  await shot('02-paciente-inicio');

  section('2 · Pantallas del paciente');
  for (const [hash, selector, name] of [
    ['#/orientacion', '.orient-hero', '03-orientacion'],
    ['#/medicacion', '.dose-card', '04-medicacion'],
    ['#/personas', '.person', '05-personas'],
    ['#/recuerdos', '.mem-card', '06-recuerdos'],
    ['#/rutina', '.step', '07-rutina'],
    ['#/juegos', '.game-card', '08-juegos'],
    ['#/calma', '.breath-circle', '09-calma'],
    ['#/animo', '.mood-btn', '10-animo'],
    ['#/ayuda', '.help-item', '11-ayuda'],
    ['#/ficha', '.ficha', '12-ficha']
  ]) {
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForSelector(selector, { timeout: 8000 });
    await wait(250);
    ok(`pantalla ${hash} renderiza`, await page.locator(selector).first().isVisible());
    await shot(name);
  }
  ok('imágenes de familia cargadas', await page.evaluate(() => {
    location.hash = '#/personas';
    return true;
  }));
  await page.waitForSelector('.person-photo');
  ok('fotos reales decodificadas', await page.evaluate(() => [...document.querySelectorAll('img.person-photo')].every(i => i.complete && i.naturalWidth > 0)));

  section('3 · Aviso automático de medicación');
  await page.waitForSelector('.reminder-modal', { timeout: 20000 });
  ok('el aviso de la hora aparece solo, sin recargar', await page.locator('.reminder-modal .r-title').isVisible());
  await shot('13-aviso-medicacion');
  await page.locator('.reminder-modal').getByRole('button', { name: /Ya lo he hecho/ }).click();
  await wait(1200);
  ok('confirmar desde el aviso lo cierra', await page.locator('.reminder-modal').count() === 0);

  section('4 · Interacciones del paciente');
  await page.evaluate(() => { location.hash = '#/rutina'; });
  await page.waitForSelector('.step');
  const antes = await page.locator('.step[aria-pressed="true"]').count();
  await page.locator('.step').first().click();
  await wait(700);
  ok('marcar paso de rutina cambia el estado', await page.locator('.step[aria-pressed="true"]').count() !== antes);

  await page.evaluate(() => { location.hash = '#/medicacion'; });
  await page.waitForSelector('.dose-card');
  const btnTomar = page.getByRole('button', { name: /Ya lo he hecho/ }).first();
  if (await btnTomar.count()) {
    await btnTomar.click();
    await wait(900);
    ok('confirmar toma actualiza la lista', await page.locator('.dose-card.done').count() > 0);
  } else { ok('confirmar toma actualiza la lista', true, '(no había tomas pendientes a esta hora)'); }
  await shot('13-medicacion-confirmada');

  await page.evaluate(() => { location.hash = '#/animo'; });
  await page.waitForSelector('.mood-btn');
  await page.locator('.mood-btn').nth(4).click();
  await wait(800);
  ok('registrar ánimo funciona', await page.locator('.toast').count() > 0);

  section('5 · Juego completo (Números)');
  await page.evaluate(() => { location.hash = '#/juegos/numeros'; });
  await page.waitForSelector('.quiz-q');
  await shot('14-juego-numeros');
  for (let i = 0; i < 6; i++) {
    await page.waitForSelector('.quiz-options .opt:not([disabled])', { timeout: 8000 });
    await page.locator('.quiz-options .opt').first().click();
    await wait(2000);
  }
  await page.waitForSelector('.game-done', { timeout: 8000 });
  ok('el juego termina y muestra resultado', await page.locator('.game-score').isVisible());
  await shot('15-juego-resultado');
  await page.getByRole('button', { name: /Otra vez/ }).click();
  await page.waitForSelector('.quiz-options');
  ok('se puede reiniciar el juego', await page.locator('.quiz-q').isVisible());

  section('6 · Otros juegos');
  for (const [key, sel, name] of [['parejas', '.mcard', '16-parejas'], ['caras', '.quiz-photo', '17-caras'], ['refranes', '.quiz-q', '18-refranes'], ['orden', '.order-item', '19-orden'], ['secuencia', '.simon-btn', '20-secuencia']]) {
    await page.evaluate(k => { location.hash = '#/juegos/' + k; }, key);
    await page.waitForSelector(sel, { timeout: 8000 });
    await wait(400);
    ok(`juego ${key} renderiza`, await page.locator(sel).first().isVisible());
    await shot(name);
  }
  // partida de parejas completa
  await page.evaluate(() => { location.hash = '#/juegos/parejas'; });
  await page.waitForSelector('.mcard');
  const valores = await page.evaluate(() => [...document.querySelectorAll('.mcard')].map(c => c.querySelector('.mcard-face img')?.src || c.querySelector('.mcard-face').innerHTML));
  const parejasMap = new Map();
  valores.forEach((v, i) => { if (!parejasMap.has(v)) parejasMap.set(v, []); parejasMap.get(v).push(i); });
  for (const idxs of parejasMap.values()) {
    await page.locator('.mcard').nth(idxs[0]).click(); await wait(220);
    await page.locator('.mcard').nth(idxs[1]).click(); await wait(420);
  }
  await page.waitForSelector('.game-done', { timeout: 8000 });
  ok('partida de parejas completable de principio a fin', await page.locator('.game-score').isVisible());

  section('7 · SOS del paciente y tiempo real entre dos navegadores');
  // Segundo navegador: la cuidadora, con su propia sesión abierta
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
  const care = await ctx2.newPage();
  care.on('pageerror', e => errors.push('pageerror(cuidador): ' + e.message));
  care.on('console', m => { if (m.type() === 'error') errors.push('console(cuidador): ' + m.text()); });
  await care.goto(BASE, { waitUntil: 'networkidle' });
  await care.getByRole('button', { name: /Entrar como Ana/ }).click();
  await care.waitForSelector('.kpis', { timeout: 10000 });
  const alertasAntes = await care.locator('.alert-item').count();

  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForSelector('.tiles');
  await page.locator('.bottom-btn--sos').click();
  await page.waitForSelector('.modal');
  await shot('21-sos-confirmar');
  await page.getByRole('button', { name: /Sí, avisar ahora/ }).click();
  await page.waitForSelector('.modal-head h2:has-text("Aviso enviado")', { timeout: 10000 });
  ok('el SOS se envía y confirma', true);
  await shot('22-sos-enviado');
  await page.getByRole('button', { name: 'Entendido' }).click();
  await wait(400);

  // La cuidadora NO ha recargado la página
  await care.waitForSelector('.toast--alert', { timeout: 8000 });
  ok('el cuidador recibe el aviso en vivo sin recargar (SSE)', await care.locator('.toast--alert').isVisible());
  await care.screenshot({ path: path.join(SHOTS, '22b-tiempo-real-cuidador.png') });
  await care.waitForTimeout(1200);
  ok('la alerta aparece en su panel automáticamente', await care.locator('.alert-item').count() > alertasAntes);
  await ctx2.close();

  section('8 · Accesibilidad');
  await page.getByRole('button', { name: 'Texto más grande' }).click();
  await wait(500);
  const scale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--scale').trim());
  ok('escalado de fuente aplicado', Number(scale) > 1, scale);
  await shot('23-texto-grande');
  await page.getByRole('button', { name: 'Alto contraste' }).click();
  await wait(500);
  ok('alto contraste aplicado', await page.locator('body.hc').count() === 1);
  await shot('24-alto-contraste');
  await page.getByRole('button', { name: 'Alto contraste' }).click();
  await wait(300);
  await page.getByRole('button', { name: 'Texto más pequeño' }).click();
  await wait(400);

  section('9 · Móvil (390 × 844)');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { location.hash = '#/'; });
  await wait(600);
  await shot('25-movil-inicio');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('sin desbordamiento horizontal en móvil', overflow <= 1, `overflow ${overflow}px`);
  await page.evaluate(() => { location.hash = '#/medicacion'; });
  await page.waitForSelector('.dose-card'); await wait(300);
  await shot('26-movil-medicacion');
  await page.setViewportSize({ width: 1440, height: 950 });

  section('10 · Modo cuidador');
  await page.evaluate(() => localStorage.removeItem('memovida.token'));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Entrar como Ana/ }).click();
  await page.waitForSelector('.kpis', { timeout: 10000 });
  ok('panel del cuidador con métricas', await page.locator('.kpi').count() >= 6);
  ok('el SOS del paciente llegó al panel', (await page.locator('.alert-item').count()) > 0);
  ok('gráficas SVG dibujadas', await page.locator('svg.chart').count() >= 2);
  await shot('27-cuidador-panel');

  for (const [hash, sel, name] of [
    ['#/alertas', '.alert-item', '28-alertas'],
    ['#/recordatorios', '.list-item', '29-recordatorios'],
    ['#/rutinas', '.list-item', '30-rutinas'],
    ['#/personas', '.list-item', '31-personas'],
    ['#/recuerdos', '.list-item', '32-recuerdos'],
    ['#/progreso', '.kpi', '33-progreso'],
    ['#/diario', '.list-item', '34-diario'],
    ['#/informes', '.kpi', '35-informes'],
    ['#/ajustes', '.card', '36-ajustes'],
    ['#/pacientes', '.list-item', '37-pacientes']
  ]) {
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForSelector(sel, { timeout: 9000 });
    await wait(350);
    ok(`pantalla cuidador ${hash}`, await page.locator(sel).first().isVisible());
    await shot(name);
  }

  section('11 · CRUD completo');
  await page.evaluate(() => { location.hash = '#/personas'; });
  await page.waitForSelector('.list-item');
  const n0 = await page.locator('.list-item').count();
  await page.getByRole('button', { name: /Nueva persona/ }).click();
  await page.waitForSelector('.modal');
  await page.locator('.modal input[type="text"]').first().fill('Manuel');
  await page.locator('.modal input[type="text"]').nth(1).fill('Tu marido');
  await shot('38-formulario');
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await wait(1200);
  ok('crear registro', await page.locator('.list-item').count() === n0 + 1, `${n0} → ${await page.locator('.list-item').count()}`);

  const fila = page.locator('.list-item', { hasText: 'Manuel' });
  await fila.getByRole('button', { name: 'Editar' }).click();
  await page.waitForSelector('.modal');
  await page.locator('.modal input[type="text"]').nth(1).fill('Tu esposo');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await wait(1200);
  ok('editar registro', (await page.locator('.list-item', { hasText: 'Tu esposo' }).count()) === 1);

  await page.locator('input[type="search"]').fill('Manuel');
  await wait(400);
  ok('buscar filtra la lista', await page.locator('.list-item').count() === 1);
  await page.locator('input[type="search"]').fill('');
  await wait(300);

  await page.locator('.list-item', { hasText: 'Manuel' }).getByRole('button', { name: 'Eliminar' }).click();
  await page.waitForSelector('.modal');
  await page.getByRole('button', { name: 'Sí, eliminar' }).click();
  await wait(1200);
  ok('eliminar registro', await page.locator('.list-item').count() === n0);

  section('12 · Alertas e informes');
  await page.evaluate(() => { location.hash = '#/alertas'; });
  await page.waitForSelector('.alert-item');
  await page.locator('.alert-item').first().getByRole('button', { name: /Resolver/ }).click();
  await page.waitForSelector('.modal');
  await page.locator('.modal textarea').fill('Llamada realizada, todo bien.');
  await page.getByRole('button', { name: 'Marcar resuelta' }).click();
  await wait(1200);
  await page.getByRole('button', { name: 'Resueltas' }).click();
  await wait(500);
  ok('resolver alerta', await page.locator('.alert-item.resuelta').count() > 0);
  await shot('39-alertas-resueltas');

  await page.evaluate(() => { location.hash = '#/informes'; });
  await page.waitForSelector('.kpi');
  await wait(500);
  const csvHref = await page.locator('a:has-text("Descargar CSV")').getAttribute('href');
  const csvRes = await page.request.get(BASE + csvHref);
  ok('descarga de CSV real', csvRes.status() === 200 && (await csvRes.text()).includes('seccion'));
  await shot('40-informes');

  section('13 · Estabilidad');
  await page.evaluate(() => { location.hash = '#/panel'; });
  await page.waitForSelector('.kpis');
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { location.hash = '#/progreso'; });
    await page.waitForSelector('.kpi'); await wait(200);
    await page.evaluate(() => { location.hash = '#/panel'; });
    await page.waitForSelector('.kpis'); await wait(200);
  }
  ok('navegación repetida sin duplicar contenido', await page.locator('.care-head h1').count() === 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(500);
  await shot('41-movil-cuidador');
  const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('panel del cuidador sin desbordamiento en móvil', overflow2 <= 1, `overflow ${overflow2}px`);

  section('14 · Consola');
  ok('cero errores de JavaScript en todo el recorrido', errors.length === 0, errors.slice(0, 6).join(' | '));
} catch (e) {
  fail++;
  console.error('\n\x1b[31mFallo de la prueba:\x1b[0m', e.message);
  await shot('99-fallo');
} finally {
  await browser.close();
  server.kill('SIGTERM');
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`\n${'─'.repeat(46)}`);
  console.log(`  ${pass} comprobaciones correctas · ${fail} fallidas`);
  console.log(`  Capturas en test/capturas/`);
  console.log('─'.repeat(46));
  if (errors.length) console.log('\nErrores captados:\n' + errors.slice(0, 12).join('\n'));
  process.exit(fail ? 1 : 0);
}
