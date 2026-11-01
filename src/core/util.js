const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Tagged template that escapes every interpolated value unless wrapped with raw(). */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += renderValue(value) + strings[i + 1];
  });
  return new SafeHtml(out);
}

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export function raw(value) {
  return new SafeHtml(String(value ?? ''));
}

function renderValue(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  if (value === false || value === null || value === undefined) return '';
  return escapeHtml(value);
}

export function uid(prefix = 'id') {
  const rand = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${Date.now().toString(36)}${rand[0].toString(36)}${rand[1].toString(36)}`.slice(0, 24);
}

export function debounce(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function normalizeSearch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const numberFormats = new Map();
export function formatNumber(n, digits = 0) {
  const key = digits;
  if (!numberFormats.has(key)) {
    numberFormats.set(key, new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }));
  }
  return numberFormats.get(key).format(Number.isFinite(n) ? n : 0);
}

export function formatCompact(n) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
}

export const KM_PER_MILE = 1.609344;

export function formatDistance(km, units = 'km', { compact = false } = {}) {
  const value = units === 'mi' ? km / KM_PER_MILE : km;
  return `${compact ? formatCompact(value) : formatNumber(Math.round(value))} ${units}`;
}

export function formatDuration(minutes, { long = false } = {}) {
  const m = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (long) {
    const days = Math.floor(h / 24);
    if (days > 0) return `${days}d ${h % 24}h`;
  }
  if (h === 0) return `${rest}m`;
  return `${h}h ${String(rest).padStart(2, '0')}m`;
}

/** Parse a YYYY-MM-DD string as a local calendar date (no time zone shifts). */
export function parseDay(day) {
  if (!day) return null;
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  const now = new Date();
  return toDay(now);
}

export function toDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(day, n) {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

export function dayDiff(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}

export function formatDay(day, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = parseDay(day);
  return d ? d.toLocaleDateString(undefined, opts) : '';
}

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
export function countryName(cc, fallback = '') {
  if (!cc) return fallback || 'Unknown';
  try {
    return regionNames?.of(cc.toUpperCase()) || fallback || cc;
  } catch {
    return fallback || cc;
  }
}

export function flagEmoji(cc) {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '🏳️';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export function plural(n, one, many = `${one}s`) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isTouchDevice() {
  return typeof matchMedia === 'function' && matchMedia('(hover: none), (pointer: coarse)').matches;
}

/** Runs `worker` over items with at most `limit` in flight. */
export async function pool(items, limit, worker, signal) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const i = index++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

export function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
