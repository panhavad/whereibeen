const stroke = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;

export const icons = {
  plane: stroke('<path d="M10.5 20.5 12 15l-5-1.5L5 16l-2-1 2.5-4L3 7l2-1 2 2.5L12 7l-1.5-5.5 2-.5 4 6.5 4.5-1c1.2-.2 2 .9 1.4 1.9-.3.5-.8.8-1.4.9l-4.5 1 1 7.5-2 .5-3-6"/>'),
  globe: stroke('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"/>'),
  chart: stroke('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  ticket: stroke('<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4Z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>'),
  pin: stroke('<path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/>'),
  passport: stroke('<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><circle cx="12" cy="10" r="3.2"/><path d="M8.8 10h6.4M12 6.8c.9.9 1.3 2 1.3 3.2s-.4 2.3-1.3 3.2M12 6.8c-.9.9-1.3 2-1.3 3.2s.4 2.3 1.3 3.2M9 17h6"/>'),
  plus: stroke('<path d="M12 5v14M5 12h14"/>'),
  search: stroke('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  close: stroke('<path d="M6 6l12 12M18 6 6 18"/>'),
  play: stroke('<path d="M7 4.5v15l12-7.5Z" fill="currentColor"/>'),
  pause: stroke('<path d="M8 5v14M16 5v14" stroke-width="3"/>'),
  next: stroke('<path d="M6 5v14l9-7ZM18 5v14" fill="currentColor"/>'),
  prev: stroke('<path d="M18 5v14L9 12ZM6 5v14" fill="currentColor"/>'),
  share: stroke('<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/>'),
  download: stroke('<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16"/>'),
  upload: stroke('<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M4 20h16"/>'),
  logout: stroke('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>'),
  trash: stroke('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>'),
  edit: stroke('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>'),
  mail: stroke('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>'),
  map: stroke('<path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5Z"/><path d="M9 4v13.5M15 6.5V20"/>'),
  lock: stroke('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
  check: stroke('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  refresh: stroke('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
  sparkles: stroke('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>'),
  zoomIn: stroke('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>'),
  zoomOut: stroke('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/>'),
  rotate: stroke('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>'),
  target: stroke('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  info: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  arrowRight: stroke('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  install: stroke('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7.5v7M9 11.5l3 3 3-3M10 18.5h4"/>'),
  user: stroke('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  calendar: stroke('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  layers: stroke('<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>'),
  menu: stroke('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  locate: stroke('<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="7.5"/>'),
};

export const planeSolid = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 10.6 14 8.9 10.1 2.2c-.2-.3-.5-.5-.9-.5H8.3c-.4 0-.7.4-.6.8l1.9 6.7-4.7.9-1.7-2.3c-.1-.2-.4-.3-.6-.3H1.8c-.3 0-.6.3-.5.7l1.2 3.9-1.2 3.8c-.1.4.2.7.5.7h.8c.2 0 .5-.1.6-.3l1.7-2.3 4.7.9-1.9 6.7c-.1.4.2.8.6.8h.9c.4 0 .7-.2.9-.5l3.9-6.7 7.6-1.7c.9-.2 1.5-1 1.5-1.9s-.6-1.7-1.5-1.9Z"/></svg>`;

export const googleLogo = `<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5Z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5Z"/></svg>`;

export const gmailLogo = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4caf50" d="M45 16.2 41 38H35V20.4Z"/><path fill="#1e88e5" d="M3 16.2 7 38h6V20.4Z"/><path fill="#e53935" d="M35 11.2 24 19.5 13 11.2 12 17l1 3.4 11 8.3 11-8.3 1-3.4Z"/><path fill="#c62828" d="M3 12.3v3.9l10 7.5V11.2L9.9 8.8A4.3 4.3 0 0 0 3 12.3Z"/><path fill="#fbc02d" d="M45 12.3v3.9l-10 7.5V11.2l3.1-2.4a4.3 4.3 0 0 1 6.9 3.5Z"/></svg>`;

export const mapsLogo = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#48b564" d="M35.8 13.2 24 27.4l-9.3 11L9 44.2c-.3-.4-.5-.9-.5-1.5V7.6c0-1.5 1.2-2.6 2.6-2.6h21.6Z"/><path fill="#fcc60e" d="M39.4 7.6v35.2c0 1.4-1.1 2.6-2.6 2.6H10.9c-.5 0-1.1-.2-1.5-.5l26.4-31.7Z"/><path fill="#2c85eb" d="m35.8 13.2-.1.1L32.6 5h4.3c1.4 0 2.6 1.1 2.6 2.6Z"/><path fill="#ed5748" d="M33.7 14.6c0 6.5-9.7 16.1-9.7 16.1s-9.7-9.6-9.7-16.1a9.7 9.7 0 0 1 19.4 0Z"/><circle cx="24" cy="14.6" r="3.6" fill="#fff"/></svg>`;

export function brandMark(id = 'bm') {
  return `<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#38bdf8"/><stop offset=".52" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/>
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="62" height="62" rx="18" fill="#0d1230" stroke="url(#${id}-g)" stroke-opacity=".55"/>
    <circle cx="32" cy="33" r="15" fill="none" stroke="url(#${id}-g)" stroke-width="3.2"/>
    <ellipse cx="32" cy="33" rx="6.5" ry="15" fill="none" stroke="url(#${id}-g)" stroke-width="2" opacity=".75"/>
    <path d="M17.5 33h29" stroke="url(#${id}-g)" stroke-width="2" opacity=".75"/>
    <path d="M9 44C15 22 37 11 55 17" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="0.5 5"/>
    <g transform="translate(53 16) rotate(28)"><path fill="#fff" d="M0-7 1.6-2 7 1v1.6L1.6 1.4 1.2 5.2 3 6.6v1L0 6.8-3 7.6v-1l1.8-1.4-.4-3.8L-7 2.6V1l5.4-3Z"/></g>
  </svg>`;
}
