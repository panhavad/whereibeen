import { brandMark, icons } from '../icons.js';
import { footerHtml, bindChrome, bindUserMenu, userButtonHtml } from './shared.js';
import { setYear, store, subscribe } from '../../core/store.js';
import { computeStats } from '../../core/stats.js';
import { isUpcoming, sortFlights } from '../../core/flights.js';
import { loadCountries } from '../../core/datasets.js';
import { CONTINENTS } from '../../core/geo.js';
import { countryName, escapeHtml, flagEmoji, formatDay, formatDistance, formatDuration, formatNumber, normalizeSearch } from '../../core/util.js';
import { VERSION_SHORT } from '../../core/version.js';
import { cityCardHtml, emptyHtml, passHtml, stampHtml } from '../components.js';
import { flyTo, focusFlight, isAutoRotating, isInteractive, mountGlobe, onGlobe, setAutoRotate, setGlobeData, setGlobeOffset, setInteractive, setUnits, zoomBy } from '../globe.js';
import { enhance, gsap, REDUCED, retarget, scramble, scrollToTarget, ScrollTrigger, TOUCH } from '../motion.js';
import { openFlightDetails, openPlaceDetails } from '../details.js';
import { isReplaying, startReplay, stopReplay } from '../replay.js';
import { openShareCard } from '../share.js';
import { toast } from '../toast.js';

const PAGE = 24;

export function renderDashboard(root, app) {
  const p = app.profile();
  const first = escapeHtml(p?.givenName || (p?.name || '').split(' ')[0] || 'Your');
  const badge = p?.mode === 'demo' ? 'Demo' : p?.mode === 'local' ? 'Local' : 'Live';

  root.innerHTML = `
  <header class="nav" data-nav>
    <a class="brand" href="#/globe" aria-label="WhereIBeen">${brandMark('nav')}<span class="brand-name">Where<b>I</b>Been</span></a>
    <nav class="nav-links" aria-label="Sections">
      <span class="nav-pill" data-pill></span>
      <button data-sec="globe" class="is-active">Globe</button>
      <button data-sec="stats">Stats</button>
      <button data-sec="flights">Flights</button>
      <button data-sec="places">Places</button>
      <button data-sec="passport">Passport</button>
    </nav>
    <div class="nav-actions">
      <button class="version-pill hide-mobile" data-act="about" title="About this version">${VERSION_SHORT}</button>
      <span class="chip chip-warn offline-pill">Offline</span>
      <button class="btn btn-glass btn-sm hide-mobile" data-act="sources">${icons.layers} Sources</button>
      <button class="btn btn-primary btn-sm hide-mobile" data-act="add">${icons.plus} Add</button>
      ${userButtonHtml(p)}
    </div>
  </header>
  <main class="dash">
    <section id="globe" class="dash-hero">
      <div class="globe-slot" data-globe-slot></div>
      <div class="hero-panel glass" data-hero-panel>
        <div class="hp-title">
          <span class="eyebrow"><span class="eyebrow-badge">${badge}</span> <span data-year-label>All time</span></span>
          <h1>${first}'s <span class="grad-text">world</span></h1>
        </div>
        <div class="hp-stats">
          <div class="hp-stat"><strong data-hp="flights">0</strong><span>Flights</span></div>
          <div class="hp-stat"><strong data-hp="distance">0</strong><span data-hp-unit>km flown</span></div>
          <div class="hp-stat"><strong data-hp="countries">0</strong><span>Countries</span></div>
          <div class="hp-stat"><strong data-hp="cities">0</strong><span>Cities</span></div>
        </div>
        <div class="year-chips" data-years role="group" aria-label="Filter by year"></div>
        <div class="hp-actions" data-hp-actions></div>
      </div>
      <div class="globe-controls">
        <button class="btn btn-glass btn-icon btn-sm" data-g="in" aria-label="Zoom in">${icons.zoomIn}</button>
        <button class="btn btn-glass btn-icon btn-sm" data-g="out" aria-label="Zoom out">${icons.zoomOut}</button>
        <button class="btn btn-glass btn-icon btn-sm" data-g="home" aria-label="Reset view">${icons.target}</button>
        <button class="btn btn-glass btn-icon btn-sm" data-g="spin" aria-label="Toggle rotation">${icons.rotate}</button>
        ${TOUCH ? `<button class="btn btn-glass btn-icon btn-sm" data-g="interact" aria-label="Explore the globe" aria-pressed="false">${icons.globe}</button>` : ''}
      </div>
      <div class="globe-legend glass"><span><i></i>Flights</span><span><i class="up"></i>Upcoming</span><span><i class="dot"></i>Visited</span></div>
      <div class="scroll-cue" aria-hidden="true"><span>Scroll</span><i></i></div>
    </section>

    <section id="stats" class="dash-section">
      <div class="section-row"><div class="section-head"><span class="section-kicker">By the numbers</span><h2>Bragging rights, <span class="grad-text">quantified.</span></h2></div></div>
      <div class="bento" data-bento></div>
    </section>

    <section id="flights" class="dash-section">
      <div class="section-row">
        <div class="section-head"><span class="section-kicker">Flight log</span><h2>Every boarding pass, <span class="grad-text">kept forever.</span></h2></div>
        <div class="toolbar">
          <label class="search">${icons.search}<input class="input" type="search" placeholder="Search city, airport, airline…" data-search aria-label="Search flights" /></label>
          <div class="segmented" data-srcfilter>
            <button aria-pressed="true" data-v="all">All</button><button aria-pressed="false" data-v="gmail">Gmail</button><button aria-pressed="false" data-v="timeline">Timeline</button><button aria-pressed="false" data-v="manual">Manual</button>
          </div>
          <button class="btn btn-primary btn-sm" data-act="add-flight">${icons.plus} Flight</button>
        </div>
      </div>
      <div data-flights></div>
    </section>

    <section id="places" class="dash-section">
      <div class="section-row">
        <div class="section-head"><span class="section-kicker">Places</span><h2>Cities you've <span class="grad-text">called yours.</span></h2></div>
        <div class="toolbar"><button class="btn btn-glass btn-sm" data-act="sources">${icons.map} Import Timeline</button><button class="btn btn-primary btn-sm" data-act="add-place">${icons.plus} Place</button></div>
      </div>
      <div data-places></div>
    </section>

    <section id="passport" class="dash-section">
      <div class="section-row"><div class="section-head"><span class="section-kicker">Passport</span><h2>Stamps <span class="grad-text">collected.</span></h2><p data-passport-sub></p></div></div>
      <div class="passport-book"><div class="stamp-grid" data-stamps></div></div>
    </section>
    <div class="dash-footer-space"></div>
  </main>
  ${footerHtml()}
  <nav class="tabbar" aria-label="Sections">
    <button data-sec="globe" class="is-active">${icons.globe}<span>Globe</span></button>
    <button data-sec="flights">${icons.ticket}<span>Flights</span></button>
    <button class="tab-add" data-act="add" aria-label="Add"><span class="plus">${icons.plus}</span></button>
    <button data-sec="places">${icons.pin}<span>Places</span></button>
    <button data-sec="passport">${icons.passport}<span>Passport</span></button>
  </nav>`;

  bindChrome(root, app);
  bindUserMenu(root, app);

  const $ = (s) => root.querySelector(s);
  const ui = { search: '', src: 'all', limit: PAGE, cityLimit: 24, newIds: new Set(), continentOf: () => null, stats: null, triggers: [] };
  let first_ = true;

  loadCountries().then((c) => {
    ui.continentOf = c.continentOf;
    update();
  });

  /* ------------------------------------------------------------ globe */
  const slot = $('[data-globe-slot]');
  const applyOffset = () => {
    const panel = $('[data-hero-panel]');
    const wide = window.innerWidth > 900 && !document.body.classList.contains('replaying');
    setGlobeOffset(wide && panel ? Math.min(280, panel.offsetWidth / 2 + 24) : 0, 0);
  };
  window.addEventListener('resize', applyOffset);
  app.onCleanup(() => window.removeEventListener('resize', applyOffset));
  onGlobe('arc', (f) => f?.id && openFlightDetails(f.id));
  onGlobe('point', (d) => {
    if (!d?.airport) return;
    flyTo({ lat: d.lat, lng: d.lng, altitude: 1.2 }, 1200);
    toast({ title: `${d.airport.iata} · ${d.airport.city}`, message: `${d.airport.name} — ${d.airport.count} ${d.airport.count === 1 ? 'flight' : 'flights'}`, icon: flagEmoji(d.airport.cc), duration: 3500 });
  });
  onGlobe('globe', null);
  mountGlobe(slot, { interactive: !TOUCH }).then(() => {
    if (!slot.isConnected) return;
    applyOffset();
    paintGlobe();
    const home = ui.stats?.home;
    flyTo({ lat: (home?.lat ?? 30) - 8, lng: home?.lng ?? 120, altitude: 3.8 }, 0);
    setTimeout(() => flyTo({ lat: (home?.lat ?? 30) - 4, lng: (home?.lng ?? 120) + 8, altitude: 2.3 }, 2600), 80);
  });

  root.querySelector('.globe-controls').addEventListener('click', (e) => {
    const g = e.target.closest('[data-g]')?.dataset.g;
    if (g === 'in') zoomBy(0.75);
    else if (g === 'out') zoomBy(1.33);
    else if (g === 'home') {
      const home = ui.stats?.home;
      flyTo({ lat: home?.lat ?? 25, lng: home?.lng ?? 120, altitude: 2.3 }, 1400);
    } else if (g === 'spin') setAutoRotate(!isAutoRotating());
    else if (g === 'interact') {
      const on = !isInteractive();
      setInteractive(on);
      e.target.closest('[data-g]').setAttribute('aria-pressed', String(on));
      toast({ title: on ? 'Globe unlocked' : 'Globe locked', message: on ? 'Drag to spin the globe. Tap the globe button again to scroll the page.' : 'Swipe scrolls the page again.', icon: '🌐', duration: 2600 });
    }
  });

  function paintGlobe() {
    if (!ui.stats) return;
    const year = store.ui.year;
    const flights = store.data.flights.filter((f) => year === 'all' || f.date.startsWith(year));
    setUnits(store.data.settings.units);
    setGlobeData({ flights, places: ui.stats.places, countries: ui.stats.countries.map((c) => c.cc), mode: 'dashboard' });
  }

  /* ------------------------------------------------------------ hero */
  function renderHero(s) {
    const units = store.data.settings.units;
    const fmt = (v) => formatNumber(Math.round(v));
    retarget($('[data-hp="flights"]'), s.count, fmt);
    retarget($('[data-hp="distance"]'), units === 'mi' ? s.km / 1.609344 : s.km, fmt);
    retarget($('[data-hp="countries"]'), s.countries.length, fmt);
    retarget($('[data-hp="cities"]'), s.places.length, fmt);
    $('[data-hp-unit]').textContent = units === 'mi' ? 'miles flown' : 'km flown';
    $('[data-year-label]').textContent = store.ui.year === 'all' ? 'All time' : `Year ${store.ui.year}`;

    const years = ['all', ...[...s.years].reverse()];
    const chips = $('[data-years]');
    chips.innerHTML = years.map((y) => `<button class="year-chip" data-year="${escapeHtml(y)}" aria-pressed="${store.ui.year === y}">${y === 'all' ? 'All time' : escapeHtml(y)}</button>`).join('');

    const empty = !store.data.flights.length && !store.data.places.length;
    $('[data-hp-actions]').innerHTML = empty
      ? `<button class="btn btn-primary" data-act="sources">${icons.sparkles} Connect a source</button><button class="btn btn-glass" data-act="add">${icons.plus} Add manually</button>`
      : `<button class="btn btn-primary" data-act="replay" ${s.count ? '' : 'disabled'}>${icons.play} Replay journey</button><button class="btn btn-glass" data-act="share">${icons.share} Share</button>`;
  }

  $('[data-years]').addEventListener('click', (e) => {
    const y = e.target.closest('[data-year]')?.dataset.year;
    if (y && y !== store.ui.year) setYear(y);
  });

  /* ------------------------------------------------------------ bento */
  function bentoHtml(s) {
    const units = store.data.settings.units;
    const dist = units === 'mi' ? s.km / 1.609344 : s.km;
    const hours = s.minutes / 60;
    const worldPct = Math.min(100, (s.countries.length / 195) * 100);
    const circumference = 2 * Math.PI * 44;
    const topAirport = s.airports[0];
    const topAirline = s.airlines[0];
    const topRoute = s.routes[0];
    const topCity = s.places[0];
    const maxYear = Math.max(1, ...s.perYear.map((y) => y.flights));
    const longest = s.longest;
    return `
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
        <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
        <linearGradient id="arc-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#38bdf8"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
      </defs></svg>
      <article class="card card-glow stat-card b-wide" data-reveal>
        <div class="stat-label"><span class="ico">🛫</span> Distance flown</div>
        <div class="stat-value"><span data-to="${Math.round(dist)}">0</span><small>${units}</small></div>
        <div class="stat-foot">That's <b>${s.earthLaps.toFixed(2)}×</b> around the Earth and <b>${(s.moonShare * 100).toFixed(1)}%</b> of the way to the Moon.</div>
        <div class="moon-track" data-moon="${Math.min(1, s.moonShare).toFixed(4)}" style="--p:0"><span class="earth">🌍</span><span class="line"></span><span class="fill"></span><span class="rocket">🚀</span><span class="moon">🌕</span></div>
      </article>
      <article class="card card-glow stat-card b-third" data-reveal>
        <div class="stat-label"><span class="ico">⏱️</span> Time in the air</div>
        <div class="stat-value"><span data-to="${Math.round(hours)}">0</span><small>hours</small></div>
        <div class="stat-foot">${hours >= 24 ? `= <b>${Math.floor(hours / 24)} days ${Math.round(hours % 24)} h</b> at cruising altitude` : 'Every minute counts.'}</div>
      </article>
      <article class="card card-glow stat-card b-quarter" data-reveal>
        <div class="stat-label"><span class="ico">🌐</span> Countries</div>
        <div class="ring-wrap">
          <svg class="ring" viewBox="0 0 104 104"><circle class="track" cx="52" cy="52" r="44"/><circle class="bar" cx="52" cy="52" r="44" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" data-ring="${(circumference * (1 - worldPct / 100)).toFixed(1)}"/></svg>
          <div><div class="stat-value"><span data-to="${s.countries.length}">0</span></div><div class="stat-foot">${worldPct.toFixed(1)}% of the world</div></div>
        </div>
      </article>
      <article class="card card-glow stat-card b-quarter" data-reveal>
        <div class="stat-label"><span class="ico">🏙️</span> Cities</div>
        <div class="stat-value"><span data-to="${s.places.length}">0</span></div>
        <div class="stat-foot">${topCity ? `Most visited: <b>${flagEmoji(topCity.cc)} ${escapeHtml(topCity.name)}</b>` : 'Add places to grow this.'}</div>
      </article>
      <article class="card card-glow stat-card b-quarter" data-reveal>
        <div class="stat-label"><span class="ico">🛬</span> Airports</div>
        <div class="stat-value"><span data-to="${s.airports.length}">0</span></div>
        <div class="stat-foot">${topAirport ? `Home base: <b>${escapeHtml(topAirport.airport.iata)}</b> · ${topAirport.count} visits` : '—'}</div>
      </article>
      <article class="card card-glow stat-card b-quarter" data-reveal>
        <div class="stat-label"><span class="ico">🛩️</span> Airlines</div>
        <div class="stat-value"><span data-to="${s.airlines.length}">0</span></div>
        <div class="stat-foot">${topAirline ? `Favourite: <b>${escapeHtml(topAirline.airline?.name || topAirline.key)}</b> · ${topAirline.count}×` : '—'}</div>
      </article>
      <article class="card card-glow stat-card b-half" data-reveal>
        <div class="stat-label"><span class="ico">🏆</span> Longest flight</div>
        ${longest ? `<div class="mini-route"><span>${escapeHtml(longest.from.iata)}</span>
          <svg viewBox="0 0 200 44" preserveAspectRatio="none"><path d="M4 40 Q100 -18 196 40" data-draw pathLength="1"/></svg><span>${escapeHtml(longest.to.iata)}</span></div>
          <div class="stat-foot"><b>${escapeHtml(longest.from.city)} → ${escapeHtml(longest.to.city)}</b> · ${formatDistance(longest.distanceKm, units)} · ${formatDuration(longest.durationMin)} · ${escapeHtml(formatDay(longest.date))}</div>`
        : '<div class="stat-foot">Your longest haul will show up here.</div>'}
      </article>
      <article class="card card-glow stat-card b-half" data-reveal>
        <div class="stat-label"><span class="ico">📅</span> Flights per year</div>
        <div class="bars">${s.perYear.length ? s.perYear.slice(-10).map((y) => `<div class="bar-col ${store.ui.year === y.year ? 'is-active' : ''}"><div class="bar-fill-wrap"><div class="bar-fill" data-v="${y.flights}" style="--h:${((y.flights / maxYear) * 100).toFixed(1)}%"></div></div><span>${y.year}</span></div>`).join('') : '<p class="stat-foot">No flights yet.</p>'}</div>
      </article>
      <article class="card card-glow stat-card b-third" data-reveal>
        <div class="stat-label"><span class="ico">🗺️</span> Continents</div>
        <div class="stat-value"><span data-to="${s.continents.length}">0</span><small>/ 7</small></div>
        <div class="continents">${Object.entries(CONTINENTS).map(([code, c]) => `<span class="continent ${s.continents.includes(code) ? 'on' : ''}">${c.emoji} ${c.name}</span>`).join('')}</div>
      </article>
      <article class="card card-glow stat-card b-third" data-reveal>
        <div class="stat-label"><span class="ico">🕒</span> Time zones crossed</div>
        <div class="stat-value"><span data-to="${s.tzCrossed}">0</span><small>hours</small></div>
        <div class="stat-foot">${s.transits ? `Plus <b>${s.transits}</b> airport ${s.transits === 1 ? 'connection' : 'connections'} survived.` : 'Jet lag, earned.'}</div>
      </article>
      <article class="card card-glow stat-card b-third" data-reveal>
        <div class="stat-label"><span class="ico">🔁</span> Favourite route</div>
        ${topRoute ? `<div class="stat-value mono" style="font-size:clamp(1.6rem,3vw,2.4rem)">${escapeHtml(topRoute.from.iata)} ⇄ ${escapeHtml(topRoute.to.iata)}</div><div class="stat-foot">Flown <b>${topRoute.count}×</b> · ${escapeHtml(topRoute.from.city)} – ${escapeHtml(topRoute.to.city)}</div>` : '<div class="stat-foot">Fly a route twice to crown it.</div>'}
      </article>`;
  }

  function animateBento(container) {
    container.querySelectorAll('[data-to]').forEach((el) => {
      const to = Number(el.dataset.to);
      ui.triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top 95%',
          once: true,
          onEnter: () => {
            const state = { v: 0 };
            if (REDUCED) el.textContent = formatNumber(to);
            else gsap.to(state, { v: to, duration: 2, ease: 'power3.out', onUpdate: () => (el.textContent = formatNumber(Math.round(state.v))) });
          },
        }),
      );
    });
    container.querySelectorAll('[data-ring]').forEach((ring) =>
      ui.triggers.push(ScrollTrigger.create({ trigger: ring, start: 'top 95%', once: true, onEnter: () => gsap.to(ring, { attr: { 'stroke-dashoffset': Number(ring.dataset.ring) }, duration: REDUCED ? 0 : 2, ease: 'power3.out' }) })),
    );
    container.querySelectorAll('[data-moon]').forEach((track) =>
      ui.triggers.push(ScrollTrigger.create({ trigger: track, start: 'top 95%', once: true, onEnter: () => gsap.to(track, { '--p': Number(track.dataset.moon), duration: REDUCED ? 0 : 2.4, ease: 'power2.inOut' }) })),
    );
    const bars = container.querySelectorAll('.bar-fill');
    if (bars.length && !REDUCED) {
      gsap.set(bars, { scaleY: 0 });
      ui.triggers.push(ScrollTrigger.create({ trigger: bars[0].closest('.bars'), start: 'top 95%', once: true, onEnter: () => gsap.to(bars, { scaleY: 1, duration: 1.2, stagger: 0.06, ease: 'expo.out' }) }));
    }
    container.querySelectorAll('[data-draw]').forEach((path) => {
      if (REDUCED) return;
      gsap.set(path, { attr: { 'stroke-dasharray': 1, 'stroke-dashoffset': 1 } });
      ui.triggers.push(ScrollTrigger.create({ trigger: path, start: 'top 95%', once: true, onEnter: () => gsap.to(path, { attr: { 'stroke-dashoffset': 0 }, duration: 1.8, ease: 'power2.inOut' }) }));
    });
  }

  /* ------------------------------------------------------------ flights */
  function filteredFlights() {
    const year = store.ui.year;
    const q = normalizeSearch(ui.search);
    return store.data.flights.filter((f) => {
      if (year !== 'all' && !f.date.startsWith(year)) return false;
      if (ui.src !== 'all') {
        const src = f.source === 'demo' ? 'manual' : f.source;
        if (src !== ui.src) return false;
      }
      if (!q) return true;
      const hay = normalizeSearch([f.from.iata, f.to.iata, f.from.city, f.to.city, f.from.name, f.to.name, f.airline?.name, f.flightNo, countryName(f.from.cc), countryName(f.to.cc), f.date].join(' '));
      return hay.includes(q);
    });
  }

  function renderFlights() {
    const box = $('[data-flights]');
    const units = store.data.settings.units;
    if (!store.data.flights.length) {
      box.innerHTML = emptyHtml({
        art: '🛫',
        title: 'No flights yet',
        text: 'Scan your Gmail for booking confirmations, import your Maps Timeline, or add a flight by hand.',
        actions: `<button class="btn btn-primary" data-act="sources">${icons.mail} Scan Gmail</button><button class="btn btn-glass" data-act="add-flight">${icons.plus} Add a flight</button>`,
      }).toString();
      return;
    }
    const list = filteredFlights();
    const upcoming = sortFlights(list.filter((f) => isUpcoming(f)), 'asc');
    const past = sortFlights(list.filter((f) => !isUpcoming(f)), 'desc');
    const shown = past.slice(0, ui.limit);
    const groups = new Map();
    for (const f of shown) {
      const y = f.date.slice(0, 4);
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push(f);
    }
    const yearTotals = new Map();
    for (const f of past) {
      const y = f.date.slice(0, 4);
      const t = yearTotals.get(y) || { n: 0, km: 0 };
      t.n++;
      t.km += f.distanceKm;
      yearTotals.set(y, t);
    }
    const card = (f) => passHtml(f, { units, isNew: ui.newIds.has(f.id) }).toString();
    box.innerHTML = `
      ${upcoming.length ? `<div class="year-group"><div class="year-head"><h3>Upcoming</h3><span>${upcoming.length} ${upcoming.length === 1 ? 'trip' : 'trips'} ahead ✈</span></div><div class="pass-grid">${upcoming.map(card).join('')}</div></div>` : ''}
      ${[...groups.entries()].map(([y, fs]) => `<div class="year-group"><div class="year-head"><h3>${y}</h3><span>${yearTotals.get(y).n} flights · ${formatDistance(yearTotals.get(y).km, units)}</span></div><div class="pass-grid">${fs.map(card).join('')}</div></div>`).join('')}
      ${!list.length ? '<p class="muted" style="text-align:center;padding:40px 0">No flights match your filters.</p>' : ''}
      ${past.length > ui.limit ? `<div style="display:grid;place-items:center;margin-top:10px"><button class="btn btn-glass" data-more-flights>Show ${Math.min(PAGE, past.length - ui.limit)} more of ${past.length - ui.limit}</button></div>` : ''}`;
    const passes = [...box.querySelectorAll('.pass')];
    enhance(box);
    if (!REDUCED && passes.length) {
      gsap.set(passes, { opacity: 0, y: 40 });
      ScrollTrigger.batch(passes, {
        start: 'top 95%',
        once: true,
        onEnter: (batch) => {
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'expo.out', clearProps: 'transform' });
          batch.forEach((pass, i) => pass.querySelectorAll('.pass-code').forEach((c) => scramble(c, c.dataset.code, { delay: 0.1 + i * 0.07 })));
        },
      });
    }
  }

  /* ------------------------------------------------------------ places */
  function renderPlaces(s) {
    const box = $('[data-places]');
    if (!s.places.length) {
      box.innerHTML = emptyHtml({ art: '📍', title: 'No places yet', text: 'Places appear from your flights, your Google Maps Timeline, or the ones you add yourself.', actions: `<button class="btn btn-primary" data-act="add-place">${icons.plus} Add a place</button>` }).toString();
      return;
    }
    const maxVisits = Math.max(...s.countries.map((c) => c.visits), 1);
    box.innerHTML = `
      <div class="places-layout">
        <div class="card" data-reveal>
          <div class="stat-label" style="margin-bottom:16px"><span class="ico">🏳️</span> Top countries</div>
          <div class="country-bars">${s.countries.slice(0, 12).map((c) => `<div class="country-bar"><span class="flag">${flagEmoji(c.cc)}</span><span class="name">${escapeHtml(countryName(c.cc))}</span><span class="track"><i style="--w:${((c.visits / maxVisits) * 100).toFixed(1)}%"></i></span><span class="count">${c.cities} ${c.cities === 1 ? 'city' : 'cities'}</span></div>`).join('')}</div>
        </div>
        <div>
          <div class="city-grid">${s.places.slice(0, ui.cityLimit).map((p) => cityCardHtml(p).toString()).join('')}</div>
          ${s.places.length > ui.cityLimit ? `<div style="display:grid;place-items:center;margin-top:16px"><button class="btn btn-glass" data-more-cities>Show all ${s.places.length} cities</button></div>` : ''}
        </div>
      </div>`;
    const bars = box.querySelectorAll('.country-bar .track i');
    if (!REDUCED) {
      gsap.set(bars, { scaleX: 0 });
      ui.triggers.push(ScrollTrigger.create({ trigger: box, start: 'top 85%', once: true, onEnter: () => gsap.to(bars, { scaleX: 1, duration: 1.3, stagger: 0.05, ease: 'expo.out' }) }));
      const cards = box.querySelectorAll('.city-card');
      gsap.set(cards, { opacity: 0, y: 24, scale: 0.96 });
      ScrollTrigger.batch(cards, { start: 'top 96%', once: true, onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.04, ease: 'expo.out', clearProps: 'transform' }) });
    }
    enhance(box);
  }

  /* ------------------------------------------------------------ passport */
  function renderPassport(s) {
    const box = $('[data-stamps]');
    const countries = [...s.countries].sort((a, b) => (a.first || '9999').localeCompare(b.first || '9999'));
    $('[data-passport-sub]').textContent = countries.length ? `${countries.length} of 195 countries · ${s.continents.length} of 7 continents` : 'Your first stamp is waiting.';
    box.innerHTML = countries.length ? countries.map((c) => stampHtml(c).toString()).join('') : '<p class="muted" style="grid-column:1/-1;text-align:center;padding:30px">Visit a new country to earn a stamp 🛂</p>';
    const inner = [...box.querySelectorAll('.stamp-inner')];
    if (REDUCED || !inner.length) return;
    gsap.set(inner, { opacity: 0, scale: 2.4 });
    ScrollTrigger.batch(inner, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1,
          scale: 1,
          duration: 0.32,
          ease: 'power4.in',
          stagger: 0.14,
          onComplete: () => gsap.fromTo(box.parentElement, { x: -2 }, { x: 0, duration: 0.3, ease: 'elastic.out(1.2, 0.3)' }),
        }),
    });
  }

  /* ------------------------------------------------------------ update */
  function update() {
    ui.triggers.forEach((t) => t.kill());
    ui.triggers = [];
    const s = computeStats({ flights: store.data.flights, places: store.data.places, year: store.ui.year, continentOf: ui.continentOf });
    ui.stats = s;
    renderHero(s);
    paintGlobe();
    const bento = $('[data-bento]');
    bento.innerHTML = bentoHtml(s);
    bento.querySelectorAll('[data-reveal]').forEach((el) => el.removeAttribute('data-revealed'));
    enhance(bento);
    animateBento(bento);
    renderFlights();
    renderPlaces(s);
    renderPassport(s);
    ScrollTrigger.refresh();
    if (first_) {
      first_ = false;
      intro();
    }
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (!isReplaying()) update();
    });
  };
  const unsubscribe = subscribe((change) => {
    if (change.type === 'flights' && change.added?.length) {
      change.added.forEach((id) => ui.newIds.add(id));
      if (change.added.length === 1) {
        const f = store.data.flights.find((x) => x.id === change.added[0]);
        if (f) setTimeout(() => focusFlight(f), 400);
      }
    }
    if (['flights', 'places', 'data', 'filter', 'settings'].includes(change.type)) schedule();
  });
  app.onCleanup(unsubscribe);

  /* ------------------------------------------------------------ events */
  root.addEventListener('click', (e) => {
    const pass = e.target.closest('[data-flight]');
    if (pass && !e.target.closest('a')) return openFlightDetails(pass.dataset.flight);
    const cityBtn = e.target.closest('[data-place]');
    if (cityBtn) return openPlaceDetails(ui.stats.places.find((p) => p.key === cityBtn.dataset.place));
    const sec = e.target.closest('[data-sec]')?.dataset.sec;
    if (sec) return scrollToTarget(`#${sec}`, sec === 'globe' ? 0 : -70);
    if (e.target.closest('[data-more-flights]')) {
      ui.limit += PAGE;
      return renderFlights();
    }
    if (e.target.closest('[data-more-cities]')) {
      ui.cityLimit = Infinity;
      return renderPlaces(ui.stats);
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'sources') app.navigate('connect', e);
    else if (act === 'add') app.openAddChooser();
    else if (act === 'add-flight') app.menuAction('add-flight');
    else if (act === 'add-place') app.menuAction('add-place');
    else if (act === 'share') openShareCard({ stats: ui.stats, name: p?.givenName || p?.name?.split(' ')[0] || 'My', year: store.ui.year, units: store.data.settings.units });
    else if (act === 'replay') {
      const flights = sortFlights(ui.stats.flights, 'asc');
      scrollToTarget('#globe', 0);
      setTimeout(
        () =>
          startReplay(flights, {
            units: store.data.settings.units,
            onExit: () => {
              applyOffset();
              paintGlobe();
              update();
            },
            onShare: () => openShareCard({ stats: ui.stats, name: p?.givenName || 'My', year: store.ui.year, units: store.data.settings.units }),
          }),
        250,
      );
    }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-flight]')) openFlightDetails(e.target.dataset.flight);
  });

  const searchInput = $('[data-search]');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      ui.search = searchInput.value;
      ui.limit = PAGE;
      renderFlights();
    }, 160);
  });
  $('[data-srcfilter]').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    ui.src = b.dataset.v;
    ui.limit = PAGE;
    $('[data-srcfilter]').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderFlights();
  });

  /* ------------------------------------------------------------ section spy */
  const pill = $('[data-pill]');
  const links = [...root.querySelectorAll('.nav-links [data-sec]')];
  const tabs = [...root.querySelectorAll('.tabbar [data-sec]')];
  const setActive = (id) => {
    links.forEach((l) => l.classList.toggle('is-active', l.dataset.sec === id));
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.sec === id || (id === 'stats' && t.dataset.sec === 'globe')));
    const active = links.find((l) => l.dataset.sec === id);
    if (active && pill) {
      pill.style.left = `${active.offsetLeft}px`;
      pill.style.width = `${active.offsetWidth}px`;
    }
  };
  const spy = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && setActive(en.target.id)),
    { rootMargin: '-45% 0px -50% 0px' },
  );
  root.querySelectorAll('main > section[id]').forEach((s) => spy.observe(s));
  requestAnimationFrame(() => setActive('globe'));
  app.onCleanup(() => {
    stopReplay();
    spy.disconnect();
    ui.triggers.forEach((t) => t.kill());
  });

  function intro() {
    if (REDUCED) return;
    gsap.from(root.querySelector('[data-nav]'), { y: -30, opacity: 0, duration: 1, ease: 'expo.out' });
    gsap.from(root.querySelector('[data-hero-panel]'), { x: TOUCH ? 0 : -50, y: TOUCH ? 40 : 0, opacity: 0, duration: 1.4, delay: 0.3, ease: 'expo.out' });
    gsap.from(root.querySelectorAll('.hp-stat'), { y: 20, opacity: 0, duration: 1, stagger: 0.08, delay: 0.55, ease: 'expo.out' });
    gsap.from(root.querySelectorAll('.globe-controls .btn, .globe-legend'), { opacity: 0, x: 20, duration: 0.8, stagger: 0.06, delay: 0.9 });
    gsap.from(root.querySelector('.tabbar'), { y: 120, duration: 1, delay: 0.6, ease: 'expo.out' });
  }

  update();

  if (!store.data.flights.length && !store.data.places.length) {
    setTimeout(() => toast({ title: 'Your globe is ready for its first trip', message: 'Connect Gmail or import your Timeline to light it up.', icon: '🌍', actions: [{ label: 'Connect', primary: true, onClick: () => app.navigate('connect') }], duration: 9000 }), 1600);
  }
}
