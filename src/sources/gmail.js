import { parseEmail } from './flightParser.js';
import { consolidateCandidates } from '../core/merge.js';
import { loadAirports } from '../core/datasets.js';
import { AIRLINES, TRAVEL_AGENCY_DOMAINS } from '../data/airlines.js';
import { pool, sleep } from '../core/util.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

const SUBJECT_TERMS = [
  'flight', 'flights', 'itinerary', '"e-ticket"', 'eticket', '"boarding pass"', '"booking confirmation"', '"trip confirmation"',
  '"travel confirmation"', '"your trip"', '"your booking"', '"check-in"', '"flight reservation"', 'airline',
  '항공권', '탑승권', '여정', '항공', '航空券', '搭乗', '予約確認', '机票', '航班', '行程单',
];

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Several focused searches are unioned; highest-yield sources go first. */
export function buildQueries({ since = '', includePromotions = false } = {}) {
  const suffix = [since ? `after:${since.replaceAll('-', '/')}` : '', includePromotions ? '' : '-category:promotions'].filter(Boolean).join(' ');
  const domains = [...new Set([...AIRLINES.flatMap((a) => a.domains), ...TRAVEL_AGENCY_DOMAINS])];
  return [
    { label: 'Travel reservations', q: `category:reservations ${suffix}`.trim() },
    ...chunk(domains, 30).map((group, i, all) => ({
      label: `Airlines & travel agencies (${i + 1}/${all.length})`,
      q: `from:(${group.join(' OR ')}) ${suffix}`.trim(),
    })),
    { label: 'Flight & booking subjects', q: `subject:(${SUBJECT_TERMS.join(' OR ')}) ${suffix}`.trim() },
  ];
}

function decodeBase64Url(data, charset = 'utf-8') {
  const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder(charset.trim().toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

export function decodeMessage(msg) {
  const headers = {};
  for (const h of msg.payload?.headers || []) headers[h.name.toLowerCase()] = h.value;
  let html = '';
  let text = '';
  const walk = (part) => {
    if (!part) return;
    (part.parts || []).forEach(walk);
    if (!part.body?.data || part.filename) return;
    const contentType = (part.headers || []).find((h) => h.name.toLowerCase() === 'content-type')?.value || '';
    const charset = /charset="?([^";\s]+)"?/i.exec(contentType)?.[1] || 'utf-8';
    const mime = (part.mimeType || '').toLowerCase();
    if (mime === 'text/html') html += decodeBase64Url(part.body.data, charset);
    else if (mime === 'text/plain') text += decodeBase64Url(part.body.data, charset);
  };
  walk(msg.payload);
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: headers.subject || '',
    from: headers.from || '',
    date: Number(msg.internalDate) || Date.parse(headers.date || '') || 0,
    html,
    text: text.length > 300 || !html ? text : '',
  };
}

export class GmailError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GmailError';
    this.status = status;
  }
}

function createClient(getToken, signal) {
  let token = null;
  return async function api(path, params = {}) {
    token ??= await getToken();
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
      if (res.ok) return res.json();
      if (res.status === 401 && attempt === 0) {
        token = await getToken(true);
        continue;
      }
      if (res.status === 429 || res.status >= 500 || (res.status === 403 && /rate|quota/i.test(await res.clone().text()))) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0;
        await sleep(Math.max(retryAfter * 1000, 2 ** attempt * 600 + Math.random() * 400));
        continue;
      }
      let message = `Gmail request failed (${res.status})`;
      try {
        message = (await res.json()).error?.message || message;
      } catch {
        /* keep generic message */
      }
      throw new GmailError(message, res.status);
    }
    throw new GmailError('Gmail is rate-limiting requests. Please try again in a minute.', 429);
  };
}

/**
 * Searches the mailbox for travel emails and extracts flights from them.
 * Everything runs in the browser: message bodies are parsed in memory and discarded.
 */
export async function scanGmail({ getToken, since, includePromotions, maxMessages = 1500, signal, onProgress = () => {}, onFlights = () => {} }) {
  const airports = await loadAirports();
  const api = createClient(getToken, signal);
  const queries = buildQueries({ since, includePromotions });

  const ids = new Map();
  for (const [i, query] of queries.entries()) {
    onProgress({ phase: 'search', label: query.label, step: i + 1, steps: queries.length, matched: ids.size });
    let pageToken;
    do {
      const res = await api('/messages', { q: query.q, maxResults: 500, pageToken });
      for (const m of res.messages || []) if (!ids.has(m.id)) ids.set(m.id, m);
      pageToken = res.nextPageToken;
    } while (pageToken && ids.size < maxMessages);
    if (ids.size >= maxMessages) break;
  }

  const list = [...ids.keys()].slice(0, maxMessages);
  const candidates = [];
  let done = 0;
  let matchedEmails = 0;
  let errors = 0;
  onProgress({ phase: 'read', done, total: list.length, matchedEmails, candidates: 0 });

  await pool(
    list,
    8,
    async (id) => {
      try {
        const email = decodeMessage(await api(`/messages/${id}`, { format: 'full' }));
        const { flights } = parseEmail(email, airports);
        if (flights.length) {
          matchedEmails++;
          candidates.push(...flights);
          onFlights(flights.filter((f) => !f.cancelled), email);
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        errors++;
      }
      done++;
      onProgress({ phase: 'read', done, total: list.length, matchedEmails, candidates: candidates.length });
    },
    signal,
  );

  onProgress({ phase: 'merge' });
  const flights = consolidateCandidates(candidates);
  return { flights, scanned: list.length, matchedEmails, errors };
}
