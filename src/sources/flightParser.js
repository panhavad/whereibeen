import { airportSnapshot } from '../core/datasets.js';
import { normalizeFlightNo } from '../core/flights.js';
import { splitIsoLocal } from '../core/time.js';
import { addDays, dayDiff, toDay } from '../core/util.js';
import { AIRLINES, airlineByCode, airlineByDomain, TRAVEL_AGENCY_DOMAINS } from '../data/airlines.js';

/* ------------------------------------------------------------------ signals */

const FLIGHT_SIGNAL_RE =
  /\b(flights?|airlines?|boarding|itinerary|e-?ticket|departures?|departs?|arrivals?|arrives?|terminal|gate)\b|항공|탑승|출발|도착|便名|搭乗|出発|到着|航班|登机|机票|起飞|到达/i;
const BOOKING_SIGNAL_RE =
  /\b(booking (?:reference|ref\.?|code|number|id)|confirmation (?:code|number|#)|record locator|reservation (?:code|number)|PNR|e-?ticket(?: number| receipt)?|ticket number|boarding pass|check-?in (?:is )?(?:now )?open|online check-?in|itinerary receipt)\b|예약\s*번호|항공권|탑승권|予約番号|搭乗券|確認番号|eチケット|订单号|电子客票|登机牌|行程单/i;
const MARKETING_RE =
  /\b(sale|deals?|offers?|promo(?:tion)?s?|discounts?|% off|save up to|fares? from|newsletter|sweepstakes?|limited time|book now|special fares?|lowest fares?|win a)\b|특가|할인|이벤트|세일|セール|キャンペーン|特价|优惠/i;
const CANCEL_RE = /\bcancel+(?:ed|ation)\b|취소|キャンセル|取消/i;

/** Common words / units that look like IATA codes in upper-case text. */
const STOPWORDS = new Set(
  ('THE AND FOR YOU ARE ALL NOT BUT CAN HAS HAD WAS ONE OUR OUT GET NEW NOW SEE WAY WHO DAY USE HOW ITS SAY TOO ANY MAY OFF SET ' +
    'TAX FEE VAT USD EUR KRW JPY GBP CNY AUD CAD SGD HKD THB PHP VND IDR MYR INR TWD CHF NZD RUB AED PNR ETA ETD UTC GMT KST JST ' +
    'PST PDT EST EDT CST CDT MST CET CEST BST IST MON TUE WED THU FRI SAT SUN JAN FEB MAR APR JUN JUL AUG SEP OCT NOV DEC FAQ APP ' +
    'WEB VIP ADT CHD INF REF PDF URL TEL FAX ATM ECO BIZ FLT DEP ARR ARV BAG KGS LBS MIN MAX TOT SUM NET QTY COM ORG WWW MRS MSS ' +
    'ETC INC LTD LLC EMD TKT OPS RES REQ PRE SVC STD STA ATD ATA PAX CTC SSR OSI TBA TBD YES AIR SEA BUS CAR VIA PER NON TOP END ' +
    'BIG HOT RED BOX FAN KEY LOW HIGH MID OLD SUB FUN PRO AGE OWN ADD ACT AID AIM ART ASK BAD BED BOY CUT DOG EAR EAT EYE FAR FEW ' +
    'GOT GUY HIT HOT JOB LAW LAY LET LIE LOT MAN MEN MET MIX NOR ODD OIL PAY PUT RAN ROW RUN SAW SIT SIX TEN TRY TWO WAR WIN WON ' +
    'YET ZIP QTR ACC MSG PTS NBR NUM DOB SEX MRZ VAL').split(' '),
);

/** Multi-airport city codes some agencies print instead of an airport. */
const CITY_CODES = {
  TYO: 'HND', SEL: 'ICN', OSA: 'KIX', SPK: 'CTS', LON: 'LHR', PAR: 'CDG', NYC: 'JFK', CHI: 'ORD', WAS: 'IAD', MIL: 'MXP',
  ROM: 'FCO', STO: 'ARN', MOW: 'SVO', BJS: 'PEK', JKT: 'CGK', YTO: 'YYZ', YMQ: 'YUL', RIO: 'GIG', SAO: 'GRU', BUE: 'EZE',
  DTT: 'DTW', BUH: 'OTP', REK: 'KEF', OSL: 'OSL', QLA: 'LAX',
};

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

/* ------------------------------------------------------------------ helpers */

const str = (v) => (v === null || v === undefined ? '' : Array.isArray(v) ? str(v[0]) : typeof v === 'object' ? str(v.name ?? v['@value'] ?? '') : String(v).trim());
const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const typeName = (t) => toArray(t).map((x) => String(x).split(/[/#]/).pop());

function makeResolver(airports) {
  return (code) => {
    if (!code) return null;
    const c = String(code).trim().toUpperCase();
    return airports.get(c) || (CITY_CODES[c] ? airports.get(CITY_CODES[c]) : null);
  };
}

function validDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Year for a day/month printed without one: the occurrence nearest after the email was sent. */
function inferYear(m, d, emailDay) {
  const y = Number(emailDay.slice(0, 4));
  let best = null;
  for (const year of [y - 1, y, y + 1]) {
    const day = validDate(year, m, d);
    if (!day) continue;
    const diff = dayDiff(emailDay, day);
    if (diff >= -45 && diff <= 330 && (best === null || Math.abs(diff) < Math.abs(best.diff))) best = { day, diff };
  }
  return best?.day || validDate(y, m, d);
}

/* --------------------------------------------------------------- HTML → text */

const BLOCK_TAGS = 'p,div,tr,li,h1,h2,h3,h4,h5,h6,table,tbody,section,article,header,footer,ul,ol,dl,dt,dd,blockquote,center';

export function htmlToText(html) {
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,head,noscript,template').forEach((n) => n.remove());
    doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    doc.querySelectorAll(BLOCK_TAGS).forEach((el) => el.append('\n'));
    doc.querySelectorAll('td,th').forEach((el) => el.append(' \n'));
    return normalizeText(doc.body?.textContent || '');
  }
  return normalizeText(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h\d|table|td|th)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))),
  );
}

function normalizeText(text) {
  return text
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/* ---------------------------------------------------- schema.org structured */

function collectJsonLd(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n) => collectJsonLd(n, out));
  if (node['@graph']) collectJsonLd(node['@graph'], out);
  if (typeName(node['@type']).includes('FlightReservation')) out.push(node);
  else if (typeName(node['@type']).some((t) => /Reservation$|ReservationPackage/.test(t))) {
    collectJsonLd(node.subReservation, out);
  }
}

function parseMicrodata(html) {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const readItem = (scope) => {
    const item = { '@type': scope.getAttribute('itemtype') || '' };
    const walk = (el) => {
      for (const child of el.children) {
        const prop = child.getAttribute('itemprop');
        if (prop) {
          const value = child.hasAttribute('itemscope') ? readItem(child) : propValue(child);
          for (const p of prop.split(/\s+/)) {
            if (item[p] === undefined) item[p] = value;
            else item[p] = [...toArray(item[p]), value];
          }
        }
        if (!child.hasAttribute('itemscope')) walk(child);
      }
    };
    walk(scope);
    return item;
  };
  const propValue = (el) => {
    if (el.hasAttribute('content')) return el.getAttribute('content');
    if (el.tagName === 'TIME' && el.hasAttribute('datetime')) return el.getAttribute('datetime');
    if (el.tagName === 'A' || el.tagName === 'LINK') return el.getAttribute('href');
    return el.textContent.trim();
  };
  return [...doc.querySelectorAll('[itemscope][itemtype]')]
    .filter((el) => !el.hasAttribute('itemprop') && /FlightReservation/i.test(el.getAttribute('itemtype')))
    .map(readItem);
}

function iataOf(airport) {
  if (!airport) return '';
  if (typeof airport === 'string') {
    const m = /\b([A-Z]{3})\b/.exec(airport);
    return m ? m[1] : '';
  }
  const code = str(airport.iataCode);
  if (/^[A-Za-z]{3}$/.test(code)) return code.toUpperCase();
  return iataOf(str(airport.name));
}

export function extractStructured(html, resolve) {
  const reservations = [];
  for (const m of (html || '').matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = m[1].replace(/^\s*<!--/, '').replace(/-->\s*$/, '').trim();
    try {
      collectJsonLd(JSON.parse(body), reservations);
    } catch {
      /* malformed JSON-LD is common in marketing mail; ignore */
    }
  }
  if (/itemtype\s*=\s*["']?https?:\/\/schema\.org\/FlightReservation/i.test(html || '')) reservations.push(...parseMicrodata(html));

  const flights = [];
  for (const r of reservations) {
    const cancelled = /cancel/i.test(str(r.reservationStatus));
    for (const f of toArray(r.reservationFor)) {
      if (!f || typeof f !== 'object') continue;
      const from = resolve(iataOf(f.departureAirport));
      const to = resolve(iataOf(f.arrivalAirport));
      const dep = splitIsoLocal(str(f.departureTime));
      if (!from || !to || from.iata === to.iata || !dep) continue;
      const arr = splitIsoLocal(str(f.arrivalTime));
      const airlineCode = str(f.airline?.iataCode || f.provider?.iataCode).toUpperCase();
      let flightNo = str(f.flightNumber).replace(/\s+/g, '');
      if (/^\d+$/.test(flightNo) && airlineCode) flightNo = airlineCode + flightNo;
      const airlineName = str(f.airline?.name || f.provider?.name);
      flights.push({
        from: airportSnapshot(from),
        to: airportSnapshot(to),
        date: dep.day,
        dep: dep.time,
        arr: arr?.time || null,
        arrDayOffset: arr ? dayDiff(dep.day, arr.day) : 0,
        depAt: dep.hasOffset ? new Date(str(f.departureTime)).toISOString() : null,
        arrAt: arr?.hasOffset ? new Date(str(f.arrivalTime)).toISOString() : null,
        airline: airlineCode ? { code: airlineCode, name: airlineName || airlineByCode(airlineCode)?.name || airlineCode } : airlineName ? { code: '', name: airlineName } : null,
        flightNo: flightNo ? normalizeFlightNo(flightNo) : '',
        pnr: str(r.reservationNumber || r.reservationId),
        seat: str(r.airplaneSeat || r.reservedTicket?.ticketedSeat?.seatNumber),
        cabin: str(r.airplaneSeatClass),
        cancelled,
        structured: true,
        confidence: 0.97,
      });
    }
  }
  return flights;
}

/* --------------------------------------------------------------- heuristics */

function findDates(text, emailDay) {
  const out = [];
  const push = (index, day, explicitYear) => day && out.push({ index, day, explicitYear });
  for (const m of text.matchAll(/\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\b/g)) push(m.index, validDate(+m[1], +m[2], +m[3]), true);
  for (const m of text.matchAll(/(20\d{2})\s*[년年]\s*(\d{1,2})\s*[월月]\s*(\d{1,2})\s*[일日]/g)) push(m.index, validDate(+m[1], +m[2], +m[3]), true);
  for (const m of text.matchAll(/(?<![\d년年]\s{0,2})(\d{1,2})\s*[월月]\s*(\d{1,2})\s*[일日]/g)) push(m.index, inferYear(+m[1], +m[2], emailDay), false);
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s.-]*${MON}\\.?,?[\\s.-]*((?:19|20)?\\d{2}(?![:\\d]))?`, 'gi'))) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) continue;
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    push(m.index, year ? validDate(year, month, +m[1]) : inferYear(month, +m[1], emailDay), !!year);
  }
  for (const m of text.matchAll(new RegExp(`\\b${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+((?:19|20)\\d{2}))?`, 'gi'))) {
    const month = MONTHS[m[1].toLowerCase()];
    if (!month) continue;
    push(m.index, m[3] ? validDate(+m[3], month, +m[2]) : inferYear(month, +m[2], emailDay), !!m[3]);
  }
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g)) {
    const a = +m[1];
    const b = +m[2];
    if (a > 12) push(m.index, validDate(+m[3], b, a), true);
    else if (b > 12) push(m.index, validDate(+m[3], a, b), true);
  }
  return out.sort((x, y) => x.index - y.index);
}

function findTimes(text) {
  const out = [];
  for (const m of text.matchAll(/(오전|오후|午前|午後)?\s*\b([01]?\d|2[0-3])[:：]([0-5]\d)(?:[:：][0-5]\d)?\b\s*(a\.?m\.?|p\.?m\.?)?/gi)) {
    let h = Number(m[2]);
    const marker = (m[4] || m[1] || '').toLowerCase();
    if ((marker.startsWith('p') || marker === '오후' || marker === '午後') && h < 12) h += 12;
    if ((marker.startsWith('a') || marker === '오전' || marker === '午前') && h === 12) h = 0;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
    out.push({ index: m.index, time: `${String(h).padStart(2, '0')}:${m[3]}`, nextDay: /^\s*\(?\+\s?1\b|^\s*\(?next day/i.test(after) });
  }
  return out;
}

const AIRLINE_NAME_RE = new RegExp(
  `(${AIRLINES.flatMap((a) => [a.name, ...a.aliases])
    .filter((n) => n.length >= 3)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})\\s*(?:flight\\s*)?(?:no\\.?\\s*)?#?\\s*(\\d{1,4})\\b`,
  'g',
);
const NAME_TO_CODE = new Map(AIRLINES.flatMap((a) => [a.name, ...a.aliases].map((n) => [n, a.code])));

/** Airline codes that are also common words; they need "Flight" nearby or no space ("AS123"). */
const AMBIGUOUS_CODES = new Set(['AS', 'AT', 'BY', 'DE', 'ID', 'IT', 'ME', 'MS', 'SA', 'LA', 'AD', 'AR', 'CA', 'AM', 'UK', 'SU', 'TR', 'PC', 'FI']);
const FLIGHT_WORD_RE = /(?:flight|flt|flight no\.?|편명|항공편|便名|便|航班)\s*[:#：]?\s*$/i;

function findFlightNumbers(text) {
  const out = [];
  for (const m of text.matchAll(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])(\s?-?\s?)(\d{1,4})\b(?!\s*(?:kg|KG|km|%|원|円|:\d))/g)) {
    const airline = airlineByCode(m[1]);
    if (!airline) continue;
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    if ((m[1] === 'AM' || m[1] === 'PM') && /\d\s*$/.test(before)) continue;
    if (m[1] === 'A3' && !m[2] && m[3].length === 2) continue; // Airbus A320/A330/A350…
    if (AMBIGUOUS_CODES.has(m[1]) && m[2] && !FLIGHT_WORD_RE.test(before)) continue;
    out.push({ index: m.index, flightNo: `${m[1]}${Number(m[3])}`, airline });
  }
  for (const m of text.matchAll(AIRLINE_NAME_RE)) {
    const airline = airlineByCode(NAME_TO_CODE.get(m[1]));
    if (airline) out.push({ index: m.index, flightNo: `${airline.code}${Number(m[2])}`, airline });
  }
  return out.sort((a, b) => a.index - b.index);
}

function findAirportTokens(text, resolve) {
  const tokens = [];
  const add = (code, index, strength) => {
    const airport = resolve(code);
    if (!airport || (strength < 2 && STOPWORDS.has(code)) || tokens.some((t) => t.index === index)) return;
    tokens.push({ code: airport.iata, index, airport, strength });
  };
  for (const m of text.matchAll(/[([（【]\s*([A-Z]{3})\s*[)\]）】]/g)) add(m[1], m.index + m[0].indexOf(m[1]), 2);
  for (const m of text.matchAll(/(?:\b(?:from|to|depart(?:ure|s|ing)?|arriv(?:al|es|ing)?|origin|destination)\b|출발|도착|出発|到着|出发|到达)\s*[:：]?\s*([A-Za-z]{3})\b/gi)) {
    if (m[1] === m[1].toUpperCase()) add(m[1], m.index + m[0].length - 3, 1);
  }
  for (const m of text.matchAll(/^[ \t]*([A-Z]{3})[ \t]*$/gm)) add(m[1], m.index + m[0].indexOf(m[1]), 1);
  return tokens.sort((a, b) => a.index - b.index);
}

const STRONG_SEP = '(?:→|->|=>|⇒|➔|➝|➞|➜|⟶|✈️?|►|▶|›|»|>)';
const WEAK_SEP = '(?:–|—|-|~|〜|～|/|\\bto\\b|\\bTO\\b)';
const ROUTE_RE = new RegExp(`\\b([A-Z]{3})\\b[ \\t]*(${STRONG_SEP}|${WEAK_SEP})[ \\t]*(?=\\b([A-Z]{3})\\b)`, 'g');

function findRouteLegs(text, resolve) {
  const legs = [];
  for (const m of text.matchAll(ROUTE_RE)) {
    const strong = new RegExp(`^${STRONG_SEP}$`).test(m[2]);
    const from = resolve(m[1]);
    const to = resolve(m[3]);
    if (!from || !to || from.iata === to.iata) continue;
    if (!strong && (STOPWORDS.has(m[1]) || STOPWORDS.has(m[3]))) continue;
    const toIndex = m.index + m[0].length;
    legs.push({ from: { code: from.iata, index: m.index, airport: from }, to: { code: to.iata, index: toIndex, airport: to }, strength: strong ? 2 : 1 });
  }
  return legs;
}

function pairTokens(tokens) {
  const legs = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (a.code === b.code || b.index - a.index > 700) {
      i -= 1;
      continue;
    }
    legs.push({ from: a, to: b, strength: Math.min(a.strength, b.strength) });
  }
  return legs;
}

function nearest(items, index, maxDistance, filter = () => true) {
  let best = null;
  for (const item of items) {
    const d = Math.abs(item.index - index);
    if (d <= maxDistance && filter(item) && (!best || d < best.d)) best = { item, d };
  }
  return best?.item || null;
}

/** Heuristic extraction for emails without schema.org markup. */
export function extractHeuristic(text, email, resolve) {
  if (!FLIGHT_SIGNAL_RE.test(text)) return [];
  const emailDay = toDay(new Date(email.date || Date.now()));

  let legs = findRouteLegs(text, resolve);
  if (!legs.length) legs = pairTokens(findAirportTokens(text, resolve));
  if (!legs.length) return [];

  // Drop a summary leg A→C when the email also lists A→B and B→C.
  legs = legs.filter((l) => !legs.some((x) => x !== l && x.from.code === l.from.code && x.to.code !== l.to.code &&
    legs.some((y) => y.from.code === x.to.code && y.to.code === l.to.code)));

  const dates = findDates(text, emailDay);
  const times = findTimes(text);
  const numbers = findFlightNumbers(text);
  const booking = BOOKING_SIGNAL_RE.test(text);
  const marketing = MARKETING_RE.test(email.subject || '') || (MARKETING_RE.test(text.slice(0, 600)) && !booking);
  const sender = airlineByDomain(email.from);
  const knownSender = !!sender || TRAVEL_AGENCY_DOMAINS.some((d) => String(email.from || '').toLowerCase().includes(d));
  const pnr = /(?:booking (?:reference|ref\.?|code|number)|confirmation (?:code|number|#)|record locator|reservation (?:code|number)|\bPNR\b|예약\s*번호|予約番号|确认号)\s*[:#：]?\s*\b([A-Z0-9]{6})\b/i.exec(text)?.[1] || '';
  const seat = /(?:\bseat\b|좌석|座席)\s*(?:no\.?|number)?\s*[:：]?\s*(\d{1,2}[A-K])\b/i.exec(text)?.[1] || '';
  const cabinMatch = /\b(premium economy|economy|business|first)(?:\s+class)?\b/i.exec(text);

  const results = [];
  legs.forEach((leg, i) => {
    const next = legs[i + 1];
    const windowEnd = next ? Math.max(next.from.index, leg.to.index + 40) : leg.to.index + 500;
    const inWindow = (item) => item.index >= leg.from.index - 250 && item.index <= windowEnd;

    const date = nearest(dates, leg.from.index, 400, inWindow);
    const depTime = nearest(times, leg.from.index, 160, inWindow);
    const arrTime = nearest(times, leg.to.index, 160, (t) => inWindow(t) && t !== depTime && (!depTime || t.index > depTime.index));
    const number = nearest(numbers, leg.from.index, 500, inWindow) || (legs.length === 1 ? numbers[0] : null);
    const arrDate = date ? nearest(dates, leg.to.index, 200, (d) => inWindow(d) && d.index > date.index) : null;

    let confidence = 0.35;
    if (number) confidence += 0.2;
    if (date) confidence += date.explicitYear ? 0.15 : 0.1;
    if (depTime) confidence += 0.05;
    if (booking) confidence += 0.15;
    if (knownSender) confidence += 0.1;
    if (leg.strength < 2) confidence -= 0.1;
    if (marketing) confidence -= booking ? 0.15 : 0.35;
    if (confidence < 0.45) return;

    const airline = number?.airline || sender;
    let arrDayOffset = 0;
    if (arrDate && date) arrDayOffset = Math.max(0, Math.min(2, dayDiff(date.day, arrDate.day)));
    else if (arrTime?.nextDay) arrDayOffset = 1;

    results.push({
      from: airportSnapshot(leg.from.airport),
      to: airportSnapshot(leg.to.airport),
      date: date?.day || emailDay,
      dateEstimated: !date,
      dep: depTime?.time || null,
      arr: arrTime?.time || null,
      arrDayOffset,
      airline: airline ? { code: airline.code, name: airline.name } : null,
      flightNo: number?.flightNo || '',
      pnr,
      seat,
      cabin: cabinMatch ? cabinMatch[1].replace(/\b\w/g, (c) => c.toUpperCase()) : '',
      structured: false,
      confidence: Math.min(0.9, Math.round(confidence * 100) / 100),
    });
  });

  const seen = new Set();
  return results.filter((r) => {
    const key = `${r.from.iata}|${r.to.iata}|${r.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ---------------------------------------------------------------- public API */

/**
 * Extracts flight candidates from one decoded email.
 * email: { id, threadId, subject, from, date (ms), html, text }
 * airports: index with get(iata)
 */
export function parseEmail(email, airports) {
  const resolve = makeResolver(airports);
  const cancelledBySubject = CANCEL_RE.test(email.subject || '');
  const sourceRef = { messageId: email.id, threadId: email.threadId, subject: (email.subject || '').slice(0, 160), from: (email.from || '').slice(0, 120) };

  let flights = extractStructured(email.html, resolve);
  let kind = 'structured';
  if (!flights.length) {
    const text = `${email.subject || ''}\n${email.text || htmlToText(email.html)}`;
    flights = extractHeuristic(text, email, resolve);
    kind = flights.length ? 'heuristic' : null;
  }
  return {
    kind,
    flights: flights.map((f) => ({
      ...f,
      cancelled: f.cancelled || cancelledBySubject,
      source: 'gmail',
      sourceRef,
      emailDate: email.date || 0,
    })),
  };
}

export const __test = { findDates, findTimes, findFlightNumbers, findAirportTokens, findRouteLegs, inferYear, addDays };
