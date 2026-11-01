import { airportSnapshot, cityKey } from '../core/datasets.js';
import { fromE7, parseLatLngString } from '../core/geo.js';
import { dayInZone, splitIsoLocal } from '../core/time.js';
import { consolidateCandidates } from '../core/merge.js';
import { addDays, uid } from '../core/util.js';

const MAX_VISIT_DAYS = 60;

function normType(type) {
  return String(type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isoFromMs(ms) {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null;
}

export function detectFormat(json) {
  if (Array.isArray(json)) {
    const sample = json.slice(0, 25);
    const isSegment = (s) => s && typeof s.startTime === 'string' && (s.visit || s.activity || s.timelinePath || s.timelineMemory);
    return sample.some(isSegment) ? 'ios' : null;
  }
  if (!json || typeof json !== 'object') return null;
  if (Array.isArray(json.semanticSegments)) return 'android';
  if (Array.isArray(json.timelineObjects)) return 'takeout-semantic';
  if (Array.isArray(json.locations)) return 'takeout-records';
  return null;
}

/** Normalises any supported export into visits, flying segments and sampled raw points. */
export function extractTimeline(json) {
  const format = detectFormat(json);
  const out = { format, visits: [], flights: [], points: [] };
  if (!format) return out;

  const pushVisit = (loc, start, end, extra = {}) => {
    if (loc && start) out.visits.push({ lat: loc.lat, lng: loc.lng, start, end: end || start, ...extra });
  };
  const pushFlight = (from, to, start, end) => {
    if (from && to && start) out.flights.push({ from, to, start, end: end || start });
  };

  if (format === 'android' || format === 'ios') {
    const segments = format === 'android' ? json.semanticSegments : json;
    for (const seg of segments) {
      if (!seg || typeof seg !== 'object') continue;
      if (seg.visit) {
        if (Number(seg.visit.hierarchyLevel || 0) > 0) continue; // nested visit inside a larger place
        const top = seg.visit.topCandidate || {};
        const loc = parseLatLngString(typeof top.placeLocation === 'string' ? top.placeLocation : top.placeLocation?.latLng);
        pushVisit(loc, seg.startTime, seg.endTime, { placeId: top.placeId || top.placeID || null });
      } else if (seg.activity) {
        if (normType(seg.activity.topCandidate?.type) !== 'flying') continue;
        const start = typeof seg.activity.start === 'string' ? seg.activity.start : seg.activity.start?.latLng;
        const end = typeof seg.activity.end === 'string' ? seg.activity.end : seg.activity.end?.latLng;
        pushFlight(parseLatLngString(start), parseLatLngString(end), seg.startTime, seg.endTime);
      }
    }
  } else if (format === 'takeout-semantic') {
    for (const obj of json.timelineObjects) {
      const visit = obj?.placeVisit;
      const activity = obj?.activitySegment;
      if (visit) {
        const loc = visit.location || {};
        const lat = fromE7(loc.latitudeE7 ?? visit.centerLatE7, 90);
        const lng = fromE7(loc.longitudeE7 ?? visit.centerLngE7, 180);
        const d = visit.duration || {};
        if (lat !== null && lng !== null) {
          pushVisit({ lat, lng }, d.startTimestamp || isoFromMs(d.startTimestampMs), d.endTimestamp || isoFromMs(d.endTimestampMs), {
            placeId: loc.placeId || null,
            name: loc.name || null,
          });
        }
      } else if (activity && normType(activity.activityType) === 'flying') {
        const s = activity.startLocation || {};
        const e = activity.endLocation || {};
        const from = { lat: fromE7(s.latitudeE7, 90), lng: fromE7(s.longitudeE7, 180) };
        const to = { lat: fromE7(e.latitudeE7, 90), lng: fromE7(e.longitudeE7, 180) };
        const d = activity.duration || {};
        if (from.lat !== null && from.lng !== null && to.lat !== null && to.lng !== null) {
          pushFlight(from, to, d.startTimestamp || isoFromMs(d.startTimestampMs), d.endTimestamp || isoFromMs(d.endTimestampMs));
        }
      }
    }
  } else if (format === 'takeout-records') {
    let last = 0;
    for (const r of json.locations) {
      const t = r.timestamp ? Date.parse(r.timestamp) : Number(r.timestampMs);
      if (!Number.isFinite(t) || Math.abs(t - last) < 20 * 60000) continue;
      if (r.accuracy && r.accuracy > 5000) continue;
      const lat = fromE7(r.latitudeE7, 90);
      const lng = fromE7(r.longitudeE7, 180);
      if (lat === null || lng === null) continue;
      last = t;
      out.points.push({ lat, lng, t });
    }
  }
  return out;
}

/** Local calendar day of a timestamp: trust the written offset, else use the place's zone. */
function localDay(stamp, tz) {
  if (typeof stamp === 'string') {
    const parts = splitIsoLocal(stamp);
    if (parts && parts.hasOffset && !/Z$/i.test(stamp)) return parts.day;
  }
  return dayInZone(stamp, tz);
}

/**
 * Groups visits into cities (with per-year totals) and turns "flying" segments into
 * flights between the nearest commercial airports.
 */
export function aggregateTimeline(extracts, { cities, airports }) {
  const places = new Map();
  let visitCount = 0;
  let firstDay = null;
  let lastDay = null;

  const touch = (city) => {
    const key = cityKey(city.name, city.cc);
    let place = places.get(key);
    if (!place) {
      place = {
        id: uid('p'),
        name: city.name,
        cc: city.cc,
        region: city.region || '',
        lat: city.lat,
        lng: city.lng,
        source: 'timeline',
        visits: 0,
        minutes: 0,
        days: 0,
        first: null,
        last: null,
        byYear: {},
        dayset: new Set(),
      };
      places.set(key, place);
    }
    return place;
  };

  const record = (place, startDay, endDay, minutes, countVisit) => {
    if (countVisit) place.visits++;
    place.minutes += minutes;
    const year = startDay.slice(0, 4);
    const y = (place.byYear[year] ||= { v: 0, m: 0, d: 0 });
    if (countVisit) y.v++;
    y.m += minutes;
    let day = startDay;
    for (let i = 0; i < MAX_VISIT_DAYS && day <= endDay; i++, day = addDays(day, 1)) place.dayset.add(day);
    if (!firstDay || startDay < firstDay) firstDay = startDay;
    if (!lastDay || endDay > lastDay) lastDay = endDay;
  };

  for (const ex of extracts) {
    for (const v of ex.visits) {
      const city = cities.locate(v.lat, v.lng);
      if (!city) continue;
      const startMs = Date.parse(v.start);
      const endMs = Date.parse(v.end);
      if (!Number.isFinite(startMs)) continue;
      const minutes = Number.isFinite(endMs) ? Math.min(MAX_VISIT_DAYS * 1440, Math.max(0, (endMs - startMs) / 60000)) : 0;
      const startDay = localDay(v.start, city.tz);
      const endDay = localDay(v.end, city.tz) || startDay;
      if (!startDay) continue;
      record(touch(city), startDay, endDay < startDay ? startDay : endDay, Math.round(minutes), true);
      visitCount++;
    }

    // Raw Records.json: one "visit" per run of consecutive days spent in a city.
    const daysByCity = new Map();
    for (const p of ex.points) {
      const city = cities.locate(p.lat, p.lng);
      if (!city) continue;
      const day = dayInZone(p.t, city.tz);
      const place = touch(city);
      if (!daysByCity.has(place)) daysByCity.set(place, new Set());
      daysByCity.get(place).add(day);
    }
    for (const [place, days] of daysByCity) {
      const sorted = [...days].sort();
      sorted.forEach((day, i) => {
        const newRun = i === 0 || addDays(sorted[i - 1], 1) !== day;
        record(place, day, day, 0, newRun);
        if (newRun) visitCount++;
      });
    }
  }

  const placeList = [...places.values()]
    .filter((p) => p.dayset.size > 0)
    .map((p) => {
      const days = [...p.dayset].sort();
      for (const day of days) {
        const y = (p.byYear[day.slice(0, 4)] ||= { v: 0, m: 0, d: 0 });
        y.d++;
      }
      const { dayset, ...rest } = p;
      return { ...rest, days: days.length, first: days[0], last: days[days.length - 1], visits: Math.max(1, p.visits) };
    });

  const candidates = [];
  for (const ex of extracts) {
    for (const f of ex.flights) {
      const from = airports.nearest(f.from.lat, f.from.lng);
      const to = airports.nearest(f.to.lat, f.to.lng);
      if (!from || !to || from.iata === to.iata) continue;
      const startParts = splitIsoLocal(f.start);
      const endParts = splitIsoLocal(f.end);
      const date = localDay(f.start, from.tz);
      if (!date) continue;
      const hasLocal = startParts?.hasOffset && !/Z$/i.test(f.start);
      candidates.push({
        from: airportSnapshot(from),
        to: airportSnapshot(to),
        date,
        dep: hasLocal ? startParts.time : null,
        arr: hasLocal && endParts ? endParts.time : null,
        depAt: Number.isFinite(Date.parse(f.start)) ? new Date(f.start).toISOString() : null,
        arrAt: Number.isFinite(Date.parse(f.end)) ? new Date(f.end).toISOString() : null,
        source: 'timeline',
        sourceRef: { file: ex.file || 'Timeline' },
        confidence: 0.8,
        emailDate: Date.parse(f.start) || 0,
      });
    }
  }

  const flights = consolidateCandidates(candidates);
  return {
    places: placeList,
    flights,
    summary: {
      formats: [...new Set(extracts.map((e) => e.format))],
      visits: visitCount,
      places: placeList.length,
      countries: new Set(placeList.map((p) => p.cc)).size,
      flights: flights.length,
      from: firstDay,
      to: lastDay,
    },
  };
}
