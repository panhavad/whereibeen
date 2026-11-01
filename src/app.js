import { store, setProfile, replaceAllData, setSetting, exportBackup, importBackup, wipeData, hasAnyData } from './core/store.js';
import { friendlyAuthMessage, isGoogleConfigured, signIn, signOut } from './auth/google.js';
import { buildDemoData } from './data/demo.js';
import { download } from './core/util.js';
import { renderLanding } from './ui/views/landing.js';
import { renderConnect } from './ui/views/connect.js';
import { renderDashboard } from './ui/views/dashboard.js';
import { pageTransition, ScrollTrigger, gsap, REDUCED } from './ui/motion.js';
import { openFlightForm, openPlaceForm } from './ui/forms.js';
import { startGmailScan } from './ui/scan.js';
import { importTimelineFiles } from './ui/timelineImport.js';
import { closeAllModals, confirmDialog, openModal } from './ui/modal.js';
import { toast, toastError } from './ui/toast.js';
import { icons } from './ui/icons.js';

const root = document.getElementById('app');
let cleanups = [];
let currentView = null;
let lastOrigin = null;

const VIEWS = { landing: renderLanding, connect: renderConnect, globe: renderDashboard };

function routeFromHash() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  return ['connect', 'globe'].includes(h) ? h : '';
}

function resolve(route) {
  if (!store.profile) return 'landing';
  if (route) return route;
  return hasAnyData() ? 'globe' : 'connect';
}

async function render(route, { force = false } = {}) {
  const view = resolve(route);
  const wanted = view === 'landing' ? '#/' : `#/${view}`;
  if (location.hash !== wanted && !(view === 'landing' && !location.hash)) {
    const params = new URLSearchParams(location.search);
    params.delete('action');
    const qs = params.toString();
    history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${wanted}`);
  }
  if (view === currentView && !force) return;

  const draw = () => {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    ScrollTrigger.getAll().forEach((t) => t.kill());
    closeAllModals();
    // A fresh host per view drops every listener the previous view attached to it.
    const host = document.createElement('div');
    host.className = 'view';
    root.replaceChildren(host);
    currentView = view;
    VIEWS[view](host, app);
  };
  if (currentView === null) draw();
  else await pageTransition(draw, lastOrigin);
  lastOrigin = null;
}

function openSetupModal() {
  openModal({
    title: 'Connect Google sign-in',
    subtitle: 'This deployment does not have a Google OAuth client ID yet.',
    width: 560,
    body: `<p class="muted">Whoever hosts WhereIBeen needs to create a free OAuth client in Google Cloud and pass its ID:</p>
      <ul class="privacy-list">
        <li>Docker: <code class="mono">GOOGLE_CLIENT_ID=… docker compose up -d</code></li>
        <li>Local dev: put <code class="mono">VITE_GOOGLE_CLIENT_ID=…</code> in <code class="mono">.env</code></li>
      </ul>
      <p class="muted">Meanwhile you can explore the demo, or use WhereIBeen without an account (Timeline import + manual entries).</p>`,
    footer: `<button class="btn btn-ghost" data-close>Close</button><button class="btn btn-glass" data-local>Use without account</button><button class="btn btn-primary" data-demo>${icons.play} Explore demo</button>`,
  }).el.addEventListener('click', (e) => {
    if (e.target.closest('[data-demo]')) app.startDemo();
    if (e.target.closest('[data-local]')) app.continueLocal();
  });
}

function openAddChooser() {
  const modal = openModal({
    title: 'Add to your travels',
    subtitle: 'Log it by hand or let WhereIBeen find it.',
    width: 620,
    body: `<div class="chooser">
      <button class="chooser-item" data-c="flight"><span class="ico">✈️</span><strong>Add a flight</strong><span>Any flight, any year</span></button>
      <button class="chooser-item" data-c="place"><span class="ico">📍</span><strong>Add a place</strong><span>Cities, road & rail trips</span></button>
      <button class="chooser-item" data-c="scan"><span class="ico">📬</span><strong>Scan Gmail</strong><span>Find booking emails</span></button>
      <button class="chooser-item" data-c="timeline"><span class="ico">🗺️</span><strong>Import Timeline</strong><span>Google Maps export</span></button>
    </div>`,
  });
  if (!REDUCED) gsap.from(modal.$$('.chooser-item'), { y: 24, opacity: 0, scale: 0.94, stagger: 0.06, duration: 0.6, ease: 'back.out(1.6)' });
  modal.el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-c]')?.dataset.c;
    if (!c) return;
    if (c === 'scan') {
      // Start the consent pop-up while still inside the click.
      modal.close();
      app.scanGmail({});
      return;
    }
    modal.close();
    if (c === 'flight') openFlightForm();
    else if (c === 'place') openPlaceForm();
    else if (c === 'timeline') pickFiles('.json,.zip,application/json,application/zip', true).then((files) => files && importTimelineFiles(files, { onDone: () => app.navigate('globe') }));
  });
}

function pickFiles(accept, multiple = false) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => resolve(input.files?.length ? input.files : null));
    input.click();
  });
}

export const app = {
  profile: () => store.profile,
  units: () => store.data.settings.units,
  onCleanup(fn) {
    cleanups.push(fn);
  },
  navigate(route, event) {
    if (event?.clientX !== undefined && event.clientX !== 0) lastOrigin = { x: event.clientX, y: event.clientY };
    const target = route === 'landing' ? '#/' : `#/${route}`;
    if (location.hash === target) render(route === 'landing' ? '' : route);
    else location.hash = target;
  },

  async signInWithGoogle(event) {
    if (!isGoogleConfigured()) return openSetupModal();
    try {
      const profile = await signIn();
      await setProfile(profile);
      toast({ title: `Welcome, ${profile.givenName || profile.name}!`, message: 'Next: choose where WhereIBeen should look for your trips.', icon: '👋' });
      app.navigate(hasAnyData() ? 'globe' : 'connect', event);
    } catch (err) {
      if (err.code !== 'popup_closed') toast({ type: 'error', title: 'Sign-in failed', message: friendlyAuthMessage(err), duration: 8000 });
    }
  },

  async startDemo(event) {
    try {
      await setProfile({ sub: 'demo', name: 'Alex Rivera', givenName: 'Alex', mode: 'demo' });
      if (!hasAnyData()) {
        const demo = await buildDemoData();
        await replaceAllData({ flights: demo.flights, places: demo.places, sources: {}, dismissed: [], settings: { units: 'km' } });
      }
      app.navigate('globe', event);
      setTimeout(() => toast({ title: 'Welcome to the demo ✈', message: 'Try “Replay journey”, the year filters and the passport below.', icon: '🎬', duration: 6500 }), 2200);
    } catch (err) {
      toastError(err, 'Could not start the demo');
    }
  },

  async continueLocal(event) {
    await setProfile({ sub: 'local', name: 'Traveller', givenName: 'Traveller', mode: 'local' });
    app.navigate(hasAnyData() ? 'globe' : 'connect', event);
  },

  scanGmail(options = {}) {
    if (!isGoogleConfigured()) return openSetupModal();
    if (store.profile?.mode === 'demo') {
      toast({ title: 'Sign in to scan your own Gmail', message: 'The demo uses sample data.', icon: '🔐' });
      return app.signInWithGoogle();
    }
    startGmailScan({ ...options, onDone: () => app.navigate('globe') });
  },

  openAddChooser,

  async menuAction(action) {
    switch (action) {
      case 'sources':
        return app.navigate('connect');
      case 'add-flight':
        return openFlightForm();
      case 'add-place':
        return openPlaceForm();
      case 'units':
        await setSetting('units', store.data.settings.units === 'km' ? 'mi' : 'km');
        return toast({ title: `Distances now in ${store.data.settings.units === 'km' ? 'kilometres' : 'miles'}`, icon: '📏', duration: 2500 });
      case 'export': {
        const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' });
        download(`whereibeen-backup-${new Date().toISOString().slice(0, 10)}.json`, blob);
        return toast({ title: 'Backup downloaded', message: 'Keep it somewhere safe — it restores everything.', icon: '💾' });
      }
      case 'import': {
        const files = await pickFiles('.json,application/json');
        if (!files) return;
        try {
          const res = await importBackup(JSON.parse(await files[0].text()));
          return toast({ type: 'success', title: 'Backup restored', message: `${res.flights} new flights, ${res.places} places merged.` });
        } catch (err) {
          return toastError(err, 'Could not restore backup');
        }
      }
      case 'wipe': {
        const ok = await confirmDialog({
          title: 'Delete all travel data?',
          message: 'Every flight, place and import on this device will be erased. Export a backup first if you might want it back.',
          confirmLabel: 'Delete everything',
          danger: true,
        });
        if (!ok) return;
        await wipeData();
        toast({ title: 'All data deleted', icon: '🧹' });
        return app.navigate('connect');
      }
      case 'signout': {
        const wasDemo = store.profile?.mode === 'demo';
        signOut();
        await setProfile(null);
        toast({ title: wasDemo ? 'Demo closed' : 'Signed out', message: wasDemo ? '' : 'Your data stays on this device until you delete it.', icon: '👋' });
        return app.navigate('landing');
      }
      default:
        return undefined;
    }
  },
};

export function startApp() {
  // Read PWA shortcut actions (?action=add-flight) before routing rewrites the URL.
  const action = new URLSearchParams(location.search).get('action');
  window.addEventListener('hashchange', () => render(routeFromHash()));
  render(routeFromHash());

  if (action) {
    history.replaceState(null, '', location.pathname + location.hash);
    if (store.profile) setTimeout(() => (action === 'add-place' ? openPlaceForm() : openFlightForm()), 900);
  }
}
