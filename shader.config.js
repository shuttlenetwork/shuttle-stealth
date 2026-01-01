/* Shader Configuration */
var path = location.pathname
var basePath = path.substring(0, path.lastIndexOf('/') + 1)

self.__uv$config = {
  prefix: basePath + 'calc/',
  bare: basePath + 'telemetry/',
  wisp: '/ws/',
  searchEngine: 'https://duckduckgo.com/?q=%s',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: basePath + 'shader.handler.js',
  bundle: basePath + 'shader.bundle.js',
  config: basePath + 'shader.config.js',
  sw: basePath + 'shader.kernel.js',
  client: basePath + 'shader.canvas.js',
}
