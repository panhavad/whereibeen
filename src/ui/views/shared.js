import { brandMark, icons } from '../icons.js';
import { VERSION_LONG, buildDateLabel } from '../../core/version.js';
import { openAbout, openIosInstallHint } from '../about.js';
import { canInstall, hasUpdate, isIos, isStandalone, onPwaChange, promptInstall } from '../../pwa.js';
import { escapeHtml } from '../../core/util.js';
import { gsap } from '../motion.js';

export function footerHtml() {
  return `<footer class="footer">
    <div class="footer-links">
      <a class="brand" href="#/" aria-label="WhereIBeen">${brandMark('ft')}<span class="brand-name">Where<b>I</b>Been</span></a>
      <span>Every flight. Every city.</span>
      <a href="#/" data-act="about">About &amp; updates</a>
    </div>
    <button class="version-pill" data-act="about" title="Built ${escapeHtml(buildDateLabel())}">${escapeHtml(VERSION_LONG)}</button>
    <p class="footer-attrib">Airports © OurAirports (public domain) · Cities © GeoNames (CC BY 4.0) · Countries © Natural Earth · Flag emoji © Twemoji (CC BY 4.0). Your travel data stays on this device.</p>
  </footer>`;
}

/** Nav background on scroll, About links and update dots. Returns a cleanup fn. */
export function bindChrome(root, app) {
  const nav = root.querySelector('[data-nav]');
  const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="about"]')) {
      e.preventDefault();
      openAbout();
    }
  });
  const sync = () => root.querySelectorAll('.version-pill').forEach((p) => p.classList.toggle('has-update', hasUpdate()));
  const off = onPwaChange(sync);
  sync();
  app.onCleanup(() => {
    window.removeEventListener('scroll', onScroll);
    off();
  });
}

export function avatarHtml(profile, size = 40) {
  if (profile?.picture) {
    return `<img class="avatar" src="${escapeHtml(profile.picture)}" alt="" width="${size}" height="${size}" referrerpolicy="no-referrer" style="width:${size}px;height:${size}px" />`;
  }
  const initial = (profile?.givenName || profile?.name || '✈').trim().charAt(0).toUpperCase();
  return `<span class="avatar" style="width:${size}px;height:${size}px">${escapeHtml(initial)}</span>`;
}

export function userButtonHtml(profile) {
  return `<div class="user-wrap"><button class="user-btn" data-user aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">${avatarHtml(profile, 40)}</button></div>`;
}

/** Account dropdown. `items` callbacks come from the app controller. */
export function bindUserMenu(root, app) {
  const btn = root.querySelector('[data-user]');
  if (!btn) return;
  const wrap = btn.parentElement;
  let menu = null;

  const close = () => {
    if (!menu) return;
    const m = menu;
    menu = null;
    btn.setAttribute('aria-expanded', 'false');
    gsap.to(m, { opacity: 0, y: -8, scale: 0.97, duration: 0.2, onComplete: () => m.remove() });
  };

  const open = () => {
    const p = app.profile();
    const units = app.units();
    const modeLabel = p?.mode === 'demo' ? 'Demo mode' : p?.mode === 'local' ? 'Local only (no Google account)' : escapeHtml(p?.email || '');
    menu = document.createElement('div');
    menu.className = 'menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <div class="menu-head">${avatarHtml(p, 42)}<div><strong>${escapeHtml(p?.name || 'Traveller')}</strong><span>${modeLabel}</span></div></div>
      <button class="menu-item" data-m="sources">${icons.layers} Sources & imports</button>
      <button class="menu-item" data-m="add-flight">${icons.plane} Add a flight</button>
      <button class="menu-item" data-m="add-place">${icons.pin} Add a place</button>
      <button class="menu-item" data-m="units">${icons.globe} Distance in ${units === 'km' ? 'miles' : 'kilometres'}</button>
      <div class="menu-sep"></div>
      <button class="menu-item" data-m="export">${icons.download} Export backup</button>
      <button class="menu-item" data-m="import">${icons.upload} Restore backup</button>
      ${canInstall() || (isIos() && !isStandalone()) ? `<button class="menu-item" data-m="install">${icons.install} Install app</button>` : ''}
      <button class="menu-item" data-m="about">${icons.info} About & updates${hasUpdate() ? ' <span class="chip chip-warn" style="margin-left:auto">New</span>' : ''}</button>
      <div class="menu-sep"></div>
      <button class="menu-item danger" data-m="wipe">${icons.trash} Delete all my data</button>
      <button class="menu-item" data-m="signout">${icons.logout} ${p?.mode === 'demo' ? 'Exit demo' : 'Sign out'}</button>
      <div class="menu-version"><span>${escapeHtml(VERSION_LONG)}</span><span>${escapeHtml(buildDateLabel())}</span></div>`;
    wrap.appendChild(menu);
    btn.setAttribute('aria-expanded', 'true');
    gsap.fromTo(menu, { opacity: 0, y: -10, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'expo.out' });
    menu.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-m]')?.dataset.m;
      if (!action) return;
      close();
      if (action === 'install') {
        if (canInstall()) await promptInstall();
        else openIosInstallHint();
      } else if (action === 'about') openAbout();
      else app.menuAction(action);
    });
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu ? close() : open();
  });
  const outside = (e) => {
    if (menu && !wrap.contains(e.target)) close();
  };
  const esc = (e) => e.key === 'Escape' && close();
  document.addEventListener('click', outside);
  document.addEventListener('keydown', esc);
  app.onCleanup(() => {
    document.removeEventListener('click', outside);
    document.removeEventListener('keydown', esc);
  });
}
