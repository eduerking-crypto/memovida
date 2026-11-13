/**
 * MemoVida · Pictogramas vectoriales propios
 * La app NO depende de fuentes de emoji: cada pictograma es un SVG
 * dibujado a mano, hereda el color (currentColor) y escala con el texto.
 * Esto garantiza que se vea igual en cualquier dispositivo y navegador.
 */

const P = {
  home: '<path d="M3.2 10.6 12 3.4l8.8 7.2"/><path d="M5.6 9.6V20h12.8V9.6"/><path d="M9.8 20v-5.2h4.4V20"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 6.8V12l3.4 2.1"/>',
  calendar: '<rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.4"/><path d="M8 3.4v3.6M16 3.4v3.6M3.4 10h17.2"/>',
  pill: '<rect x="2.6" y="8.4" width="18.8" height="7.2" rx="3.6" transform="rotate(-45 12 12)"/><path d="M9.2 9.2 14.8 14.8"/>',
  heart: '<path d="M12 20.2c-6.6-4.3-8.4-8-7.2-11A4.3 4.3 0 0 1 12 8.1a4.3 4.3 0 0 1 7.2 1.1c1.2 3-.6 6.7-7.2 11z"/>',
  droplet: '<path d="M12 3.2c3.4 4 5.6 6.9 5.6 9.6a5.6 5.6 0 1 1-11.2 0c0-2.7 2.2-5.6 5.6-9.6z"/>',
  walk: '<circle cx="13.2" cy="4.6" r="2"/><path d="m11.4 9 3.4 1.2 1.8 3.2M11.4 9 8.6 12.2l2.8 1.6.8 6.2M12.2 13.8 8.2 20"/>',
  users: '<circle cx="9" cy="8.4" r="3.2"/><path d="M3.4 19.6c0-3.1 2.5-5.2 5.6-5.2s5.6 2.1 5.6 5.2"/><circle cx="17.4" cy="9.4" r="2.4"/><path d="M16.2 14.6c2.5-.3 4.4 1.5 4.4 4"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c0-3.7 3.2-6 7.2-6s7.2 2.3 7.2 6"/>',
  'user-plus': '<circle cx="9.6" cy="8" r="3.4"/><path d="M3.4 20c0-3.5 2.8-5.8 6.2-5.8"/><path d="M17.4 13.4v6M14.4 16.4h6"/>',
  book: '<path d="M4.2 5.4A2.4 2.4 0 0 1 6.6 3h12.6v14.4H6.6a2.4 2.4 0 0 0-2.4 2.4z"/><path d="M19.2 17.4V21H6.6M8.4 7.4h7"/>',
  'check-square': '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3.4"/><path d="m8 12.2 2.8 2.8L16.4 9"/>',
  brain: '<path d="M12 5.2a3 3 0 0 0-5.6-1.1A2.9 2.9 0 0 0 4 7.4a3 3 0 0 0-.4 5.3A3 3 0 0 0 6 17.9a3 3 0 0 0 6 .6z"/><path d="M12 5.2a3 3 0 0 1 5.6-1.1A2.9 2.9 0 0 1 20 7.4a3 3 0 0 1 .4 5.3A3 3 0 0 1 18 17.9a3 3 0 0 1-6 .6z"/><path d="M12 5.2v13.3"/>',
  wind: '<path d="M3.4 8.6h9a2.6 2.6 0 1 0-2.6-2.6"/><path d="M3.4 12.6h13a2.6 2.6 0 1 1-2.6 2.6"/><path d="M3.4 16.6h6.4"/>',
  'id-card': '<rect x="2.6" y="4.6" width="18.8" height="14.8" rx="2.6"/><circle cx="8.4" cy="11" r="2.2"/><path d="M5 16.4c.5-1.6 1.9-2.4 3.4-2.4s2.9.8 3.4 2.4M14.6 10h4M14.6 13.4h4"/>',
  sos: '<circle cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="3.6"/><path d="m5.8 5.8 3.6 3.6M14.6 14.6l3.6 3.6M18.2 5.8l-3.6 3.6M9.4 14.6l-3.6 3.6"/>',
  phone: '<path d="M6.2 3.6h3l1.6 4-2 1.4a11.6 11.6 0 0 0 5.6 5.6l1.4-2 4 1.6v3a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 4.2 5.8a2 2 0 0 1 2-2.2z"/>',
  bell: '<path d="M18 16.4v-5.2a6 6 0 1 0-12 0v5.2L4.2 18.6h15.6z"/><path d="M9.8 18.6a2.2 2.2 0 0 0 4.4 0"/>',
  'arrow-left': '<path d="M20 12H4.6M10.6 6 4.6 12l6 6"/>',
  'arrow-right': '<path d="M4 12h15.4M13.4 6l6 6-6 6"/>',
  'arrow-up': '<path d="M12 20V4.6M6 10.6 12 4.6l6 6"/>',
  'arrow-down': '<path d="M12 4v15.4M6 13.4l6 6 6-6"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.4 4.4v4.4H16"/>',
  rotate: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M3.6 4.4v4.4H8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pencil: '<path d="M4 20.2h4.2L20 8.4a2.2 2.2 0 0 0-3.1-3.1L5 17.1z"/><path d="m15.6 6.6 3.1 3.1"/>',
  trash: '<path d="M4.6 6.6h14.8M9.4 6.6V4.4h5.2v2.2M6.6 6.6l1 13.4h8.8l1-13.4"/><path d="M10.4 10.4v6M13.6 10.4v6"/>',
  eye: '<path d="M2.4 12S6.2 5.8 12 5.8 21.6 12 21.6 12 17.8 18.2 12 18.2 2.4 12 2.4 12z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="m15.6 15.6 4.4 4.4"/>',
  download: '<path d="M12 3.6v11M7.4 10.4 12 15l4.6-4.6"/><path d="M4.4 17.4v2.2h15.2v-2.2"/>',
  printer: '<path d="M7 8.4V3.8h10v4.6"/><rect x="3.4" y="8.4" width="17.2" height="7.6" rx="2"/><path d="M7 13.6h10v6.6H7z"/>',
  copy: '<rect x="8.4" y="8.4" width="11.2" height="11.2" rx="2.2"/><path d="M15.6 5.4H6.6a2.2 2.2 0 0 0-2.2 2.2v9"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5 16.7 16.7M7.3 7.3 5.5 5.5"/>',
  chart: '<path d="M4 20h16"/><rect x="5.6" y="11" width="3.6" height="6.6" rx="1"/><rect x="10.4" y="6.6" width="3.6" height="11" rx="1"/><rect x="15.2" y="9" width="3.6" height="8.6" rx="1"/>',
  trend: '<path d="M4 19.4h16"/><path d="m5.6 15.4 4-4.4 3.2 2.6 5.6-6.4"/><path d="M18.4 7.2h-3.4M18.4 7.2v3.4"/>',
  notebook: '<rect x="5.4" y="3.6" width="14" height="16.8" rx="2.4"/><path d="M9 3.6v16.8M11.6 8.4h5M11.6 12h5"/>',
  clipboard: '<rect x="5.4" y="4.6" width="13.2" height="15.8" rx="2.4"/><path d="M9.4 4.6V3.4h5.2v1.2"/><path d="m8.8 11.4 1.6 1.6 3.2-3.2M8.8 16.2h6.4"/>',
  alert: '<path d="M12 4.2 21 19.4H3z"/><path d="M12 10v4M12 16.6v.6"/>',
  siren: '<path d="M6.4 16.4a5.6 5.6 0 0 1 11.2 0z"/><path d="M4.4 19.4h15.2M12 4.4v2M5.6 7 7 8.4M18.4 7 17 8.4"/>',
  'map-pin': '<path d="M12 21c4.2-4.6 6.4-7.9 6.4-10.6a6.4 6.4 0 1 0-12.8 0C5.6 13.1 7.8 16.4 12 21z"/><circle cx="12" cy="10.4" r="2.4"/>',
  map: '<path d="m3.6 6.6 5.6-2.2 5.6 2.2 5.6-2.2v13l-5.6 2.2-5.6-2.2-5.6 2.2z"/><path d="M9.2 4.4v13M14.8 6.6v13"/>',
  camera: '<rect x="3" y="6.6" width="18" height="13" rx="2.6"/><circle cx="12" cy="13" r="3.6"/><path d="M8.6 6.6 10 4.4h4l1.4 2.2"/>',
  image: '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.6"/><circle cx="8.6" cy="9.6" r="1.8"/><path d="m4.4 17.4 5-5 3.4 3.2 3-2.6 4.4 4"/>',
  sparkles: '<path d="m11 3.4 1.7 4.5 4.5 1.7-4.5 1.7L11 15.8l-1.7-4.5L4.8 9.6l4.5-1.7z"/><path d="m18 15.4.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z"/>',
  moon: '<path d="M20 14.4A8.6 8.6 0 0 1 9.6 4a8.8 8.8 0 1 0 10.4 10.4z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.4M12 19v2.4M21.4 12H19M5 12H2.6M18.7 5.3 17 7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3"/>',
  sunrise: '<path d="M2.6 18.4h18.8M6.6 18.4a5.4 5.4 0 0 1 10.8 0M12 3.4v3.2M5.6 9.4 7.3 11M18.4 9.4 16.7 11"/><path d="m9.4 5.6 2.6-2.6 2.6 2.6"/>',
  sunset: '<path d="M2.6 18.4h18.8M6.6 18.4a5.4 5.4 0 0 1 10.8 0M5.6 9.4 7.3 11M18.4 9.4 16.7 11"/><path d="m9.4 4 2.6 2.6L14.6 4M12 6.6V3.4"/>',
  volume: '<path d="M4.6 9.4h3.2L12 5.6v12.8l-4.2-3.8H4.6z"/><path d="M15.4 9.4a3.6 3.6 0 0 1 0 5.2M18 7a7 7 0 0 1 0 10"/>',
  'volume-off': '<path d="M4.6 9.4h3.2L12 5.6v12.8l-4.2-3.8H4.6z"/><path d="m16 9.6 4.4 4.8M20.4 9.6 16 14.4"/>',
  contrast: '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4a8.6 8.6 0 0 1 0 17.2z" fill="currentColor" stroke="none"/>',
  logout: '<path d="M14.4 4.6H6.6a2 2 0 0 0-2 2v10.8a2 2 0 0 0 2 2h7.8"/><path d="M17.4 8.4 21 12l-3.6 3.6M21 12h-9.6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.6 4.6 4.6L19 6.6"/>',
  'check-circle': '<circle cx="12" cy="12" r="8.8"/><path d="m8 12.4 2.8 2.8 5.4-5.6"/>',
  'x-circle': '<circle cx="12" cy="12" r="8.8"/><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/>',
  square: '<rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3.2"/>',
  play: '<path d="M8 5.4 19 12 8 18.6z"/>',
  stop: '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.4"/>',
  pause: '<path d="M9.4 5.6v12.8M14.6 5.6v12.8"/>',
  alarm: '<circle cx="12" cy="13.4" r="7.4"/><path d="M12 9.6v3.8l2.6 1.6M4.6 5.4 7.4 3M19.4 5.4 16.6 3"/>',
  hourglass: '<path d="M7 3.6h10M7 20.4h10M8 3.6c0 4 4 5.4 4 8.4s-4 4.4-4 8.4M16 3.6c0 4-4 5.4-4 8.4s4 4.4 4 8.4"/>',
  gamepad: '<rect x="2.6" y="7.4" width="18.8" height="10.4" rx="4.4"/><path d="M7.4 10.6v4M5.4 12.6h4"/><circle cx="16" cy="11.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="18.4" cy="14" r="1.1" fill="currentColor" stroke="none"/>',
  target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  link: '<path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2"/><path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2"/>',
  shield: '<path d="M12 3.2 19.4 6v6c0 4.2-3 7.2-7.4 8.8C7.6 19.2 4.6 16.2 4.6 12V6z"/><path d="m9 12 2.2 2.2L15.4 10"/>',
  lock: '<rect x="4.8" y="10.4" width="14.4" height="9.8" rx="2.4"/><path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6"/>',
  bed: '<path d="M3.4 19.4v-11M3.4 12.6h17.2v6.8M20.6 12.6a3.4 3.4 0 0 0-3.4-3.4h-5.6v3.4"/><circle cx="7.6" cy="10.2" r="2"/>',
  shirt: '<path d="M8.4 3.6 4 6l1.6 3.6 2-.8V20h8.8V8.8l2 .8L20 6l-4.4-2.4a3.6 3.6 0 0 1-7.2 0z"/>',
  coffee: '<path d="M4.6 8.4h12v6a4.4 4.4 0 0 1-4.4 4.4H9a4.4 4.4 0 0 1-4.4-4.4z"/><path d="M16.6 10h1.8a2.4 2.4 0 0 1 0 4.8h-1.8M7 3.4v2.2M10.4 3.4v2.2M13.8 3.4v2.2"/>',
  toothbrush: '<path d="m4.4 17.6 8.4-8.4"/><rect x="12.8" y="4.6" width="7" height="4.2" rx="1.6" transform="rotate(45 16.3 6.7)"/><path d="m3.4 18.6 2 2"/>',
  utensils: '<path d="M7 3.4v7.2a2.4 2.4 0 0 0 4.8 0V3.4M9.4 10.6v10M16.4 3.4c-1.6 1.2-2.4 3-2.4 5.2s.8 3.4 2.4 3.8v8.2"/>',
  bowl: '<path d="M3.4 11.4h17.2a8.6 8.6 0 0 1-17.2 0z"/><path d="M8.4 7.4c0-1.4 1.2-1.8 1.2-3M12 7.4c0-1.4 1.2-1.8 1.2-3M15.6 7.4c0-1.4 1.2-1.8 1.2-3"/>',
  plant: '<path d="M7.4 12.6h9.2l-1 7.8H8.4z"/><path d="M12 12.6c0-3.4 1.6-5.6 4.6-6.4-.4 3.4-2 5.4-4.6 6.4zM12 12.6c-.4-2.8-2-4.6-4.6-5.2.4 2.8 1.8 4.6 4.6 5.2z"/>',
  leaf: '<path d="M20 4.4C10 4.4 4.4 8.6 4.4 15.2c0 1.6.4 3 .8 4.4C13 19.6 20 15 20 4.4z"/><path d="M5.2 19.6C8 14 12.4 10.6 17 8.8"/>',
  dog: '<path d="M5.4 6.4 4 3.4l3.6 1.4h8.8L20 3.4l-1.4 3v6.2c0 3.6-2.8 6.4-6.6 6.4s-6.6-2.8-6.6-6.4z"/><circle cx="9.4" cy="10.4" r="1" fill="currentColor" stroke="none"/><circle cx="14.6" cy="10.4" r="1" fill="currentColor" stroke="none"/><path d="M12 13.4v1.6M10.4 16h3.2"/>',
  cat: '<path d="M4.6 9.4 3.6 4l4.2 2.6h8.4L20.4 4l-1 5.4v3.2c0 3.6-3.2 6.4-7.4 6.4s-7.4-2.8-7.4-6.4z"/><circle cx="9.4" cy="10.6" r="1" fill="currentColor" stroke="none"/><circle cx="14.6" cy="10.6" r="1" fill="currentColor" stroke="none"/><path d="M12 13.2v1.4M4 12.4h3M17 12.4h3"/>',
  flower: '<circle cx="12" cy="7.6" r="2.6"/><circle cx="16.3" cy="10.7" r="2.6"/><circle cx="14.7" cy="15.8" r="2.6"/><circle cx="9.3" cy="15.8" r="2.6"/><circle cx="7.7" cy="10.7" r="2.6"/><circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none"/>',
  car: '<path d="M5.4 15.4 7 9.4h10l1.6 6"/><rect x="3.4" y="15.4" width="17.2" height="3.4" rx="1.6"/><circle cx="7.4" cy="19.6" r="1.5"/><circle cx="16.6" cy="19.6" r="1.5"/>',
  cake: '<path d="M4.4 20.4h15.2v-6a2.4 2.4 0 0 0-2.4-2.4H6.8a2.4 2.4 0 0 0-2.4 2.4z"/><path d="M12 12V8.4M8 12V9.6M16 12V9.6"/><path d="M12 5.2c.8.8.8 1.6 0 2.4-.8-.8-.8-1.6 0-2.4z"/>',
  music: '<path d="M9 18V6.4l10-2v11.2"/><circle cx="6.6" cy="18" r="2.6"/><circle cx="16.6" cy="15.6" r="2.6"/>',
  tree: '<path d="M12 20.4v-4.6"/><path d="M12 3.4 6.4 11h3l-4 5.4h13.2L14.6 11h3z"/>',
  apple: '<path d="M12 7.4c-1.6-1.6-4.4-1.4-5.8.6-1.6 2.2-.8 6.4 1.4 9 1.2 1.4 2.6 1.8 4.4 1.2 1.8.6 3.2.2 4.4-1.2 2.2-2.6 3-6.8 1.4-9-1.4-2-4.2-2.2-5.8-.6z"/><path d="M12 7.4V4.8M12 4.8c1.6 0 2.6-1 2.8-2.2-1.6-.2-2.6.6-2.8 2.2z"/>',
  ball: '<circle cx="12" cy="12" r="8.8"/><path d="m12 7.6 3.3 2.4-1.3 4h-4l-1.3-4z"/><path d="M12 3.2v4.4M20.4 10.8l-5.1-.8M17.8 19.2l-3.8-5.2M6.2 19.2l3.8-5.2M3.6 10.8l5.1-.8"/>',
  umbrella: '<path d="M3.4 12.6a8.6 8.6 0 0 1 17.2 0z"/><path d="M12 12.6v6a2.4 2.4 0 0 0 4.8 0"/>',
  star: '<path d="m12 3.6 2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 17.4l-5.3 2.9 1.1-6.1L3.4 10l6-.8z"/>',
  fish: '<path d="M4.4 12c3-4 6.4-6 10-6s6.4 2 7.2 6c-.8 4-3.6 6-7.2 6s-7-2-10-6z"/><path d="m4.4 12-.6-3.4 3.2 2M4.4 12l-.6 3.4 3.2-2"/><circle cx="16.4" cy="10.6" r="1" fill="currentColor" stroke="none"/>',
  cookie: '<circle cx="12" cy="12" r="8.8"/><circle cx="9.4" cy="9.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.6" cy="10.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="11.4" cy="14.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15" r=".9" fill="currentColor" stroke="none"/>',
  balloon: '<path d="M12 3.4c3.2 0 5.4 2.4 5.4 5.6S15.2 15.4 12 15.4 6.6 12.2 6.6 9 8.8 3.4 12 3.4z"/><path d="M12 15.4v1.6M12 17c1.4 1-.6 2 0 3.4"/>',
  question: '<circle cx="12" cy="12" r="8.8"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.7M12 16.6v.4"/>',
  puzzle: '<path d="M10 4.4h3.4a1.6 1.6 0 1 1 3.2 0v2.2h3v3.4a1.6 1.6 0 1 1 0 3.2v4.4h-4a1.6 1.6 0 1 0-3.2 0h-4v-4a1.6 1.6 0 1 0 0-3.2V6.6H10z"/>',
  medical: '<path d="M6 3.4v5a4 4 0 0 0 8 0v-5M6 3.4H4.4M14 3.4h1.6M10 12.4v2.2a4.4 4.4 0 0 0 8.8 0v-1.2"/><circle cx="18.8" cy="11" r="2"/>',
  sleep: '<path d="M4.4 8.4h5l-5 6h5M12.4 4.4h6l-6 7.6h6"/>',
  'hand-heart': '<path d="M12 10.2c-1.4-1.6-3.6-1-3.6 1 0 1.6 2 3.2 3.6 4.2 1.6-1 3.6-2.6 3.6-4.2 0-2-2.2-2.6-3.6-1z"/><path d="M4.4 14.4v5h9.2l5.6-2.6a1.6 1.6 0 0 0-1.4-2.8l-3.8 1.4"/>',
  hand: '<path d="M8.4 12.4V6.6a1.5 1.5 0 0 1 3 0v5M11.4 11.4V5.4a1.5 1.5 0 0 1 3 0v6M14.4 11.6V7.4a1.5 1.5 0 0 1 3 0v7.2c0 3.2-2.2 5.8-5.6 5.8s-5.8-2.4-5.8-5.6v-3a1.5 1.5 0 0 1 3 0"/>',
  ambulance: '<rect x="2.6" y="8.4" width="12" height="7.6" rx="1.6"/><path d="M14.6 11h3.4l3 3v2h-6.4z"/><circle cx="6.6" cy="18" r="1.8"/><circle cx="17.4" cy="18" r="1.8"/><path d="M8.6 10.4v3.6M6.8 12.2h3.6"/>',
  compass: '<circle cx="12" cy="12" r="8.8"/><path d="m15.4 8.6-2 4.8-4.8 2 2-4.8z"/>',
  chat: '<path d="M20.4 12.4c0 4-3.8 7-8.4 7-1.2 0-2.4-.2-3.4-.6L4 20.4l1.4-3.6c-1.2-1.2-1.8-2.8-1.8-4.4 0-4 3.8-7 8.4-7s8.4 3 8.4 7z"/>',
  thought: '<path d="M8.4 15.4a4.4 4.4 0 0 1-.6-8.8 4.8 4.8 0 0 1 9.2-1 4 4 0 0 1 .6 8z"/><circle cx="6.6" cy="18.6" r="1.5"/><circle cx="3.6" cy="20.8" r=".9"/>',
  save: '<path d="M4.4 6.4a2 2 0 0 1 2-2h9.2l4 4v9.2a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2z"/><path d="M8.4 4.4v5h7v-5M8.4 19.6v-5.2h7.2v5.2"/>',
  file: '<path d="M6.4 3.6h7.2l4.8 4.8v12H6.4z"/><path d="M13.6 3.6v4.8h4.8M9.4 12.4h5.2M9.4 15.6h5.2"/>',
  signal: '<path d="M12 18.4v.4"/><path d="M8.6 15a4.8 4.8 0 0 1 6.8 0M5.6 11.8a9 9 0 0 1 12.8 0M2.8 8.6a13 13 0 0 1 18.4 0"/>',
  numbers: '<path d="M6.4 4.6 4.4 6M6.4 4.6v14M4.4 18.6h4"/><path d="M12.6 7a2.4 2.4 0 1 1 4.8.6c0 2-4.8 3.4-4.8 6.4h5"/>',
  graduation: '<path d="m3.4 9 8.6-4 8.6 4-8.6 4z"/><path d="M7.4 11v4.6c0 1.4 2 2.4 4.6 2.4s4.6-1 4.6-2.4V11M20.6 9v5"/>',
  plane: '<path d="M11 3.4h2l.8 6.6 6.6 3.4v1.8l-6.6-1.6-.6 3.8 2.2 1.6v1.2L12 19.4l-3.4 1v-1.2l2.2-1.6-.6-3.8-6.6 1.6v-1.8l6.6-3.4z"/>',
  snowflake: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="m9.4 4.6 2.6 2 2.6-2M9.4 19.4l2.6-2 2.6 2"/>',
  party: '<path d="m4.4 19.6 5-12 6.8 6.8z"/><path d="M14 4.4v2M18.4 6.6 17 8M20.4 11h-2M16.6 3.4l.8 1.6"/>',
  cards: '<rect x="3.4" y="5.4" width="10" height="13.2" rx="2.2"/><path d="M16 6.6l3.6 1a2 2 0 0 1 1.4 2.4l-2.4 8.6"/><path d="M8.4 9.4v5.2M5.8 12h5.2"/>',
  pin: '<path d="M14.4 3.6 20.4 9.6l-3 1-3.6 3.6-.6 4-6.4-6.4 4-.6L14.4 7z"/><path d="m6.8 17.2-3.2 3.2"/>',
  filter: '<path d="M3.6 5.4h16.8l-6.4 7.4v6.2l-4 1.6v-7.8z"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h8.4M17.4 12v3.4M20 12v2.6"/>',
  door: '<path d="M6.4 3.6h11.2v16.8H6.4z"/><circle cx="14.4" cy="12" r="1" fill="currentColor" stroke="none"/>',
  cloud: '<path d="M7.4 18.4a4.4 4.4 0 0 1-.4-8.8 5.6 5.6 0 0 1 10.8-1 3.9 3.9 0 0 1 .2 7.8z"/>',
  gift: '<rect x="3.6" y="8.4" width="16.8" height="4" rx="1.2"/><path d="M5.4 12.4v8h13.2v-8M12 8.4v12"/><path d="M12 8.4C10 8.4 7.6 8 7.6 6s2.4-2 4.4 2.4c2-4.4 4.4-4.4 4.4-2.4s-2.4 2.4-4.4 2.4z"/>'
};

/* Caras de estado de ánimo (1 = muy mal … 5 = muy bien) */
const OJOS = '<circle cx="9.3" cy="10" r="1.05" fill="currentColor" stroke="none"/><circle cx="14.7" cy="10" r="1.05" fill="currentColor" stroke="none"/>';
P.face1 = `<circle cx="12" cy="12" r="8.8"/>${OJOS}<path d="M8.4 16.6c1.4-2 5.8-2 7.2 0"/><path d="M8.6 12.4c.6 1.2.6 2 0 2.6-.6-.6-.6-1.4 0-2.6z" fill="currentColor" stroke="none"/>`;
P.face2 = `<circle cx="12" cy="12" r="8.8"/>${OJOS}<path d="M8.6 16c1.4-1.2 5.4-1.2 6.8 0"/>`;
P.face3 = `<circle cx="12" cy="12" r="8.8"/>${OJOS}<path d="M8.8 15.4h6.4"/>`;
P.face4 = `<circle cx="12" cy="12" r="8.8"/>${OJOS}<path d="M8.4 14.4c1.4 1.8 5.8 1.8 7.2 0"/>`;
P.face5 = `<circle cx="12" cy="12" r="8.8"/>${OJOS}<path d="M7.8 13.8c1.6 3 6.8 3 8.4 0z"/>`;

/* Emoji heredado (o escrito por el usuario) → pictograma vectorial */
const LEGACY = {
  '🕒': 'clock', '🕰': 'clock', '⏰': 'alarm', '⏳': 'hourglass', '📅': 'calendar',
  '💊': 'pill', '❤': 'heart', '💚': 'heart', '💧': 'droplet', '🚶‍♀': 'walk', '🚶': 'walk',
  '🏠': 'home', '🌙': 'moon', '☀': 'sun', '🌞': 'sun', '🌅': 'sunrise', '🌇': 'sunset',
  '👨‍👩‍👧': 'users', '👤': 'user', '🧑‍🦳': 'user', '📖': 'book', '📚': 'book',
  '✅': 'check-circle', '⬜': 'square', '❌': 'x-circle', '✕': 'x', '🧠': 'brain',
  '🌬': 'wind', '🙂': 'face4', '😄': 'face5', '😐': 'face3', '🙁': 'face2', '😢': 'face1',
  '😴': 'sleep', '💤': 'sleep', '🪪': 'id-card', '🆘': 'sos', '🚨': 'siren', '📞': 'phone',
  '🔔': 'bell', '⬅': 'arrow-left', '➡': 'arrow-right', '↑': 'arrow-up', '↓': 'arrow-down',
  '→': 'arrow-right', '🔄': 'refresh', '🔁': 'rotate', '↺': 'rotate', '＋': 'plus', '✏': 'pencil',
  '🗑': 'trash', '👁': 'eye', '🔍': 'search', '⬇': 'download', '🖨': 'printer', '📋': 'clipboard',
  '⚙': 'settings', '📊': 'chart', '📈': 'trend', '📝': 'notebook', '⚠': 'alert', '📍': 'map-pin',
  '🗺': 'map', '📷': 'camera', '🖼': 'image', '✨': 'sparkles', '🔊': 'volume', '🔇': 'volume-off',
  '◐': 'contrast', '🚪': 'logout', '✔': 'check', '▶': 'play', '⏹': 'stop', '⏸': 'pause',
  '🎮': 'gamepad', '🎯': 'target', '🔗': 'link', '🛡': 'shield', '🔒': 'lock', '🛏': 'bed',
  '👕': 'shirt', '☕': 'coffee', '🪥': 'toothbrush', '🍽': 'utensils', '🥣': 'bowl', '🪴': 'plant',
  '🌿': 'leaf', '🍂': 'leaf', '🐕': 'dog', '🐈': 'cat', '🌻': 'flower', '🌸': 'flower', '🌼': 'flower',
  '🚗': 'car', '🎂': 'cake', '🎵': 'music', '🌳': 'tree', '🍎': 'apple', '⚽': 'ball', '☂': 'umbrella',
  '🏖': 'umbrella', '⭐': 'star', '🐟': 'fish', '🍪': 'cookie', '🎈': 'balloon', '❓': 'question',
  '🧩': 'puzzle', '⚕': 'medical', '🤝': 'hand-heart', '👋': 'hand', '🚑': 'ambulance', '🧭': 'compass',
  '💬': 'chat', '💭': 'thought', '💾': 'save', '📄': 'file', '📡': 'signal', '🔢': 'numbers',
  '🏫': 'graduation', '✈': 'plane', '❄': 'snowflake', '🎉': 'party', '🃏': 'cards', '📌': 'pin',
  '🔎': 'search', '🗝': 'key', '☁': 'cloud', '🎁': 'gift'
};

const KEYS = Object.keys(LEGACY).sort((a, b) => b.length - a.length);
const RX = new RegExp('(' + KEYS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + '|\\p{Extended_Pictographic}(?:\\uFE0F|\\u200D\\p{Extended_Pictographic})*)', 'gu');

export const iconNames = Object.keys(P).sort();

/** Devuelve un <svg> del pictograma pedido. */
export function icon(name, { cls = '', title = '' } = {}) {
  const key = P[name] ? name : (LEGACY[name] || 'sparkles');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', ('pic ' + cls).trim());
  svg.setAttribute('focusable', 'false');
  if (title) {
    svg.setAttribute('role', 'img');
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = title;
    svg.appendChild(t);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.innerHTML = P[key];
  svg.appendChild(g);
  return svg;
}

/** Convierte un texto con emoji en nodos: texto + pictogramas SVG. */
export function pictoText(str) {
  const s = String(str);
  if (!RX.test(s)) { RX.lastIndex = 0; return [s]; }
  RX.lastIndex = 0;
  const out = [];
  let last = 0, m;
  while ((m = RX.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const raw = m[0].replace(/\uFE0F/g, '');
    out.push(icon(LEGACY[raw] || LEGACY[m[0]] || raw));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export const hasIcon = name => !!P[name] || !!LEGACY[name];
