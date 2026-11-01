import { EARTH_CIRCUMFERENCE_KM, MOON_DISTANCE_KM } from './geo.js';
import { isUpcoming, sortFlights } from './flights.js';
import { buildPlaces, flightStops } from './merge.js';
import { tzOffsetMinutes } from './time.js';
import { airlineByCode } from '../data/airlines.js';

function topEntry(map) {
  let best = null;
  for (const [key, value] of map) if (!best || value.count > best.count) best = { key, ...value };
  return best;
}

/**
 * Everything the dashboard shows, for all time or a single year ('YYYY').
 * `continentOf` maps ISO country codes to continent codes.
 */
export function computeStats({ flights = [], places = [], year = 'all', continentOf = () => null }) {
  const inYear = (f) => year === 'all' || f.date.startsWith(year);
  const upcoming = sortFlights(flights.filter((f) => isUpcoming(f)), 'asc');
  const done = flights.filter((f) => !isUpcoming(f) && inYear(f));

  let km = 0;
  let minutes = 0;
  let tzCrossed = 0;
  const airports = new Map();
  const airlines = new Map();
  const routes = new Map();
  const perYear = new Map();
  let longest = null;
  let shortest = null;

  for (const f of done) {
    km += f.distanceKm || 0;
    minutes += f.durationMin || 0;
    for (const a of [f.from, f.to]) {
      const entry = airports.get(a.iata) || { count: 0, airport: a };
      entry.count++;
      airports.set(a.iata, entry);
    }
    const airlineKey = f.airline?.code || f.airline?.name;
    if (airlineKey) {
      const entry = airlines.get(airlineKey) || { count: 0, airline: airlineByCode(f.airline.code) || f.airline };
      entry.count++;
      airlines.set(airlineKey, entry);
    }
    const routeKey = [f.from.iata, f.to.iata].sort().join('⇄');
    const route = routes.get(routeKey) || { count: 0, from: f.from, to: f.to };
    route.count++;
    routes.set(routeKey, route);

    const y = f.date.slice(0, 4);
    const py = perYear.get(y) || { flights: 0, km: 0, minutes: 0 };
    py.flights++;
    py.km += f.distanceKm || 0;
    py.minutes += f.durationMin || 0;
    perYear.set(y, py);

    if (!longest || f.distanceKm > longest.distanceKm) longest = f;
    if (!shortest || f.distanceKm < shortest.distanceKm) shortest = f;

    const when = f.depAt ? new Date(f.depAt) : new Date(`${f.date}T12:00:00Z`);
    const o1 = tzOffsetMinutes(f.from.tz, when);
    const o2 = tzOffsetMinutes(f.to.tz, when);
    if (o1 !== null && o2 !== null) tzCrossed += Math.abs(o2 - o1) / 60;
  }

  const placeList = buildPlaces({ places, flights, year });
  const countries = new Map();
  for (const p of placeList) {
    const c = countries.get(p.cc) || { cc: p.cc, cities: 0, visits: 0, minutes: 0, first: null, last: null };
    c.cities++;
    c.visits += p.visits;
    c.minutes += p.minutes;
    if (p.first && (!c.first || p.first < c.first)) c.first = p.first;
    if (p.last && (!c.last || p.last > c.last)) c.last = p.last;
    countries.set(p.cc, c);
  }
  const continents = new Set([...countries.keys()].map(continentOf).filter(Boolean));

  const allYears = [...new Set([
    ...flights.map((f) => f.date.slice(0, 4)),
    ...places.flatMap((p) => Object.keys(p.byYear || {})),
  ])].filter(Boolean).sort();

  const chronological = sortFlights(done, 'asc');
  const homeAirport = topEntry(airports);

  return {
    year,
    years: allYears,
    flights: done,
    upcoming,
    count: done.length,
    km,
    minutes,
    earthLaps: km / EARTH_CIRCUMFERENCE_KM,
    moonShare: km / MOON_DISTANCE_KM,
    tzCrossed: Math.round(tzCrossed),
    airports: [...airports.values()].sort((a, b) => b.count - a.count),
    airlines: [...airlines.values()].sort((a, b) => b.count - a.count),
    routes: [...routes.values()].sort((a, b) => b.count - a.count),
    perYear: [...perYear.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([y, v]) => ({ year: y, ...v })),
    longest,
    shortest,
    first: chronological[0] || null,
    latest: chronological[chronological.length - 1] || null,
    places: placeList,
    countries: [...countries.values()].sort((a, b) => b.visits - a.visits || b.cities - a.cities),
    continents: [...continents],
    home: homeAirport?.airport || null,
    transits: flightStops(done).filter((s) => s.kind === 'transit').length,
  };
}
