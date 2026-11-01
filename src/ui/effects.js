import { gsap, REDUCED, TOUCH } from './motion.js';

/* --------------------------------------------------------------- starfield */

export function startStarfield(canvas = document.getElementById('starfield')) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;
  let stars = [];
  let shooting = null;
  let nextShoot = performance.now() + 4000;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(520, Math.round((w * h) / 3600));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.2 + Math.random() * 0.8,
      r: Math.random() < 0.08 ? 1.2 + Math.random() * 0.9 : 0.35 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.8,
      hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? 200 : 280) : 0,
    }));
  };

  const draw = (now) => {
    ctx.clearRect(0, 0, w, h);
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    const scroll = window.scrollY || 0;
    const t = now / 1000;
    for (const s of stars) {
      const tw = REDUCED ? 0.8 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
      let x = s.x + mouse.x * s.z * 14;
      let y = s.y - scroll * 0.04 * s.z + mouse.y * s.z * 10;
      y = ((y % h) + h) % h;
      x = ((x % w) + w) % w;
      ctx.globalAlpha = tw * (0.35 + s.z * 0.65);
      ctx.fillStyle = s.hue ? `hsl(${s.hue} 90% 80%)` : '#fff';
      ctx.beginPath();
      ctx.arc(x, y, s.r * s.z + 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!REDUCED) {
      if (!shooting && now > nextShoot) {
        const fromLeft = Math.random() < 0.5;
        shooting = { x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5, y: Math.random() * h * 0.35, vx: (fromLeft ? 1 : -1) * (8 + Math.random() * 5), vy: 3 + Math.random() * 3, life: 1 };
        nextShoot = now + 6000 + Math.random() * 9000;
      }
      if (shooting) {
        const s = shooting;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12);
        grad.addColorStop(0, `rgba(255,255,255,${s.life})`);
        grad.addColorStop(1, 'rgba(167,139,250,0)');
        ctx.globalAlpha = 1;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 12, s.y - s.vy * 12);
        ctx.stroke();
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.018;
        if (s.life <= 0 || s.x < -100 || s.x > w + 100 || s.y > h + 100) shooting = null;
      }
    }
    ctx.globalAlpha = 1;
  };

  resize();
  window.addEventListener('resize', resize);
  if (!TOUCH) {
    window.addEventListener('pointermove', (e) => {
      mouse.tx = e.clientX / w - 0.5;
      mouse.ty = e.clientY / h - 0.5;
    });
  }
  gsap.ticker.add(() => {
    if (!document.hidden) draw(performance.now());
  });
}

/* ------------------------------------------------------------------ cursor */

export function startCursor() {
  if (TOUCH || REDUCED) return;
  const root = document.getElementById('cursor');
  if (!root) return;
  const dot = root.querySelector('.cursor-dot');
  const ring = root.querySelector('.cursor-ring');
  document.documentElement.classList.add('has-cursor');
  const pos = { x: -100, y: -100 };
  const ringPos = { x: -100, y: -100 };
  let visible = false;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pos.x = e.clientX;
    pos.y = e.clientY;
    if (!visible) {
      visible = true;
      ringPos.x = pos.x;
      ringPos.y = pos.y;
      gsap.to(root, { opacity: 1, duration: 0.3 });
    }
    const interactive = e.target.closest?.('a, button, [role="button"], input, select, textarea, label, .pass, .city-card, [data-cursor]');
    document.documentElement.classList.toggle('cursor-hover', !!interactive);
  });
  window.addEventListener('pointerdown', () => document.documentElement.classList.add('cursor-down'));
  window.addEventListener('pointerup', () => document.documentElement.classList.remove('cursor-down'));
  document.addEventListener('mouseleave', () => {
    visible = false;
    gsap.to(root, { opacity: 0, duration: 0.3 });
  });

  gsap.ticker.add(() => {
    ringPos.x += (pos.x - ringPos.x) * 0.18;
    ringPos.y += (pos.y - ringPos.y) * 0.18;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
  });
}

/* ----------------------------------------------------------------- confetti */

let confettiModule = null;
export async function celebrate(opts = {}) {
  if (REDUCED) return;
  confettiModule ??= (await import('canvas-confetti')).default;
  const colors = ['#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#ffffff'];
  const base = { particleCount: 90, spread: 75, startVelocity: 42, ticks: 220, colors, zIndex: 2000, scalar: 0.95, ...opts };
  confettiModule({ ...base, origin: { x: 0.25, y: 0.7 }, angle: 60 });
  confettiModule({ ...base, origin: { x: 0.75, y: 0.7 }, angle: 120 });
}
