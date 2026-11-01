export const EARTH_RADIUS_KM = 6371.0088;
export const EARTH_CIRCUMFERENCE_KM = 40075;
export const MOON_DISTANCE_KM = 384400;

const RAD = Math.PI / 180;

export function distanceKm(a, b) {
  if (!a || !b) return 0;
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point at fraction t along the great circle from a to b. */
export function interpolateGreatCircle(a, b, t) {
  const φ1 = a.lat * RAD;
  const λ1 = a.lng * RAD;
  const φ2 = b.lat * RAD;
  const λ2 = b.lng * RAD;
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return { lat: a.lat, lng: a.lng };
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD, lng: Math.atan2(y, x) / RAD };
}

export function midpoint(a, b) {
  return interpolateGreatCircle(a, b, 0.5);
}

/** Typical block time: ~820 km/h cruise plus ~35 min for taxi, climb and approach. */
export function estimateDurationMin(km) {
  if (!km) return 0;
  return Math.round((km / 820) * 60 + 35);
}

export function isPlausibleDuration(km, minutes) {
  if (!minutes || minutes <= 0) return false;
  const fastest = (km / 1000) * 60; // no airliner averages more than ~1000 km/h gate-to-gate
  const slowest = (km / 250) * 60 + 180;
  return minutes >= fastest && minutes <= slowest;
}

export const CONTINENTS = {
  AF: { name: 'Africa', emoji: '🌍' },
  AN: { name: 'Antarctica', emoji: '🧊' },
  AS: { name: 'Asia', emoji: '🌏' },
  EU: { name: 'Europe', emoji: '🌍' },
  NA: { name: 'North America', emoji: '🌎' },
  OC: { name: 'Oceania', emoji: '🌏' },
  SA: { name: 'South America', emoji: '🌎' },
};

/** Approximate camera altitude so that a route of the given length fits on screen. */
export function altitudeForDistance(km) {
  return Math.min(3.2, Math.max(0.9, 0.7 + km / 5200));
}

/** Parses "37.56°, 126.97°", "geo:37.56,126.97" or "37.56,126.97" into {lat,lng}. */
export function parseLatLngString(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/^geo:/i, '').replace(/°/g, '');
  const [latStr, lngStr] = cleaned.split(',');
  const lat = Number.parseFloat(latStr);
  const lng = Number.parseFloat(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Legacy Takeout E7 integers; negative values sometimes arrive wrapped as unsigned 32-bit. */
export function fromE7(value, limitDeg) {
  if (value === null || value === undefined || value === '') return null;
  let n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > limitDeg * 1e7) n -= 2 ** 32;
  const deg = n / 1e7;
  return Math.abs(deg) <= limitDeg ? deg : null;
}
