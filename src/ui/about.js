import { BUILD, buildDateLabel, describeVersion } from '../core/version.js';
import { applyUpdate, canInstall, checkForUpdates, isIos, isStandalone, promptInstall } from '../pwa.js';
import { escapeHtml } from '../core/util.js';
import { brandMark, icons } from './icons.js';
import { openModal } from './modal.js';

export function openAbout() {
  const modal = openModal({
    title: 'About WhereIBeen',
    width: 560,
    body: `
      <div class="about-head">${brandMark('about')}<div>
        <span class="muted">You're running</span>
        <strong class="about-version">v${escapeHtml(BUILD.version)}</strong>
        <span class="mono muted">build ${escapeHtml(BUILD.build)} · commit ${escapeHtml(BUILD.sha)}</span>
      </div></div>
      <div class="detail-grid">
        <div class="detail-row"><span>Built</span><strong>${escapeHtml(buildDateLabel())}</strong></div>
        <div class="detail-row"><span>Server</span><strong data-server>Checking…</strong></div>
        <div class="detail-row"><span>Mode</span><strong>${isStandalone() ? 'Installed app' : 'Browser tab'}</strong></div>
      </div>
      <p class="muted" style="font-size:.86rem">WhereIBeen processes Gmail and Timeline data entirely in your browser. Nothing is uploaded; your travel log lives in this device's storage until you delete it.</p>
      <p class="muted" style="font-size:.76rem">Airports: OurAirports (public domain) · Cities: GeoNames (CC BY 4.0) · Countries: Natural Earth · Flags: Twemoji (CC BY 4.0) · Globe: globe.gl / three.js</p>`,
    footer: `
      <button class="btn btn-glass" data-install ${canInstall() || (isIos() && !isStandalone()) ? '' : 'hidden'}>${icons.install} Install app</button>
      <span class="spacer"></span>
      <button class="btn btn-ghost" data-check>${icons.refresh} Check for updates</button>
      <button class="btn btn-primary hidden" data-update>${icons.sparkles} Update now</button>`,
  });

  const server = modal.$('[data-server]');
  const check = async () => {
    server.textContent = 'Checking…';
    const { deployed, newer } = await checkForUpdates();
    if (!deployed) server.textContent = 'Unavailable (offline or dev server)';
    else if (newer) {
      server.innerHTML = `<span style="color:var(--c4)">Update available · ${escapeHtml(describeVersion(deployed))}</span>`;
      modal.$('[data-update]').classList.remove('hidden');
    } else server.innerHTML = `<span style="color:var(--ok)">✓ Up to date</span>`;
  };
  check();
  modal.$('[data-check]').addEventListener('click', check);
  modal.$('[data-update]').addEventListener('click', applyUpdate);
  modal.$('[data-install]')?.addEventListener('click', async () => {
    if (canInstall()) await promptInstall();
    else openIosInstallHint();
  });
}

export function openIosInstallHint() {
  openModal({
    title: 'Install on iPhone or iPad',
    width: 480,
    body: `<ol class="howto-list">
      <li>Tap the <b>Share</b> button in Safari's toolbar.</li>
      <li>Scroll and choose <b>Add to Home Screen</b>.</li>
      <li>Tap <b>Add</b> — WhereIBeen opens full-screen like a native app.</li></ol>`,
    footer: '<button class="btn btn-primary" data-close>Got it</button>',
  });
}
