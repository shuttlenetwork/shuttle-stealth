import * as BareMux from './matrix/index.js'
import './shader.bundle.js'
import './shader.config.js'
import './shader.kernel.js'

self.BareMux = BareMux

const uv = new self.UVServiceWorker()
const connection = new BareMux.BareMuxConnection('./matrix/worker.js?raw=true')

let transportReady = false

async function setupTransport() {
  const wispUrl = self.__uv$config.wisp

  try {
    await connection.setTransport('./vector/index.mjs', [{ wisp: wispUrl }])
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
