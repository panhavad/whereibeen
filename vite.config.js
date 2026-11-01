import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

function git(args) {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

/**
 * Version shown in the app. CI/Docker pass these as env vars (the .git folder is not
 * part of the Docker build context); local builds read them straight from git.
 */
function buildInfo() {
  return {
    version: process.env.APP_VERSION || pkg.version,
    build: String(process.env.BUILD_NUMBER || git('rev-list --count HEAD') || '0'),
    sha: (process.env.GIT_SHA || git('rev-parse HEAD') || 'dev').slice(0, 7),
    date: process.env.BUILD_DATE || new Date().toISOString(),
  };
}

const info = buildInfo();

export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify(info),
  },
  plugins: [
    {
      name: 'whereibeen-version-json',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify(info, null, 2)}\n` });
      },
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'WhereIBeen — your travel globe',
        short_name: 'WhereIBeen',
        description:
          'Every flight and every city you have been to on a living 3D globe. Auto-detects flights from Gmail and places from Google Maps Timeline.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        theme_color: '#05060d',
        background_color: '#05060d',
        categories: ['travel', 'lifestyle', 'navigation'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Add a flight', short_name: 'Add flight', url: '/?action=add-flight#/globe' },
          { name: 'Add a place', short_name: 'Add place', url: '/?action=add-place#/globe' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}', 'data/{countries,airports}.json'],
        globIgnores: ['**/config.json', '**/version.json', '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-wght-*.woff2'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/config\.json$/, /^\/version\.json$/, /^\/healthz$/, /^\/data\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/data/cities.json',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'wib-geo-data', expiration: { maxEntries: 4 } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/config.json',
            handler: 'NetworkFirst',
            options: { cacheName: 'wib-runtime-config', networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'wib-fonts', expiration: { maxEntries: 30 } },
          },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2600,
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
