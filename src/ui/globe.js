import { loadCountries } from '../core/datasets.js';
import { altitudeForDistance, distanceKm, EARTH_RADIUS_KM, interpolateGreatCircle, midpoint } from '../core/geo.js';
import { isUpcoming } from '../core/flights.js';
import { escapeHtml, flagEmoji, formatDay, formatDuration, formatNumber, countryName, hashString } from '../core/util.js';
import { gsap, REDUCED, TOUCH } from './motion.js';

const ARC_ALT_SCALE = 0.38;
const PALETTE = ['#38bdf8', '#818cf8', '#a78bfa', '#c084fc', '#f472b6', '#2dd4bf'];
const VISITED_PALETTE = ['#38bdf8', '#818cf8', '#a78bfa', '#c084fc', '#f472b6', '#22d3ee'];

let globe = null;
let THREE = null;
let host = null;
let slot = null;
let countries = null;
let readyPromise = null;
let resizeObserver = null;
let visibilityObserver = null;
let interactive = true;
const arcCache = new Map();
const handlers = {};
let visited = new Set();
let units = 'km';

function hexToRgba(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function visitedColor(iso2) {
  return VISITED_PALETTE[hashString(iso2 || '') % VISITED_PALETTE.length];
}

export function onGlobe(event, fn) {
  handlers[event] = fn;
}

export function getGlobe() {
  return globe;
}

export function ensureGlobe() {
  readyPromise ??= (async () => {
    const [{ default: Globe }, three, countryData] = await Promise.all([import('globe.gl'), import('three'), loadCountries()]);
    THREE = three;
    countries = countryData;
    host = document.createElement('div');
    host.className = 'globe-canvas';
    host.style.cssText = 'position:absolute;inset:0;';
    globe = new Globe(host, {
      rendererConfig: { antialias: !TOUCH, alpha: true, powerPreference: 'high-performance' },
      animateIn: false,
    });
    configure();
    return globe;
  })();
  readyPromise.catch(() => (readyPromise = null));
  return readyPromise;
}

function configure() {
  globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, TOUCH ? 1.6 : 2));
  globe
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('#7c8cff')
    .atmosphereAltitude(0.2)
    .globeMaterial(
      new THREE.MeshPhongMaterial({
        color: new THREE.Color('#0a1030'),
        emissive: new THREE.Color('#0a0e2b'),
        emissiveIntensity: 0.6,
        shininess: 14,
        transparent: true,
        opacity: 0.97,
      }),
    )
    .hexPolygonsData(countries.features)
    .hexPolygonResolution(3)
    .hexPolygonMargin(0.45)
    .hexPolygonUseDots(true)
    .hexPolygonsTransitionDuration(REDUCED ? 0 : 900)
    .hexPolygonLabel((f) => {
      const iso = f.properties.iso2;
      const been = visited.has(iso);
      return `<div class="globe-tip"><span class="flag">${flagEmoji(iso)}</span> ${escapeHtml(countryName(iso, f.properties.name))}<br><span>${been ? '✓ Visited' : 'Not yet visited'}</span></div>`;
    })
    .arcStartLat((d) => d.from.lat)
    .arcStartLng((d) => d.from.lng)
    .arcEndLat((d) => d.to.lat)
    .arcEndLng((d) => d.to.lng)
    .arcColor((d) => d.colors)
    .arcStroke((d) => d.stroke)
    .arcAltitudeAutoScale(ARC_ALT_SCALE)
    .arcDashLength((d) => d.dash[0])
    .arcDashGap((d) => d.dash[1])
    .arcDashInitialGap((d) => d.dash[2])
    .arcDashAnimateTime((d) => d.dash[3])
    .arcsTransitionDuration(REDUCED ? 0 : 1100)
    .arcLabel((d) => d.label || '')
    .onArcClick((d) => handlers.arc?.(d.flight || d))
    .pointLat('lat')
    .pointLng('lng')
    .pointAltitude(0.012)
    .pointRadius((d) => d.r)
    .pointColor((d) => d.color)
    .pointResolution(14)
    .pointsMerge(false)
    .pointsTransitionDuration(REDUCED ? 0 : 900)
    .pointLabel((d) => d.label || '')
    .onPointClick((d) => handlers.point?.(d))
    .ringLat('lat')
    .ringLng('lng')
    .ringColor((d) => (t) => `rgba(${d.rgb},${Math.max(0, 0.9 - t)})`)
    .ringMaxRadius((d) => d.maxR)
    .ringPropagationSpeed((d) => d.speed)
    .ringRepeatPeriod((d) => d.period)
    .htmlLat('lat')
    .htmlLng('lng')
    .htmlAltitude(0.03)
    .htmlElement((d) => d.el)
    .htmlElementVisibilityModifier((el, isVisible) => {
      el.style.opacity = isVisible ? '1' : '0';
    })
    .onGlobeClick((coords) => handlers.globe?.(coords));

  const controls = globe.controls();
  controls.autoRotate = !REDUCED;
  controls.autoRotateSpeed = 0.32;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.6;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
  });
}

/** Moves the single WebGL globe into a slot element and keeps it sized to it. */
export async function mountGlobe(target, { interactive: allowInteraction = true } = {}) {
  slot = target;
  target.classList.add('is-loading');
  const g = await ensureGlobe();
  if (slot !== target || !target.isConnected) return g;
  target.appendChild(host);
  target.classList.remove('is-loading');

  const resize = () => {
    const r = target.getBoundingClientRect();
    if (r.width && r.height) g.width(r.width).height(r.height);
  };
  resizeObserver?.disconnect();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(target);
  resize();

  visibilityObserver?.disconnect();
  visibilityObserver = new IntersectionObserver(([entry]) => (entry.isIntersecting ? g.resumeAnimation() : g.pauseAnimation()), { threshold: 0 });
  visibilityObserver.observe(target);

  setInteractive(allowInteraction);
  if (!REDUCED) gsap.fromTo(host, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 1.8, ease: 'expo.out' });
  return g;
}

export function setInteractive(on) {
  interactive = on;
  if (!globe) return;
  globe.controls().enabled = on;
  host.style.pointerEvents = on ? 'auto' : 'none';
  globe.renderer().domElement.style.touchAction = on ? 'none' : 'pan-y';
}

export function isInteractive() {
  return interactive;
}

export function setUnits(u) {
  units = u;
}

function arcTooltip(f) {
  const km = units === 'mi' ? f.distanceKm / 1.609344 : f.distanceKm;
  return `<div class="globe-tip"><strong>${escapeHtml(f.from.iata)} → ${escapeHtml(f.to.iata)}</strong><br>
    <span>${escapeHtml(f.from.city)} → ${escapeHtml(f.to.city)}</span><br>
    <span>${escapeHtml(formatDay(f.date))} · ${formatNumber(Math.round(km))} ${units} · ${formatDuration(f.durationMin)}</span>
    ${f.airline?.name ? `<br><span>${escapeHtml(f.airline.name)} ${escapeHtml(f.flightNo || '')}</span>` : ''}</div>`;
}

function arcFor(f, index, mode) {
  const key = `${mode}:${f.id}:${f.updatedAt || ''}`;
  if (arcCache.has(key)) return arcCache.get(key);
  if (arcCache.size > 4000) arcCache.clear();
  const upcoming = isUpcoming(f);
  const color = PALETTE[index % PALETTE.length];
  const arc = {
    id: f.id,
    flight: f,
    from: f.from,
    to: f.to,
    colors: upcoming ? ['rgba(251,191,36,0.25)', 'rgba(251,191,36,0.95)'] : [hexToRgba(PALETTE[(index + 5) % PALETTE.length], 0.35), hexToRgba(color, 0.95)],
    stroke: upcoming ? 0.32 : mode === 'landing' ? 0.5 : 0.55,
    dash: upcoming ? [0.06, 0.035, 0, 9000] : [0.42, 0.14, Math.random(), 2400 + Math.min(4200, (f.distanceKm || 1000) / 2.5)],
    label: mode === 'landing' ? '' : arcTooltip(f),
  };
  arcCache.set(key, arc);
  return arc;
}

function makeLabel(place) {
  const el = document.createElement('div');
  el.className = 'globe-label';
  el.innerHTML = `<span class="flag">${flagEmoji(place.cc)}</span> ${escapeHtml(place.name)}`;
  return el;
}

/**
 * Draws flights (arcs), airports (points), visited cities (pulsing rings + labels)
 * and visited countries (lit dots).
 */
export function setGlobeData({ flights = [], places = [], countries: visitedCountries = [], mode = 'dashboard', labels = 6 } = {}) {
  if (!globe) return;
  visited = new Set(visitedCountries);
  const sorted = [...flights].sort((a, b) => a.date.localeCompare(b.date));
  globe.arcsData(sorted.map((f, i) => arcFor(f, i, mode)));

  const airports = new Map();
  for (const f of flights) {
    for (const a of [f.from, f.to]) {
      const entry = airports.get(a.iata) || { ...a, count: 0 };
      entry.count++;
      airports.set(a.iata, entry);
    }
  }
  globe.pointsData(
    [...airports.values()].map((a) => ({
      lat: a.lat,
      lng: a.lng,
      r: 0.14 + Math.min(0.32, Math.sqrt(a.count) * 0.07),
      color: '#e0e7ff',
      airport: a,
      label: mode === 'landing' ? '' : `<div class="globe-tip"><strong>${escapeHtml(a.iata)}</strong> <span class="flag">${flagEmoji(a.cc)}</span><br><span>${escapeHtml(a.name)}</span><br><span>${a.count} ${a.count === 1 ? 'flight' : 'flights'}</span></div>`,
    })),
  );

  const ringPlaces = places.slice(0, TOUCH ? 24 : 48);
  globe.ringsData(
    ringPlaces.map((p, i) => ({
      lat: p.lat,
      lng: p.lng,
      rgb: i % 3 === 0 ? '244,114,182' : i % 3 === 1 ? '167,139,250' : '56,189,248',
      maxR: 1.6 + Math.min(3.4, Math.log2((p.visits || 1) + 1)),
      speed: 1.2 + (i % 4) * 0.25,
      period: 1500 + (i % 6) * 280,
    })),
  );

  const labelCount = window.matchMedia('(max-width: 640px)').matches ? Math.min(3, labels) : labels;
  const labelled = [];
  for (const p of places) {
    if (labelled.length >= labelCount) break;
    if (labelled.every((q) => distanceKm(p, q) > 900)) labelled.push(p);
  }
  globe.htmlElementsData(labelled.map((p) => ({ lat: p.lat, lng: p.lng, el: makeLabel(p) })));

  globe.hexPolygonColor((f) => (visited.has(f.properties.iso2) ? visitedColor(f.properties.iso2) : 'rgba(160,175,255,0.2)'));
  globe.hexPolygonAltitude((f) => (visited.has(f.properties.iso2) ? 0.016 : 0.005));
}

export function flyTo({ lat, lng, altitude = 1.8 }, ms = 1600) {
  globe?.pointOfView({ lat, lng, altitude }, REDUCED ? 0 : ms);
}

export function focusFlight(f, ms = 1500) {
  const mid = midpoint(f.from, f.to);
  flyTo({ ...mid, altitude: altitudeForDistance(f.distanceKm || distanceKm(f.from, f.to)) }, ms);
}

export function zoomBy(factor) {
  if (!globe) return;
  const pov = globe.pointOfView();
  globe.pointOfView({ altitude: Math.min(4.2, Math.max(0.55, pov.altitude * factor)) }, REDUCED ? 0 : 650);
}

export function setAutoRotate(on, speed = 0.32) {
  if (!globe) return;
  globe.controls().autoRotate = on && !REDUCED;
  globe.controls().autoRotateSpeed = speed;
}

/** Shifts the globe horizontally (px) so side panels don't cover it. */
export function setGlobeOffset(x = 0, y = 0) {
  globe?.globeOffset([x, y]);
}

export function isAutoRotating() {
  return !!globe?.controls().autoRotate;
}

/* ------------------------------------------------------------------ replay */

const replayArcCache = new Map();

/**
 * Replay mode: completed legs stay as solid arcs and the current leg is "drawn" from
 * origin to destination over drawMs (dash trick: dash length 1, offset 1).
 */
export function setReplayArcs(done, current, drawMs) {
  if (!globe) return;
  const arcs = done.map((f, i) => {
    const key = `done:${f.id}`;
    if (!replayArcCache.has(key)) {
      replayArcCache.set(key, {
        id: key,
        flight: f,
        from: f.from,
        to: f.to,
        colors: [hexToRgba(PALETTE[(i + 5) % PALETTE.length], 0.25), hexToRgba(PALETTE[i % PALETTE.length], 0.7)],
        stroke: 0.4,
        dash: [1, 0, 0, 0],
        label: '',
      });
    }
    return replayArcCache.get(key);
  });
  if (current) {
    arcs.push({
      id: `draw:${current.id}:${performance.now()}`,
      flight: current,
      from: current.from,
      to: current.to,
      colors: ['rgba(56,189,248,0.6)', 'rgba(244,114,182,1)'],
      stroke: 1.05,
      dash: [1, 4, 1, drawMs],
      label: '',
    });
  }
  globe.arcsTransitionDuration(0);
  globe.arcsData(arcs);
}

export function endReplayArcs() {
  replayArcCache.clear();
  globe?.arcsTransitionDuration(REDUCED ? 0 : 1100);
}

/** Screen position + heading of the point at fraction t along a flight's rendered arc. */
export function arcScreenPoint(f, t) {
  if (!globe) return null;
  const angular = distanceKm(f.from, f.to) / EARTH_RADIUS_KM;
  const altitude = (angular / 2) * ARC_ALT_SCALE;
  const cp = altitude * 1.5;
  const m1 = interpolateGreatCircle(f.from, f.to, 0.25);
  const m2 = interpolateGreatCircle(f.from, f.to, 0.75);
  const pts = [
    globe.getCoords(f.from.lat, f.from.lng, 0),
    globe.getCoords(m1.lat, m1.lng, cp),
    globe.getCoords(m2.lat, m2.lng, cp),
    globe.getCoords(f.to.lat, f.to.lng, 0),
  ];
  const bez = (u) => {
    const a = (1 - u) ** 3;
    const b = 3 * (1 - u) ** 2 * u;
    const c = 3 * (1 - u) * u ** 2;
    const d = u ** 3;
    return new THREE.Vector3(
      a * pts[0].x + b * pts[1].x + c * pts[2].x + d * pts[3].x,
      a * pts[0].y + b * pts[1].y + c * pts[2].y + d * pts[3].y,
      a * pts[0].z + b * pts[1].z + c * pts[2].z + d * pts[3].z,
    );
  };
  const camera = globe.camera();
  const w = globe.width();
  const h = globe.height();
  const toScreen = (v) => {
    const p = v.clone().project(camera);
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
  };
  const p = bez(Math.min(1, Math.max(0, t)));
  const ahead = bez(Math.min(1, t + 0.01));
  const behind = bez(Math.max(0, t - 0.01));
  const s = toScreen(p);
  const s2 = toScreen(ahead);
  const s1 = toScreen(behind);

  // Hidden when the globe sphere sits between the camera and the point.
  const R = globe.getGlobeRadius();
  const cam = camera.position;
  const dir = p.clone().sub(cam);
  const len = dir.length();
  dir.normalize();
  const b = cam.dot(dir);
  const disc = b * b - (cam.lengthSq() - R * R);
  let visible = true;
  if (disc > 0) {
    const hit = -b - Math.sqrt(disc);
    visible = !(hit > 0 && hit < len - 0.5);
  }
  return { x: s.x, y: s.y, angle: Math.atan2(s2.y - s1.y, s2.x - s1.x), visible };
}
