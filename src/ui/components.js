import { html, raw, escapeHtml, formatDay, formatDistance, formatDuration, flagEmoji, countryName, hashString, formatNumber } from '../core/util.js';
import { isUpcoming } from '../core/flights.js';
import { airlineByCode, airlineColor } from '../data/airlines.js';
import { planeSolid, icons } from './icons.js';

export const SOURCE_LABELS = { gmail: 'Gmail', timeline: 'Maps Timeline', manual: 'Added by you', demo: 'Demo', flight: 'Flights' };

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || 'Manual';
}

function airlineOf(f) {
  if (!f.airline) return null;
  return airlineByCode(f.airline.code) || f.airline;
}

export function passHtml(f, { units = 'km', isNew = false, interactive = true } = {}) {
  const airline = airlineOf(f);
  const color = airline ? airlineColor(airline) : '#a78bfa';
  const upcoming = isUpcoming(f);
  const needsCheck = f.source === 'gmail' && (f.confidence ?? 1) < 0.7;
  const label = `${f.from.iata} to ${f.to.iata}, ${formatDay(f.date)}`;
  return html`<article class="pass ${upcoming ? 'is-upcoming' : ''} ${isNew ? 'is-new' : ''}" style="--accent:${color}"
      ${raw(interactive ? `data-flight="${escapeHtml(f.id)}" tabindex="0" role="button" data-tilt="4"` : '')} aria-label="${label}">
    <div class="pass-main">
      <header class="pass-head">
        <span class="pass-airline"><span class="pass-logo">${airline?.code || '✈'}</span>${airline?.name || 'Flight'}</span>
        <span class="pass-tags">
          ${upcoming ? raw('<span class="chip chip-warn">Upcoming</span>') : ''}
          ${needsCheck ? raw('<span class="chip chip-warn" title="Auto-detected with lower confidence">Check</span>') : ''}
          ${f.flightNo ? raw(`<span class="chip mono">${escapeHtml(f.flightNo)}</span>`) : ''}
        </span>
      </header>
      <div class="pass-route">
        <div class="pass-port">
          <span class="pass-code" data-code="${f.from.iata}">${f.from.iata}</span>
          <span class="pass-city">${f.from.city}</span>
          <span class="pass-time">${f.dep || '— —'}</span>
        </div>
        <div class="pass-path">
          <svg viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true">
            <path class="arc" d="M4 31 Q60 -9 116 31" vector-effect="non-scaling-stroke" />
          </svg>
          <span class="pass-plane" aria-hidden="true">${raw(planeSolid)}</span>
          <span class="pass-dur">${f.durationEstimated ? '≈ ' : ''}${formatDuration(f.durationMin)}</span>
        </div>
        <div class="pass-port right">
          <span class="pass-code" data-code="${f.to.iata}">${f.to.iata}</span>
          <span class="pass-city">${f.to.city}</span>
          <span class="pass-time">${f.arr ? `${f.arr}${f.arrDayOffset > 0 ? ` +${f.arrDayOffset}` : ''}` : '— —'}</span>
        </div>
      </div>
      <footer class="pass-meta">
        <div><label>Date</label><strong>${formatDay(f.date)}</strong></div>
        <div><label>Distance</label><strong>${formatDistance(f.distanceKm, units)}</strong></div>
        <div><label>${f.seat ? 'Seat' : 'Class'}</label><strong>${f.seat || f.cabin || '—'}</strong></div>
        <div><label>Source</label><strong>${sourceLabel(f.source)}</strong></div>
      </footer>
    </div>
    <div class="pass-stub">
      <span class="flag" style="font-size:1.4rem">${flagEmoji(f.to.cc)}</span>
      <div class="pass-barcode"></div>
      <span class="pass-source">${f.pnr || (upcoming ? 'Bon voyage' : 'Boarding pass')}</span>
    </div>
  </article>`;
}

const STAMP_INKS = ['#f472b6', '#a78bfa', '#38bdf8', '#fbbf24', '#2dd4bf', '#fb7185', '#818cf8', '#34d399'];
const STAMP_SHAPES = ['', 'round', 'ticket'];

export function stampHtml(country) {
  const h = hashString(country.cc);
  const ink = STAMP_INKS[h % STAMP_INKS.length];
  const shape = STAMP_SHAPES[(h >>> 3) % STAMP_SHAPES.length];
  const rot = ((h >>> 5) % 17) - 8;
  const date = country.first ? formatDay(country.first, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'VISITED';
  return html`<div class="stamp ${shape}" style="--ink:${ink};--rot:${rot}deg" data-cc="${country.cc}" title="${countryName(country.cc)}">
    <div class="stamp-inner">
      <span class="stamp-flag flag">${flagEmoji(country.cc)}</span>
      <strong class="stamp-country">${countryName(country.cc)}</strong>
      <span class="stamp-date">${date}</span>
      <span class="stamp-meta">${country.cities} ${country.cities === 1 ? 'city' : 'cities'}</span>
    </div>
  </div>`;
}

export function cityCardHtml(p) {
  const sources = [...(p.sources || [])];
  const time = p.minutes ? formatDuration(p.minutes, { long: true }) : p.days ? `${p.days} ${p.days === 1 ? 'day' : 'days'}` : '';
  return html`<button class="city-card" data-place="${p.key}">
    <span class="src">${sources.map((s) => raw(`<i class="src-${escapeHtml(s)}" title="${escapeHtml(sourceLabel(s))}"></i>`))}</span>
    <span class="flag">${flagEmoji(p.cc)}</span>
    <strong>${p.name}</strong>
    <span>${countryName(p.cc)}</span>
    <span>${formatNumber(p.visits)} ${p.visits === 1 ? 'visit' : 'visits'}${time ? ` · ${time}` : ''}</span>
  </button>`;
}

export function airportOptionHtml(a) {
  return html`<span class="code">${a.iata}</span><span class="label">${a.city}<small>${a.name}</small></span><span class="flag">${flagEmoji(a.cc)}</span>`;
}

export function cityOptionHtml(c) {
  return html`<span class="flag">${flagEmoji(c.cc)}</span><span class="label">${c.name}<small>${[c.region, countryName(c.cc)].filter(Boolean).join(', ')}</small></span><span class="muted mono" style="font-size:.72rem">${c.pop ? `${formatNumber(Math.round(c.pop / 1000))}k` : ''}</span>`;
}

export function emptyHtml({ art = '🧭', title, text, actions = '' }) {
  return html`<div class="empty"><div class="empty-art">${art}</div><h3>${title}</h3><p>${text}</p><div class="hero-cta">${raw(actions)}</div></div>`;
}

export { icons };
