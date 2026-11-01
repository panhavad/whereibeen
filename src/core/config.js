const runtime = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
};

/**
 * Docker images read GOOGLE_CLIENT_ID at container start and serve it as /config.json,
 * so one image works for any domain. Local dev falls back to VITE_GOOGLE_CLIENT_ID.
 */
export async function loadConfig() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      const json = await res.json();
      if (typeof json.googleClientId === 'string' && json.googleClientId.trim()) runtime.googleClientId = json.googleClientId.trim();
    }
  } catch {
    /* offline or no runtime config: keep build-time values */
  }
  return runtime;
}

export function getConfig() {
  return runtime;
}
