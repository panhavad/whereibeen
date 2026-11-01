import { airportSnapshot, loadAirports } from '../core/datasets.js';
import { createFlight } from '../core/flights.js';
import { addDays, todayISO, uid } from '../core/util.js';
import { airlineByCode } from './airlines.js';

// date, from, to, airline, number, dep, arr, cabin
const FLIGHTS = [
  ['2019-02-02', 'ICN', 'BKK', 'TG', '657', '19:20', '23:10', 'Economy'],
  ['2019-02-08', 'BKK', 'ICN', 'TG', '656', '10:40', '18:20', 'Economy'],
  ['2019-07-12', 'ICN', 'CDG', 'KE', '901', '13:10', '18:30', 'Economy'],
  ['2019-07-20', 'CDG', 'FCO', 'AF', '1404', '07:05', '09:10', 'Economy'],
  ['2019-07-26', 'FCO', 'ICN', 'KE', '932', '21:00', '16:00', 'Economy'],
  ['2020-01-18', 'GMP', 'CJU', '7C', '101', '08:00', '09:10', 'Economy'],
  ['2020-01-21', 'CJU', 'GMP', '7C', '120', '18:00', '19:10', 'Economy'],
  ['2022-08-10', 'ICN', 'NRT', 'KE', '703', '10:30', '12:45', 'Economy'],
  ['2022-08-14', 'HND', 'GMP', 'KE', '2708', '16:05', '18:25', 'Economy'],
  ['2022-12-20', 'ICN', 'SIN', 'SQ', '607', '16:30', '22:05', 'Premium Economy'],
  ['2022-12-24', 'SIN', 'DPS', 'SQ', '946', '09:40', '12:25', 'Economy'],
  ['2022-12-29', 'DPS', 'ICN', 'KE', '630', '00:55', '09:00', 'Economy'],
  ['2023-04-01', 'ICN', 'PNH', 'KE', '689', '18:30', '21:50', 'Economy'],
  ['2023-04-05', 'PNH', 'REP', 'K6', '106', '08:00', '08:50', 'Economy'],
  ['2023-04-09', 'REP', 'BKK', 'PG', '906', '09:20', '10:30', 'Economy'],
  ['2023-04-09', 'BKK', 'ICN', 'KE', '652', '13:40', '21:05', 'Economy'],
  ['2023-09-14', 'ICN', 'LAX', 'KE', '17', '14:30', '09:00', 'Economy'],
  ['2023-09-18', 'LAX', 'JFK', 'AA', '10', '08:00', '16:30', 'Economy'],
  ['2023-09-24', 'JFK', 'ICN', 'KE', '86', '13:00', '17:30', 'Business'],
  ['2024-03-08', 'ICN', 'HKG', 'CX', '415', '08:50', '11:40', 'Economy'],
  ['2024-03-11', 'HKG', 'TPE', 'CX', '494', '12:30', '14:20', 'Economy'],
  ['2024-03-14', 'TPE', 'ICN', 'BR', '160', '08:10', '11:45', 'Economy'],
  ['2024-06-20', 'ICN', 'IST', 'TK', '91', '23:55', '06:00', 'Economy'],
  ['2024-06-25', 'IST', 'ATH', 'TK', '1841', '07:35', '08:55', 'Economy'],
  ['2024-06-30', 'ATH', 'LHR', 'BA', '641', '15:45', '17:55', 'Economy'],
  ['2024-07-04', 'LHR', 'ICN', 'KE', '908', '20:40', '17:05', 'Economy'],
  ['2024-11-15', 'ICN', 'SYD', 'KE', '121', '19:05', '07:00', 'Economy'],
  ['2024-11-22', 'SYD', 'AKL', 'NZ', '104', '10:00', '15:05', 'Economy'],
  ['2024-11-28', 'AKL', 'ICN', 'KE', '130', '11:05', '19:05', 'Economy'],
  ['2025-02-10', 'ICN', 'DXB', 'EK', '323', '23:55', '04:50', 'Economy'],
  ['2025-02-15', 'DXB', 'ICN', 'EK', '322', '03:00', '16:35', 'Economy'],
  ['2025-05-01', 'ICN', 'HAN', 'VN', '417', '10:35', '13:25', 'Economy'],
  ['2025-05-04', 'HAN', 'SGN', 'VN', '215', '09:00', '11:10', 'Economy'],
  ['2025-05-08', 'SGN', 'ICN', 'VJ', '862', '23:30', '06:50', 'Economy'],
  ['2025-10-02', 'ICN', 'YVR', 'AC', '64', '19:00', '13:20', 'Economy'],
  ['2025-10-07', 'YVR', 'ICN', 'KE', '72', '13:00', '16:30', 'Economy'],
  ['2026-01-17', 'ICN', 'KIX', '7C', '1302', '07:40', '09:30', 'Economy'],
  ['2026-01-21', 'KIX', 'ICN', '7C', '1301', '10:30', '12:20', 'Economy'],
  ['2026-06-12', 'ICN', 'MEX', 'AM', '91', '15:00', '13:05', 'Business'],
  ['2026-06-20', 'MEX', 'CUN', 'AM', '531', '09:00', '12:10', 'Economy'],
  ['2026-06-26', 'CUN', 'LAX', 'AS', '1361', '12:00', '14:20', 'Economy'],
  ['2026-06-28', 'LAX', 'ICN', 'KE', '12', '11:00', '17:20', 'Economy'],
];

// name, cc, lat, lng, first, last, visits, hours
const PLACES = [
  ['Kyoto', 'JP', 35.021, 135.754, '2026-01-19', '2026-01-19', 1, 11],
  ['Busan', 'KR', 35.102, 129.04, '2021-10-02', '2021-10-05', 1, 72],
  ['Gyeongju', 'KR', 35.843, 129.212, '2021-10-04', '2021-10-04', 1, 9],
  ['Venice', 'IT', 45.438, 12.327, '2019-07-23', '2019-07-24', 1, 30],
  ['Florence', 'IT', 43.778, 11.249, '2019-07-22', '2019-07-22', 1, 12],
  ['Ubud', 'ID', -8.507, 115.263, '2022-12-26', '2022-12-27', 1, 40],
  ['Hakone', 'JP', 35.189, 139.026, '2022-08-12', '2022-08-12', 1, 10],
  ['Ha Long', 'VN', 20.951, 107.08, '2025-05-02', '2025-05-03', 1, 26],
  ['Whistler', 'CA', 50.116, -122.957, '2025-10-04', '2025-10-05', 1, 34],
  ['Santorini', 'GR', 36.417, 25.432, '2024-06-27', '2024-06-28', 1, 36],
];

/** Routes animated on the landing page globe. */
export const LANDING_ROUTES = [
  ['ICN', 'CDG'], ['ICN', 'JFK'], ['JFK', 'LHR'], ['LHR', 'DXB'], ['DXB', 'SIN'], ['SIN', 'SYD'], ['SYD', 'LAX'],
  ['LAX', 'NRT'], ['NRT', 'HNL'], ['CDG', 'GRU'], ['GRU', 'JNB'], ['JNB', 'DXB'], ['ICN', 'PNH'], ['BKK', 'IST'],
  ['IST', 'JFK'], ['YVR', 'HKG'], ['AKL', 'SFO'], ['MEX', 'MAD'], ['MAD', 'CAI'], ['DEL', 'FRA'],
];

export async function buildDemoData() {
  const airports = await loadAirports();
  const flights = FLIGHTS.map(([date, from, to, code, num, dep, arr, cabin], i) =>
    createFlight({
      from: airportSnapshot(airports.get(from)),
      to: airportSnapshot(airports.get(to)),
      date,
      dep,
      arr,
      airline: { code, name: airlineByCode(code)?.name || code },
      flightNo: `${code}${num}`,
      cabin,
      seat: `${10 + ((i * 7) % 40)}${'ACDFHK'[i % 6]}`,
      source: i % 4 === 0 ? 'manual' : 'gmail',
      confidence: 0.97,
      sourceRef: i % 4 === 0 ? null : { subject: `Your e-ticket receipt ${from}–${to}` },
    }),
  ).map((f) => ({ ...f, source: 'demo', demoOrigin: f.source }));

  // Two upcoming trips relative to today so the demo always has something ahead.
  const soon = addDays(todayISO(), 24);
  const back = addDays(todayISO(), 33);
  for (const [date, from, to, code, num, dep, arr] of [
    [soon, 'ICN', 'ZRH', 'KE', '917', '13:15', '19:05'],
    [back, 'ZRH', 'ICN', 'KE', '918', '20:55', '16:30'],
  ]) {
    flights.push({
      ...createFlight({
        from: airportSnapshot(airports.get(from)),
        to: airportSnapshot(airports.get(to)),
        date,
        dep,
        arr,
        airline: { code, name: airlineByCode(code)?.name },
        flightNo: `${code}${num}`,
        cabin: 'Economy',
      }),
      source: 'demo',
    });
  }

  const places = PLACES.map(([name, cc, lat, lng, first, last, visits, hours]) => ({
    id: uid('p'),
    name,
    cc,
    region: '',
    lat,
    lng,
    first,
    last,
    visits,
    minutes: hours * 60,
    days: Math.max(1, Math.round((new Date(last) - new Date(first)) / 86400000) + 1),
    byYear: { [first.slice(0, 4)]: { v: visits, m: hours * 60, d: 1 } },
    source: 'demo',
    notes: '',
  }));

  return { flights, places };
}

export async function buildLandingFlights() {
  const airports = await loadAirports();
  return LANDING_ROUTES.map(([from, to], i) =>
    createFlight({ id: `landing-${i}`, from: airportSnapshot(airports.get(from)), to: airportSnapshot(airports.get(to)), date: '2020-01-01' }),
  );
}
