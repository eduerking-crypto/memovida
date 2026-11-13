/**
 * Shim de node:fs sobre localStorage. La demo no tiene disco:
 * toda la "base de datos" vive en el navegador del usuario.
 */
const KEY = 'memovida.demo.db.v1';

export default {
  mkdirSync() {},
  existsSync() { return localStorage.getItem(KEY) !== null; },
  readFileSync() {
    const v = localStorage.getItem(KEY);
    if (v === null) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; }
    return v;
  },
  writeFileSync(_p, data) {
    try { localStorage.setItem(KEY, typeof data === 'string' ? data : String(data)); }
    catch (e) { console.warn('[demo] almacenamiento lleno', e); }
  },
  renameSync() {},
  statSync() { return { size: 0, isDirectory: () => false }; },
  createReadStream() { return null; }
};
