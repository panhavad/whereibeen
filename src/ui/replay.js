import { arcScreenPoint, endReplayArcs, focusFlight, getGlobe, isInteractive, setAutoRotate, setGlobeOffset, setInteractive, setReplayArcs } from './globe.js';
import { countryName, escapeHtml, flagEmoji, formatDay, formatDistance, formatNumber } from '../core/util.js';
import { icons, planeSolid } from './icons.js';
import { gsap, lockScroll, REDUCED } from './motion.js';
import { celebrate } from './effects.js';

let active = null;

export function isReplaying() {
  return !!active;
}

/** Ends a running replay without callbacks (used when the dashboard is torn down). */
export function stopReplay() {
  active?.teardown?.();
}

/**
 * Plays flights in chronological order. Each leg: camera glides to the route, the arc is
 * drawn origin→destination while a plane rides its tip, then totals and unlocks update.
 */
export function startReplay(flights, { units = 'km', onExit, onShare } = {}) {
  if (active || !flights.length || !getGlobe()) return;
  const hero = document.querySelector('.dash-hero');
  const wasInteractive = isInteractive();
  document.body.classList.add('replaying');
  lockScroll(true);
  setGlobeOffset(0, 0);
  setAutoRotate(false);
  setInteractive(false);

  const hud = document.createElement('div');
  hud.className = 'replay-hud';
  hud.innerHTML = `
    <div class="replay-top glass">
      <div><span class="eyebrow"><span class="eyebrow-badge">Replay</span> Your journey</span></div>
      <div style="display:flex;align-items:center;gap:10px"><span class="replay-count" data-count></span>
        <button class="btn btn-ghost btn-icon btn-sm" data-exit aria-label="Exit replay">${icons.close}</button></div>
      <div class="replay-progress">${flights.length <= 80 ? flights.map(() => '<i></i>').join('') : '<i data-single></i>'}</div>
    </div>
    <div class="replay-plane" data-plane>${planeSolid}</div>
    <div class="replay-unlock glass" data-unlock></div>
    <div class="replay-card glass">
      <div class="muted" data-date></div>
      <div class="replay-route"><span data-from></span>${icons.arrowRight}<span data-to></span></div>
      <div class="replay-cities" data-cities></div>
      <div class="replay-totals">
        <div><strong data-km>0</strong><span>${units === 'mi' ? 'miles' : 'km'} flown</span></div>
        <div><strong data-countries>0</strong><span>countries</span></div>
        <div><strong data-flights>0</strong><span>flights</span></div>
      </div>
    </div>
    <div class="replay-controls glass">
      <button class="btn btn-ghost btn-icon" data-prev aria-label="Previous flight">${icons.prev}</button>
      <button class="btn btn-primary btn-icon" data-toggle aria-label="Pause">${icons.pause}</button>
      <button class="btn btn-ghost btn-icon" data-next aria-label="Next flight">${icons.next}</button>
      <button class="btn btn-ghost btn-sm" data-speed>1×</button>
    </div>`;
  hero.appendChild(hud);
  const $ = (s) => hud.querySelector(s);
  const plane = $('[data-plane]');
  const segs = [...hud.querySelectorAll('.replay-progress i')];

  const kmFactor = units === 'mi' ? 1 / 1.609344 : 1;
  const cumulative = [];
  {
    let km = 0;
    const seen = new Set();
    flights.forEach((f) => {
      km += f.distanceKm || 0;
      seen.add(f.from.cc).add(f.to.cc);
      cumulative.push({ km, countries: seen.size });
    });
  }

  const state = { i: 0, playing: true, speed: 1, run: 0, raf: 0, shown: { km: 0 } };
  active = state;

  const sleep = (ms, run) => new Promise((resolve) => setTimeout(() => resolve(run === state.run), ms / state.speed));

  const setTotals = (i, animateMs = 0) => {
    const target = i < 0 ? { km: 0, countries: 0 } : cumulative[i];
    gsap.to(state.shown, {
      km: target.km * kmFactor,
      duration: REDUCED ? 0 : animateMs / 1000 / state.speed,
      ease: 'power1.inOut',
      overwrite: true,
      onUpdate: () => ($('[data-km]').textContent = formatNumber(Math.round(state.shown.km))),
    });
    $('[data-countries]').textContent = formatNumber(target.countries);
    $('[data-flights]').textContent = formatNumber(i + 1);
  };

  const setProgress = (i, p = 1) => {
    if (segs.length === 1 && segs[0].dataset.single !== undefined) {
      segs[0].style.setProperty('--p', String((i + p) / flights.length));
      return;
    }
    segs.forEach((s, k) => s.style.setProperty('--p', k < i ? '1' : k === i ? String(p) : '0'));
  };

  const showCard = (f, i) => {
    $('[data-count]').textContent = `${i + 1} / ${flights.length}`;
    $('[data-date]').textContent = `${formatDay(f.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${f.airline?.name ? ` · ${f.airline.name} ${f.flightNo || ''}` : ''}`;
    $('[data-cities]').textContent = `${f.from.city} → ${f.to.city} · ${formatDistance(f.distanceKm, units)}`;
    for (const [sel, text] of [['[data-from]', f.from.iata], ['[data-to]', f.to.iata]]) {
      const el = $(sel);
      if (REDUCED) el.textContent = text;
      else gsap.to(el, { duration: 0.8, scrambleText: { text, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', speed: 0.9 } });
    }
  };

  const unlock = async (cc) => {
    const box = $('[data-unlock]');
    box.innerHTML = `<small>New country unlocked</small><span class="flag">${flagEmoji(cc)}</span><strong>${escapeHtml(countryName(cc))}</strong>`;
    if (REDUCED) return;
    gsap.killTweensOf(box);
    gsap.timeline()
      .fromTo(box, { opacity: 0, y: 20, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(2)' })
      .to(box, { opacity: 0, y: -20, duration: 0.5, delay: 1.3 / state.speed });
  };

  const flyPlane = (f, drawMs, run) =>
    new Promise((resolve) => {
      const start = performance.now();
      cancelAnimationFrame(state.raf);
      const step = (now) => {
        if (run !== state.run) return resolve(false);
        const t = Math.min(1, (now - start) / drawMs);
        const p = REDUCED ? null : arcScreenPoint(f, t);
        if (p) {
          plane.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.angle}rad)`;
          plane.style.opacity = p.visible && t < 1 ? '1' : '0';
        }
        setProgress(state.i, t);
        if (t < 1) state.raf = requestAnimationFrame(step);
        else resolve(true);
      };
      state.raf = requestAnimationFrame(step);
    });

  const seenBefore = (i) => {
    const set = new Set();
    for (let k = 0; k < i; k++) set.add(flights[k].from.cc).add(flights[k].to.cc);
    return set;
  };

  async function playLeg(i, run) {
    const f = flights[i];
    state.i = i;
    showCard(f, i);
    setReplayArcs(flights.slice(0, i), null, 0);
    focusFlight(f, 1300 / state.speed);
    if (!(await sleep(1250, run))) return false;
    const drawMs = Math.min(5200, Math.max(1700, 1500 + (f.distanceKm || 0) * 0.32)) / state.speed;
    // Reduced motion: the arc appears at once, but each leg still gets time on screen.
    setReplayArcs(flights.slice(0, i), f, REDUCED ? 1 : drawMs);
    setTotals(i, drawMs);
    if (!(await flyPlane(f, REDUCED ? 900 / state.speed : drawMs, run))) return false;
    setReplayArcs(flights.slice(0, i + 1), null, 0);
    const before = seenBefore(i);
    const fresh = [f.from.cc, f.to.cc].filter((cc) => !before.has(cc));
    if (fresh.length && i > 0) unlock(fresh[fresh.length - 1]);
    return sleep(fresh.length && i > 0 ? 1500 : 650, run);
  }

  async function run(from) {
    const myRun = ++state.run;
    for (let i = from; i < flights.length; i++) {
      if (!(await playLeg(i, myRun))) return;
    }
    if (myRun === state.run) finale();
  }

  const setPlaying = (on) => {
    state.playing = on;
    const btn = $('[data-toggle]');
    btn.innerHTML = on ? icons.pause : icons.play;
    btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
  };

  const jump = (i) => {
    state.run++;
    cancelAnimationFrame(state.raf);
    plane.style.opacity = '0';
    const idx = Math.max(0, Math.min(flights.length - 1, i));
    if (state.playing) run(idx);
    else {
      state.i = idx;
      showCard(flights[idx], idx);
      setReplayArcs(flights.slice(0, idx + 1), null, 0);
      setTotals(idx, 300);
      setProgress(idx, 1);
      focusFlight(flights[idx], 900);
    }
  };

  function finale() {
    const total = cumulative[cumulative.length - 1];
    plane.style.opacity = '0';
    setReplayArcs(flights, null, 0);
    getGlobe().pointOfView({ altitude: 2.6 }, 2200);
    setAutoRotate(true, 0.6);
    const box = document.createElement('div');
    box.className = 'replay-summary';
    box.innerHTML = `<div class="card">
      <span class="eyebrow"><span class="eyebrow-badge">That's a wrap</span> Your journey so far</span>
      <h2 style="font-size:clamp(1.8rem,4vw,2.6rem)"><span class="grad-text">${formatNumber(flights.length)} flights</span> across ${formatNumber(total.countries)} countries</h2>
      <p class="muted">${formatDistance(total.km, units)} in the air — that's ${(total.km / 40075).toFixed(1)}× around the Earth.</p>
      <div class="hero-cta" style="justify-content:center">
        <button class="btn btn-glass" data-again>${icons.refresh} Replay again</button>
        ${onShare ? `<button class="btn btn-glass" data-share>${icons.share} Share</button>` : ''}
        <button class="btn btn-primary" data-done>Done</button>
      </div></div>`;
    hud.appendChild(box);
    if (!REDUCED) gsap.from(box.querySelector('.card'), { y: 40, opacity: 0, scale: 0.95, duration: 0.9, ease: 'expo.out' });
    celebrate({ particleCount: 160 });
    box.querySelector('[data-again]').addEventListener('click', () => {
      box.remove();
      setAutoRotate(false);
      setPlaying(true);
      run(0);
    });
    box.querySelector('[data-share]')?.addEventListener('click', () => onShare?.());
    box.querySelector('[data-done]').addEventListener('click', exit);
  }

  function teardown() {
    if (active !== state) return;
    state.run++;
    cancelAnimationFrame(state.raf);
    hud.remove();
    document.body.classList.remove('replaying');
    lockScroll(false);
    endReplayArcs();
    setInteractive(wasInteractive);
    setAutoRotate(true);
    active = null;
    document.removeEventListener('keydown', onKey);
  }

  function exit() {
    teardown();
    onExit?.();
  }
  state.teardown = teardown;

  const onKey = (e) => {
    if (e.key === 'Escape') exit();
    else if (e.key === ' ') {
      e.preventDefault();
      $('[data-toggle]').click();
    } else if (e.key === 'ArrowRight') jump(state.i + 1);
    else if (e.key === 'ArrowLeft') jump(state.i - 1);
  };
  document.addEventListener('keydown', onKey);

  $('[data-exit]').addEventListener('click', exit);
  $('[data-next]').addEventListener('click', () => jump(state.i + 1));
  $('[data-prev]').addEventListener('click', () => jump(state.i - 1));
  $('[data-speed]').addEventListener('click', (e) => {
    state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
    e.currentTarget.textContent = `${state.speed}×`;
  });
  $('[data-toggle]').addEventListener('click', () => {
    if (state.playing) {
      setPlaying(false);
      jump(state.i);
    } else {
      setPlaying(true);
      run(state.i + 1 < flights.length ? state.i + 1 : 0);
    }
  });

  if (!REDUCED) gsap.from(hud.querySelectorAll('.replay-top, .replay-card, .replay-controls'), { opacity: 0, y: 24, stagger: 0.08, duration: 0.8, ease: 'expo.out' });
  setTotals(-1);
  run(0);
}
