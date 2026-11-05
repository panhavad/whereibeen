# WhereIBeen ✈🌍

**Every flight. Every city. One living globe.**

WhereIBeen is an animated, installable web app that turns your travel history into a 3D globe. It
finds flight bookings in your **Gmail**, reads the places in your **Google Maps Timeline** export,
and lets you add anything it couldn't detect. Then it shows off how far you've flown, how long you
were in the air, every city and country you've been to, and replays your journeys flight by flight.

- 🌐 **Living 3D globe** — dotted-hex continents, animated flight arcs, pulsing cities, visited countries lit up
- 📬 **Gmail flight detection** — airline & travel-agency confirmations (schema.org data + multilingual text parsing: EN/KO/JA/ZH), de-duplicated across bookings, check-ins, changes and cancellations; you review every result
- 📍 **Google Maps Timeline import** — Android `Timeline.json`, iPhone `location-history.json`, or a Takeout ZIP; visits become cities/time spent and "flying" segments become flights
- ✍️ **Manual entry** — flights (airport autocomplete for ~9,000 airports, live boarding-pass preview) and places (46,000 cities or your current location)
- 📊 **Stats** — distance (× around the Earth, % to the Moon), hours in the air, time zones crossed, countries, continents, airlines, longest flight, favourite route, flights per year, year filters
- 🎬 **Journey replay** — the camera flies through every trip in order while a plane draws each arc
- 🛂 **Passport stamps**, 🎫 **boarding-pass flight log**, 🖼️ **shareable poster**
- 📱 **Responsive + PWA** — mobile tab bar & bottom sheets, installable, works offline, prompts when a new version is deployed
- 🔒 **Private by design** — everything runs in the browser; email content is never uploaded or stored
- 🏷️ **Version shown in the app** — footer, account menu and *About & updates* (`v1.0.0 · build 12 · a1b2c3d`)

---

## Quick start (development)

Requirements: Node.js 20.19+ (24 LTS recommended).

```bash
npm install
cp .env.example .env        # put your Google client ID in VITE_GOOGLE_CLIENT_ID
npm run dev                 # http://localhost:5173
```

Without a client ID you can still use **Explore the demo** or **start without an account**
(Timeline import + manual entries).

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm test` | Unit tests (email parser, Timeline importer, merge/stats logic) |
| `npm run build` | Production build to `dist/` (includes the service worker and `version.json`) |
| `npm run preview` | Serve the production build locally |
| `npm run data` | Re-download and regenerate the airport/city/country datasets in `public/data/` |
| `npm run icons` | Regenerate PWA icons from `public/favicon.svg` |

---

## Google setup (Sign-in + Gmail permission)

WhereIBeen uses Google Identity Services in the browser — there is no backend. Sign-in asks only
for your basic profile; Gmail access (`gmail.readonly`) is requested separately, the first time you
press **Allow Gmail & scan**.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. **APIs & Services → Library**: enable the **Gmail API**.
3. **Google Auth Platform → Branding / Audience** (OAuth consent screen): choose *External*.
   While the app is in **Testing**, add yourself (and friends, up to 100) under **Test users**.
4. **Data access** (scopes): add `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   and `.../auth/gmail.readonly`.
5. **Clients → Create client → Web application**. Under **Authorized JavaScript origins** add every
   origin you serve from, e.g. `http://localhost:5173`, `http://localhost:8080`,
   `https://travel.example.com`. No redirect URIs are needed.
6. Copy the client ID (`…apps.googleusercontent.com`) into `VITE_GOOGLE_CLIENT_ID` (dev) or
   `GOOGLE_CLIENT_ID` (Docker).

> `gmail.readonly` is a *restricted* scope. For personal use keep the app in Testing mode with test
> users. Publishing it for everyone requires Google's verification and security assessment.

### Why Google Maps data is a file import

Since 2024 Google stores Maps **Timeline on your phone**, and there is no web API or OAuth
permission that exposes it. Export it once and drop the file into **Sources**:

- **Android:** Settings → Location → Location services → Timeline → **Export Timeline data** (`Timeline.json`)
- **iPhone:** Google Maps → profile picture → Settings → Personal content / Location & privacy → **Export Timeline data** (`location-history.json`)
- **Older history:** [Google Takeout](https://takeout.google.com) → *Location History (Timeline)* → drop the ZIP

The file is parsed in a Web Worker on your device; re-importing replaces the previous Timeline import.

---

## Deploy with Docker

The image is a static build served by unprivileged nginx (port **8080**) with security headers, a
strict CSP, long-term caching for hashed assets, a `/healthz` endpoint, and SPA routing. The Google
client ID is injected **at container start**, so one image works on any domain:

```bash
docker build -t whereibeen .
docker run -d -p 8080:8080 -e GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com whereibeen
```

Unit tests run inside the image build — a failing commit never produces an image.

> Google sign-in and installable PWAs need **HTTPS** (except on `localhost`). Put WhereIBeen behind
> your usual reverse proxy (Caddy, Traefik, nginx, Cloudflare Tunnel…) and add that HTTPS origin
> to the OAuth client.

### Auto-update on every git commit

Pick one of the two modes.

#### A. GitHub Actions → GHCR → Watchtower (recommended)

1. Push this repository to GitHub (default branch `main`).
2. `.github/workflows/docker-publish.yml` runs on every push: tests → multi-arch build
   (amd64/arm64) → pushes `ghcr.io/<owner>/<repo>` tagged `latest`, `1.0.0-build.<n>` and `sha-<commit>`
   (plus `X.Y.Z` when you push a `vX.Y.Z` tag).
3. On your server:

   ```bash
   cp .env.example .env    # set GOOGLE_CLIENT_ID and WHEREIBEEN_IMAGE=ghcr.io/<owner>/<repo>:latest
   docker compose up -d
   ```

[Watchtower](https://github.com/nicholas-fedor/watchtower) (the maintained fork — the original
`containrrr/watchtower` is archived and fails on Docker 29+) checks the registry every
`WATCHTOWER_POLL_INTERVAL` seconds and restarts the app on the new image. Only containers labelled
`com.centurylinklabs.watchtower.enable=true` are touched. For a private package, run
`docker login ghcr.io` on the server and uncomment the `config.json` mount in `docker-compose.yml`.

**Flow:** `git push` → CI (≈3–5 min) → Watchtower pulls within a minute → open tabs show
*"A new version is ready"* → users get the new version.

#### B. Self-hosted build + git watcher (no registry, no CI)

```bash
git clone <your repo> whereibeen && cd whereibeen
cp .env.example .env
docker compose -f docker-compose.selfhost.yml up -d --build
```

The `updater` sidecar watches the checkout every `AUTO_UPDATE_INTERVAL` seconds. When `HEAD`
changes — a commit made in that checkout, or new commits on `origin/<AUTO_UPDATE_BRANCH>` which it
fetches and fast-forwards (`AUTO_UPDATE_FETCH=true`) — it rebuilds and restarts only the `web`
service with the new version info. If the build or tests fail, the running version stays up.

```bash
docker logs -f whereibeen-updater
# [updater …] New commits on origin/main - fast-forwarding
# [updater …] Deploying v1.0.0 build 13 (a1b2c3d): Add flight notes
# [updater …] Live: v1.0.0 build 13
```

The updater mounts the Docker socket; run it only on hosts you control. Git runs as the owner of
the checkout, so the host working copy never ends up with root-owned files.

---

## Versioning

The app shows `v<version> · build <n> · <sha>` in the footer, the account menu and
**About & updates** (which also compares against the server's `/version.json` and offers *Update now*).

| Part | Source |
| --- | --- |
| `version` | `version` in `package.json` — bump it for releases (`npm version minor`) |
| `build` | number of commits on the branch (`git rev-list --count HEAD`) — increases with every commit |
| `sha` | short commit hash |

Locally these come from git; in Docker/CI they're passed as build args (`APP_VERSION`,
`BUILD_NUMBER`, `GIT_SHA`, `BUILD_DATE`) because `.git` isn't in the build context.

## Progressive Web App

- Install from the browser menu, the account menu (**Install app**) or *Add to Home Screen* on iOS.
- The app shell, fonts, airports and country shapes are precached — the globe and your saved log work offline.
- The service worker checks for a new deployment every 20 minutes and whenever the app is reopened,
  then shows **"A new version is ready → Update now"** instead of reloading under you.
- App shortcuts: *Add a flight*, *Add a place*.

## Privacy

- No backend: Gmail is called directly from your browser with a short-lived token kept in memory.
- Email bodies are parsed in memory and discarded; only the flights you approve are saved.
- Your log lives in this browser's IndexedDB. **Export backup** / **Restore backup** / **Delete all my data** are in the account menu.
- Revoke Gmail access any time at <https://myaccount.google.com/permissions>.

## Project structure

```
src/
  auth/google.js            Google Identity Services: sign-in + incremental Gmail consent
  sources/gmail.js          Gmail search & fetch (rate-limit aware), MIME/charset decoding
  sources/flightParser.js   schema.org JSON-LD/microdata + heuristic flight extraction
  sources/timeline.js       Android / iOS / Takeout Timeline parsing & city aggregation
  workers/timeline.worker.js  runs the Timeline import off the main thread
  core/                     store (IndexedDB), flights (tz-aware durations), merge/dedupe, stats, datasets
  ui/                       globe (globe.gl), views, replay, forms, modals, motion (GSAP + Lenis)
  pwa.js                    service worker registration, update prompt, install prompt
deploy/                     nginx config, runtime-config entrypoint, git auto-updater
scripts/build-data.mjs      dataset generator
tests/                      Vitest unit tests
```

## Data & credits

- Airports: [OurAirports](https://ourairports.com/data/) (public domain) + time zones from [mwgg/Airports](https://github.com/mwgg/Airports) (MIT)
- Cities: [GeoNames](https://www.geonames.org/) (CC BY 4.0)
- Countries: [Natural Earth](https://www.naturalearthdata.com/) (public domain)
- Flag emoji on Windows: [Twemoji](https://github.com/jdecked/twemoji) via `country-flag-emoji-polyfill` (CC BY 4.0)
- Globe: [globe.gl](https://github.com/vasturiano/globe.gl) / three.js · Animation: [GSAP](https://gsap.com) & [Lenis](https://lenis.darkroom.engineering)
#   w h e r e i b e e n  
 