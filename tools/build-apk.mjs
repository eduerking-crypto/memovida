/**
 * MemoVida · Compilador de APK sin Gradle
 *
 * Usa directamente las herramientas del Android SDK:
 *   javac → d8 → aapt2 (compile/link) → jar (dex) → zipalign → apksigner
 *
 *   node tools/build-apk.mjs
 *
 * Requisitos: JDK 21 y Android SDK con build-tools + platform android-35.
 * Salida: build/MemoVida.apk (firmado, instalable desde Android 7.0)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = path.join(ROOT, 'android');
const BUILD = path.join(ROOT, 'build');
const WORK = path.join(BUILD, 'apk');

const MIN_SDK = 24;
const TARGET_SDK = 35;
const VERSION = '1.1.0';
const APP_ID = 'app.memovida';

/* ───────────────────────── utilidades ───────────────────────── */

const log = (...a) => console.log('  ', ...a);
const q = s => `"${s}"`;

function run(cmdline) {
  const r = spawnSync(cmdline, { shell: true, stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) {
    console.error(`\n❌ Falló: ${cmdline}\n`);
    process.exit(r.status || 1);
  }
}
function capture(cmdline) {
  return spawnSync(cmdline, { shell: true, encoding: 'utf8', cwd: ROOT });
}

function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Android', 'Sdk'),
    'C:/Android/Sdk'
  ].filter(Boolean);

  for (const sdk of candidates) {
    if (!fs.existsSync(sdk)) continue;
    const bt = path.join(sdk, 'build-tools');
    const pf = path.join(sdk, 'platforms');
    if (!fs.existsSync(bt) || !fs.existsSync(pf)) continue;
    const builds = fs.readdirSync(bt).filter(v => /^\d+\.\d+\.\d+$/.test(v)).sort((a, b) => {
      const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
      return pb[0] - pa[0] || pb[1] - pa[1] || pb[2] - pa[2];
    });
    const platforms = fs.readdirSync(pf).filter(v => /^android-\d+$/.test(v))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    if (!builds.length || !platforms.length) continue;
    return {
      sdk,
      buildTools: path.join(bt, builds[0]),
      androidJar: path.join(pf, platforms[0], 'android.jar'),
      platform: platforms[0]
    };
  }
  return null;
}

const tool = (dir, name) => {
  for (const ext of ['.exe', '.bat', '']) {
    const p = path.join(dir, name + ext);
    if (fs.existsSync(p)) return p;
  }
  return path.join(dir, name);
};

/* ───────────────────────── iconos PNG ───────────────────────── */

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = buf => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function inRoundedRect(u, v, x, y, w, h, r) {
  const cx = Math.max(x + r, Math.min(x + w - r, u));
  const cy = Math.max(y + r, Math.min(y + h - r, v));
  if (u >= x && u <= x + w && v >= y + r && v <= y + h - r) return true;
  if (v >= y && v <= y + h && u >= x + r && u <= x + w - r) return true;
  return Math.hypot(u - cx, v - cy) <= r;
}

/** Icono de MemoVida: cuadrado verde degradado con una "M" blanca. */
function renderIcon(size) {
  const ss = 3;
  const S = size * ss;
  const acc = new Float32Array(size * size * 4);
  const strokes = [
    [0.31, 0.73, 0.31, 0.32],
    [0.31, 0.32, 0.50, 0.55],
    [0.50, 0.55, 0.69, 0.32],
    [0.69, 0.32, 0.69, 0.73]
  ];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S, v = (y + 0.5) / S;
      let r = 0, g = 0, b = 0, a = 0;

      if (inRoundedRect(u, v, 0.015, 0.015, 0.97, 0.97, 0.235)) {
        const t = (v - 0.05) / 0.9;
        r = 0x1f + (0x12 - 0x1f) * t;
        g = 0x6f + (0x46 - 0x6f) * t;
        b = 0x5c + (0x3a - 0x5c) * t;
        a = 255;

        let d = Infinity;
        for (const s of strokes) d = Math.min(d, distSeg(u, v, s[0], s[1], s[2], s[3]));
        if (d < 0.078) { r = 255; g = 255; b = 255; }
        else if (d < 0.086) {
          const k = 1 - (d - 0.078) / 0.008;
          r = r + (255 - r) * k; g = g + (255 - g) * k; b = b + (255 - b) * k;
        }
      }

      const i = (((y / ss) | 0) * size + ((x / ss) | 0)) * 4;
      acc[i] += r; acc[i + 1] += g; acc[i + 2] += b; acc[i + 3] += a;
    }
  }

  const out = Buffer.alloc(size * size * 4);
  const n = ss * ss;
  for (let i = 0; i < out.length; i++) out[i] = Math.round(acc[i] / n);
  return encodePNG(size, size, out);
}

const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

/* ───────────────────────── zip (reescritura de rutas) ───────────────────────── */

/** aapt2 en Windows guarda "assets\public\..." — Android necesita "/". */
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('EOCD no encontrado');

  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = [];

  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('Central directory corrupto');
    const method = buf.readUInt16LE(off + 10);
    const time = buf.readUInt16LE(off + 12);
    const date = buf.readUInt16LE(off + 14);
    const crc = buf.readUInt32LE(off + 16);
    const csize = buf.readUInt32LE(off + 20);
    const usize = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);

    const lnameLen = buf.readUInt16LE(lho + 26);
    const lextraLen = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lnameLen + lextraLen;

    entries.push({ name, method, time, date, crc, csize, usize, data: buf.subarray(start, start + csize) });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function writeZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const flags = 0x0800;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(flags, 6);
    lh.writeUInt16LE(e.method, 8);
    lh.writeUInt16LE(e.time || 0, 10);
    lh.writeUInt16LE(e.date || 0x21, 12);
    lh.writeUInt32LE(e.crc, 14);
    lh.writeUInt32LE(e.csize, 18);
    lh.writeUInt32LE(e.usize, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    parts.push(lh, name, e.data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(flags, 8);
    ch.writeUInt16LE(e.method, 10);
    ch.writeUInt16LE(e.time || 0, 12);
    ch.writeUInt16LE(e.date || 0x21, 14);
    ch.writeUInt32LE(e.crc, 16);
    ch.writeUInt32LE(e.csize, 20);
    ch.writeUInt32LE(e.usize, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += 30 + name.length + e.data.length;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...parts, cd, eocd]);
}

/* ───────────────────────── build ───────────────────────── */

console.log('\n📱  Compilando MemoVida.apk\n');

const sdk = findSdk();
if (!sdk) {
  console.error('❌ No encontré el Android SDK. Define ANDROID_HOME.\n');
  process.exit(1);
}
log(`SDK          ${sdk.sdk}`);
log(`build-tools  ${path.basename(sdk.buildTools)}`);
log(`platform     ${sdk.platform}`);

const AAPT2 = tool(sdk.buildTools, 'aapt2');
const D8 = tool(sdk.buildTools, 'd8');
const ZIPALIGN = tool(sdk.buildTools, 'zipalign');
const APKSIGNER = tool(sdk.buildTools, 'apksigner');

/* 0. limpiar */
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(BUILD, { recursive: true });

/* 1. assets = demo estática */
const DOCS = path.join(ROOT, 'docs');
if (!fs.existsSync(path.join(DOCS, 'index.html'))) {
  console.error('❌ Falta docs/. Ejecuta primero: node tools/build-demo.mjs\n');
  process.exit(1);
}
const ASSETS = path.join(WORK, 'assets');
fs.cpSync(DOCS, path.join(ASSETS, 'public'), { recursive: true });
log('assets/public ← docs/');

/* 2. iconos */
for (const [density, size] of Object.entries(DENSITIES)) {
  const dir = path.join(ANDROID, 'res', `mipmap-${density}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), renderIcon(size));
}
log('iconos generados (5 densidades)');

/* 3. recursos */
run(`${q(AAPT2)} compile --dir ${q(path.join(ANDROID, 'res'))} -o ${q(path.join(WORK, 'res.zip'))}`);
log('aapt2 compile');

/* 4. R.java + APK base */
const GEN = path.join(WORK, 'gen');
fs.mkdirSync(GEN, { recursive: true });
run([
  q(AAPT2), 'link',
  '-o', q(path.join(WORK, 'base.apk')),
  '-I', q(sdk.androidJar),
  '--manifest', q(path.join(ANDROID, 'AndroidManifest.xml')),
  '-R', q(path.join(WORK, 'res.zip')),
  '--java', q(GEN),
  '--min-sdk-version', String(MIN_SDK),
  '--target-sdk-version', String(TARGET_SDK),
  '--auto-add-overlay',
  '-A', q(ASSETS)
].join(' '));
log('aapt2 link');

/* 5. javac */
const CLASSES = path.join(WORK, 'classes');
fs.mkdirSync(CLASSES, { recursive: true });
const javaFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.java')) javaFiles.push(p);
  }
})(path.join(ANDROID, 'java'));
if (fs.existsSync(GEN)) {
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.java')) javaFiles.push(p);
    }
  })(GEN);
}

run([
  'javac', '--release', '11',
  '-encoding', 'UTF-8',
  '-classpath', q(sdk.androidJar),
  '-d', q(CLASSES),
  ...javaFiles.map(q)
].join(' '));
log('javac');

/* 6. d8 → classes.dex */
const DEX = path.join(WORK, 'dex');
fs.mkdirSync(DEX, { recursive: true });
const classFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.class')) classFiles.push(p);
  }
})(CLASSES);

run([
  q(D8),
  '--min-api', String(MIN_SDK),
  '--lib', q(sdk.androidJar),
  '--output', q(DEX),
  ...classFiles.map(q)
].join(' '));
log('d8 → classes.dex');

/* 7. añadir classes.dex + normalizar rutas del zip */
const dexData = fs.readFileSync(path.join(DEX, 'classes.dex'));
const baseApk = path.join(WORK, 'base.apk');
const entries = readZip(fs.readFileSync(baseApk))
  .filter(e => !e.name.startsWith('META-INF/'))
  .map(e => ({ ...e, name: e.name.replace(/\\/g, '/') }));

entries.push({
  name: 'classes.dex', method: 0, time: 0, date: 0x21,
  crc: crc32(dexData), csize: dexData.length, usize: dexData.length, data: dexData
});

fs.writeFileSync(baseApk, writeZip(entries));
log(`dex empaquetado + ${entries.length} entradas normalizadas`);

/* 8. zipalign */
run(`${q(ZIPALIGN)} -f -p 4 ${q(path.join(WORK, 'base.apk'))} ${q(path.join(WORK, 'aligned.apk'))}`);
log('zipalign');

/* 9. keystore + firma */
const KS_DIR = path.join(BUILD, 'keystore');
const KS = path.join(KS_DIR, 'memovida.jks');
fs.mkdirSync(KS_DIR, { recursive: true });
if (!fs.existsSync(KS)) {
  run([
    'keytool', '-genkeypair',
    '-keystore', q(KS),
    '-alias', 'memovida',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10950',
    '-storepass', 'memovida', '-keypass', 'memovida',
    '-dname', q('CN=MemoVida, OU=App, O=MemoVida, L=Madrid, C=ES')
  ].join(' '));
  log('keystore creado (build/keystore/memovida.jks)');
}

const OUT_APK = path.join(BUILD, `MemoVida-${VERSION}.apk`);
run([
  q(APKSIGNER), 'sign',
  '--ks', q(KS),
  '--ks-key-alias', 'memovida',
  '--ks-pass', 'pass:memovida',
  '--key-pass', 'pass:memovida',
  '--min-sdk-version', String(MIN_SDK),
  '--out', q(OUT_APK),
  q(path.join(WORK, 'aligned.apk'))
].join(' '));
log('apksigner');

/* 10. verificación */
const verify = capture(`${q(APKSIGNER)} verify --print-certs ${q(OUT_APK)}`);
if (verify.status !== 0) {
  console.error('❌ El APK no pasa la verificación de firma\n' + (verify.stderr || ''));
  process.exit(1);
}
const size = fs.statSync(OUT_APK).size;

/* copia con nombre corto */
fs.copyFileSync(OUT_APK, path.join(BUILD, 'MemoVida.apk'));

console.log(`\n✅  APK listo: ${OUT_APK}`);
console.log(`    ${(size / 1024 / 1024).toFixed(1)} MB · minSdk ${MIN_SDK} · targetSdk ${TARGET_SDK}`);
console.log(`    Firma: ${/Signer #1 certificate DN: (.+)/.exec(verify.stdout || '')?.[1] || 'verificada'}`);
console.log(`    Copia: build/MemoVida.apk\n`);
