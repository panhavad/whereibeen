import { applyTimelineImport, store } from '../core/store.js';
import { countryName, escapeHtml, flagEmoji, formatDay, formatNumber } from '../core/util.js';
import { icons } from './icons.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { celebrate } from './effects.js';
import { gsap, REDUCED } from './motion.js';

const PHASES = {
  reading: 'Opening your export…',
  parsing: 'Reading visits & trips…',
  locating: 'Matching places to cities and airports…',
};

export async function importTimelineFiles(fileList, { onDone } = {}) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const totalMb = files.reduce((n, f) => n + f.size, 0) / 1048576;

  const modal = openModal({
    title: 'Importing Google Maps Timeline',
    subtitle: `${files.map((f) => f.name).join(', ')} · ${totalMb.toFixed(1)} MB — processed on this device`,
    width: 640,
    dismissible: false,
    body: `
      <div class="import-stage">
        <div class="import-orbit" aria-hidden="true"><span>📍</span></div>
        <h3 data-phase>${PHASES.reading}</h3>
        <div class="progress"><div class="progress-fill" data-progress style="--p:.1"></div></div>
      </div>`,
    footer: '<span class="spacer"></span><button class="btn btn-ghost" data-cancel>Cancel</button>',
  });

  const worker = new Worker(new URL('../workers/timeline.worker.js', import.meta.url), { type: 'module' });
  const finish = () => worker.terminate();
  let result = null;
  const fail = (message) => {
    finish();
    modal.close();
    toast({ type: 'error', title: 'Timeline import failed', message, duration: 10000 });
  };
  modal.$('[data-cancel]').addEventListener('click', () => {
    finish();
    modal.close();
    toast({ title: 'Import cancelled', icon: '✋' });
  });

  worker.onmessage = (event) => {
    const msg = event.data;
    if (msg.type === 'progress') {
      modal.$('[data-phase]').textContent = PHASES[msg.phase] || msg.phase;
      const p = msg.phase === 'reading' ? 0.15 : msg.phase === 'parsing' ? 0.25 + 0.4 * ((msg.done || 0) / (msg.total || 1)) : 0.8;
      modal.$('[data-progress]').style.setProperty('--p', String(p));
    } else if (msg.type === 'done') {
      finish();
      result = msg.result;
      showSummary();
    } else if (msg.type === 'error') {
      fail(msg.message);
    }
  };
  worker.onerror = (err) => fail(err.message || 'The file could not be processed.');

  try {
    const buffers = await Promise.all(files.map(async (f) => ({ name: f.name, buffer: await f.arrayBuffer() })));
    worker.postMessage({ files: buffers }, buffers.map((b) => b.buffer));
  } catch (err) {
    fail(err?.message || 'The file could not be read.');
    return;
  }

  function showSummary() {
    const s = result.summary;
    const top = [...result.places].sort((a, b) => b.days - a.days || b.visits - a.visits).slice(0, 8);
    const replacing = store.data.places.some((p) => p.source === 'timeline');
    modal.setBody(`
      <div class="summary-grid">
        <div><strong>${formatNumber(s.places)}</strong><span>cities</span></div>
        <div><strong>${formatNumber(s.countries)}</strong><span>countries</span></div>
        <div><strong>${formatNumber(s.visits)}</strong><span>visits</span></div>
        <div><strong>${formatNumber(s.flights)}</strong><span>flights detected</span></div>
      </div>
      <p class="muted">${s.from ? `From ${escapeHtml(formatDay(s.from))} to ${escapeHtml(formatDay(s.to))}. ` : ''}${replacing ? 'This replaces your previous Timeline import (manual entries and Gmail flights are kept).' : ''}${s.skipped?.length ? ` Skipped ${s.skipped.length} oversized raw file(s); your semantic history was used instead.` : ''}</p>
      <div class="import-top">${top
        .map((p) => `<div class="import-city"><span class="flag">${flagEmoji(p.cc)}</span><div><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(countryName(p.cc))} · ${p.days} ${p.days === 1 ? 'day' : 'days'}</span></div></div>`)
        .join('')}</div>`);
    modal.setFooter(`<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-apply>${icons.globe} Add to my globe</button>`);
    if (!REDUCED) gsap.from(modal.$$('.summary-grid > div, .import-city'), { y: 18, opacity: 0, stagger: 0.04, duration: 0.6 });
    modal.$('[data-apply]').addEventListener('click', async () => {
      const res = await applyTimelineImport(result);
      modal.close();
      celebrate({ particleCount: 140 });
      toast({ type: 'success', title: `${formatNumber(s.places)} places imported`, message: res.added.length ? `Plus ${res.added.length} flights from your Timeline` : `${formatNumber(s.countries)} countries on your map`, icon: '📍', duration: 6000 });
      onDone?.();
    });
  }
}

/** Wires a .dropzone element (with an inner file input) to the importer. */
export function bindDropzone(zone, options) {
  const input = zone.querySelector('input[type="file"]');
  input?.addEventListener('change', () => {
    importTimelineFiles(input.files, options);
    input.value = '';
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-over');
    importTimelineFiles(e.dataTransfer.files, options);
  });
}
