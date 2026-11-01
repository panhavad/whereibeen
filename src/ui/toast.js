import { gsap, REDUCED } from './motion.js';
import { escapeHtml } from '../core/util.js';

const ICONS = { info: '✨', success: '🎉', error: '⚠️', update: '🚀', offline: '📡' };

/**
 * Shows a toast. actions: [{ label, primary, onClick }]. duration 0 keeps it open.
 */
export function toast({ title = '', message = '', type = 'info', icon, actions = [], duration = 4800 } = {}) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <div class="toast-icon">${escapeHtml(icon || ICONS[type] || ICONS.info)}</div>
    <div class="toast-body">${title ? `<strong>${escapeHtml(title)}</strong>` : ''}${message ? `<span>${escapeHtml(message)}</span>` : ''}</div>
    <div class="toast-actions"></div>
    ${duration ? '<div class="toast-progress"></div>' : ''}`;
  const actionsEl = el.querySelector('.toast-actions');
  actions.forEach((a) => {
    const btn = document.createElement('button');
    btn.className = `btn btn-sm ${a.primary ? 'btn-primary' : 'btn-ghost'}`;
    btn.textContent = a.label;
    btn.addEventListener('click', () => {
      a.onClick?.();
      if (a.keepOpen !== true) close();
    });
    actionsEl.appendChild(btn);
  });
  if (!actions.length) {
    const x = document.createElement('button');
    x.className = 'btn btn-ghost btn-icon btn-sm';
    x.setAttribute('aria-label', 'Dismiss');
    x.innerHTML = '&times;';
    x.addEventListener('click', () => close());
    actionsEl.appendChild(x);
  }
  root.appendChild(el);

  let closed = false;
  let timer = null;
  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    gsap.to(el, { opacity: 0, y: 16, scale: 0.96, duration: REDUCED ? 0 : 0.35, ease: 'power2.in', onComplete: () => el.remove() });
  }

  gsap.from(el, { opacity: 0, y: 30, scale: 0.94, duration: REDUCED ? 0 : 0.6, ease: 'back.out(1.6)' });
  if (duration) {
    gsap.fromTo(el.querySelector('.toast-progress'), { scaleX: 1 }, { scaleX: 0, duration: duration / 1000, ease: 'none' });
    timer = setTimeout(close, duration);
    el.addEventListener('pointerenter', () => clearTimeout(timer));
    el.addEventListener('pointerleave', () => {
      if (!closed) timer = setTimeout(close, 1800);
    });
  }
  return { close, el };
}

export const toastError = (err, title = 'Something went wrong') =>
  toast({ type: 'error', title, message: err?.message || String(err || ''), duration: 7000 });
