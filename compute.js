import * as BareMux from './matrix/index.mjs'
import './shader.bundle.mjs'
import './shader.config.mjs'
import './shader.kernel.mjs'

self.BareMux = BareMux
const uv = new self.UVServiceWorker()
const connection = new BareMux.BareMuxConnection('./matrix/worker.js?raw=true')

let transportReady = false

async function setupTransport() {
  const wispUrl = self.__uv$config.wisp

  try {
    const transportUrl = new URL('./vector/index.mjs', self.location.href).href
    await connection.setTransport(transportUrl, [{ wisp: wispUrl }])
    console.log('[SW] Vector transport configured (Remote):', wispUrl)
    transportReady = true
  } catch (err) {
    console.error('[SW] Failed to set Wisp transport:', err)
  }
}

const transportPromise = setupTransport()

// ── Sanitized game snapshots ──────────────────────────────────────────
// The page fetches + sanitizes game wrappers and stores them in CacheStorage
// under ./game-serve/... so games run at a real same-origin URL instead of
// about:srcdoc. Games that parse location.* (host checks, query strings,
// pathname) crash or misbehave under about:srcdoc.
const GAME_SERVE_PREFIX = new URL('./game-serve/', self.location.href).href
const GAME_SERVE_CACHE = 'shuttle-game-serve'

// Same-origin proxies for remote resources that games cannot fetch directly:
// - game-worker/<enc>...  cross-origin Worker scripts (the page rewrites
//   `new Worker(remoteUrl)`) plus relative fetches inside those workers;
// - game-asset/<marker>/<enc>...  remote asset files that need a literal
//   marker in their path (e.g. UnityLoader's progress handler requires a
//   "/Build/" segment in the responseURL of its downloads).
// In both cases every segment of the remote URL is individually encoded so
// real slashes survive: worker code that derives its own directory (e.g.
// emscripten's scriptDirectory via lastIndexOf('/')) and then fetches
// same-dir assets keeps working through the SW.
const GAME_WORKER_PREFIX = new URL('./game-worker/', self.location.href).href
const GAME_ASSET_PREFIX = new URL('./game-asset/', self.location.href).href

async function serveProxiedAsset(request, forWorker) {
  try {
    const reqUrl = new URL(request.url)
    const prefix = forWorker ? GAME_WORKER_PREFIX : GAME_ASSET_PREFIX
    const rest = reqUrl.pathname.slice(new URL(prefix).pathname.length)
    if (!rest) return new Response('missing proxy url', { status: 404 })
    const segments = rest.split('/')
    if (!forWorker) segments.shift() // drop the marker segment (e.g. Build)
    const target = segments.map((seg) => decodeURIComponent(seg)).join('/')
    if (!/^https?:\/\//.test(target)) return new Response('bad proxy url', { status: 400 })
    const upstream = await fetch(target, { mode: 'cors', credentials: 'omit' })
    if (!upstream.ok) return new Response('proxy: upstream ' + upstream.status, { status: 502 })
    let mime = upstream.headers.get('content-type') || 'application/octet-stream'
    if (target.endsWith('.wasm')) mime = 'application/wasm'
    else if (/\.m?js$/.test(target)) mime = 'text/javascript; charset=utf-8'
    const headers = new Headers()
    headers.set('Content-Type', mime)
    headers.set('Cache-Control', 'no-cache')
    return new Response(upstream.body, { headers })
  } catch (err) {
    return new Response('proxy error: ' + err.message, { status: 502 })
  }
}

async function serveGameSnapshot(request) {
  try {
    const cache = await caches.open(GAME_SERVE_CACHE)
    let hit = await cache.match(request)
    if (!hit) {
      const plain = new URL(request.url)
      plain.search = ''
      hit = await cache.match(plain.href)
    }
    if (hit) return hit
  } catch (err) {
    console.error('[SW] game-serve cache error:', err)
  }
  return new Response(
    '<!doctype html><html><head><meta charset="utf-8"><title>Game expired</title><style>body{margin:0;height:100vh;display:grid;place-items:center;background:#0a0c0f;color:#fff;font-family:Inter,system-ui,sans-serif}.card{max-width:520px;padding:18px;border:1px solid rgba(255,255,255,.15);border-radius:14px}</style></head><body><div class="card">This game snapshot has expired. Close this tab and reopen the game.</div></body></html>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

// Make the already-open app page controlled by this SW (required for the
// game-serve iframes to be intercepted on first load).
self.addEventListener('install', (event) => {
  // Replace any previously deployed SW right away. Old SWs (pre game-serve)
  // keep controlling pages across redeploys, and they let game-serve/
  // requests fall through to the static host -> 404 instead of the game.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = event.request.url
  if (url.startsWith(GAME_WORKER_PREFIX)) {
    event.respondWith(serveProxiedAsset(event.request, true))
    return
  }
  if (url.startsWith(GAME_ASSET_PREFIX)) {
    event.respondWith(serveProxiedAsset(event.request, false))
    return
  }
  if (url.startsWith(GAME_SERVE_PREFIX)) {
    event.respondWith(serveGameSnapshot(event.request))
    return
  }
  if (url.startsWith(location.origin + self.__uv$config.prefix)) {
    event.respondWith(
      (async () => {
        await transportPromise
        return await uv.fetch(event)
      })()
    )
  }
})
