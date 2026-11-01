import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles/base.css';
import './styles/components.css';
import './styles/views.css';
import flagFontUrl from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import { loadConfig } from './core/config.js';
import { loadData } from './core/store.js';
import { isGoogleConfigured, loadGis } from './auth/google.js';
import { startCursor, startStarfield } from './ui/effects.js';
import { initSmoothScroll } from './ui/motion.js';
import { initPwa } from './pwa.js';
import { startApp } from './app.js';
import { BUILD } from './core/version.js';

polyfillCountryFlagEmojis('Twemoji Country Flags', flagFontUrl);
startStarfield();
startCursor();
initSmoothScroll();

console.info(`%cWhereIBeen v${BUILD.version} · build ${BUILD.build} · ${BUILD.sha}`, 'color:#a78bfa;font-weight:700');

await Promise.all([loadConfig(), loadData()]);
if (isGoogleConfigured()) loadGis().catch(() => {});
startApp();
initPwa();
