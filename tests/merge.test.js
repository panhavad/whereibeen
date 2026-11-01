import { describe, expect, it } from 'vitest';
import { createFlight } from '../src/core/flights.js';
import { buildPlaces, flightStops, isSameFlight, mergeIntoLog } from '../src/core/merge.js';
import { computeStats } from '../src/core/stats.js';
import { airportSnapshot } from '../src/core/datasets.js';
import { testAirports } from './helpers.js';

const airports = testAirports();
const ap = (code) => airportSnapshot(airports.get(code));
const flight = (from, to, date, extra = {}) => createFlight({ from: ap(from), to: ap(to), date, ...extra });

describe('flight metrics', () => {
  it('computes time-zone aware durations from local times', () => {
    const f = flight('ICN', 'JFK', '2024-05-01', { dep: '10:00', arr: '10:30' });
    expect(f.durationMin).toBe(13 * 60 + 30); // KST (UTC+9) → EDT (UTC−4)
    expect(f.durationEstimated).toBe(false);
    expect(f.depAt).toBe('2024-05-01T01:00:00.000Z');
  });

  it('handles overnight arrivals without an explicit day offset', () => {
    const f = flight('LHR', 'SIN', '2024-05-01', { dep: '21:00', arr: '17:30' });
    expect(f.durationMin).toBe(13 * 60 + 30);
    expect(f.arrDayOffset).toBe(1);
  });

  it('handles date-line crossings in both directions', () => {
    const east = flight('ICN', 'HNL', '2024-03-01', { dep: '20:00', arr: '09:30' });
    expect(east.durationMin).toBe(8 * 60 + 30);
    expect(east.arrDayOffset).toBe(0);
    const west = flight('HNL', 'ICN', '2024-03-10', { dep: '13:00', arr: '18:30' });
    expect(west.durationMin).toBe(10 * 60 + 30);
    expect(west.arrDayOffset).toBe(1);
  });

  it('estimates durations when times are missing', () => {
    const f = flight('ICN', 'NRT', '2024-05-01');
    expect(f.durationEstimated).toBe(true);
    expect(f.durationMin).toBeGreaterThan(100);
    expect(f.durationMin).toBeLessThan(160);
  });
});

describe('merging', () => {
  it('treats nearby airports of the same city on the same day as duplicates', () => {
    expect(isSameFlight(flight('ICN', 'NRT', '2024-01-01'), flight('ICN', 'HND', '2024-01-01'))).toBe(true);
    expect(isSameFlight(flight('ICN', 'NRT', '2024-01-01'), flight('ICN', 'NRT', '2024-01-05'))).toBe(false);
  });

  it('enriches existing entries and respects dismissed ones', () => {
    const manual = flight('ICN', 'NRT', '2024-01-01');
    const fromGmail = flight('ICN', 'NRT', '2024-01-01', { source: 'gmail', flightNo: 'KE703', dep: '10:30', arr: '12:45' });
    const result = mergeIntoLog([manual], [fromGmail, flight('NRT', 'HNL', '2024-01-02', { source: 'gmail' })], ['2024-01-02|NRT|HNL']);
    expect(result.flights).toHaveLength(1);
    expect(result.flights[0].flightNo).toBe('KE703');
    expect(result.flights[0].source).toBe('manual');
    expect(result.skipped).toBe(1);
  });
});

describe('places & stats', () => {
  const trip = [
    flight('ICN', 'NRT', '2023-04-01', { dep: '09:00', arr: '11:20' }),
    flight('NRT', 'HNL', '2023-04-01', { dep: '20:00', arr: '08:30' }),
    flight('HNL', 'ICN', '2023-04-10', { dep: '13:00', arr: '18:30' }),
  ];

  it('labels connections as transit', () => {
    const kinds = flightStops(trip).map((s) => `${s.place.iata}:${s.kind}`);
    expect(kinds).toEqual(['ICN:origin', 'NRT:transit', 'HNL:destination', 'HNL:origin', 'ICN:destination']);
  });

  it('builds visited places without transit cities', () => {
    const places = buildPlaces({ flights: trip });
    expect(places.map((p) => p.name).sort()).toEqual(['Honolulu', 'Seoul']);
  });

  it('computes headline stats', () => {
    const stats = computeStats({ flights: trip, continentOf: (cc) => ({ KR: 'AS', US: 'OC', JP: 'AS' })[cc] });
    expect(stats.count).toBe(3);
    expect(stats.km).toBeGreaterThan(14000);
    expect(stats.countries.map((c) => c.cc).sort()).toEqual(['KR', 'US']);
    expect(`${stats.longest.from.iata}-${stats.longest.to.iata}`).toBe('HNL-ICN');
    expect(stats.tzCrossed).toBeGreaterThan(0);
    expect(stats.years).toEqual(['2023']);
  });
});
