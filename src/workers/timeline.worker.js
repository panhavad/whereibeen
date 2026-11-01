import { unzipSync, strFromU8 } from 'fflate';
import { aggregateTimeline, extractTimeline } from '../sources/timeline.js';
import { loadAirports, loadCities } from '../core/datasets.js';

const RELEVANT = /(semantic location history\/.*\.json$|records\.json$|timeline\.json$|location-history\.json$|timeline_export\.json$)/i;
// V8 cannot build strings longer than ~512 MB; stay well below to leave room for JSON.parse.
const MAX_JSON_BYTES = 400 * 1024 * 1024;

function decode(name, bytes) {
  if (bytes.length > MAX_JSON_BYTES) {
    throw new Error(`${name} is too large to read in the browser (${Math.round(bytes.length / 1048576)} MB). Export Timeline from your phone or use the Semantic Location History files instead.`);
  }
  return strFromU8(bytes);
}

self.onmessage = async (event) => {
  const post = (message) => self.postMessage(message);
  try {
    post({ type: 'progress', phase: 'reading' });
    const docs = [];
    const skipped = [];
    for (const file of event.data.files) {
      const bytes = new Uint8Array(file.buffer);
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
      if (!isZip) {
        docs.push({ name: file.name, bytes });
        continue;
      }
      // First pass only lists entries (no decompression) so we can pick the cheapest useful ones.
      const entries = [];
      unzipSync(bytes, {
        filter: (entry) => {
          if (RELEVANT.test(entry.name)) entries.push(entry);
          return false;
        },
      });
      const hasSemantic = entries.some((e) => /semantic location history\//i.test(e.name));
      const wanted = new Set(
        entries
          .filter((e) => {
            const raw = /records\.json$/i.test(e.name);
            if ((raw && hasSemantic) || e.originalSize > MAX_JSON_BYTES) {
              skipped.push(e.name);
              return false;
            }
            return true;
          })
          .map((e) => e.name),
      );
      const extracted = unzipSync(bytes, { filter: (entry) => wanted.has(entry.name) });
      for (const [name, data] of Object.entries(extracted)) docs.push({ name, bytes: data });
    }
    if (!docs.length) throw new Error('No Timeline data was found in that file.');

    const extracts = [];
    for (const [i, doc] of docs.entries()) {
      post({ type: 'progress', phase: 'parsing', done: i, total: docs.length });
      let json;
      try {
        json = JSON.parse(decode(doc.name, doc.bytes));
      } catch (err) {
        if (/too large/.test(err.message)) throw err;
        continue;
      }
      doc.bytes = null;
      const extract = extractTimeline(json);
      if (extract.format) extracts.push({ ...extract, file: doc.name.split('/').pop() });
    }
    if (!extracts.length) {
      throw new Error('That file doesn’t look like a Google Maps Timeline export (Timeline.json, location-history.json or a Takeout ZIP).');
    }

    post({ type: 'progress', phase: 'locating' });
    const [cities, airports] = await Promise.all([loadCities(), loadAirports()]);
    const result = aggregateTimeline(extracts, { cities, airports });
    if (!result.places.length && !result.flights.length) {
      throw new Error('The export was read correctly but contains no visits or flights yet.');
    }
    result.summary.skipped = skipped;
    post({ type: 'done', result });
  } catch (err) {
    post({ type: 'error', message: err?.message || String(err) });
  }
};
