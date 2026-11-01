import { distanceKm, estimateDurationMin, isPlausibleDuration } from './geo.js';
import { dayInZone, zonedToUtc } from './time.js';
import { addDays, dayDiff, todayISO, uid } from './util.js';
import { airlineByCode } from '../data/airlines.js';

export const CABINS = ['Economy', 'Premium Economy', 'Business', 'First'];

export function normalizeFlightNo(value) {
  const m = /^\s*([A-Z0-9]{2})\s*-?\s*0*(\d{1,4})\s*$/i.exec(value || '');
  return m ? `${m[1].toUpperCase()}${m[2]}` : String(value || '').replace(/\s+/g, '').toUpperCase();
}

export function flightFingerprint(f) {
  return `${f.date}|${f.from?.iata}|${f.to?.iata}`;
}

/** Distance, duration and absolute departure/arrival instants for a flight record. */
export function computeFlightMetrics(f) {
  const distance = distanceKm(f.from, f.to);
  let durationMin = null;
  let depAt = null;
  let arrAt = null;

  if (f.depAt && f.arrAt) {
    const d = (new Date(f.arrAt) - new Date(f.depAt)) / 60000;
    if (isPlausibleDuration(distance, d)) {
      durationMin = d;
      depAt = new Date(f.depAt).toISOString();
      arrAt = new Date(f.arrAt).toISOString();
    }
  }

  if (durationMin === null && f.date && f.dep && f.from?.tz) {
    const dep = zonedToUtc(f.date, f.dep, f.from.tz);
    if (dep) depAt = dep.toISOString();
    if (dep && f.arr && f.to?.tz) {
      // The arrival may land on another calendar day; the shortest plausible option is the real one.
      for (const offset of [-1, 0, 1, 2]) {
        const arr = zonedToUtc(addDays(f.date, offset), f.arr, f.to.tz);
        const d = arr ? (arr - dep) / 60000 : null;
        if (arr && d > 0 && isPlausibleDuration(distance, d) && (durationMin === null || d < durationMin)) {
          durationMin = d;
          arrAt = arr.toISOString();
        }
      }
    }
  }

  const estimated = durationMin === null;
  if (estimated) durationMin = estimateDurationMin(distance);
  if (!arrAt && depAt) arrAt = new Date(new Date(depAt).getTime() + durationMin * 60000).toISOString();

  // Day offset of the printed arrival time (e.g. "17:20 +1") derived from the real instant.
  let arrDayOffset = f.arrDayOffset || 0;
  if (f.arr && arrAt && f.to?.tz && f.date) {
    const arrDay = dayInZone(arrAt, f.to.tz);
    if (arrDay) arrDayOffset = Math.max(-1, Math.min(2, dayDiff(f.date, arrDay)));
  }

  return {
    distanceKm: Math.round(distance),
    durationMin: Math.round(durationMin),
    durationEstimated: estimated,
    depAt,
    arrAt,
    arrDayOffset,
  };
}

/** Builds a normalised flight record from partial input (form, parser or importer). */
export function createFlight(input) {
  const now = Date.now();
  const airline = input.airline?.code
    ? { code: input.airline.code.toUpperCase(), name: input.airline.name || airlineByCode(input.airline.code)?.name || input.airline.code }
    : input.airline?.name
      ? { code: '', name: input.airline.name }
      : null;
  const flight = {
    id: input.id || uid('f'),
    from: input.from,
    to: input.to,
    date: input.date,
    dateEstimated: !!input.dateEstimated,
    dep: input.dep || null,
    arr: input.arr || null,
    arrDayOffset: input.arrDayOffset || 0,
    depAt: input.depAt || null,
    arrAt: input.arrAt || null,
    airline,
    flightNo: input.flightNo ? normalizeFlightNo(input.flightNo) : '',
    cabin: input.cabin || '',
    seat: input.seat || '',
    pnr: input.pnr || '',
    notes: input.notes || '',
    source: input.source || 'manual',
    sourceRef: input.sourceRef || null,
    confidence: input.confidence ?? 1,
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
  Object.assign(flight, computeFlightMetrics(flight));
  flight.fingerprint = flightFingerprint(flight);
  return flight;
}

export function isUpcoming(f, today = todayISO(), now = Date.now()) {
  if (f.date > today) return true;
  if (f.date === today && f.depAt) return new Date(f.depAt).getTime() > now;
  return false;
}

export function departureMs(f) {
  if (f.depAt) return new Date(f.depAt).getTime();
  const [y, m, d] = f.date.split('-').map(Number);
  const [hh, mm] = (f.dep || '12:00').split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - (f.from?.lng || 0) * 4 * 60000;
}

export function arrivalDay(f) {
  if (f.arrAt && f.to?.tz) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: f.to.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(f.arrAt));
    } catch {
      /* fall back to the departure day */
    }
  }
  return addDays(f.date, f.arrDayOffset || 0);
}

export function sortFlights(flights, dir = 'desc') {
  const sign = dir === 'desc' ? -1 : 1;
  return [...flights].sort((a, b) => sign * (departureMs(a) - departureMs(b)));
}
