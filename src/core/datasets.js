import { distanceKm } from './geo.js';
import { normalizeSearch } from './util.js';

const DATA_BASE = (() => {
  if (typeof document !== 'undefined') return new URL(`${import.meta.env?.BASE_URL || '/'}data/`, location.origin).href;
  if (typeof self !== 'undefined' && self.location) return new URL('/data/', self.location.origin).href;
  return '/data/';
})();

const cache = new Map();

function fetchJson(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(DATA_BASE + name).then((res) => {
        if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
        return res.json();
      }),
    );
    cache.get(name).catch(() => cache.delete(name));
  }
  return cache.get(name);
}

function createGrid(items) {
  const grid = new Map();
  for (const item of items) {
    const key = `${Math.floor(item.lat)}:${Math.floor(item.lng)}`;
    let bucket = grid.get(key);
    if (!bucket) grid.set(key, (bucket = []));
    bucket.push(item);
  }
  return (lat, lng, radiusKm) => {
    const out = [];
    const latSpan = Math.ceil(radiusKm / 111) || 1;
    const lngSpan = Math.min(180, Math.ceil(radiusKm / (111 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)))) || 1);
    const cy = Math.floor(lat);
    const cx = Math.floor(lng);
    for (let dy = -latSpan; dy <= latSpan; dy++) {
      for (let dx = -lngSpan; dx <= lngSpan; dx++) {
        let x = cx + dx;
        if (x < -180) x += 360;
        if (x >= 180) x -= 360;
        const bucket = grid.get(`${cy + dy}:${x}`);
        if (!bucket) continue;
        for (const item of bucket) {
          const d = distanceKm({ lat, lng }, item);
          if (d <= radiusKm) out.push({ item, d });
        }
      }
    }
    return out.sort((a, b) => a.d - b.d);
  };
}

export function airportSnapshot(a) {
  if (!a) return null;
  return { iata: a.iata, name: a.name, city: a.city, cc: a.cc, lat: a.lat, lng: a.lng, tz: a.tz || null };
}

export function buildAirportIndex(json) {
  const byIata = new Map();
  const list = json.rows.map(([iata, name, city, cc, lat, lng, tz, rank]) => {
    const airport = { iata, name, city, cc, lat, lng, tz: tz >= 0 ? json.tz[tz] : null, rank };
    airport.searchCity = normalizeSearch(city);
    airport.searchName = normalizeSearch(name);
    byIata.set(iata, airport);
    return airport;
  });
  const around = createGrid(list);

  return {
    list,
    get(code) {
      return code ? byIata.get(String(code).trim().toUpperCase()) || null : null;
    },
    has(code) {
      return byIata.has(code);
    },
    search(query, limit = 8) {
      const q = normalizeSearch(query);
      if (!q) return list.filter((a) => a.rank >= 4).slice(0, limit);
      const upper = q.toUpperCase();
      const scored = [];
      for (const a of list) {
        let score = 0;
        if (a.iata === upper) score = 1000;
        else if (a.iata.startsWith(upper) && q.length < 3) score = 400;
        else if (a.searchCity.startsWith(q)) score = 300;
        else if (a.searchName.startsWith(q)) score = 250;
        else if (a.searchCity.includes(` ${q}`) || a.searchName.includes(` ${q}`)) score = 180;
        else if (q.length >= 3 && (a.searchCity.includes(q) || a.searchName.includes(q))) score = 100;
        if (!score) continue;
        if (a.rank === 0 && score < 1000) score -= 150;
        scored.push({ a, score: score + a.rank * 20 });
      }
      return scored
        .sort((x, y) => y.score - x.score || x.a.iata.localeCompare(y.a.iata))
        .slice(0, limit)
        .map((s) => s.a);
    },
    /** Best commercial airport near a coordinate (used for Timeline "flying" segments). */
    nearest(lat, lng, maxKm = 80) {
      const near = around(lat, lng, maxKm).filter((x) => x.item.rank >= 2);
      if (!near.length) return null;
      const score = (x) => x.d - x.item.rank * 12;
      return near.sort((p, q) => score(p) - score(q))[0].item;
    },
  };
}

export function buildCityIndex(json) {
  const list = json.rows.map(([name, cc, region, lat, lng, pop, tz, capital]) => ({
    name,
    cc,
    region: region >= 0 ? json.regions[region] : '',
    lat,
    lng,
    pop,
    tz: tz >= 0 ? json.tz[tz] : null,
    capital: !!capital,
  }));
  let searchKeys = null;
  const around = createGrid(list);

  return {
    list,
    /**
     * City a person would say they visited: favours big cities but lets a nearby smaller
     * town win (score = √population / distance), so Shinjuku → Tokyo but Hakone → Hakone.
     */
    locate(lat, lng) {
      const near = around(lat, lng, 40);
      if (near.length) {
        let best = null;
        let bestScore = -1;
        for (const { item, d } of near) {
          const s = Math.sqrt(item.pop || 1) / Math.max(d, 2);
          if (s > bestScore) {
            bestScore = s;
            best = item;
          }
        }
        return best;
      }
      const far = around(lat, lng, 160);
      return far.length ? far[0].item : null;
    },
    search(query, limit = 8) {
      const q = normalizeSearch(query);
      if (!q) return [];
      if (!searchKeys) searchKeys = list.map((c) => normalizeSearch(c.name));
      const out = [];
      for (let i = 0; i < list.length && out.length < 400; i++) {
        const key = searchKeys[i];
        if (key.startsWith(q)) out.push({ c: list[i], score: 2 });
        else if (q.length >= 3 && key.includes(q)) out.push({ c: list[i], score: 1 });
      }
      return out
        .sort((a, b) => b.score - a.score || b.c.pop - a.c.pop)
        .slice(0, limit)
        .map((x) => x.c);
    },
  };
}

let airportsPromise;
export function loadAirports() {
  airportsPromise ??= fetchJson('airports.json').then(buildAirportIndex);
  airportsPromise.catch(() => (airportsPromise = null));
  return airportsPromise;
}

let citiesPromise;
export function loadCities() {
  citiesPromise ??= fetchJson('cities.json').then(buildCityIndex);
  citiesPromise.catch(() => (citiesPromise = null));
  return citiesPromise;
}

let countriesPromise;
export function loadCountries() {
  countriesPromise ??= fetchJson('countries.json').then((json) => ({
    meta: json.meta,
    features: json.geo.features,
    continentOf: (cc) => json.meta[cc]?.continent || null,
  }));
  countriesPromise.catch(() => (countriesPromise = null));
  return countriesPromise;
}

export function cityKey(name, cc) {
  return `${(cc || '').toUpperCase()}:${normalizeSearch(name)}`;
}
