import { getConfig } from '../core/config.js';

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const PROFILE_SCOPES = 'openid email profile';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let gisPromise = null;
let session = null; // { response, accessToken, expiresAt }

export class AuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'AuthError';
    this.code = code;
  }
}

const FRIENDLY = {
  popup_closed: 'The Google window was closed before finishing.',
  popup_failed_to_open: 'Your browser blocked the Google sign-in pop-up. Allow pop-ups for this site and try again.',
  access_denied: 'Permission was not granted.',
  scope_denied: 'Gmail access was not granted, so flights can’t be detected automatically.',
  not_configured: 'Google sign-in is not configured for this deployment yet (missing GOOGLE_CLIENT_ID).',
};

export function friendlyAuthMessage(err) {
  return FRIENDLY[err?.code] || err?.message || 'Something went wrong talking to Google.';
}

export function isGoogleConfigured() {
  return !!getConfig().googleClientId;
}

/** Loads Google Identity Services early so pop-ups open directly from the click. */
export function loadGis() {
  if (!isGoogleConfigured()) return Promise.reject(new AuthError('not_configured'));
  gisPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve(window.google);
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      gisPromise = null;
      reject(new AuthError('gis_failed', 'Could not reach Google. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

function requestToken({ scope, prompt = '', hint }) {
  if (!isGoogleConfigured()) return Promise.reject(new AuthError('not_configured'));
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    // Fallback when the script is not ready yet; the pop-up may then need a second click.
    return loadGis().then(() => requestToken({ scope, prompt, hint }));
  }
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: getConfig().googleClientId,
      scope,
      include_granted_scopes: true,
      prompt,
      login_hint: hint || undefined,
      callback: (response) => {
        if (response.error) {
          reject(new AuthError(response.error, response.error_description));
          return;
        }
        session = {
          response,
          accessToken: response.access_token,
          expiresAt: Date.now() + (Number(response.expires_in || 3600) - 90) * 1000,
        };
        resolve(response);
      },
      error_callback: (err) => reject(new AuthError(err?.type || 'unknown', err?.message)),
    });
    client.requestAccessToken();
  });
}

export async function fetchUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new AuthError('userinfo_failed', 'Could not read your Google profile.');
  const u = await res.json();
  return {
    sub: u.sub,
    name: u.name || u.email,
    givenName: u.given_name || (u.name || '').split(' ')[0],
    email: u.email,
    picture: u.picture || '',
    mode: 'google',
  };
}

/** Step 1 — sign in with basic profile scopes only. */
export async function signIn() {
  const response = await requestToken({ scope: PROFILE_SCOPES, prompt: 'select_account' });
  return fetchUserInfo(response.access_token);
}

export function hasGmailAccess() {
  return !!session && session.expiresAt > Date.now() && window.google?.accounts?.oauth2?.hasGrantedAllScopes(session.response, GMAIL_SCOPE);
}

/** Step 2 — incremental consent for read-only Gmail. Must be called from a click. */
export async function requestGmailAccess(hint, { force = false } = {}) {
  if (!force && hasGmailAccess()) return session.accessToken;
  const response = await requestToken({ scope: GMAIL_SCOPE, hint });
  if (!window.google.accounts.oauth2.hasGrantedAllScopes(response, GMAIL_SCOPE)) throw new AuthError('scope_denied');
  return response.access_token;
}

export function signOut() {
  const token = session?.accessToken;
  session = null;
  if (token && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {});
    } catch {
      /* best effort */
    }
  }
}
