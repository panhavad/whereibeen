import { friendlyAuthMessage, requestGmailAccess } from '../auth/google.js';
import { scanGmail } from '../sources/gmail.js';
import { addFlights, setSource, store } from '../core/store.js';
import { isSameFlight, dismissKey } from '../core/merge.js';
import { escapeHtml, formatDay, formatNumber, flagEmoji } from '../core/util.js';
import { icons } from './icons.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { celebrate } from './effects.js';
import { gsap, REDUCED } from './motion.js';

const PHASES = {
  search: 'Searching your inbox…',
  read: 'Reading travel emails…',
  merge: 'Matching airports & removing duplicates…',
};

function radarHtml() {
  return `
    <div class="scan-stage">
      <div class="radar" aria-hidden="true">
        <div class="radar-sweep"></div>
        <div class="radar-center">${icons.mail}</div>
      </div>
      <div class="scan-info">
        <span class="eyebrow"><span class="eyebrow-badge">Gmail</span> Read-only · on this device</span>
        <h2 class="scan-phase" data-phase>Connecting to Gmail…</h2>
        <p class="muted" data-sub>Looking for airline and travel-agency confirmations.</p>
        <div class="progress"><div class="progress-fill" data-progress></div></div>
        <div class="scan-counters">
          <div><strong data-c="emails">0</strong><span>emails matched</span></div>
          <div><strong data-c="read">0</strong><span>emails read</span></div>
          <div><strong data-c="flights">0</strong><span>flights spotted</span></div>
        </div>
        <ul class="scan-feed" data-feed></ul>
      </div>
    </div>`;
}

/** Must be called from a click handler so Google's consent pop-up is allowed. */
export async function startGmailScan({ since = '', includePromotions = false, onDone } = {}) {
  let token;
  try {
    token = await requestGmailAccess(store.profile?.email);
  } catch (err) {
    toast({ type: 'error', title: 'Gmail not connected', message: friendlyAuthMessage(err), duration: 8000 });
    return;
  }

  const controller = new AbortController();
  const modal = openModal({
    className: 'scan-layer',
    dismissible: false,
    width: 980,
    body: radarHtml(),
    footer: `<span class="muted" style="font-size:.82rem">${icons.lock} Emails are parsed in your browser and never stored.</span><span class="spacer"></span><button class="btn btn-ghost" data-cancel>Cancel</button>`,
  });
  const $ = (s) => modal.$(s);
  const radar = $('.radar');
  const feed = $('[data-feed]');
  const counters = { emails: $('[data-c="emails"]'), read: $('[data-c="read"]'), flights: $('[data-c="flights"]') };
  let spotted = 0;
  let blips = [];

  $('[data-cancel]').addEventListener('click', () => {
    controller.abort();
    modal.close();
    toast({ title: 'Scan cancelled', icon: '✋' });
  });

  const setPhase = (text, sub) => {
    const el = $('[data-phase]');
    if (!el || el.dataset.text === text) return;
    el.dataset.text = text;
    if (REDUCED) el.textContent = text;
    else gsap.to(el, { duration: 0.6, scrambleText: { text, chars: 'lowerCase', speed: 0.8 } });
    if (sub !== undefined) $('[data-sub]').textContent = sub;
  };

  const addBlip = (flight) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 22 + Math.random() * 24;
    const blip = document.createElement('div');
    blip.className = 'radar-blip';
    blip.style.left = `${50 + Math.cos(angle) * radius}%`;
    blip.style.top = `${50 + Math.sin(angle) * radius}%`;
    blip.innerHTML = `<span>${escapeHtml(flight.from.iata)}→${escapeHtml(flight.to.iata)}</span>`;
    radar.appendChild(blip);
    blips.push(blip);
    if (blips.length > 10) {
      const old = blips.shift();
      gsap.to(old, { scale: 0, opacity: 0, duration: 0.4, onComplete: () => old.remove() });
    }
    gsap.from(blip, { scale: 0, opacity: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)' });
  };

  const addFeed = (flight) => {
    const li = document.createElement('li');
    li.className = 'feed-item';
    li.innerHTML = `<span class="flag">${flagEmoji(flight.to.cc)}</span><span class="route">${escapeHtml(flight.from.iata)} → ${escapeHtml(flight.to.iata)}</span><span class="muted">${escapeHtml(flight.airline?.name || flight.flightNo || '')}</span><span class="when">${escapeHtml(formatDay(flight.date))}</span>`;
    feed.prepend(li);
    gsap.from(li, { x: 30, opacity: 0, duration: 0.5, ease: 'power3.out' });
    while (feed.children.length > 6) feed.lastElementChild.remove();
  };

  try {
    const result = await scanGmail({
      getToken: async (force) => (force ? requestGmailAccess(store.profile?.email, { force: true }) : token),
      since,
      includePromotions,
      signal: controller.signal,
      onProgress: (p) => {
        if (p.phase === 'search') {
          setPhase(PHASES.search, p.label);
          counters.emails.textContent = formatNumber(p.matched);
          $('[data-progress]').style.setProperty('--p', String((p.step / p.steps) * 0.12));
        } else if (p.phase === 'read') {
          setPhase(PHASES.read, `${formatNumber(p.done)} of ${formatNumber(p.total)} travel emails`);
          counters.emails.textContent = formatNumber(p.total);
          counters.read.textContent = formatNumber(p.done);
          $('[data-progress]').style.setProperty('--p', String(0.12 + (p.total ? (p.done / p.total) * 0.86 : 0.86)));
        } else if (p.phase === 'merge') {
          setPhase(PHASES.merge, '');
        }
      },
      onFlights: (flights) => {
        for (const f of flights) {
          spotted++;
          counters.flights.textContent = formatNumber(spotted);
          addBlip(f);
          addFeed(f);
        }
      },
    });
    $('[data-progress]').style.setProperty('--p', '1');
    await setSource('gmail', { lastScan: Date.now(), scanned: result.scanned, found: result.flights.length, account: store.profile?.email });
    showReview(modal, result, onDone);
  } catch (err) {
    if (err.name === 'AbortError') return;
    modal.close();
    toast({ type: 'error', title: 'Gmail scan failed', message: err.message, duration: 9000 });
  }
}

function showReview(modal, result, onDone) {
  const existing = store.data.flights;
  const dismissed = new Set(store.data.dismissed);
  const items = result.flights
    .map((f) => ({
      flight: f,
      duplicate: existing.some((e) => isSameFlight(e, f)),
      dismissed: dismissed.has(dismissKey(f)),
    }))
    .sort((a, b) => b.flight.date.localeCompare(a.flight.date));
  const fresh = items.filter((i) => !i.duplicate && !i.dismissed);

  if (!items.length) {
    modal.setBody(`
      <div class="empty">
        <div class="empty-art">🔎</div>
        <h3>No flight confirmations found</h3>
        <p>We read ${formatNumber(result.scanned)} travel emails but none contained a recognisable flight. Try scanning again with promotions included, import your Maps Timeline, or add trips manually.</p>
      </div>`);
    modal.setFooter('<span class="spacer"></span><button class="btn btn-primary" data-close>Got it</button>');
    return;
  }

  const confidenceChip = (c) => (c >= 0.85 ? '<span class="chip chip-ok">High</span>' : c >= 0.6 ? '<span class="chip chip-accent">Medium</span>' : '<span class="chip chip-warn">Low</span>');
  let lastYear = '';
  const list = items
    .map(({ flight: f, duplicate, dismissed: wasDismissed }, i) => {
      const year = f.date.slice(0, 4);
      const head = year !== lastYear ? `<li class="review-year">${year}</li>` : '';
      lastYear = year;
      const checked = !duplicate && !wasDismissed && f.confidence >= 0.6;
      return `${head}<li><label class="review-item ${duplicate || wasDismissed ? 'is-dup' : ''}">
        <input type="checkbox" data-i="${i}" ${checked ? 'checked' : ''} ${duplicate ? 'disabled' : ''} />
        <div style="min-width:0">
          <div class="review-route">${escapeHtml(f.from.iata)} → ${escapeHtml(f.to.iata)} <span class="flag">${flagEmoji(f.to.cc)}</span></div>
          <div class="review-meta">${escapeHtml(formatDay(f.date))}${f.dateEstimated ? ' (date estimated)' : ''} · ${escapeHtml(f.from.city)} → ${escapeHtml(f.to.city)}${f.airline?.name ? ` · ${escapeHtml(f.airline.name)}` : ''} ${escapeHtml(f.flightNo || '')}
            <br><small>${duplicate ? 'Already in your log' : wasDismissed ? 'You removed this before' : escapeHtml(f.sourceRef?.subject || '')}</small></div>
        </div>
        ${confidenceChip(f.confidence)}
      </label></li>`;
    })
    .join('');

  modal.setBody(`
    <div class="summary-grid">
      <div><strong>${formatNumber(result.scanned)}</strong><span>emails read</span></div>
      <div><strong>${formatNumber(result.matchedEmails)}</strong><span>with flights</span></div>
      <div><strong>${formatNumber(items.length)}</strong><span>unique flights</span></div>
      <div><strong>${formatNumber(fresh.length)}</strong><span>new for your log</span></div>
    </div>
    <div class="toolbar"><strong style="margin-right:auto">Review & choose what to add</strong>
      <button class="btn btn-ghost btn-sm" data-all>Select all</button><button class="btn btn-ghost btn-sm" data-none>None</button></div>
    <ul class="review-list">${list}</ul>`);
  modal.setFooter(`<span class="muted" data-count></span><span class="spacer"></span><button class="btn btn-ghost" data-close>Close</button><button class="btn btn-primary" data-add>${icons.plus} Add flights</button>`);

  const boxes = () => modal.$$('input[type="checkbox"][data-i]');
  const update = () => {
    const n = boxes().filter((b) => b.checked).length;
    modal.$('[data-count]').textContent = `${n} selected`;
    const btn = modal.$('[data-add]');
    btn.disabled = n === 0;
    btn.lastChild.textContent = ` Add ${n} ${n === 1 ? 'flight' : 'flights'}`;
  };
  modal.el.addEventListener('change', update);
  modal.$('[data-all]').addEventListener('click', () => {
    boxes().forEach((b) => !b.disabled && (b.checked = true));
    update();
  });
  modal.$('[data-none]').addEventListener('click', () => {
    boxes().forEach((b) => (b.checked = false));
    update();
  });
  update();
  if (!REDUCED) gsap.from(modal.$$('.review-item'), { y: 16, opacity: 0, stagger: 0.025, duration: 0.5 });

  modal.$('[data-add]').addEventListener('click', async () => {
    const chosen = boxes()
      .filter((b) => b.checked)
      .map((b) => items[Number(b.dataset.i)].flight);
    // The user ticked these explicitly, so previously dismissed detections are re-added.
    const res = await addFlights(chosen, { undismiss: true });
    modal.close();
    celebrate({ particleCount: 150 });
    toast({ type: 'success', title: `${res.added.length} flights added`, message: res.updated.length ? `${res.updated.length} existing flights enriched` : 'Your globe just got busier ✈', duration: 6000 });
    onDone?.();
  });
}
