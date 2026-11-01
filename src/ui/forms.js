import { airportSnapshot, loadAirports, loadCities } from '../core/datasets.js';
import { CABINS, createFlight, normalizeFlightNo } from '../core/flights.js';
import { deleteFlight, deletePlace, restoreFlight, restorePlace, saveFlight, savePlace, store } from '../core/store.js';
import { countryName, escapeHtml, flagEmoji, todayISO } from '../core/util.js';
import { airlineByCode, searchAirlines } from '../data/airlines.js';
import { combobox } from './combobox.js';
import { airportOptionHtml, cityOptionHtml, passHtml } from './components.js';
import { celebrate } from './effects.js';
import { icons } from './icons.js';
import { confirmDialog, openModal } from './modal.js';
import { toast, toastError } from './toast.js';
import { gsap } from './motion.js';

const airportLabel = (a) => (a ? `${a.iata} · ${a.city}` : '');

function knownCountries() {
  const set = new Set();
  for (const f of store.data.flights) set.add(f.to.cc).add(f.from.cc);
  for (const p of store.data.places) set.add(p.cc);
  return set;
}

/* -------------------------------------------------------------- flights */

export async function openFlightForm(existing = null) {
  const airports = await loadAirports();
  const units = store.data.settings.units;
  let from = existing?.from || null;
  let to = existing?.to || null;
  let airline = existing?.airline || null;

  const modal = openModal({
    title: existing ? 'Edit flight' : 'Add a flight',
    subtitle: existing ? 'Fix anything the robots got wrong.' : 'Missing a trip? Log it in a few seconds.',
    width: 780,
    body: `
      <div class="form-preview" data-preview></div>
      <div class="field-row route-row">
        <div class="field combo"><label for="ff-from">From</label><input class="input" id="ff-from" placeholder="City or airport code" value="${escapeHtml(airportLabel(from))}" /></div>
        <button type="button" class="btn btn-glass btn-icon btn-sm swap-btn" data-swap aria-label="Swap airports">⇄</button>
        <div class="field combo"><label for="ff-to">To</label><input class="input" id="ff-to" placeholder="City or airport code" value="${escapeHtml(airportLabel(to))}" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="ff-date">Date</label><input class="input" type="date" id="ff-date" value="${escapeHtml(existing?.date || todayISO())}" required /></div>
        <div class="field"><label for="ff-dep">Departs (local)</label><input class="input" type="time" id="ff-dep" value="${escapeHtml(existing?.dep || '')}" /></div>
        <div class="field"><label for="ff-arr">Arrives (local)</label><input class="input" type="time" id="ff-arr" value="${escapeHtml(existing?.arr || '')}" /></div>
      </div>
      <div class="field-row">
        <div class="field combo"><label for="ff-airline">Airline</label><input class="input" id="ff-airline" placeholder="e.g. Korean Air" value="${escapeHtml(airline?.name || '')}" /></div>
        <div class="field"><label for="ff-no">Flight number</label><input class="input mono" id="ff-no" placeholder="KE703" value="${escapeHtml(existing?.flightNo || '')}" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="ff-cabin">Class</label><select class="select" id="ff-cabin"><option value="">—</option>${CABINS.map((c) => `<option ${existing?.cabin === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label for="ff-seat">Seat</label><input class="input mono" id="ff-seat" placeholder="32A" value="${escapeHtml(existing?.seat || '')}" /></div>
        <div class="field"><label for="ff-pnr">Booking ref</label><input class="input mono" id="ff-pnr" placeholder="ABC123" value="${escapeHtml(existing?.pnr || '')}" /></div>
      </div>
      <div class="field"><label for="ff-notes">Notes</label><textarea class="textarea" id="ff-notes" placeholder="Window seat, saw the northern lights…">${escapeHtml(existing?.notes || '')}</textarea></div>
      <p class="field-error" data-error></p>`,
    footer: `
      ${existing ? `<button class="btn btn-danger" data-delete>${icons.trash} Delete</button>` : ''}
      <span class="spacer"></span>
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" data-save>${icons.check} ${existing ? 'Save changes' : 'Add flight'}</button>`,
  });

  const $ = (s) => modal.$(s);
  const preview = $('[data-preview]');
  const placeholder = (code, city) => ({ iata: code, city, cc: '', lat: 0, lng: 0, name: city });

  const current = () =>
    createFlight({
      id: existing?.id || 'preview',
      from: from || placeholder('···', 'From'),
      to: to || placeholder('···', 'To'),
      date: $('#ff-date').value || todayISO(),
      dep: $('#ff-dep').value,
      arr: $('#ff-arr').value,
      airline,
      flightNo: $('#ff-no').value,
      cabin: $('#ff-cabin').value,
      seat: $('#ff-seat').value.trim().toUpperCase(),
      pnr: $('#ff-pnr').value.trim().toUpperCase(),
      notes: $('#ff-notes').value.trim(),
      source: existing?.source || 'manual',
    });

  const renderPreview = () => {
    preview.innerHTML = passHtml(current(), { units, interactive: false }).toString();
  };
  renderPreview();
  modal.el.addEventListener('input', renderPreview);
  modal.el.addEventListener('change', renderPreview);

  const airportCombo = (input, set) =>
    combobox(input, {
      search: async (q) => airports.search(q.split('·')[0], 8),
      render: (a) => airportOptionHtml(a).toString(),
      onSelect: (a) => {
        set(airportSnapshot(a));
        input.value = airportLabel(a);
        renderPreview();
        gsap.fromTo(preview.querySelectorAll('.pass-code'), { y: -8, opacity: 0.3 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05 });
      },
    });
  airportCombo($('#ff-from'), (a) => (from = a));
  airportCombo($('#ff-to'), (a) => (to = a));

  combobox($('#ff-airline'), {
    search: async (q) => {
      const found = searchAirlines(q, 7);
      return q.trim() && !found.some((a) => a.name.toLowerCase() === q.trim().toLowerCase()) ? [...found, { code: '', name: q.trim(), custom: true }] : found;
    },
    render: (a) => `<span class="code">${escapeHtml(a.code || '+')}</span><span class="label">${escapeHtml(a.custom ? `Use “${a.name}”` : a.name)}</span><span></span>`,
    onSelect: (a) => {
      airline = { code: a.code, name: a.name };
      $('#ff-airline').value = a.name;
      const no = $('#ff-no');
      if (a.code && (!no.value || /^\d+$/.test(no.value.trim()))) no.value = `${a.code}${no.value.trim()}`;
      renderPreview();
    },
  });

  $('#ff-airline').addEventListener('input', (e) => {
    if (!e.target.value.trim()) airline = null;
  });
  $('#ff-no').addEventListener('input', (e) => {
    const code = /^([A-Z0-9]{2})\d/i.exec(e.target.value.trim())?.[1]?.toUpperCase();
    const known = code && airlineByCode(code);
    if (known && (!airline || !airline.code)) {
      airline = { code: known.code, name: known.name };
      $('#ff-airline').value = known.name;
    }
  });

  $('[data-swap]').addEventListener('click', () => {
    [from, to] = [to, from];
    $('#ff-from').value = airportLabel(from);
    $('#ff-to').value = airportLabel(to);
    gsap.fromTo($('[data-swap]'), { rotate: 0 }, { rotate: 180, duration: 0.5 });
    renderPreview();
  });

  $('[data-save]').addEventListener('click', async () => {
    const error = $('[data-error]');
    if (!from || !to) return void (error.textContent = 'Pick both airports from the list.');
    if (from.iata === to.iata) return void (error.textContent = 'Departure and arrival airports must be different.');
    if (!$('#ff-date').value) return void (error.textContent = 'Add the flight date.');
    const before = knownCountries();
    try {
      const flight = current();
      const saved = await saveFlight({ ...flight, id: existing?.id, flightNo: flight.flightNo ? normalizeFlightNo(flight.flightNo) : '' });
      modal.close();
      const newCountry = !before.has(saved.to.cc);
      toast({
        type: 'success',
        title: existing ? 'Flight updated' : `${saved.from.iata} → ${saved.to.iata} added`,
        message: newCountry ? `New country unlocked: ${flagEmoji(saved.to.cc)} ${countryName(saved.to.cc)}` : `${saved.from.city} to ${saved.to.city}`,
        icon: newCountry ? flagEmoji(saved.to.cc) : '✈️',
      });
      if (!existing) celebrate({ particleCount: newCountry ? 140 : 70 });
    } catch (err) {
      toastError(err);
    }
  });

  $('[data-delete]')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete this flight?', message: `${existing.from.iata} → ${existing.to.iata} on ${existing.date} will be removed from your log.`, confirmLabel: 'Delete', danger: true }))) return;
    modal.close();
    const removed = await deleteFlight(existing.id);
    toast({ title: 'Flight deleted', message: `${removed.from.iata} → ${removed.to.iata}`, icon: '🗑️', actions: [{ label: 'Undo', primary: true, onClick: () => restoreFlight(removed) }], duration: 7000 });
  });
}

/* --------------------------------------------------------------- places */

export async function openPlaceForm(existing = null) {
  const cities = await loadCities();
  let city = existing ? { name: existing.name, cc: existing.cc, region: existing.region, lat: existing.lat, lng: existing.lng } : null;

  const modal = openModal({
    title: existing ? 'Edit place' : 'Add a place',
    subtitle: 'Road trips, train journeys and day trips count too.',
    width: 600,
    body: `
      <div class="field combo"><label for="pf-city">City</label><input class="input" id="pf-city" placeholder="Search any city…" value="${escapeHtml(city ? `${city.name}, ${countryName(city.cc)}` : '')}" /></div>
      <div class="toolbar"><button type="button" class="btn btn-glass btn-sm" data-locate>${icons.locate} Use my current location</button><span class="field-hint" data-picked>${city ? `${flagEmoji(city.cc)} ${escapeHtml(city.name)}` : ''}</span></div>
      <div class="field-row">
        <div class="field"><label for="pf-from">Arrived</label><input class="input" type="date" id="pf-from" value="${escapeHtml(existing?.first || todayISO())}" /></div>
        <div class="field"><label for="pf-to">Left</label><input class="input" type="date" id="pf-to" value="${escapeHtml(existing?.last || '')}" /></div>
      </div>
      <div class="field"><label for="pf-notes">Notes</label><textarea class="textarea" id="pf-notes" placeholder="Best ramen of my life…">${escapeHtml(existing?.notes || '')}</textarea></div>
      <p class="field-error" data-error></p>`,
    footer: `
      ${existing ? `<button class="btn btn-danger" data-delete>${icons.trash} Delete</button>` : ''}
      <span class="spacer"></span>
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" data-save>${icons.check} ${existing ? 'Save' : 'Add place'}</button>`,
  });
  const $ = (s) => modal.$(s);

  const pick = (c) => {
    city = { name: c.name, cc: c.cc, region: c.region || '', lat: c.lat, lng: c.lng };
    $('#pf-city').value = `${c.name}, ${countryName(c.cc)}`;
    $('[data-picked]').textContent = `${flagEmoji(c.cc)} ${c.name} selected`;
  };

  combobox($('#pf-city'), { search: async (q) => cities.search(q.split(',')[0], 8), render: (c) => cityOptionHtml(c).toString(), onSelect: pick });

  $('[data-locate]').addEventListener('click', () => {
    if (!navigator.geolocation) return toast({ type: 'error', title: 'Location is not available on this device' });
    const btn = $('[data-locate]');
    btn.classList.add('is-busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        btn.classList.remove('is-busy');
        const c = cities.locate(pos.coords.latitude, pos.coords.longitude);
        if (c) pick(c);
        else toast({ type: 'error', title: 'No city found near you' });
      },
      (err) => {
        btn.classList.remove('is-busy');
        toast({ type: 'error', title: 'Could not get your location', message: err.message });
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  });

  $('[data-save]').addEventListener('click', async () => {
    const error = $('[data-error]');
    if (!city) return void (error.textContent = 'Choose a city from the list.');
    const first = $('#pf-from').value || null;
    const last = $('#pf-to').value || first;
    if (first && last && last < first) return void (error.textContent = '“Left” must be after “Arrived”.');
    const isNewCountry = !knownCountries().has(city.cc);
    const days = first && last ? Math.round((new Date(last) - new Date(first)) / 86400000) + 1 : 1;
    await savePlace({ ...city, id: existing?.id, first, last, days, visits: existing?.visits || 1, minutes: existing?.minutes || 0, byYear: existing?.source === 'timeline' ? existing.byYear : undefined, notes: $('#pf-notes').value.trim(), source: existing?.source || 'manual' });
    modal.close();
    toast({ type: 'success', title: existing ? 'Place updated' : `${city.name} added`, message: isNewCountry ? `New country unlocked: ${countryName(city.cc)}` : countryName(city.cc), icon: flagEmoji(city.cc) });
    if (!existing) celebrate({ particleCount: isNewCountry ? 140 : 60 });
  });

  $('[data-delete]')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: `Remove ${existing.name}?`, message: 'It will disappear from your places and passport (flights are not affected).', confirmLabel: 'Remove', danger: true }))) return;
    modal.close();
    const removed = await deletePlace(existing.id);
    toast({ title: `${removed.name} removed`, icon: '🗑️', actions: [{ label: 'Undo', primary: true, onClick: () => restorePlace(removed) }], duration: 7000 });
  });
}
