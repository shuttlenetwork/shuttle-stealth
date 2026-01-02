/* Shader Configuration */
var path = location.pathname
var basePath = path.substring(0, path.lastIndexOf('/') + 1)

// Ensure basePath is correct even in proxied pages
if (path.includes('/calc/')) {
    basePath = path.substring(0, path.indexOf('/calc/') + 1)
}

self.__uv$config = {
  prefix: basePath + 'calc/',
  bare: basePath + 'telemetry/',
  wisp: '/ws/',
  searchEngine: 'https://duckduckgo.com/?q=%s',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: basePath + 'shader.handler.mjs',
  bundle: basePath + 'shader.bundle.mjs',
  config: basePath + 'shader.config.mjs',
  sw: basePath + 'shader.kernel.mjs',
  client: basePath + 'shader.canvas.mjs',
}
