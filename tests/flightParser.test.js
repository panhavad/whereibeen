import { describe, expect, it } from 'vitest';
import { htmlToText, parseEmail } from '../src/sources/flightParser.js';
import { consolidateCandidates } from '../src/core/merge.js';
import { testAirports } from './helpers.js';

const airports = testAirports();
const email = (over) => ({ id: 'm1', threadId: 't1', subject: '', from: '', date: Date.UTC(2024, 1, 1), html: '', text: '', ...over });

describe('structured (schema.org) extraction', () => {
  it('reads JSON-LD FlightReservation with offsets', () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"http://schema.org","@type":"FlightReservation","reservationNumber":"RXJ34P",
       "reservationStatus":"http://schema.org/ReservationConfirmed","underName":{"@type":"Person","name":"Eva Green"},
       "reservationFor":{"@type":"Flight","flightNumber":"110","airline":{"@type":"Airline","name":"United","iataCode":"UA"},
       "departureAirport":{"@type":"Airport","name":"San Francisco Airport","iataCode":"SFO"},"departureTime":"2027-03-04T20:15:00-08:00",
       "arrivalAirport":{"@type":"Airport","name":"John F. Kennedy International Airport","iataCode":"JFK"},"arrivalTime":"2027-03-05T06:30:00-05:00"}}
    </script></head><body>Thanks</body></html>`;
    const { kind, flights } = parseEmail(email({ html, subject: 'Your United reservation' }), airports);
    expect(kind).toBe('structured');
    expect(flights).toHaveLength(1);
    const [f] = flights;
    expect(f.from.iata).toBe('SFO');
    expect(f.to.iata).toBe('JFK');
    expect(f.date).toBe('2027-03-04');
    expect(f.dep).toBe('20:15');
    expect(f.arr).toBe('06:30');
    expect(f.arrDayOffset).toBe(1);
    expect(f.flightNo).toBe('UA110');
    expect(f.pnr).toBe('RXJ34P');
    expect(f.depAt).toBe('2027-03-05T04:15:00.000Z');

    const [flight] = consolidateCandidates(flights);
    expect(flight.durationMin).toBe(435);
    expect(flight.durationEstimated).toBe(false);
    expect(flight.distanceKm).toBeGreaterThan(4100);
  });

  it('reads microdata and multi-leg @graph', () => {
    const html = `<div itemscope itemtype="http://schema.org/FlightReservation">
        <meta itemprop="reservationNumber" content="ABC123"/>
        <div itemprop="reservationFor" itemscope itemtype="http://schema.org/Flight">
          <meta itemprop="flightNumber" content="703"/>
          <div itemprop="airline" itemscope itemtype="http://schema.org/Airline"><meta itemprop="iataCode" content="KE"/></div>
          <div itemprop="departureAirport" itemscope itemtype="http://schema.org/Airport"><meta itemprop="iataCode" content="ICN"/></div>
          <meta itemprop="departureTime" content="2024-03-15T10:30:00+09:00"/>
          <div itemprop="arrivalAirport" itemscope itemtype="http://schema.org/Airport"><meta itemprop="iataCode" content="NRT"/></div>
          <meta itemprop="arrivalTime" content="2024-03-15T12:45:00+09:00"/>
        </div>
      </div>`;
    const { flights } = parseEmail(email({ html }), airports);
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({ date: '2024-03-15', dep: '10:30', arr: '12:45', flightNo: 'KE703', pnr: 'ABC123' });
    expect(flights[0].from.city).toBe('Seoul');
    expect(flights[0].to.city).toBe('Tokyo');
  });

  it('flags cancelled reservations', () => {
    const html = `<script type="application/ld+json">[{"@type":"FlightReservation","reservationStatus":"ReservationCancelled",
      "reservationFor":{"@type":"Flight","flightNumber":"KE5","departureAirport":{"iataCode":"ICN"},"arrivalAirport":{"iataCode":"LAX"},
      "departureTime":"2024-06-01T19:00:00+09:00"}}]</script>`;
    const { flights } = parseEmail(email({ html }), airports);
    expect(flights[0].cancelled).toBe(true);
  });
});

describe('heuristic extraction', () => {
  it('parses an airline e-ticket receipt with two legs', () => {
    const text = [
      'Booking Reference: ABC123',
      'Flight KE 703',
      'Seoul/Incheon (ICN) 15 Mar 2024 (Fri) 10:30 Terminal 2',
      'Tokyo/Narita (NRT) 15 Mar 2024 (Fri) 12:45 Terminal 1',
      'Flight KE 704',
      'Tokyo/Narita (NRT) 20 Mar 2024 (Wed) 14:00',
      'Seoul/Incheon (ICN) 20 Mar 2024 (Wed) 16:40',
      'Economy class Seat 32A',
    ].join('\n');
    const { kind, flights } = parseEmail(email({ subject: 'E-Ticket Itinerary Receipt', from: 'Korean Air <noreply@koreanair.com>', text }), airports);
    expect(kind).toBe('heuristic');
    expect(flights).toHaveLength(2);
    expect(flights[0]).toMatchObject({ date: '2024-03-15', dep: '10:30', arr: '12:45', flightNo: 'KE703', pnr: 'ABC123', cabin: 'Economy' });
    expect(flights[0].from.iata).toBe('ICN');
    expect(flights[0].to.iata).toBe('NRT');
    expect(flights[1]).toMatchObject({ date: '2024-03-20', dep: '14:00', arr: '16:40', flightNo: 'KE704' });
    expect(flights[1].from.iata).toBe('NRT');
    expect(flights[1].to.iata).toBe('ICN');
    expect(flights[0].confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('parses Korean low-cost carrier confirmations', () => {
    const html = `<table><tr><td>예약번호: K7ABCD</td></tr>
      <tr><td>7C1101</td><td>김포(GMP)</td><td>→</td><td>제주(CJU)</td></tr>
      <tr><td>2024년 5월 3일 오전 8:05 출발</td><td>오전 9:15 도착</td></tr></table>`;
    const { flights } = parseEmail(email({ subject: '[제주항공] 항공권 예약 확인', from: 'noreply@jejuair.net', html, date: Date.UTC(2024, 3, 1) }), airports);
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({ date: '2024-05-03', dep: '08:05', arr: '09:15', flightNo: '7C1101', pnr: 'K7ABCD' });
    expect(flights[0].from.iata).toBe('GMP');
    expect(flights[0].to.iata).toBe('CJU');
  });

  it('handles arrow routes, airline names and year inference', () => {
    const text = 'Your trip is confirmed\nICN → PNH\nThu, Dec 5 · Asiana Airlines 737 · 18:35 – 22:20\nConfirmation code: Q7XK2P';
    const { flights } = parseEmail(email({ subject: 'Your flight to Phnom Penh', from: 'Expedia <travel@expedia.com>', text, date: Date.UTC(2024, 10, 2) }), airports);
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({ date: '2024-12-05', flightNo: 'OZ737', dep: '18:35', arr: '22:20' });
    expect(flights[0].to.city).toBe('Phnom Penh');
  });

  it('chains multi-leg arrows and drops the summary leg', () => {
    const text = 'Itinerary ICN → HNL\nBoarding pass\nICN → NRT 2024-07-01 09:00\nNRT → HNL 2024-07-01 21:00\nBooking reference: ZZ9PLZ';
    const { flights } = parseEmail(email({ text, subject: 'Boarding pass' }), airports);
    expect(flights.map((f) => `${f.from.iata}-${f.to.iata}`)).toEqual(['ICN-NRT', 'NRT-HNL']);
  });

  it('ignores marketing emails and aircraft types', () => {
    const promo = parseEmail(email({ subject: 'Summer SALE: fares from $99!', text: 'Fly ICN → NRT from $99. Book now, limited time. Airbus A320 service.' }), airports);
    expect(promo.flights).toHaveLength(0);
  });

  it('marks cancellation emails', () => {
    const text = 'Booking reference ABC123\nFlight KE 703\nSeoul (ICN) 15 Mar 2024 10:30\nTokyo (NRT) 15 Mar 2024 12:45';
    const booking = parseEmail(email({ id: 'a', subject: 'Booking confirmation', text, date: Date.UTC(2024, 0, 10) }), airports).flights;
    const cancel = parseEmail(email({ id: 'b', subject: 'Your flight has been cancelled', text, date: Date.UTC(2024, 0, 20) }), airports).flights;
    expect(cancel[0].cancelled).toBe(true);
    expect(consolidateCandidates([...booking, ...cancel])).toHaveLength(0);
    expect(consolidateCandidates([...booking, ...booking.map((f) => ({ ...f, emailDate: f.emailDate + 1 }))])).toHaveLength(1);
  });
});

describe('htmlToText', () => {
  it('keeps table cells on their own lines and drops styles', () => {
    const text = htmlToText('<style>.x{}</style><table><tr><td>ICN</td><td>NRT</td></tr></table><p>Hello&nbsp;world</p>');
    expect(text).toBe('ICN\nNRT\nHello world');
  });
});
