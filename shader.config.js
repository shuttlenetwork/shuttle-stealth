/* Shader Configuration */
self.__uv$config = {
    prefix: '/calc/',
    bare: '/telemetry/',
    wisp: '/ws/',
    searchEngine: 'https://duckduckgo.com/?q=%s',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/shader.handler.js',
    bundle: '/shader.bundle.js',
    config: '/shader.config.js',
    sw: '/shader.kernel.js',
    client: '/shader.canvas.js',
};