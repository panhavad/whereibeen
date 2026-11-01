import { describe, expect, it } from 'vitest';
import { aggregateTimeline, detectFormat, extractTimeline } from '../src/sources/timeline.js';
import { testAirports, testCities } from './helpers.js';

const ctx = () => ({ airports: testAirports(), cities: testCities() });

const android = {
  semanticSegments: [
    {
      startTime: '2024-03-15T08:00:00.000+09:00',
      endTime: '2024-03-15T09:30:00.000+09:00',
      visit: { hierarchyLevel: 0, probability: 0.9, topCandidate: { placeId: 'a', placeLocation: { latLng: '37.5665°, 126.9780°' } } },
    },
    {
      startTime: '2024-03-15T10:30:00.000+09:00',
      endTime: '2024-03-15T12:45:00.000+09:00',
      activity: {
        start: { latLng: '37.4602°, 126.4407°' },
        end: { latLng: '35.7720°, 140.3929°' },
        distanceMeters: 1260000,
        topCandidate: { type: 'FLYING', probability: 0.8 },
      },
    },
    {
      startTime: '2024-03-15T15:00:00.000+09:00',
      endTime: '2024-03-17T11:00:00.000+09:00',
      visit: { hierarchyLevel: 0, topCandidate: { placeId: 'b', placeLocation: { latLng: '35.6938°, 139.7034°' } } },
    },
    {
      startTime: '2024-03-16T10:00:00.000+09:00',
      endTime: '2024-03-16T11:00:00.000+09:00',
      visit: { hierarchyLevel: 1, topCandidate: { placeId: 'c', placeLocation: { latLng: '35.6938°, 139.7034°' } } },
    },
    { startTime: '2024-03-15T10:00:00.000+09:00', endTime: '2024-03-15T11:00:00.000+09:00', timelinePath: [{ point: '37.5°, 126.9°', time: '2024-03-15T10:05:00.000+09:00' }] },
  ],
  rawSignals: [],
};

const ios = [
  {
    startTime: '2023-08-01T09:00:00.000+07:00',
    endTime: '2023-08-01T18:00:00.000+07:00',
    visit: { hierarchyLevel: '0', probability: '0.95', topCandidate: { probability: '0.8', semanticType: 'Unknown', placeID: 'x', placeLocation: 'geo:11.556400,104.928200' } },
  },
  {
    startTime: '2023-08-02T07:00:00.000+07:00',
    endTime: '2023-08-02T08:00:00.000+07:00',
    activity: { start: 'geo:11.5473,104.8443', end: 'geo:13.4100,103.8130', distanceMeters: '230000.0', topCandidate: { type: 'flying', probability: '0.7' } },
  },
];

const takeout = {
  timelineObjects: [
    {
      placeVisit: {
        location: { latitudeE7: 488566000, longitudeE7: 23522000, name: 'Louvre', placeId: 'p' },
        duration: { startTimestamp: '2019-06-01T08:00:00Z', endTimestamp: '2019-06-01T12:00:00Z' },
      },
    },
    {
      // Western longitude wrapped as unsigned 32-bit (New York)
      placeVisit: {
        location: { latitudeE7: 407128000, longitudeE7: 2 ** 32 - 740060000 },
        duration: { startTimestampMs: String(Date.UTC(2019, 6, 4, 14)), endTimestampMs: String(Date.UTC(2019, 6, 4, 20)) },
      },
    },
  ],
};

describe('timeline formats', () => {
  it('detects every supported shape', () => {
    expect(detectFormat(android)).toBe('android');
    expect(detectFormat(ios)).toBe('ios');
    expect(detectFormat(takeout)).toBe('takeout-semantic');
    expect(detectFormat({ locations: [] })).toBe('takeout-records');
    expect(detectFormat([{ a: 1 }])).toBe(null);
  });

  it('aggregates an Android export into cities and flights', () => {
    const ex = extractTimeline(android);
    expect(ex.visits).toHaveLength(2); // nested hierarchyLevel 1 visit is skipped
    expect(ex.flights).toHaveLength(1);
    const result = aggregateTimeline([ex], ctx());
    const names = result.places.map((p) => p.name).sort();
    expect(names).toEqual(['Seoul', 'Tokyo']);
    const tokyo = result.places.find((p) => p.name === 'Tokyo');
    expect(tokyo.days).toBe(3);
    expect(tokyo.byYear['2024'].v).toBe(1);
    expect(result.flights).toHaveLength(1);
    expect(result.flights[0].from.iata).toBe('ICN');
    expect(result.flights[0].to.iata).toBe('NRT');
    expect(result.flights[0].dep).toBe('10:30');
    expect(result.flights[0].durationMin).toBe(135);
  });

  it('reads iOS string-typed exports', () => {
    const result = aggregateTimeline([extractTimeline(ios)], ctx());
    expect(result.places[0].name).toBe('Phnom Penh');
    expect(result.places[0].cc).toBe('KH');
    expect(result.flights[0].to.city).toBe('Siem Reap');
    expect(result.flights[0].date).toBe('2023-08-02');
  });

  it('reads legacy Takeout with E7 coordinates and wrapped negatives', () => {
    const ex = extractTimeline(takeout);
    expect(ex.visits[1].lng).toBeCloseTo(-74.006, 3);
    const result = aggregateTimeline([ex], ctx());
    expect(result.places.map((p) => p.name).sort()).toEqual(['New York City', 'Paris']);
    expect(result.summary.countries).toBe(2);
  });
});
