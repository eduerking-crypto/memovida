/** Shim de node:url para el navegador. */
export function fileURLToPath(u) { return String(u).replace(/^file:\/\/(\/)?/, ''); }
export function pathToFileURL(p) { return new URL('file://' + p); }
