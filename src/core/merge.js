import { distanceKm } from './geo.js';
import { createFlight, departureMs, normalizeFlightNo, arrivalDay, isUpcoming } from './flights.js';
import { cityKey } from './datasets.js';
import { dayDiff, normalizeSearch } from './util.js';

const SOURCE_RANK = { manual: 4, demo: 3, gmail: 2, timeline: 1 };

export function sameCity(a, b) {
  if (!a || !b) return false;
  if (a.iata && a.iata === b.iata) return true;
  if (a.cc !== b.cc) return false;
  return normalizeSearch(a.city) === normalizeSearch(b.city) || distanceKm(a, b) < 60;
}

/** Two records describe the same physical flight (tolerant to date/airport noise). */
export function isSameFlight(a, b) {
  if (!a?.date || !b?.date) return false;
  const diff = dayDiff(a.date, b.date);
  if (a.flightNo && b.flightNo && normalizeFlightNo(a.flightNo) === normalizeFlightNo(b.flightNo) && Math.abs(diff) <= 1) {
    return sameCity(a.from, b.from) || sameCity(a.to, b.to);
  }
  if (!sameCity(a.from, b.from) || !sameCity(a.to, b.to)) return false;
  if (a.flightNo && b.flightNo && normalizeFlightNo(a.flightNo) !== normalizeFlightNo(b.flightNo) && Math.abs(diff) >= 1) return false;
  // A date guessed from the email's send date only bounds the real flight date from below.
  if (a.dateEstimated && !b.dateEstimated) return diff >= -3 && diff <= 370;
  if (b.dateEstimated && !a.dateEstimated) return diff <= 3 && diff >= -370;
  return Math.abs(diff) <= 1;
}

const FILLABLE = ['dep', 'arr', 'arrDayOffset', 'depAt', 'arrAt', 'flightNo', 'airline', 'pnr', 'seat', 'cabin'];

/** Copies details the target is missing; returns true when something changed. */
function fillMissing(target, source) {
  let changed = false;
  for (const key of FILLABLE) {
    if ((target[key] === null || target[key] === undefined || target[key] === '' || target[key] === 0) && source[key]) {
      target[key] = source[key];
      changed = true;
    }
  }
  if (target.dateEstimated && !source.dateEstimated) {
    target.date = source.date;
    target.dateEstimated = false;
    changed = true;
  }
  return changed;
}

/**
 * Collapses raw candidates from many emails (booking, check-in, boarding pass, changes)
 * into one entry per flight. Cancellation emails remove earlier bookings of the flight.
 */
export function consolidateCandidates(candidates) {
  const ordered = [...candidates].sort((a, b) => (a.emailDate || 0) - (b.emailDate || 0));
  const out = [];
  for (const c of ordered) {
    const idx = out.findIndex((x) => isSameFlight(x, c));
    if (c.cancelled) {
      if (idx >= 0) out.splice(idx, 1);
      continue;
    }
    if (idx >= 0) {
      const m = out[idx];
      fillMissing(m, c);
      m.confidence = Math.max(m.confidence, c.confidence);
      m.evidence = (m.evidence || 1) + 1;
      if (c.structured && !m.structured) {
        m.structured = true;
        m.sourceRef = c.sourceRef;
      }
    } else {
      out.push({ ...c, evidence: 1 });
    }
  }
  return out.map((c) => {
    const flight = createFlight(c);
    flight.evidence = c.evidence;
    flight.structured = !!c.structured;
    flight.confidence = Math.min(1, c.confidence + (c.evidence > 1 ? 0.1 : 0));
    return flight;
  });
}

export function dismissKey(flight) {
  return flight.fingerprint || `${flight.date}|${flight.from?.iata}|${flight.to?.iata}`;
}

/**
 * Merges new flights into the log. Duplicates enrich the existing entry (user-entered
 * values are never overwritten) and dismissed auto-detections stay dismissed.
 */
export function mergeIntoLog(existing, incoming, dismissed = []) {
  const flights = existing.map((f) => ({ ...f }));
  const dismissedSet = new Set(dismissed);
  const added = [];
  const updated = [];
  let skipped = 0;
  for (const inc of incoming) {
    if (dismissedSet.has(dismissKey(inc))) {
      skipped++;
      continue;
    }
    const match = flights.find((f) => isSameFlight(f, inc));
    if (!match) {
      flights.push(inc);
      added.push(inc);
      continue;
    }
    const before = JSON.stringify(match);
    if ((SOURCE_RANK[inc.source] || 0) > (SOURCE_RANK[match.source] || 0) && match.source !== 'manual') {
      Object.assign(match, { from: inc.from, to: inc.to, date: inc.date, dateEstimated: inc.dateEstimated, source: inc.source, sourceRef: inc.sourceRef });
    }
    fillMissing(match, inc);
    if (JSON.stringify(match) !== before) {
      const rebuilt = createFlight(match);
      Object.assign(match, rebuilt, { id: match.id, createdAt: match.createdAt });
      updated.push(match);
    } else {
      skipped++;
    }
  }
  return { flights, added, updated, skipped };
}

/**
 * Walks flights chronologically and labels each arrival/departure city. An arrival is a
 * transit when the traveller leaves the same city again within the connection window.
 */
export function flightStops(flights) {
  const sorted = [...flights].sort((a, b) => departureMs(a) - departureMs(b));
  const stops = [];
  let previousArrivalTransit = false;
  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    const next = sorted[i + 1];
    if (!previousArrivalTransit) stops.push({ place: f.from, date: f.date, kind: 'origin', flight: f });
    let transit = false;
    if (next && sameCity(f.to, next.from)) {
      if (f.arrAt && next.depAt) transit = new Date(next.depAt) - new Date(f.arrAt) < 24 * 3600000;
      else transit = dayDiff(arrivalDay(f), next.date) <= 0;
    }
    stops.push({ place: f.to, date: arrivalDay(f), kind: transit ? 'transit' : 'destination', flight: f });
    previousArrivalTransit = transit;
  }
  return stops;
}

function yearOf(day) {
  return day ? day.slice(0, 4) : '';
}

/**
 * Unified list of visited cities from Timeline/manual places plus flight destinations.
 * `year` = 'all' or 'YYYY'. Transit-only airports are excluded.
 */
export function buildPlaces({ places = [], flights = [], year = 'all' }) {
  const byKey = new Map();
  const list = [];

  const upsert = (base, stats) => {
    let key = cityKey(base.name, base.cc);
    let entry = byKey.get(key);
    if (!entry) {
      entry = list.find((p) => p.cc === base.cc && distanceKm(p, base) < 25);
      if (entry) byKey.set(key, entry);
    }
    if (!entry) {
      entry = {
        key,
        name: base.name,
        cc: base.cc,
        region: base.region || '',
        lat: base.lat,
        lng: base.lng,
        visits: 0,
        minutes: 0,
        days: 0,
        flightsIn: 0,
        first: null,
        last: null,
        sources: new Set(),
        ids: [],
      };
      byKey.set(key, entry);
      list.push(entry);
    }
    entry.visits += stats.visits || 0;
    entry.minutes += stats.minutes || 0;
    entry.days += stats.days || 0;
    entry.flightsIn += stats.flightsIn || 0;
    if (stats.first && (!entry.first || stats.first < entry.first)) entry.first = stats.first;
    if (stats.last && (!entry.last || stats.last > entry.last)) entry.last = stats.last;
    if (stats.source) entry.sources.add(stats.source);
    if (stats.id) entry.ids.push(stats.id);
    return entry;
  };

  for (const p of places) {
    if (year === 'all') {
      upsert(p, { visits: p.visits || 1, minutes: p.minutes || 0, days: p.days || 0, first: p.first, last: p.last || p.first, source: p.source, id: p.id });
    } else {
      const y = p.byYear?.[year];
      if (y) upsert(p, { visits: y.v || 1, minutes: y.m || 0, days: y.d || 0, first: y.first || p.first, last: y.last || p.last, source: p.source, id: p.id });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const completed = flights.filter((f) => !isUpcoming(f, today));
  for (const stop of flightStops(completed)) {
    if (stop.kind === 'transit') continue;
    if (year !== 'all' && yearOf(stop.date) !== year) continue;
    upsert(
      { name: stop.place.city, cc: stop.place.cc, lat: stop.place.lat, lng: stop.place.lng },
      { visits: stop.kind === 'destination' ? 1 : 0, flightsIn: stop.kind === 'destination' ? 1 : 0, first: stop.date, last: stop.date, source: 'flight' },
    );
  }

  for (const p of list) if (p.visits === 0) p.visits = 1;
  return list.sort((a, b) => b.visits - a.visits || b.minutes - a.minutes || a.name.localeCompare(b.name));
}
