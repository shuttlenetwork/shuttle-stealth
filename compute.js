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
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = event.request.url
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
