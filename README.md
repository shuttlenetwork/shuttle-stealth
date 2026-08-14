# Shuttle Stealth

"Shuttle Stealth" is a static, single-page web proxy application that provides a "Virtual Browser" experience: a tabbed browser UI whose navigation is proxied through a Service Worker. It is built on the **Vector** proxy engine (a UV-style bundle) with a **BareMux** transport connection and **Wisp** protocol support.

> This README was audited from repository evidence (commit `2512b3c`, branch `master`) on 2026-08-13. Facts below were verified against the source; anything unverified is marked `TODO`/`Unknown` rather than invented.

---

## Purpose & Status

- **Purpose**: Client-side web proxy ("Virtual Browser") with a tabbed interface, iframe-based browsing surfaces, bookmarks, theming, and a new-tab page. Proxied requests are handled by a Service Worker (`compute.js`) using the Vector/UV proxy engine.
- **Monetization/analytics integrations** (verified in source):
  - Google Publisher Tag (GPT) H5 rewarded ad integration in `shader-canvas.js` (ad unit path `/22921845643/H5_Game_Rewarded`).
  - Plausible analytics script in `index.html` (`stats.senty.com.au`, `data-domain="shuttle-stealth"`).
  - Startup popup URL configured in `index.html` (`shuttleApp.startupPopupUrl`).
- **Status**: No CI, no releases/tags, no version file in the repository. Live deployment status is **Unknown** — `project.json` lists the domain `shuttle-stealth.vercel.app`, but the deployed instance was not verified as part of this audit (`TODO`).

## Stack

- **Type**: Static frontend only — plain HTML/CSS/JavaScript (ES modules). No server-side code, no database.
- **UI**: `index.html` + **Alpine.js** (loaded from `unpkg.com`) for reactive UI state.
- **Proxy engine**: Vendored **Vector** library (`vector/`, `shader.bundle.mjs`) with UV-style client/handler/sw modules (`shader.canvas.mjs`, `shader.handler.mjs`, `shader.kernel.mjs`).
- **Transport**: **BareMux** v2.1.6 (build `4b7607b`, vendored in `matrix/`) connecting to a remote **Wisp** server.
- **Tooling**: None — no `package.json`, no Node.js/Composer detected (`project.json`), no build step, no lint/test tooling.

## Prerequisites

- A modern browser with **Service Worker** and **SharedWorker** support (service workers require a secure context — `localhost` or HTTPS).
- Any static file server to serve the repository directory.
- Reachable proxy backends: the app expects a **Bare**-compatible server at the `telemetry/` path and a **Wisp** server at `/ws/` (relative to the deployed origin; see `shader.config.mjs`). These backends are **not part of this repository** — provisioning them is `TODO`/environment-specific.
- No runtime environment variables, secrets, or API keys are required.

## Setup

No installation is required — serve the directory with any static file server:

```bash
# from the repository root
python3 -m http.server 8080
# or
npx serve .
```

Open `http://localhost:8080` in your browser. On first load the page registers the Service Worker and reloads itself once (`shader-client.js`). Note that the app's pre-configured proxy backends (`/telemetry/`, `/ws/`) may not be available on your own host — serving the UI locally works, but proxied navigation depends on those endpoints (`TODO`).

## Environment Variables

**None.** This project is fully static; there are no environment variables, `.env` files, or secrets in the repository. The only configuration is `shader.config.mjs` (path/prefix settings — no credentials).

## Dev / Build / Test

- **Build**: None. Files are served as-is; there is no bundler, transpiler, or build step.
- **Dev workflow**: Edit files and refresh the browser; hard-refresh or re-register the Service Worker (`compute.js`) after changes since the SW is cached per scope.
- **Test**: No test suite exists (`TODO`). Validation is manual: load the page, confirm `ShaderClient` initializes (ready state), tabs open, and proxied navigation works.
- **Lint/format**: No configured linting or formatting tooling (`TODO`).

## Architecture

| File/Dir | Role (verified) |
|---|---|
| `index.html` | Main entry point / UI: Alpine.js app state (`shuttleApp`), tab bar, bookmarks, themes (dark/light/system), new-tab page, startup popup, Plausible analytics, GPT ad markup. |
| `shader-client.js` | `ShaderClient`: loads BareMux (`matrix/index.mjs`) and Vector libs, sets the Wisp transport via BareMux, registers the Service Worker, encodes/decodes proxy URLs. |
| `shader-canvas.js` | `ShaderCanvas`: multi-tab manager ("Virtual Browser" controller) — iframe lifecycle, tab switching, event bubbling; includes the GPT H5 rewarded-ad injection code. |
| `compute.js` | Service Worker (registered as a **module** worker, scope `./`): imports BareMux + Vector bundle/config/kernel, configures the Vector transport, and answers `fetch` events for URLs under the proxy prefix. |
| `shader.config.mjs` | Proxy configuration: prefix `calc/`, bare server `telemetry/`, Wisp `/ws/`, DuckDuckGo search template, XOR URL codec (`Vector.codec.xor`), asset paths. |
| `shader.bundle.mjs` | Vendored Vector/UV bundle (`uv.bundle.js`) — defines the `self.Vector` global. |
| `shader.canvas.mjs` | UV client (`uv.client.js`) — defines `self.ShaderCanvas` / `self.UVClient`; includes BareMux v2.1.6. |
| `shader.handler.mjs` | UV handler (`uv.handler.js`) — request handling/rewriting. |
| `shader.kernel.mjs` | UV service worker (`uv.sw.js`) — defines `self.UVServiceWorker`. |
| `matrix/` | Vendored **BareMux** library (`index.js`/`index.mjs`, `worker.js`) used for transport bridging. |
| `vector/` | Vendored **Vector** transport module (`index.js`/`index.mjs`) used as the BareMux remote transport with Wisp. |
| `shuttle.png` | Favicon. |
| `GEMINI.md` | Internal project overview/conventions document. |
| `project.json` | Repo metadata (stack: static/html; domain: `shuttle-stealth.vercel.app`). |

**Flow**: `index.html` → `shader-client.js` loads BareMux + Vector, registers SW → `compute.js` (SW) intercepts requests under the `calc/` prefix → proxies via Vector/UV handler through the BareMux transport to the Wisp/Bare backends → iframes in `shader-canvas.js` render proxied pages in tabs.

## Deployment

- This is a **static site**: deployable to any static host/CDN (Vercel, Netlify, Railway, Render, S3, etc.) by publishing the repository contents.
- The repository contains **no platform configuration files** (no `vercel.json`, `netlify.toml`, `railway.json`, `render.yaml`, `Dockerfile`) — the previous README's "one-click deploy" buttons are **unverified** (`TODO`).
- `project.json` references `shuttle-stealth.vercel.app` as the known domain.
- The **Bare and Wisp backends** referenced by `shader.config.mjs` (`telemetry/`, `/ws/`) must be hosted and reachable from the deployed origin for proxying to work; they are not part of this repo (`TODO`).
- Service Worker registration uses `scope: './'`, so the app also works when hosted in a subdirectory.

## Maintenance Notes

- **`.mjs` + `?raw=true` convention**: shared libraries use `.mjs` extensions for stable delivery via module CDNs (e.g. `esm.sh`); scripts that must run as classic scripts are fetched with `?raw=true` (see `shader-client.js` `loadScript`/worker fetch).
- **Global dependencies**: Vector/UV scripts expect `self.Vector`, `self.ShaderCanvas`, `self.UVClient`, `self.UVServiceWorker`, `self.__uv$config`, and `self.__uv$cookies` to be defined globally — keep load order intact (`bundle` → `config` → `canvas`/`handler`/`kernel`).
- **Service Worker**: always register with `scope: './'`; `compute.js` must stay a module worker.
- **Path resolution**: use `new URL(path, location.href).href` for absolute path resolution in workers so assets resolve regardless of hosting depth.
- **Code integrity**: avoid placeholders like `...` when editing minified sources (see `GEMINI.md`).
- **Monetization knobs**: GPT rewarded ad unit path in `shader-canvas.js` (`YOUR_H5_ADS.rewardedUnitPath`), startup popup URL and Plausible `data-domain` in `index.html`.
- **Config changes**: proxy prefix/bare/wisp endpoints are edited in `shader.config.mjs`; changing them requires updating both the page and the Service Worker (deploy + SW re-registration).

## License

This project is open-source. See the repository for license details.

> Audit note: no `LICENSE` file or explicit license text is present in the repository, and no separate credits section exists — the statement above is preserved from the original README.
