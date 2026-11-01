import { store } from '../core/store.js';
import { countryName, escapeHtml, flagEmoji, formatDay, formatDistance, formatDuration, formatNumber } from '../core/util.js';
import { formatOffset, tzOffsetMinutes } from '../core/time.js';
import { isUpcoming } from '../core/flights.js';
import { passHtml, sourceLabel } from './components.js';
import { icons } from './icons.js';
import { openModal } from './modal.js';
import { openFlightForm, openPlaceForm } from './forms.js';
import { focusFlight, flyTo } from './globe.js';
import { scrollToTarget } from './motion.js';

function row(label, value) {
  return value ? `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>` : '';
}

export function openFlightDetails(flightOrId) {
  const f = typeof flightOrId === 'string' ? store.data.flights.find((x) => x.id === flightOrId) : flightOrId;
  if (!f) return;
  const units = store.data.settings.units;
  const depOffset = f.depAt ? tzOffsetMinutes(f.from.tz, new Date(f.depAt)) : null;
  const arrOffset = f.arrAt ? tzOffsetMinutes(f.to.tz, new Date(f.arrAt)) : null;
  const gmailLink = f.source === 'gmail' && f.sourceRef?.threadId ? `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(f.sourceRef.threadId)}` : null;
  const editable = f.source !== 'demo' || true;

  const modal = openModal({
    title: `${f.from.city} → ${f.to.city}`,
    subtitle: `${formatDay(f.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${isUpcoming(f) ? ' · upcoming' : ''}`,
    width: 720,
    body: `
      ${passHtml(f, { units, interactive: false })}
      <div class="detail-grid">
        ${row('Departure', `${escapeHtml(f.from.name)} <span class="muted">(${escapeHtml(f.from.iata)})</span>`)}
        ${row('Arrival', `${escapeHtml(f.to.name)} <span class="muted">(${escapeHtml(f.to.iata)})</span>`)}
        ${row('Local times', f.dep ? `${escapeHtml(f.dep)} ${depOffset !== null ? `<span class="muted">${formatOffset(depOffset)}</span>` : ''} → ${escapeHtml(f.arr || '—')} ${arrOffset !== null && f.arr ? `<span class="muted">${formatOffset(arrOffset)}</span>` : ''}` : '')}
        ${row('Duration', `${f.durationEstimated ? '≈ ' : ''}${formatDuration(f.durationMin)}${f.durationEstimated ? ' <span class="muted">(estimated)</span>' : ''}`)}
        ${row('Distance', formatDistance(f.distanceKm, units))}
        ${row('Airline', f.airline?.name ? `${escapeHtml(f.airline.name)} ${escapeHtml(f.flightNo || '')}` : escapeHtml(f.flightNo || ''))}
        ${row('Class', escapeHtml([f.cabin, f.seat && `seat ${f.seat}`].filter(Boolean).join(' · ')))}
        ${row('Booking ref', f.pnr ? `<span class="mono">${escapeHtml(f.pnr)}</span>` : '')}
        ${row('Source', `${escapeHtml(sourceLabel(f.source))}${f.source === 'gmail' ? ` · ${Math.round((f.confidence || 0) * 100)}% confidence` : ''}`)}
        ${f.sourceRef?.subject ? row('Email', `${escapeHtml(f.sourceRef.subject)}${gmailLink ? ` · <a href="${gmailLink}" target="_blank" rel="noopener">Open in Gmail ↗</a>` : ''}`) : ''}
        ${row('Notes', escapeHtml(f.notes))}
      </div>`,
    footer: `
      <button class="btn btn-glass" data-show>${icons.globe} Show on globe</button>
      <span class="spacer"></span>
      ${editable ? `<button class="btn btn-primary" data-edit>${icons.edit} Edit</button>` : ''}`,
  });

  modal.$('[data-show]').addEventListener('click', () => {
    modal.close();
    scrollToTarget('#globe', 0);
    setTimeout(() => focusFlight(f), 350);
  });
  modal.$('[data-edit]')?.addEventListener('click', () => {
    modal.close();
    openFlightForm(f);
  });
}

export function openPlaceDetails(place) {
  const stored = place.ids?.map((id) => store.data.places.find((p) => p.id === id)).filter(Boolean) || [];
  const editable = stored.find((p) => p.source === 'manual' || p.source === 'demo') || stored[0];
  const flightsHere = store.data.flights.filter((f) => f.to.cc === place.cc && f.to.city === place.name).length;
  const modal = openModal({
    title: `${flagEmoji(place.cc)} ${place.name}`,
    subtitle: [place.region, countryName(place.cc)].filter(Boolean).join(', '),
    width: 560,
    body: `
      <div class="summary-grid">
        <div><strong>${formatNumber(place.visits)}</strong><span>${place.visits === 1 ? 'visit' : 'visits'}</span></div>
        <div><strong>${place.minutes ? formatDuration(place.minutes, { long: true }) : place.days ? `${formatNumber(Number(place.days) || 0)}d` : '—'}</strong><span>time spent</span></div>
        <div><strong>${formatNumber(flightsHere)}</strong><span>flights in</span></div>
      </div>
      <div class="detail-grid">
        ${row('First visit', place.first ? formatDay(place.first) : '')}
        ${row('Latest visit', place.last && place.last !== place.first ? formatDay(place.last) : '')}
        ${row('Sources', [...(place.sources || [])].map((s) => escapeHtml(sourceLabel(s))).join(', '))}
        ${row('Notes', escapeHtml(stored.map((p) => p.notes).filter(Boolean).join(' · ')))}
      </div>`,
    footer: `
      <button class="btn btn-glass" data-show>${icons.globe} Show on globe</button>
      <span class="spacer"></span>
      ${editable ? `<button class="btn btn-primary" data-edit>${icons.edit} ${editable.source === 'timeline' ? 'Edit / remove' : 'Edit'}</button>` : ''}`,
  });
  modal.$('[data-show]').addEventListener('click', () => {
    modal.close();
    scrollToTarget('#globe', 0);
    setTimeout(() => flyTo({ lat: place.lat, lng: place.lng, altitude: 1.1 }), 350);
  });
  modal.$('[data-edit]')?.addEventListener('click', () => {
    modal.close();
    openPlaceForm(editable);
  });
}
