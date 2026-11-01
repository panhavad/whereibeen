#!/usr/bin/env node
/**
 * Downloads open datasets and generates the compact JSON files in public/data/.
 * The generated files are committed, so this only needs to run to refresh data.
 *
 *  - Airports:  OurAirports (public domain) + mwgg/Airports time zones (MIT)
 *  - Cities:    GeoNames cities5000 (CC BY 4.0)
 *  - Countries: Natural Earth 110m admin-0 (public domain) + GeoNames countryInfo (CC BY 4.0)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

const OUT_DIR = new URL('../public/data/', import.meta.url);

const SOURCES = {
  airports: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
  airportTz: 'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json',
  cities: 'https://download.geonames.org/export/dump/cities5000.zip',
  admin1: 'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
  countryInfo: 'https://download.geonames.org/export/dump/countryInfo.txt',
  countries: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
};

async function download(url, kind = 'text') {
  process.stdout.write(`  ↓ ${url}\n`);
  const res = await fetch(url, { headers: { 'user-agent': 'whereibeen-data-builder/1.0' } });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  if (kind === 'buffer') return new Uint8Array(await res.arrayBuffer());
  if (kind === 'json') return res.json();
  return res.text();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

/** Tiny interning table so repeated strings (time zones, regions) are stored once. */
function interner() {
  const list = [];
  const index = new Map();
  return {
    list,
    id(value) {
      if (!value) return -1;
      if (!index.has(value)) { index.set(value, list.length); list.push(value); }
      return index.get(value);
    },
  };
}

async function buildCities() {
  console.log('• Cities (GeoNames cities5000)');
  const [zip, admin1Text] = await Promise.all([download(SOURCES.cities, 'buffer'), download(SOURCES.admin1)]);
  const files = unzipSync(zip);
  const tsv = strFromU8(files['cities5000.txt']);

  const admin1 = new Map();
  for (const line of admin1Text.split('\n')) {
    const [code, name] = line.split('\t');
    if (code && name) admin1.set(code, name);
  }

  const excluded = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH']);
  const adminSeats = new Set(['PPLC', 'PPLA', 'PPLA2']);
  const tz = interner();
  const regions = interner();
  const rows = [];
  for (const line of tsv.split('\n')) {
    const c = line.split('\t');
    if (c.length < 18 || excluded.has(c[7])) continue;
    const pop = Number(c[14]) || 0;
    if (pop < 10000 && !adminSeats.has(c[7])) continue;
    // GeoNames keeps municipal suffixes ("Nara-shi", "Suwon-si") that travellers don't use.
    let name = c[1];
    if (c[8] === 'JP') name = name.replace(/-shi$/, '');
    if (c[8] === 'KR') name = name.replace(/-si$/, '');
    rows.push([
      name,
      c[8],
      regions.id(admin1.get(`${c[8]}.${c[10]}`) || ''),
      round(Number(c[4]), 3),
      round(Number(c[5]), 3),
      pop,
      tz.id(c[17]),
      c[7] === 'PPLC' ? 1 : 0,
    ]);
  }
  rows.sort((a, b) => b[5] - a[5]);
  console.log(`  ✓ ${rows.length} cities`);
  return {
    v: 1,
    fields: ['name', 'cc', 'region', 'lat', 'lng', 'pop', 'tz', 'capital'],
    tz: tz.list,
    regions: regions.list,
    rows,
  };
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** Grid-indexed city lookups used to enrich airports (time zone + served metro area). */
function cityLocator(cities) {
  const grid = new Map();
  for (const row of cities.rows) {
    const key = `${Math.floor(row[3])}:${Math.floor(row[4])}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(row);
  }
  const around = (lat, lng, radiusKm) => {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const row of grid.get(`${Math.floor(lat) + dy}:${Math.floor(lng) + dx}`) || []) {
          const d = distanceKm(lat, lng, row[3], row[4]);
          if (d <= radiusKm) out.push({ row, d });
        }
      }
    }
    return out.sort((a, b) => a.d - b.d);
  };
  return {
    tz(lat, lng) {
      const best = around(lat, lng, 150)[0];
      return best && best.row[6] >= 0 ? cities.tz[best.row[6]] : '';
    },
    /** Big-city name an airport serves, e.g. NRT (Narita) → Tokyo, STN (Stansted) → London. */
    metro(lat, lng, cc, cityName) {
      const near = around(lat, lng, 70).filter((x) => x.row[1] === cc);
      const own = near.find((x) => x.row[0] === cityName && x.d < 40);
      const ownPop = own ? own.row[5] : 0;
      const big = near
        .filter((x) => x.row[5] >= 1_000_000 && x.row[5] >= ownPop * 5)
        .sort((a, b) => b.row[5] - a.row[5])[0];
      return big ? big.row[0] : cityName;
    },
  };
}

async function buildAirports(cities) {
  console.log('• Airports (OurAirports + mwgg time zones)');
  const [csv, tzJson] = await Promise.all([download(SOURCES.airports), download(SOURCES.airportTz, 'json').catch(() => ({}))]);
  const tzByIata = new Map();
  for (const a of Object.values(tzJson)) if (a.iata && a.tz) tzByIata.set(a.iata, a.tz);
  const locate = cityLocator(cities);

  const typeRank = { large_airport: 3, medium_airport: 2, small_airport: 1, seaplane_base: 1, closed: 0 };
  // Served-city names that the population heuristic can't infer.
  const cityOverrides = { IAD: 'Washington', DCA: 'Washington' };
  const best = new Map();
  for (const a of parseCsv(csv)) {
    const iata = (a.iata_code || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iata) || !(a.type in typeRank)) continue;
    const scheduled = a.scheduled_service === 'yes';
    if (a.type === 'seaplane_base' && !scheduled) continue;
    // Closed airports are kept (rank 0) so historic bookings, e.g. REP or TXL, still resolve.
    const rank = typeRank[a.type] + (scheduled && a.type !== 'closed' ? 1 : 0);
    const prev = best.get(iata);
    if (prev && prev.rank >= rank) continue;
    best.set(iata, { a, rank });
  }

  const tz = interner();
  const rows = [];
  // mwgg/Airports still lists many retired codes (REP, TXL, SXF…) that OurAirports cleared.
  for (const m of Object.values(tzJson)) {
    const iata = (m.iata || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iata) || best.has(iata) || !m.country || !Number.isFinite(+m.lat)) continue;
    best.set(iata, {
      a: { name: m.name, municipality: m.city, iso_country: m.country, latitude_deg: m.lat, longitude_deg: m.lon },
      rank: 0,
    });
  }
  for (const [iata, { a, rank }] of best) {
    const lat = round(Number(a.latitude_deg), 4);
    const lng = round(Number(a.longitude_deg), 4);
    const municipality = (a.municipality || '').replace(/\s*\([^)]*\)\s*/g, ' ').split(/[/,]/)[0].trim();
    rows.push([
      iata,
      a.name.trim(),
      cityOverrides[iata] || locate.metro(lat, lng, a.iso_country, municipality || a.name.trim()),
      a.iso_country,
      lat,
      lng,
      tz.id(tzByIata.get(iata) || locate.tz(lat, lng)),
      rank,
    ]);
  }
  rows.sort((x, y) => y[7] - x[7] || x[0].localeCompare(y[0]));
  console.log(`  ✓ ${rows.length} airports with IATA codes`);
  return { v: 1, fields: ['iata', 'name', 'city', 'cc', 'lat', 'lng', 'tz', 'rank'], tz: tz.list, rows };
}

function roundRing(ring) {
  const out = [];
  for (const [lng, lat] of ring) {
    const p = [round(lng, 2), round(lat, 2)];
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) out.push(p);
  }
  if (out.length > 1) {
    const [a, b] = [out[0], out[out.length - 1]];
    if (a[0] !== b[0] || a[1] !== b[1]) out.push([...a]);
  }
  // A valid ring needs 3 distinct vertices plus the closing point.
  return out.length >= 4 ? out : null;
}

/** Rounds coordinates to ~1 km and drops rings/polygons that collapse (h3 rejects them). */
function simplifyGeometry(geometry) {
  const polygon = (rings) => {
    const outer = roundRing(rings[0]);
    if (!outer) return null;
    return [outer, ...rings.slice(1).map(roundRing).filter(Boolean)];
  };
  if (geometry.type === 'Polygon') {
    const p = polygon(geometry.coordinates);
    return p ? { type: 'Polygon', coordinates: p } : null;
  }
  const polys = geometry.coordinates.map(polygon).filter(Boolean);
  if (!polys.length) return null;
  return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
}

async function buildCountries() {
  console.log('• Countries (Natural Earth 110m + GeoNames countryInfo)');
  const [geo, infoText] = await Promise.all([download(SOURCES.countries, 'json'), download(SOURCES.countryInfo)]);
  const meta = {};
  for (const line of infoText.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const c = line.split('\t');
    // ISO, ISO3, ISO-Numeric, fips, Country, Capital, Area, Population, Continent
    meta[c[0]] = { name: c[4], continent: c[8], capital: c[5], population: Number(c[7]) || 0 };
  }
  const features = geo.features
    .map((f) => {
      let iso2 = f.properties.ISO_A2_EH;
      if (!iso2 || iso2 === '-99') iso2 = f.properties.ISO_A2;
      if (!iso2 || iso2 === '-99') iso2 = null;
      const geometry = simplifyGeometry(f.geometry);
      return geometry ? { type: 'Feature', properties: { iso2, name: f.properties.NAME }, geometry } : null;
    })
    .filter(Boolean);
  console.log(`  ✓ ${features.length} country shapes, ${Object.keys(meta).length} country records`);
  return { v: 1, meta, geo: { type: 'FeatureCollection', features } };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const cities = await buildCities();
  const [airports, countries] = await Promise.all([buildAirports(cities), buildCountries()]);
  const files = { 'cities.json': cities, 'airports.json': airports, 'countries.json': countries };
  for (const [name, data] of Object.entries(files)) {
    const json = JSON.stringify(data);
    await writeFile(new URL(name, OUT_DIR), json);
    console.log(`  → public/data/${name} (${(json.length / 1024).toFixed(0)} KB)`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
