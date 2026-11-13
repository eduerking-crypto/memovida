/* MemoVida · Arranque de la demo estática.
   Intercepta /api/* para responder con el backend que corre en esta pestaña. */
(function () {
  'use strict';
  if (typeof window.process === 'undefined') window.process = { env: {} };
  if (typeof window.Buffer === 'undefined') {
    window.Buffer = {
      from(input, enc) {
        if (typeof input === 'string') {
          if (enc === 'hex') {
            const out = new Uint8Array(input.length >> 1);
            for (let i = 0; i < out.length; i++) out[i] = parseInt(input.substr(i * 2, 2), 16);
            return out;
          }
          return new TextEncoder().encode(input);
        }
        return new Uint8Array(input);
      },
      isBuffer: v => v instanceof Uint8Array,
      byteLength(s) { return new TextEncoder().encode(String(s)).length; },
      concat(list) {
        const n = list.reduce((a, b) => a + b.length, 0);
        const out = new Uint8Array(n);
        let o = 0;
        for (const b of list) { out.set(b, o); o += b.length; }
        return out;
      }
    };
  }
  var CORE = new URL('js/core/', document.baseURI).href;
  var ready = null;
  function api() { return ready || (ready = import(CORE + 'demo-server.js')); }

  /* ── fetch → router local ── */
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    init = init || {};
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    var u;
    try { u = new URL(url, document.baseURI); } catch (e) { return nativeFetch ? nativeFetch(input, init) : Promise.reject(e); }
    if (!u.pathname.startsWith('/api/')) {
      return nativeFetch ? nativeFetch(input, init) : Promise.reject(new Error('sin fetch'));
    }
    var method = String(init.method || 'GET').toUpperCase();
    var body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = {}; } }
    var headers = init.headers || {};
    var auth = headers.Authorization || headers.authorization || '';
    var token = String(auth).replace(/^Bearer\s+/i, '') || u.searchParams.get('token') || '';
    return api().then(function (mod) {
      return mod.handle(method, u.pathname, u.search, body, token);
    }).then(function (res) {
      if (res.raw !== undefined) {
        return new Response(res.raw, { status: 200, headers: { 'Content-Type': res.contentType || 'text/csv; charset=utf-8' } });
      }
      return new Response(JSON.stringify(res.body), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    });
  };

  /* ── EventSource → bus local ── */
  function DemoEventSource(url) {
    var self = this;
    this.url = String(url);
    this._closed = false;
    this._target = new EventTarget();
    this.addEventListener = this._target.addEventListener.bind(this._target);
    this.removeEventListener = this._target.removeEventListener.bind(this._target);
    this.dispatchEvent = this._target.dispatchEvent.bind(this._target);
    this._emit = function (type, data) {
      var ev = new Event(type);
      ev.data = JSON.stringify(data);
      self._target.dispatchEvent(ev);
    };
    import(CORE + 'bus.js').then(function (bus) { if (!self._closed) bus.attachStream(self); });
  }
  DemoEventSource.prototype.close = function () {
    this._closed = true;
    var self = this;
    import(CORE + 'bus.js').then(function (bus) { bus.detachStream(self); });
  };
  window.EventSource = DemoEventSource;

  /* ── Imágenes: "/img/x" → "img/x" ──
     GitHub Pages sirve la app en /memovida/, así que una ruta absoluta
     apunta fuera del proyecto. Lo corregimos también en tiempo de ejecución
     para que un HTML o JS cacheado por el navegador no rompa las fotos. */
  function fixImg(root) {
    if (!root || !root.querySelectorAll) return;
    var imgs = root.querySelectorAll('img[src^="/img/"]');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].setAttribute('src', imgs[i].getAttribute('src').replace(/^\/img\//, 'img/'));
    }
    var icons = root.querySelectorAll('link[href^="/img/"]');
    for (var j = 0; j < icons.length; j++) {
      icons[j].setAttribute('href', icons[j].getAttribute('href').replace(/^\/img\//, 'img/'));
    }
  }
  fixImg(document);
  document.addEventListener('DOMContentLoaded', function () { fixImg(document); });
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.tagName === 'IMG' && /^\/img\//.test(n.getAttribute('src') || '')) fixImg(n.parentNode || document);
          else if (n.querySelector && n.querySelector('img[src^="/img/"]')) fixImg(n);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ── Descarga de CSV (enlace <a download> hacia /api/...) ── */
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var a = el.closest('a[href*="/api/reports/export.csv"]');
    if (!a) return;
    e.preventDefault();
    var u = new URL(a.getAttribute('href'), document.baseURI);
    api().then(function (mod) {
      return mod.handle('GET', u.pathname, u.search, {}, u.searchParams.get('token') || '');
    }).then(function (res) {
      var blob = new Blob([res.raw || ''], { type: res.contentType || 'text/csv; charset=utf-8' });
      var dl = URL.createObjectURL(blob);
      var tmp = document.createElement('a');
      tmp.href = dl;
      tmp.download = res.filename || 'memovida.csv';
      document.body.appendChild(tmp);
      tmp.click();
      tmp.remove();
      setTimeout(function () { URL.revokeObjectURL(dl); }, 5000);
    });
  }, true);

  /* Primer uso: limpia el "modo demo" de la URL */
  if (location.search.indexOf('demo') >= 0) {
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* noop */ }
  }
})();
