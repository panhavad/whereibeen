import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import Lenis from 'lenis';
import { isTouchDevice, prefersReducedMotion } from '../core/util.js';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);
gsap.defaults({ ease: 'power3.out', duration: 0.9 });

export { gsap, ScrollTrigger, SplitText };

export const REDUCED = prefersReducedMotion();
export const TOUCH = isTouchDevice();

/* ------------------------------------------------------------ smooth scroll */

let lenis = null;

export function initSmoothScroll() {
  if (REDUCED || TOUCH || lenis) return lenis;
  lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function scrollToTarget(target, offset = -70) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: REDUCED ? 'auto' : 'smooth' });
}

export function scrollToTop(immediate = true) {
  if (lenis) lenis.scrollTo(0, { immediate });
  else window.scrollTo({ top: 0, behavior: 'auto' });
}

let locks = 0;
export function lockScroll(lock) {
  locks = Math.max(0, locks + (lock ? 1 : -1));
  const locked = locks > 0;
  document.body.classList.toggle('modal-open', locked);
  if (lenis) locked ? lenis.stop() : lenis.start();
}

/* -------------------------------------------------------------- page wipe */

export async function pageTransition(render, origin) {
  const wipe = document.getElementById('wipe');
  if (REDUCED || !wipe) {
    await render();
    return;
  }
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  wipe.style.opacity = '1';
  await gsap.fromTo(
    wipe,
    { clipPath: `circle(0% at ${x}px ${y}px)` },
    { clipPath: `circle(150% at ${x}px ${y}px)`, duration: 0.75, ease: 'power3.inOut' },
  );
  await render();
  scrollToTop();
  await gsap.to(wipe, { opacity: 0, duration: 0.6, ease: 'power2.out', delay: 0.05 });
  wipe.style.clipPath = 'circle(0% at 50% 50%)';
}

/* ---------------------------------------------------------------- counting */

export function countUp(el, to, { from = 0, duration = 1.8, format = (v) => Math.round(v).toLocaleString(), delay = 0 } = {}) {
  if (!el) return null;
  if (REDUCED) {
    el.textContent = format(to);
    return null;
  }
  const state = { v: from };
  return gsap.to(state, {
    v: to,
    duration,
    delay,
    ease: 'power3.out',
    onUpdate: () => (el.textContent = format(state.v)),
  });
}

/** Tweens from the number currently displayed to a new one (used when filters change). */
export function retarget(el, to, format) {
  if (!el) return;
  const current = Number(el.dataset.value ?? 0);
  el.dataset.value = String(to);
  countUp(el, to, { from: current, duration: 1.1, format });
}

export function scramble(el, text, { duration = 0.9, delay = 0 } = {}) {
  if (!el) return;
  if (REDUCED) {
    el.textContent = text;
    return;
  }
  gsap.to(el, { duration, delay, scrambleText: { text, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', speed: 0.7, revealDelay: 0.25 } });
}

/* ------------------------------------------------------------------ reveal */

export function revealOnScroll(root = document) {
  const items = [...root.querySelectorAll('[data-reveal]:not([data-revealed])')];
  if (!items.length) return;
  items.forEach((el) => (el.dataset.revealed = '1'));
  if (REDUCED) return;
  gsap.set(items, { opacity: 0, y: 46, filter: 'blur(8px)' });
  ScrollTrigger.batch(items, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, stagger: 0.08, ease: 'power3.out', clearProps: 'filter,transform' }),
  });
}

export function splitReveal(el, { delay = 0, stagger = 0.025 } = {}) {
  if (!el || REDUCED) return null;
  const split = SplitText.create(el, { type: 'lines,words,chars', linesClass: 'line', charsClass: 'char', mask: 'lines' });
  // background-clip:text can't paint through transformed children, so each char gets
  // its own slice of the gradient while animating; the split is reverted afterwards.
  const gradients = [...el.querySelectorAll('.grad-text')];
  for (const g of gradients) {
    const box = g.getBoundingClientRect();
    const image = getComputedStyle(g).backgroundImage;
    g.style.background = 'none';
    for (const c of split.chars) {
      if (!g.contains(c)) continue;
      const r = c.getBoundingClientRect();
      Object.assign(c.style, {
        backgroundImage: image,
        backgroundSize: `${box.width * 2}px ${box.height}px`,
        backgroundPosition: `${box.left - r.left}px ${box.top - r.top}px`,
        backgroundRepeat: 'no-repeat',
        webkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      });
    }
  }
  return gsap.from(split.chars, {
    yPercent: 115,
    rotateX: -60,
    opacity: 0,
    duration: 1.1,
    ease: 'expo.out',
    stagger,
    delay,
    transformOrigin: '50% 100%',
    onComplete: () => {
      split.revert();
      gradients.forEach((g) => (g.style.background = ''));
    },
  });
}

/* -------------------------------------------------------------- hover fx */

export function magnetize(root = document) {
  if (TOUCH || REDUCED) return;
  root.querySelectorAll('[data-magnetic]:not([data-mag-ready])').forEach((el) => {
    el.dataset.magReady = '1';
    const strength = Number(el.dataset.magnetic) || 0.3;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)' });
    });
  });
}

export function tiltify(root = document) {
  if (TOUCH || REDUCED) return;
  root.querySelectorAll('[data-tilt]:not([data-tilt-ready])').forEach((el) => {
    el.dataset.tiltReady = '1';
    el.classList.add('tilt');
    if (!el.querySelector(':scope > .shine')) el.insertAdjacentHTML('beforeend', '<span class="shine"></span>');
    const max = Number(el.dataset.tilt) || 7;
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3.out' });
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      ry((px - 0.5) * max * 2);
      rx(-(py - 0.5) * max * 2);
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      rx(0);
      ry(0);
    });
  });
}

export function enhance(root = document) {
  magnetize(root);
  tiltify(root);
  revealOnScroll(root);
}
