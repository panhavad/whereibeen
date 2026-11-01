const formatters = new Map();

function formatterFor(tz) {
  if (!formatters.has(tz)) {
    formatters.set(
      tz,
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }
  return formatters.get(tz);
}

/** Offset (local minus UTC, in minutes) of an IANA time zone at a given instant. */
export function tzOffsetMinutes(tz, instant = new Date()) {
  if (!tz) return null;
  try {
    const parts = Object.fromEntries(formatterFor(tz).formatToParts(instant).map((p) => [p.type, p.value]));
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
    return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
  } catch {
    return null;
  }
}

/** Converts a wall-clock date/time in an IANA zone into a UTC Date. */
export function zonedToUtc(day, time, tz) {
  if (!day) return null;
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  const offset = tzOffsetMinutes(tz, new Date(guess));
  if (offset === null) return null;
  let utc = guess - offset * 60000;
  const corrected = tzOffsetMinutes(tz, new Date(utc));
  if (corrected !== null && corrected !== offset) utc = guess - corrected * 60000;
  return new Date(utc);
}

/** Local calendar day (YYYY-MM-DD) of an instant in a time zone; falls back to UTC. */
export function dayInZone(instant, tz) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  if (tz) {
    try {
      const parts = Object.fromEntries(formatterFor(tz).formatToParts(date).map((p) => [p.type, p.value]));
      return `${parts.year}-${parts.month}-${parts.day}`;
    } catch {
      /* fall through */
    }
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Splits an ISO timestamp into its local day and HH:MM exactly as written, which is what
 * schema.org and Timeline strings carry (e.g. "2024-03-15T10:30:00+09:00").
 */
export function splitIsoLocal(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso || '');
  if (!m) return null;
  return { day: m[1], time: m[2] ? `${m[2]}:${m[3]}` : null, hasOffset: /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) };
}

export function formatOffset(minutes) {
  if (minutes === null || minutes === undefined) return '';
  const sign = minutes >= 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}
