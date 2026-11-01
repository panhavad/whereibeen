import { googleLogo, icons, brandMark, planeSolid } from '../icons.js';
import { mountGlobe, setGlobeData, flyTo, onGlobe, setGlobeOffset } from '../globe.js';
import { buildLandingFlights, LANDING_ROUTES } from '../../data/demo.js';
import { enhance, gsap, REDUCED, ScrollTrigger, splitReveal, TOUCH } from '../motion.js';
import { footerHtml, bindChrome } from './shared.js';
import { VERSION_SHORT } from '../../core/version.js';

const CODES = [...new Set(LANDING_ROUTES.flat())];

function flap(code) {
  return `<span class="flap">${[...code].map((c) => `<span>${c}</span>`).join('')}</span>`;
}

export function renderLanding(root, app) {
  const marquee = [...CODES, ...CODES].map((c) => `<span class="marquee-item">${flap(c)}${icons.plane}</span>`).join('');
  root.innerHTML = `
  <header class="nav" data-nav>
    <a class="brand" href="#/" aria-label="WhereIBeen home">${brandMark('nav')}<span class="brand-name">Where<b>I</b>Been</span></a>
    <div class="nav-actions">
      <button class="version-pill hide-mobile" data-act="about" title="About this version">${VERSION_SHORT}</button>
      <button class="btn btn-ghost btn-sm hide-mobile" data-act="demo">Live demo</button>
      <button class="btn btn-glass btn-sm" data-act="google">Sign in</button>
    </div>
  </header>
  <main class="landing">
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow" data-intro><span class="eyebrow-badge">✈ New</span> Your travel life on a living globe</span>
        <h1 class="hero-title" data-split>Every flight. Every city. <span class="grad-text">One living globe.</span></h1>
        <p class="hero-sub" data-intro>WhereIBeen finds the flight confirmations in your Gmail and the places in your Google Maps Timeline, then turns them into a breathtaking, interactive map of everywhere you've been.</p>
        <div class="hero-cta" data-intro>
          <button class="btn btn-google btn-lg" data-act="google" data-magnetic="0.25">${googleLogo} Continue with Google</button>
          <button class="btn btn-glass btn-lg" data-act="demo" data-magnetic="0.25">${icons.play} Explore the demo</button>
        </div>
        <div class="hero-trust" data-intro>
          <span>${icons.lock} Processed on your device</span>
          <span>${icons.mail} Read-only Gmail</span>
          <span>${icons.install} Installable app</span>
        </div>
        <div data-intro><button class="btn btn-ghost btn-sm" data-act="local">Or start without an account ${icons.arrowRight}</button></div>
      </div>
      <div class="hero-visual">
        <div class="globe-slot" data-globe-slot></div>
        <div class="float-card fc-1" data-float="1"><span class="fc-icon">✈️</span><div><strong data-count="128">0</strong><span>flights logged</span></div></div>
        <div class="float-card fc-2" data-float="2"><span class="fc-icon">🌍</span><div><strong data-count="34">0</strong><span>countries unlocked</span></div></div>
        <div class="float-card fc-3 fc-ticket" data-float="3"><b>ICN</b><span style="width:22px;color:#a78bfa">${planeSolid}</span><b>CDG</b><span>11h 50m</span></div>
      </div>
      <div class="scroll-cue" aria-hidden="true"><span>Scroll</span><i></i></div>
    </section>

    <section class="marquee" aria-hidden="true"><div class="marquee-track">${marquee}</div></section>

    <section class="section" id="features">
      <div class="section-head" data-reveal>
        <span class="section-kicker">Why you'll love it</span>
        <h2>Your passport, reimagined as <span class="grad-text">a work of art.</span></h2>
        <p>Connect once and watch years of trips assemble themselves — with room to add every road trip, train ride and spontaneous weekend.</p>
      </div>
      <div class="feature-grid">
        <article class="card card-glow feature wide" data-reveal data-tilt>
          <div class="feature-icon">📬</div>
          <h3>Flights found in your Gmail</h3>
          <p>We look for airline and travel-agency confirmations, read the structured flight data airlines embed (or the itinerary text), and remove duplicates from check-ins, changes and cancellations.</p>
          <div class="feature-art"><span class="chip chip-ok chip-dot">KE703 · ICN → NRT</span><span class="chip chip-accent chip-dot">BA641 · ATH → LHR</span><span class="chip chip-dot">VN215 · HAN → SGN</span></div>
        </article>
        <article class="card card-glow feature wide" data-reveal data-tilt>
          <div class="feature-icon">📍</div>
          <h3>Places from Google Maps Timeline</h3>
          <p>Drop your Timeline export (Android, iPhone or a Takeout ZIP). Every visit becomes a city, a country and time spent — flights you took are detected too.</p>
          <div class="feature-art"><span class="chip">Timeline.json</span><span class="chip">location-history.json</span><span class="chip">takeout.zip</span></div>
        </article>
        <article class="card card-glow feature" data-reveal data-tilt>
          <div class="feature-icon">🎬</div>
          <h3>Replay your journeys</h3>
          <p>Hit play and fly through every trip in order, with the camera chasing each arc across the planet.</p>
        </article>
        <article class="card card-glow feature" data-reveal data-tilt>
          <div class="feature-icon">🛂</div>
          <h3>A passport of stamps</h3>
          <p>Each new country lands as an inked stamp, dated with your first visit. Collect them all.</p>
        </article>
        <article class="card card-glow feature" data-reveal data-tilt>
          <div class="feature-icon">📊</div>
          <h3>Stats worth bragging about</h3>
          <p>Kilometres flown, laps around the Earth, hours in the air, time zones crossed, longest haul and more.</p>
        </article>
      </div>
    </section>

    <section class="section" id="how">
      <div class="section-head" data-reveal>
        <span class="section-kicker">How it works</span>
        <h2>Three steps to your <span class="grad-text">travel universe.</span></h2>
      </div>
      <div class="steps">
        <article class="card step" data-reveal><span class="step-num">01</span><h3>Sign in with Google</h3><p>Only your name and photo at first. Nothing else until you say so.</p></article>
        <article class="card step" data-reveal><span class="step-num">02</span><h3>Grant what you're comfortable with</h3><p>Allow read-only Gmail to auto-detect flights, import your Maps Timeline, or simply add trips by hand.</p></article>
        <article class="card step" data-reveal><span class="step-num">03</span><h3>Watch your world light up</h3><p>Your globe, stats and passport build themselves. Install it as an app and keep it forever.</p></article>
      </div>
    </section>

    <section class="section">
      <div class="card privacy-card" data-reveal>
        <div class="privacy-lock">🔐</div>
        <div>
          <span class="section-kicker">Private by design</span>
          <h2 style="font-size:clamp(1.8rem,3.6vw,2.8rem);margin-top:10px">Your inbox never leaves your browser.</h2>
          <ul class="privacy-list">
            <li>Emails are fetched straight from Google to your device and parsed in memory — no servers in between.</li>
            <li>Only the flight details you approve are saved, locally on this device.</li>
            <li>Read-only access. Revoke it any time from your Google account.</li>
            <li>Export a backup or wipe everything with one tap.</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section cta-final">
      <h2 data-reveal>Where have <span class="grad-text">you</span> been?</h2>
      <div class="hero-cta" data-reveal style="justify-content:center">
        <button class="btn btn-primary btn-lg" data-act="google" data-magnetic>${icons.sparkles} Build my globe</button>
        <button class="btn btn-glass btn-lg" data-act="demo" data-magnetic>${icons.play} See a demo</button>
      </div>
    </section>
  </main>
  ${footerHtml()}`;

  bindChrome(root, app);
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'google') app.signInWithGoogle(e);
    else if (act === 'demo') app.startDemo(e);
    else if (act === 'local') app.continueLocal(e);
  });

  intro(root);
  enhance(root);
  initGlobe(root);
}

async function initGlobe(root) {
  const slot = root.querySelector('[data-globe-slot]');
  onGlobe('arc', null);
  onGlobe('point', null);
  onGlobe('globe', null);
  await mountGlobe(slot, { interactive: !TOUCH });
  if (!slot.isConnected) return;
  setGlobeOffset(0, 0);
  const flights = await buildLandingFlights();
  const places = flights.map((f) => ({ name: f.to.city, cc: f.to.cc, lat: f.to.lat, lng: f.to.lng, visits: 1 }));
  setGlobeData({ flights, places, countries: [...new Set(flights.flatMap((f) => [f.from.cc, f.to.cc]))], mode: 'landing', labels: 0 });
  flyTo({ lat: 28, lng: 110, altitude: 3.4 }, 0);
  setTimeout(() => flyTo({ lat: 25, lng: 125, altitude: 2.15 }, 2600), 60);
}

function intro(root) {
  const title = root.querySelector('[data-split]');
  const cards = root.querySelectorAll('[data-float]');
  root.querySelectorAll('[data-count]').forEach((el, i) => {
    const to = Number(el.dataset.count);
    if (REDUCED) el.textContent = String(to);
    else {
      const state = { v: 0 };
      gsap.to(state, { v: to, duration: 2.4, delay: 1 + i * 0.2, ease: 'power3.out', onUpdate: () => (el.textContent = String(Math.round(state.v))) });
    }
  });
  if (REDUCED) return;

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from(root.querySelector('[data-nav]'), { y: -40, opacity: 0, duration: 1.2 }, 0.1)
    .from(root.querySelector('.hero-copy .eyebrow'), { y: 24, opacity: 0, duration: 1 }, 0.25)
    .add(splitReveal(title, { stagger: 0.018 }), 0.3)
    .from(root.querySelectorAll('.hero-copy [data-intro]:not(.eyebrow)'), { y: 30, opacity: 0, duration: 1.1, stagger: 0.1 }, 0.75)
    .from(cards, { y: 60, scale: 0.7, opacity: 0, duration: 1.4, stagger: 0.15, ease: 'back.out(1.6)' }, 1.1)
    .from(root.querySelector('.scroll-cue'), { opacity: 0, duration: 1 }, 1.6);

  cards.forEach((card, i) => {
    gsap.to(card, { y: `+=${10 + i * 4}`, rotation: i % 2 ? 1.5 : -1.5, duration: 3 + i * 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2.6 });
  });

  if (!TOUCH) {
    const movers = [...cards].map((c, i) => ({ x: gsap.quickTo(c, 'x', { duration: 1.2 }), depth: 14 + i * 10 }));
    root.querySelector('.hero').addEventListener('pointermove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      movers.forEach((m) => m.x(nx * m.depth));
    });
  }

  gsap.to(root.querySelector('.hero-visual'), {
    yPercent: 14,
    scale: 0.92,
    opacity: 0.5,
    ease: 'none',
    scrollTrigger: { trigger: root.querySelector('.hero'), start: 'top top', end: 'bottom top', scrub: true },
  });
  ScrollTrigger.refresh();
}
