import { get, set, del } from 'idb-keyval';
import { createFlight } from './flights.js';
import { dismissKey, mergeIntoLog } from './merge.js';
import { uid } from './util.js';

const PROFILE_KEY = 'wib.profile';
const DATA_VERSION = 1;
const listeners = new Set();

function emptyData() {
  return {
    v: DATA_VERSION,
    flights: [],
    places: [],
    dismissed: [],
    sources: {},
    settings: { units: 'km' },
  };
}

function readProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
  } catch {
    return null;
  }
}

export const store = {
  profile: readProfile(),
  data: emptyData(),
  loaded: false,
  ui: { year: 'all' },
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(change) {
  for (const fn of listeners) {
    try {
      fn(change);
    } catch (err) {
      console.error(err);
    }
  }
}

function dataKey(profile = store.profile) {
  return `wib.data.${profile?.sub || 'local'}`;
}

// Other tabs (or the installed PWA window) reload when this one saves, so a stale copy
// never overwrites newer data.
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('wib-store') : null;
channel?.addEventListener('message', (event) => {
  if (event.data?.key === dataKey()) loadData();
});

async function persist() {
  await set(dataKey(), store.data);
  channel?.postMessage({ key: dataKey() });
}

export async function loadData() {
  let data = null;
  try {
    data = await get(dataKey());
  } catch (err) {
    console.warn('IndexedDB unavailable, data will not persist', err);
  }
  store.data = { ...emptyData(), ...(data || {}) };
  store.data.settings = { ...emptyData().settings, ...(store.data.settings || {}) };
  store.loaded = true;
  emit({ type: 'data' });
}

export async function setProfile(profile) {
  store.profile = profile;
  if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  else localStorage.removeItem(PROFILE_KEY);
  await loadData();
  emit({ type: 'profile' });
}

export function setYear(year) {
  store.ui.year = year;
  emit({ type: 'filter' });
}

export async function setSetting(key, value) {
  store.data.settings[key] = value;
  await persist();
  emit({ type: 'settings' });
}

export async function addFlights(incoming, { undismiss = false } = {}) {
  if (undismiss) {
    const keys = new Set(incoming.map(dismissKey));
    store.data.dismissed = store.data.dismissed.filter((k) => !keys.has(k));
  }
  const result = mergeIntoLog(store.data.flights, incoming, store.data.dismissed);
  store.data.flights = result.flights;
  await persist();
  emit({ type: 'flights', added: result.added.map((f) => f.id) });
  return result;
}

export async function saveFlight(input) {
  const existing = store.data.flights.find((f) => f.id === input.id);
  const flight = createFlight({ ...existing, ...input, source: existing?.source === 'demo' ? 'demo' : input.source || existing?.source || 'manual' });
  if (existing) {
    Object.assign(existing, flight, { createdAt: existing.createdAt });
  } else {
    store.data.flights.push(flight);
  }
  await persist();
  emit({ type: 'flights', added: existing ? [] : [flight.id], updated: existing ? [flight.id] : [] });
  return flight;
}

export async function deleteFlight(id) {
  const flight = store.data.flights.find((f) => f.id === id);
  if (!flight) return;
  store.data.flights = store.data.flights.filter((f) => f.id !== id);
  if (flight.source === 'gmail' || flight.source === 'timeline') {
    store.data.dismissed = [...new Set([...store.data.dismissed, dismissKey(flight)])];
  }
  await persist();
  emit({ type: 'flights', removed: [id] });
  return flight;
}

export async function restoreFlight(flight) {
  store.data.dismissed = store.data.dismissed.filter((k) => k !== dismissKey(flight));
  store.data.flights.push(flight);
  await persist();
  emit({ type: 'flights', added: [flight.id] });
}

export async function savePlace(input) {
  const existing = store.data.places.find((p) => p.id === input.id);
  const now = Date.now();
  const place = {
    id: input.id || uid('p'),
    name: input.name,
    cc: input.cc,
    region: input.region || '',
    lat: input.lat,
    lng: input.lng,
    first: input.first || null,
    last: input.last || input.first || null,
    notes: input.notes || '',
    source: existing?.source || input.source || 'manual',
    visits: input.visits || 1,
    minutes: input.minutes || 0,
    days: input.days || 0,
    byYear: input.byYear || manualByYear(input.first, input.last || input.first),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (existing) Object.assign(existing, place);
  else store.data.places.push(place);
  await persist();
  emit({ type: 'places', added: existing ? [] : [place.id] });
  return place;
}

function manualByYear(first, last) {
  if (!first) return {};
  const out = {};
  const start = new Date(`${first}T00:00:00`);
  const end = new Date(`${last || first}T00:00:00`);
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const from = y === start.getFullYear() ? start : new Date(y, 0, 1);
    const to = y === end.getFullYear() ? end : new Date(y, 11, 31);
    const days = Math.max(1, Math.round((to - from) / 86400000) + 1);
    out[y] = { v: y === start.getFullYear() ? 1 : 0, m: 0, d: days };
  }
  return out;
}

export async function deletePlace(id) {
  const place = store.data.places.find((p) => p.id === id);
  store.data.places = store.data.places.filter((p) => p.id !== id);
  await persist();
  emit({ type: 'places', removed: [id] });
  return place;
}

export async function restorePlace(place) {
  store.data.places.push(place);
  await persist();
  emit({ type: 'places', added: [place.id] });
}

/** Re-importing Timeline replaces the previous Timeline-derived places and flights. */
export async function applyTimelineImport({ places, flights, summary }) {
  store.data.places = [...store.data.places.filter((p) => p.source !== 'timeline'), ...places];
  const kept = store.data.flights.filter((f) => f.source !== 'timeline');
  const result = mergeIntoLog(kept, flights, store.data.dismissed);
  store.data.flights = result.flights;
  store.data.sources.timeline = { ...summary, importedAt: Date.now() };
  await persist();
  emit({ type: 'places', added: places.map((p) => p.id) });
  emit({ type: 'flights', added: result.added.map((f) => f.id) });
  return result;
}

export async function setSource(name, info) {
  store.data.sources[name] = { ...(store.data.sources[name] || {}), ...info };
  await persist();
  emit({ type: 'sources' });
}

export function exportBackup() {
  return {
    app: 'whereibeen',
    exportedAt: new Date().toISOString(),
    profile: store.profile ? { name: store.profile.name, email: store.profile.email } : null,
    data: store.data,
  };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const SOURCES = new Set(['gmail', 'timeline', 'manual', 'demo']);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const text = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

function cleanAirport(a) {
  if (!a || !Number.isFinite(Number(a.lat)) || !Number.isFinite(Number(a.lng))) return null;
  return {
    iata: text(a.iata, 4).toUpperCase(),
    name: text(a.name),
    city: text(a.city),
    cc: /^[A-Za-z]{2}$/.test(a.cc || '') ? a.cc.toUpperCase() : '',
    lat: Number(a.lat),
    lng: Number(a.lng),
    tz: text(a.tz, 64) || null,
  };
}

/** Backups are user-supplied files: rebuild every record from validated fields only. */
function cleanBackupFlight(f) {
  const from = cleanAirport(f?.from);
  const to = cleanAirport(f?.to);
  if (!from || !to || !DAY_RE.test(f.date || '')) return null;
  return createFlight({
    from,
    to,
    date: f.date,
    dep: TIME_RE.test(f.dep || '') ? f.dep : null,
    arr: TIME_RE.test(f.arr || '') ? f.arr : null,
    airline: f.airline ? { code: text(f.airline.code, 3), name: text(f.airline.name, 80) } : null,
    flightNo: text(f.flightNo, 8),
    cabin: text(f.cabin, 30),
    seat: text(f.seat, 6),
    pnr: text(f.pnr, 12),
    notes: text(f.notes, 2000),
    source: SOURCES.has(f.source) ? f.source : 'manual',
    confidence: Math.min(1, Math.max(0, num(f.confidence ?? 1))),
  });
}

function cleanBackupPlace(p) {
  if (!p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng)) || !/^[A-Za-z]{2}$/.test(p.cc || '')) return null;
  const byYear = {};
  for (const [year, v] of Object.entries(p.byYear || {})) {
    if (/^\d{4}$/.test(year)) byYear[year] = { v: num(v?.v), m: num(v?.m), d: num(v?.d) };
  }
  return {
    id: uid('p'),
    name: text(p.name, 120) || 'Unknown place',
    cc: p.cc.toUpperCase(),
    region: text(p.region, 120),
    lat: Number(p.lat),
    lng: Number(p.lng),
    first: DAY_RE.test(p.first || '') ? p.first : null,
    last: DAY_RE.test(p.last || '') ? p.last : null,
    notes: text(p.notes, 2000),
    source: SOURCES.has(p.source) ? p.source : 'manual',
    visits: num(p.visits) || 1,
    minutes: num(p.minutes),
    days: num(p.days),
    byYear,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function importBackup(json) {
  if (json?.app !== 'whereibeen' || !json.data || !Array.isArray(json.data.flights)) {
    throw new Error('This file is not a WhereIBeen backup.');
  }
  const flights = json.data.flights.map(cleanBackupFlight).filter(Boolean);
  const places = (Array.isArray(json.data.places) ? json.data.places : []).map(cleanBackupPlace).filter(Boolean);
  const merged = mergeIntoLog(store.data.flights, flights, []);
  store.data.flights = merged.flights;
  const known = new Set(store.data.places.map((p) => `${p.cc}|${p.name}|${p.first}|${p.source}`));
  const fresh = places.filter((p) => !known.has(`${p.cc}|${p.name}|${p.first}|${p.source}`));
  store.data.places.push(...fresh);
  await persist();
  emit({ type: 'data' });
  return { flights: merged.added.length, places: fresh.length };
}

export async function replaceAllData(data) {
  store.data = { ...emptyData(), ...data };
  await persist();
  emit({ type: 'data' });
}

export async function wipeData() {
  await del(dataKey());
  store.data = emptyData();
  channel?.postMessage({ key: dataKey() });
  emit({ type: 'data' });
}

export function hasAnyData() {
  return store.data.flights.length > 0 || store.data.places.length > 0;
}
