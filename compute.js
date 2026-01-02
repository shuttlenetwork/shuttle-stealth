importScripts('./matrix/index.js?raw=true')
importScripts('./shader.bundle.js?raw=true')
importScripts('./shader.config.js?raw=true')
importScripts('./shader.kernel.js?raw=true')

const uv = new self.UVServiceWorker()
const connection = new self.BareMux.BareMuxConnection('./matrix/worker.js?raw=true')

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

self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith(location.origin + self.__uv$config.prefix)) {
    event.respondWith(
      (async () => {
        await transportPromise
        return await uv.fetch(event)
      })()
    )
  }
})
