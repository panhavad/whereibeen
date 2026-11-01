import { loadCountries } from '../core/datasets.js';
import { interpolateGreatCircle } from '../core/geo.js';
import { download, formatNumber } from '../core/util.js';
import { VERSION_SHORT } from '../core/version.js';
import { icons } from './icons.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

const W = 1080;
const H = 1350;

function project(lat, lng, box) {
  return [box.x + ((lng + 180) / 360) * box.w, box.y + ((90 - lat) / 180) * box.h];
}

function fillCountries(ctx, features, box, filter) {
  ctx.beginPath();
  for (const f of features) {
    if (!filter(f)) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        ring.forEach(([lng, lat], i) => {
          const [x, y] = project(lat, lng, box);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
    }
  }
  ctx.fill();
}

async function renderCard({ stats, name, yearLabel, units }) {
  const { features } = await loadCountries();
  try {
    await Promise.all([document.fonts.load('700 80px "Space Grotesk Variable"'), document.fonts.load('600 30px "Inter Variable"')]);
  } catch {
    /* fall back to system fonts */
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#070918');
  bg.addColorStop(1, '#120a2a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [[880, 160, 520, 'rgba(124,92,255,0.28)'], [120, 1150, 560, 'rgba(56,189,248,0.16)'], [900, 1200, 420, 'rgba(244,114,182,0.14)']]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
  }

  ctx.fillStyle = '#b9bfe2';
  ctx.font = '600 30px "Inter Variable", system-ui, sans-serif';
  ctx.fillText(`${yearLabel} · TRAVEL STORY`, 72, 120);
  ctx.font = '700 84px "Space Grotesk Variable", system-ui, sans-serif';
  const grad = ctx.createLinearGradient(72, 0, 1000, 0);
  grad.addColorStop(0, '#38bdf8');
  grad.addColorStop(0.5, '#a78bfa');
  grad.addColorStop(1, '#f472b6');
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${name}'s world`, 72, 216);

  // Dotted world map, visited countries lit.
  const box = { x: 60, y: 300, w: 960, h: 480 };
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  const visited = new Set(stats.countries.map((c) => c.cc));
  mctx.fillStyle = '#ff0000';
  fillCountries(mctx, features, box, (f) => !visited.has(f.properties.iso2));
  mctx.fillStyle = '#00ff00';
  fillCountries(mctx, features, box, (f) => visited.has(f.properties.iso2));
  const pixels = mctx.getImageData(0, 0, W, H).data;
  const step = 9;
  for (let y = box.y; y < box.y + box.h; y += step) {
    for (let x = box.x; x < box.x + box.w; x += step) {
      const idx = (Math.round(y) * W + Math.round(x)) * 4;
      if (pixels[idx + 3] < 128) continue;
      const lit = pixels[idx + 1] > 128;
      ctx.fillStyle = lit ? grad : 'rgba(170,185,255,0.22)';
      ctx.beginPath();
      ctx.arc(x, y, lit ? 3 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.lineCap = 'round';
  for (const f of stats.flights) {
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = 'rgba(167,139,250,0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    let prev = null;
    for (let i = 0; i <= 48; i++) {
      const p = interpolateGreatCircle(f.from, f.to, i / 48);
      const [x, y] = project(p.lat, p.lng, box);
      if (!prev || Math.abs(x - prev[0]) > box.w / 2) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      prev = [x, y];
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  const cells = [
    [formatNumber(stats.count), 'flights'],
    [formatNumber(Math.round(units === 'mi' ? stats.km / 1.609344 : stats.km)), units === 'mi' ? 'miles flown' : 'km flown'],
    [formatNumber(stats.countries.length), 'countries'],
    [formatNumber(stats.places.length), 'cities'],
    [`${Math.round(stats.minutes / 60)}h`, 'in the air'],
    [`${stats.earthLaps.toFixed(1)}×`, 'around Earth'],
  ];
  cells.forEach(([value, label], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 72 + col * 320;
    const y = 900 + row * 170;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = 'rgba(160,174,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 296, 146, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '700 62px "Space Grotesk Variable", system-ui, sans-serif';
    ctx.fillText(value, x + 26, y + 80);
    ctx.fillStyle = '#9aa1c9';
    ctx.font = '600 26px "Inter Variable", system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), x + 26, y + 120);
  });

  ctx.fillStyle = '#7c84ad';
  ctx.font = '600 26px "Inter Variable", system-ui, sans-serif';
  ctx.fillText(`WhereIBeen ${VERSION_SHORT} · ${location.host}`, 72, H - 64);
  return canvas;
}

export async function openShareCard({ stats, name = 'My', year = 'all', units = 'km' }) {
  if (!stats.count && !stats.places.length) {
    toast({ title: 'Nothing to share yet', message: 'Add a few flights or places first.', icon: '🧳' });
    return;
  }
  const yearLabel = year === 'all' ? 'ALL TIME' : year;
  const canvas = await renderCard({ stats, name, yearLabel, units });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const file = new File([blob], `whereibeen-${year}.png`, { type: 'image/png' });
  const canShare = navigator.canShare?.({ files: [file] });
  const modal = openModal({
    title: 'Share your travel story',
    subtitle: 'A poster of your year in travel — perfect for stories.',
    width: 560,
    body: `<img src="${url}" alt="Travel stats poster" style="width:100%;border-radius:18px;border:1px solid var(--line)" />`,
    footer: `<button class="btn btn-glass" data-dl>${icons.download} Download</button>${canShare ? `<button class="btn btn-primary" data-share>${icons.share} Share</button>` : ''}`,
    onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000),
  });
  modal.$('[data-dl]').addEventListener('click', () => download(file.name, blob));
  modal.$('[data-share]')?.addEventListener('click', async () => {
    try {
      await navigator.share({ files: [file], title: 'My travel story', text: `${stats.count} flights · ${stats.countries.length} countries — made with WhereIBeen` });
    } catch {
      /* user cancelled */
    }
  });
}
