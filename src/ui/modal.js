import { gsap, lockScroll, REDUCED } from './motion.js';
import { icons } from './icons.js';
import { escapeHtml } from '../core/util.js';

const stack = [];

function isSheet() {
  return window.matchMedia('(max-width: 640px)').matches;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    const top = stack[stack.length - 1];
    if (top.dismissible) top.close();
  }
});

/**
 * Opens a modal (desktop) / bottom sheet (mobile).
 * body/footer are HTML strings built with the escaping html`` helper.
 */
export function openModal({ title = '', subtitle = '', body = '', footer = '', width, className = '', dismissible = true, onClose } = {}) {
  const layer = document.createElement('div');
  layer.className = `modal-layer ${className}`;
  layer.innerHTML = `
    <div class="modal-backdrop"></div>
    <section class="modal" role="dialog" aria-modal="true" ${title ? 'aria-labelledby="modal-title"' : ''} style="${width ? `--modal-w:${width}px` : ''}">
      <div class="sheet-handle" aria-hidden="true"></div>
      ${title || dismissible ? `<header class="modal-head">
        <div>${title ? `<h2 id="modal-title">${escapeHtml(title)}</h2>` : ''}${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
        ${dismissible ? `<button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close">${icons.close}</button>` : ''}
      </header>` : ''}
      <div class="modal-body" data-lenis-prevent>${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </section>`;
  document.getElementById('modal-root').appendChild(layer);
  const panel = layer.querySelector('.modal');
  const backdrop = layer.querySelector('.modal-backdrop');
  const previousFocus = document.activeElement;
  lockScroll(true);

  const sheet = isSheet();
  gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: REDUCED ? 0 : 0.4 });
  gsap.fromTo(
    panel,
    sheet ? { yPercent: 100 } : { y: 40, scale: 0.96, opacity: 0 },
    { yPercent: 0, y: 0, scale: 1, opacity: 1, duration: REDUCED ? 0 : 0.65, ease: 'expo.out', clearProps: 'transform' },
  );

  let closed = false;
  const api = {
    el: panel,
    layer,
    dismissible,
    close(result) {
      if (closed) return;
      closed = true;
      stack.splice(stack.indexOf(api), 1);
      lockScroll(false);
      gsap.to(backdrop, { opacity: 0, duration: REDUCED ? 0 : 0.3 });
      gsap.to(panel, {
        ...(isSheet() ? { yPercent: 100 } : { y: 30, scale: 0.97, opacity: 0 }),
        duration: REDUCED ? 0 : 0.35,
        ease: 'power2.in',
        onComplete: () => {
          layer.remove();
          previousFocus?.focus?.({ preventScroll: true });
        },
      });
      onClose?.(result);
    },
    setBody(htmlString) {
      panel.querySelector('.modal-body').innerHTML = htmlString;
    },
    setFooter(htmlString) {
      let foot = panel.querySelector('.modal-foot');
      if (!foot) {
        foot = document.createElement('footer');
        foot.className = 'modal-foot';
        panel.appendChild(foot);
      }
      foot.innerHTML = htmlString;
    },
    $(selector) {
      return panel.querySelector(selector);
    },
    $$(selector) {
      return [...panel.querySelectorAll(selector)];
    },
  };
  stack.push(api);

  if (dismissible) backdrop.addEventListener('click', () => api.close());
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) api.close();
  });

  if (sheet && dismissible) enableSheetDrag(panel, api);

  requestAnimationFrame(() => {
    const focusable = panel.querySelector('[autofocus], input:not([type=hidden]), select, textarea, .modal-foot .btn-primary');
    (focusable || panel.querySelector('button'))?.focus({ preventScroll: true });
  });
  return api;
}

function enableSheetDrag(panel, api) {
  const handleZone = panel.querySelector('.modal-head') || panel.querySelector('.sheet-handle');
  let startY = null;
  let dy = 0;
  const onMove = (e) => {
    if (startY === null) return;
    dy = Math.max(0, e.clientY - startY);
    panel.style.transform = `translateY(${dy}px)`;
  };
  const onUp = () => {
    if (startY === null) return;
    startY = null;
    if (dy > 110) api.close();
    else gsap.to(panel, { y: 0, duration: 0.4, ease: 'expo.out', onComplete: () => (panel.style.transform = '') });
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  [handleZone, panel.querySelector('.sheet-handle')].forEach((zone) =>
    zone?.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input, a')) return;
      startY = e.clientY;
      dy = 0;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    }),
  );
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const modal = openModal({
      title,
      body: `<p class="muted">${escapeHtml(message)}</p>`,
      footer: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${escapeHtml(confirmLabel)}</button>`,
      width: 460,
      onClose: () => !answered && resolve(false),
    });
    modal.$('[data-ok]').addEventListener('click', () => {
      answered = true;
      resolve(true);
      modal.close();
    });
  });
}

export function closeAllModals() {
  [...stack].reverse().forEach((m) => m.close());
}
