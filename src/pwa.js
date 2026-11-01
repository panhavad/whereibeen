import { BUILD, describeVersion, fetchDeployedVersion, isSameBuild } from './core/version.js';
import { toast } from './ui/toast.js';

let updateSW = null;
let registration = null;
let deferredPrompt = null;
let updateReady = false;
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

export function onPwaChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function canInstall() {
  return !!deferredPrompt;
}

export function hasUpdate() {
  return updateReady;
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === 'accepted';
}

export function applyUpdate() {
  if (updateSW) updateSW(true);
  else location.reload();
}

async function showUpdateToast() {
  const deployed = await fetchDeployedVersion();
  toast({
    type: 'update',
    title: 'A new version is ready',
    message: deployed && !isSameBuild(deployed, BUILD) ? `${describeVersion(BUILD)} → ${describeVersion(deployed)}` : 'Reload to get the latest improvements.',
    duration: 0,
    actions: [
      { label: 'Later' },
      { label: 'Update now', primary: true, onClick: applyUpdate },
    ],
  });
}

/** Returns the deployed build and whether it differs from the one running. */
export async function checkForUpdates() {
  try {
    await registration?.update();
  } catch {
    /* offline */
  }
  const deployed = await fetchDeployedVersion();
  const newer = !!deployed && !isSameBuild(deployed, BUILD);
  if (newer && !registration) updateReady = true;
  notify();
  return { deployed, newer: newer || updateReady };
}

export async function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
    toast({ type: 'success', title: 'WhereIBeen installed', message: 'Find it on your home screen or app launcher.', icon: '📲' });
  });

  const syncOnline = () => document.documentElement.classList.toggle('is-offline', !navigator.onLine);
  window.addEventListener('online', () => {
    syncOnline();
    toast({ title: 'Back online', icon: '🛰️', duration: 2500 });
  });
  window.addEventListener('offline', () => {
    syncOnline();
    toast({ type: 'offline', title: 'You are offline', message: 'Your saved globe still works. Gmail scanning needs a connection.' });
  });
  syncOnline();

  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const { registerSW } = await import('virtual:pwa-register');
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      notify();
      showUpdateToast();
    },
    onOfflineReady() {
      toast({ title: 'Ready to work offline', message: 'WhereIBeen now opens even without a connection.', icon: '📦', duration: 4000 });
    },
    onRegisteredSW(_url, reg) {
      registration = reg || null;
      if (!reg) return;
      setInterval(() => reg.update().catch(() => {}), 20 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    },
  });
}
