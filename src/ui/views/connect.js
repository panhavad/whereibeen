import { brandMark, gmailLogo, icons, mapsLogo } from '../icons.js';
import { footerHtml, bindChrome, bindUserMenu, userButtonHtml } from './shared.js';
import { isGoogleConfigured } from '../../auth/google.js';
import { store } from '../../core/store.js';
import { escapeHtml, formatDay, formatNumber } from '../../core/util.js';
import { bindDropzone } from '../timelineImport.js';
import { enhance, gsap, REDUCED, splitReveal } from '../motion.js';

const HOWTO = {
  android: `<ol>
    <li>On your phone open <b>Settings → Location → Location services → Timeline</b>.</li>
    <li>Tap <b>Export Timeline data</b> and save <b>Timeline.json</b>.</li>
    <li>Drop the file below (or open WhereIBeen on your phone and pick it).</li></ol>`,
  ios: `<ol>
    <li>Open <b>Google Maps</b>, tap your profile picture → <b>Settings</b>.</li>
    <li>Go to <b>Personal content</b> (or <b>Location &amp; privacy</b>) → <b>Export Timeline data</b>.</li>
    <li>Save <b>location-history.json</b> to Files and drop it below.</li></ol>`,
  takeout: `<ol>
    <li>Visit <a href="https://takeout.google.com" target="_blank" rel="noopener"><b>takeout.google.com</b></a> and select only <b>Location History (Timeline)</b>.</li>
    <li>Download the ZIP when Google emails you.</li>
    <li>Drop the whole ZIP below — we find the right files. (Takeout only has history from before the 2024 move to on-device Timeline.)</li></ol>`,
};

function yearsAgo(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
}

export function renderConnect(root, app) {
  const p = app.profile();
  const configured = isGoogleConfigured();
  const gmail = store.data.sources.gmail;
  const timeline = store.data.sources.timeline;
  const flights = store.data.flights.length;
  const places = store.data.places.length;
  const manualCount = store.data.flights.filter((f) => f.source === 'manual').length + store.data.places.filter((x) => x.source === 'manual').length;
  const first = escapeHtml(p?.givenName || (p?.name || '').split(' ')[0] || 'traveller');
  const demo = p?.mode === 'demo';

  let gmailNote = '';
  if (!configured) {
    gmailNote = `<div class="setup-note">Google sign-in isn't configured on this deployment yet. Set <code>GOOGLE_CLIENT_ID</code> (Docker) or <code>VITE_GOOGLE_CLIENT_ID</code> (dev) — see the README. Timeline import and manual entries work without it.</div>`;
  } else if (demo) {
    gmailNote = `<div class="setup-note">You're exploring the demo. Sign in with Google to scan your own inbox.</div>`;
  }

  root.innerHTML = `
  <header class="nav" data-nav>
    <a class="brand" href="#/globe" aria-label="WhereIBeen">${brandMark('nav')}<span class="brand-name">Where<b>I</b>Been</span></a>
    <div class="nav-actions">
      <button class="btn btn-ghost btn-sm" data-act="globe">${icons.globe} <span class="hide-mobile">My globe</span></button>
      ${userButtonHtml(p)}
    </div>
  </header>
  <main class="connect">
    <section class="connect-hero">
      <span class="eyebrow" data-intro><span class="eyebrow-badge">Sources</span> Connect what you're comfortable with</span>
      <h1 data-split>Hi ${first} 👋 <span class="grad-text">Let's find where you've been.</span></h1>
      <p data-intro>Pick any combination below. Everything is processed right here in your browser — nothing is uploaded, and you approve every detected flight.</p>
    </section>

    <section class="source-grid">
      <article class="card source-card" data-source="gmail">
        <div class="source-top"><div class="source-logo">${gmailLogo}</div>
          ${gmail?.lastScan ? `<span class="chip chip-ok chip-dot">Scanned ${escapeHtml(formatDay(new Date(gmail.lastScan).toISOString().slice(0, 10)))}</span>` : '<span class="chip">Not connected</span>'}</div>
        <h3>Gmail flight confirmations</h3>
        <p>We search for airline and travel-agency emails — bookings, e-tickets, boarding passes — and extract every flight, from where to where and how long.</p>
        <ul class="perm-list">
          <li><span>👁️</span><span><b>Read-only access.</b> WhereIBeen can't send, delete or change email.</span></li>
          <li><span>🧠</span><span><b>Parsed in your browser.</b> Email content is never uploaded or saved.</span></li>
          <li><span>✅</span><span><b>You review</b> each detected flight before it's added.</span></li>
        </ul>
        <div class="source-options">
          <div class="field"><label for="scan-range">Search emails from</label>
            <select class="select" id="scan-range"><option value="">All time</option><option value="10">Last 10 years</option><option value="5">Last 5 years</option><option value="2">Last 2 years</option><option value="1">Last 12 months</option></select></div>
          <label class="switch"><input type="checkbox" id="scan-promos" /> Also search the Promotions tab</label>
        </div>
        ${gmailNote}
        <div class="source-actions">
          <button class="btn btn-primary" data-act="scan" ${configured ? '' : 'disabled'}>${icons.mail} ${demo ? 'Sign in & scan my Gmail' : gmail?.lastScan ? 'Scan again' : 'Allow Gmail & scan'}</button>
        </div>
        ${gmail?.lastScan ? `<p class="field-hint">Last scan: ${formatNumber(gmail.scanned || 0)} emails read, ${formatNumber(gmail.found || 0)} flights found.</p>` : ''}
      </article>

      <article class="card source-card" data-source="timeline">
        <div class="source-top"><div class="source-logo">${mapsLogo}</div>
          ${timeline?.importedAt ? `<span class="chip chip-ok chip-dot">${formatNumber(timeline.places || 0)} places imported</span>` : '<span class="chip">Not imported</span>'}</div>
        <h3>Google Maps Timeline</h3>
        <p>Google now stores Timeline on your phone, so no website can request it directly. Export it once (about 30 seconds) and drop the file here.</p>
        <div class="segmented" role="tablist" data-os>
          <button type="button" aria-pressed="true" data-v="android">Android</button>
          <button type="button" aria-pressed="false" data-v="ios">iPhone</button>
          <button type="button" aria-pressed="false" data-v="takeout">Takeout ZIP</button>
        </div>
        <div class="howto" data-howto>${HOWTO.android}</div>
        <label class="dropzone" data-dropzone>
          <input type="file" accept=".json,.zip,application/json,application/zip" multiple />
          <span class="dropzone-icon">${icons.upload}</span>
          <strong>Drop your Timeline export here</strong>
          <span class="field-hint">Timeline.json · location-history.json · Takeout .zip</span>
        </label>
      </article>

      <article class="card source-card" data-source="manual">
        <div class="source-top"><div class="source-logo alt">✍️</div><span class="chip">${formatNumber(manualCount)} added by you</span></div>
        <h3>Add trips by hand</h3>
        <p>Road trips, train journeys, flights booked offline — add anything we couldn't detect. Use your current location to log where you are right now.</p>
        <div class="source-actions">
          <button class="btn btn-glass" data-act="add-flight">${icons.plane} Add a flight</button>
          <button class="btn btn-glass" data-act="add-place">${icons.pin} Add a place</button>
        </div>
      </article>
    </section>

    <section class="card connect-cta">
      <p><b>${formatNumber(flights)}</b> flights and <b>${formatNumber(places)}</b> places in your log so far.</p>
      <button class="btn btn-primary btn-lg" data-act="globe" data-magnetic="0.2">${icons.globe} Open my globe ${icons.arrowRight}</button>
    </section>
  </main>
  ${footerHtml()}`;

  bindChrome(root, app);
  bindUserMenu(root, app);
  bindDropzone(root.querySelector('[data-dropzone]'), { onDone: () => app.navigate('globe') });

  root.querySelector('[data-os]').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-v]');
    if (!btn) return;
    root.querySelectorAll('[data-os] button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    const howto = root.querySelector('[data-howto]');
    howto.innerHTML = HOWTO[btn.dataset.v];
    if (!REDUCED) gsap.from(howto.querySelectorAll('li'), { x: 14, opacity: 0, stagger: 0.06, duration: 0.45 });
  });

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'globe') app.navigate('globe', e);
    else if (act === 'add-flight') app.menuAction('add-flight');
    else if (act === 'add-place') app.menuAction('add-place');
    else if (act === 'scan') {
      const years = root.querySelector('#scan-range').value;
      app.scanGmail({ since: years ? yearsAgo(Number(years)) : '', includePromotions: root.querySelector('#scan-promos').checked });
    }
  });

  if (!REDUCED) {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from(root.querySelector('[data-nav]'), { y: -30, opacity: 0, duration: 1 })
      .from(root.querySelector('.connect-hero .eyebrow'), { y: 20, opacity: 0, duration: 0.9 }, 0.1)
      .add(splitReveal(root.querySelector('[data-split]'), { stagger: 0.014 }), 0.15)
      .from(root.querySelector('.connect-hero p'), { y: 20, opacity: 0, duration: 0.9 }, 0.5)
      .from(root.querySelectorAll('.source-card'), { y: 70, opacity: 0, rotateX: -12, duration: 1.2, stagger: 0.12, transformPerspective: 900 }, 0.55)
      .from(root.querySelector('.connect-cta'), { y: 40, opacity: 0, duration: 1 }, 0.9);
  }
  enhance(root);
}
