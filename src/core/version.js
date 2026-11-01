/* global __BUILD_INFO__ */
export const BUILD =
  typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : { version: '0.0.0', build: '0', sha: 'dev', date: new Date().toISOString() };

export const VERSION_SHORT = `v${BUILD.version}`;
export const VERSION_LONG = `v${BUILD.version} · build ${BUILD.build} · ${BUILD.sha}`;

export function buildDateLabel(info = BUILD) {
  const d = new Date(info.date);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function describeVersion(info) {
  return info ? `v${info.version} · build ${info.build} · ${info.sha}` : '';
}

/** Version currently deployed on the server (written at build time as /version.json). */
export async function fetchDeployedVersion() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function isSameBuild(a, b) {
  return !!a && !!b && a.version === b.version && a.sha === b.sha && String(a.build) === String(b.build);
}
