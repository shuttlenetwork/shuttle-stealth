/**
 * ShaderCanvas - Multi-tab manager for ShaderClient instances.
 * Acts as the "Virtual Browser" controller.
 */

function gameDebug(event, details = {}) {
  const entry = {
    event,
    details,
    ts: new Date().toISOString(),
  };

  window.shuttleGameDebugLog = window.shuttleGameDebugLog || [];
  window.shuttleGameDebugLog.push(entry);
  console.log('[Game debug]', event, entry);
  return entry;
}

function stripSidebarAdsFromDoc(targetDoc) {
  if (!targetDoc) return;

  const stats = {
    selectorsRemoved: 0,
    stylesRemoved: 0,
    scriptsRemoved: 0,
    adNodesRemoved: 0,
    removedScriptReasons: {},
  };

  const adSelectors = [
    '#sidebarad1',
    '#sidebarad2',
    '.sidebar-frame',
    '.sidebar-close',
    '[id*="sidebarad"]',
    '[class*="sidebarad"]',
    'iframe[width="160"][height="600"]',
  ];

  targetDoc.querySelectorAll(adSelectors.join(',')).forEach((el) => {
    stats.selectorsRemoved += 1;
    el.remove();
  });

  targetDoc.querySelectorAll('style').forEach((styleTag) => {
    const css = (styleTag.textContent || '').toLowerCase();
    if (css.includes('#sidebarad1') || css.includes('#sidebarad2')) {
      stats.stylesRemoved += 1;
      styleTag.remove();
    }
  });

  targetDoc.querySelectorAll('script').forEach((scriptTag) => {
    const src = (scriptTag.getAttribute('src') || '').toLowerCase();
    const code = (scriptTag.textContent || '').toLowerCase();
    const isShuttleH5Ad = scriptTag.hasAttribute('data-shuttle-h5-ad');
    const isGnMathObfuscatedAd =
      code.length > 10000 &&
      (code.includes('uravpbgesyjdunqxkcf') ||
        code.includes('sffekk$fmzibajzwzbkuvp') ||
        code.includes('ykjyjgqrqvlq') ||
        code.includes('vwjqavltnv'));

    if (
      !isShuttleH5Ad &&
      (isGnMathObfuscatedAd ||
        src.includes('cdn.r9x.in') ||
        src.includes('ailogic_gn-math') ||
        src.includes('securepubads.g.doubleclick.net') ||
        src.includes('pagead2.googlesyndication.com') ||
        src.includes('googlesyndication.com') ||
        src.includes('googletagservices.com') ||
        src.includes('googletagmanager.com') ||
        src.includes('google-analytics.com') ||
        src.includes('reports.serviceclic.com') ||
        src.includes('serviceclic.com') ||
        src.includes('atpnd.com') ||
        src.includes('tag.escalated.io') ||
        src.includes('cdn.pushalert.co') ||
        src.includes('rudderlabs.com') ||
        src.includes('taboola.com') ||
        src.includes('amazon-adsystem.com') ||
        src.includes('connect.facebook.net') ||
        src.includes('analytics.tiktok.com') ||
        code.includes('ailogic_gn-math') ||
        code.includes('gn-math.dev/reward') ||
        code.includes('/gn-math.dev/reward') ||
        code.includes('myw_rewarded_iframe') ||
        code.includes('avrewardedviewed') ||
        code.includes('window.avconfig') ||
        code.includes('cdn.r9x.in') ||
        code.includes('reports.serviceclic.com') ||
        code.includes('serviceclic.com') ||
        code.includes('hash1.atpnd.com') ||
        code.includes('kv1.atpnd.com') ||
        code.includes('allow-popups-to-escape-sandbox') ||
        code.includes('sidebarad1') ||
        code.includes('sidebarad2') ||
        code.includes('sidebar-frame'))
    ) {
      const reason = isGnMathObfuscatedAd
        ? 'gn-math-obfuscated'
        : src
          ? src
          : 'inline-ad-script';
      stats.scriptsRemoved += 1;
      stats.removedScriptReasons[reason] = (stats.removedScriptReasons[reason] || 0) + 1;
      scriptTag.remove();
    }
  });

  targetDoc.querySelectorAll('ins.adsbygoogle, [data-ad-client], [data-ad-slot]').forEach((el) => {
    if (!el.hasAttribute('data-shuttle-h5-ad')) {
      stats.adNodesRemoved += 1;
      el.remove();
    }
  });

  gameDebug('sanitized ad nodes', stats);
  return stats;
}

function buildShuttleH5AdScripts(targetDoc) {
  const adsenseScript = targetDoc.createElement('script');
  adsenseScript.async = true;
  adsenseScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3723218062742398';
  adsenseScript.crossOrigin = 'anonymous';
  adsenseScript.dataset.shuttleH5Ad = 'true';
  adsenseScript.setAttribute('data-ad-channel', '9267153333');
  adsenseScript.setAttribute('data-ad-client', 'ca-pub-3723218062742398');
  adsenseScript.setAttribute('data-ad-frequency-hint', '30s');

  const h5Bootstrap = targetDoc.createElement('script');
  h5Bootstrap.dataset.shuttleH5Ad = 'true';
  h5Bootstrap.textContent = `
    (function () {
      window.adsbygoogle = window.adsbygoogle || [];
      window.shuttleH5DebugLog = window.shuttleH5DebugLog || [];
      function shuttleH5Debug(event, details) {
        var entry = {
          event: event,
          details: details || {},
          href: location.href,
          readyState: document.readyState,
          queueLength: Array.isArray(window.adsbygoogle) ? window.adsbygoogle.length : null,
          ts: new Date().toISOString()
        };
        window.shuttleH5DebugLog.push(entry);
        console.log('[Game H5 debug]', event, entry);
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'shuttle-h5-debug', entry: entry }, '*');
          }
        } catch (err) {}
        return entry;
      }
      var adBreak = window.adBreak = window.adBreak || function (o) {
        shuttleH5Debug('adBreak/adConfig queued', o);
        window.adsbygoogle.push(o);
      };
      var adConfig = window.adConfig = window.adConfig || function (o) {
        shuttleH5Debug('adConfig queued', o);
        window.adsbygoogle.push(o);
      };
      var hasShownPreroll = false;

      function runAdBreak(options) {
        shuttleH5Debug('adBreak requested', options);
        try {
          adBreak(options);
          shuttleH5Debug('adBreak accepted', options);
        } catch (err) {
          shuttleH5Debug('adBreak failed', { message: err.message, stack: err.stack });
        }
      }

      function showPreroll() {
        if (hasShownPreroll) return;
        hasShownPreroll = true;
        runAdBreak({
          type: 'preroll',
          name: 'game-start',
          adBreakDone: function (placementInfo) {
            shuttleH5Debug('preroll done', placementInfo);
          }
        });
      }

      window.showShuttleRewardedAd = function () {
        runAdBreak({
          type: 'reward',
          name: 'user-requested-reward',
          adBreakDone: function (placementInfo) {
            shuttleH5Debug('manual reward done', placementInfo);
          }
        });
      };

      document.addEventListener('gameOver', function () {
        runAdBreak({ type: 'next', name: 'game-over' });
      });

      document.addEventListener('gameWon', function () {
        runAdBreak({
          type: 'reward',
          name: 'game-won',
          adBreakDone: function (placementInfo) {
            shuttleH5Debug('game-won reward done', placementInfo);
          }
        });
      });

      adConfig({
        preloadAdBreaks: 'on',
        onReady: function () {
          shuttleH5Debug('H5 Ads API ready');
          showPreroll();
        }
      });

      window.addEventListener('error', function (event) {
        shuttleH5Debug('window error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      window.addEventListener('unhandledrejection', function (event) {
        shuttleH5Debug('unhandled rejection', {
          reason: event.reason && (event.reason.message || String(event.reason))
        });
      });

      shuttleH5Debug('H5 bootstrap installed');
      setTimeout(showPreroll, 3000);
    })();
  `;

  return [adsenseScript, h5Bootstrap];
}

function injectShuttleH5Ads(targetDoc) {
  if (!targetDoc?.head) return;
  targetDoc.querySelectorAll('script[data-shuttle-h5-ad]').forEach((el) => el.remove());
  buildShuttleH5AdScripts(targetDoc).forEach((script) => targetDoc.head.appendChild(script));
  gameDebug('injected Shuttle H5 scripts', {
    scriptCount: targetDoc.querySelectorAll('script[data-shuttle-h5-ad]').length,
  });
}

function sanitizeGameHtml(html) {
  try {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(html, 'text/html');

    const sanitizeStats = stripSidebarAdsFromDoc(parsed);
    injectShuttleH5Ads(parsed);

    const blockStyle = parsed.createElement('style');
    blockStyle.textContent = `
      #sidebarad1,
      #sidebarad2,
      .sidebar-frame,
      .sidebar-close,
      [id*="sidebarad"],
      [class*="sidebarad"],
      iframe[width="160"][height="600"] {
        display: none !important;
        visibility: hidden !important;
      }
    `;
    parsed.head.appendChild(blockStyle);

    gameDebug('game html sanitized', {
      title: parsed.title,
      htmlLengthBefore: html.length,
      htmlLengthAfter: parsed.documentElement.outerHTML.length,
      sanitizeStats,
    });

    return '<!doctype html>\n' + parsed.documentElement.outerHTML;
  } catch (err) {
    console.warn('Game sanitize failed, blocking unsafe payload:', err);
    return null;
  }
}

function buildBlockedHtml(message) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blocked</title>
    <style>
      body {
        margin: 0;
        height: 100vh;
        display: grid;
        place-items: center;
        background: #0a0c0f;
        color: #fff;
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .card {
        width: min(620px, 92vw);
        background: #111827;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 14px;
        padding: 20px;
      }
      .title {
        font-weight: 800;
        margin-bottom: 8px;
      }
      .muted {
        opacity: 0.85;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="title">Game load blocked in strict mode</div>
      <div class="muted">${message}</div>
    </div>
  </body>
</html>`;
}

class ShaderCanvas {
  /**
   * Available events.
   * @readonly
   */
  static get EVENTS() {
    return {
      SURFACE_CREATED: 'surfaceCreated',
      SURFACE_CHANGE: 'surfaceChange',
      SURFACE_CLOSED: 'surfaceClosed',
      SURFACE_UPDATE: 'surfaceUpdate',
      // Proxied events from active ShaderClient
      READY: 'ready',
      ERROR: 'error',
      NAVIGATING: 'navigating',
      URL_CHANGE: 'urlChange',
      TITLE_CHANGE: 'titleChange',
      FAVICON_CHANGE: 'faviconChange',
      STATUS_CHANGE: 'statusChange',
      LOADING_START: 'loadingStart',
      LOADING_STOP: 'loadingStop',
    }
  }

  /**
   * Creates an instance of ShaderCanvas.
   * @param {string|HTMLElement} containerId - The container element.
   */
  constructor(containerId) {
    this.container = typeof containerId === 'string' 
      ? document.getElementById(containerId) 
      : containerId;
    
    if (!this.container) throw new Error('Container element not found');

    this.surfaces = new Map(); // id -> { id, client, iframe }
    this.activeSurfaceId = null;
    this.listeners = {};

    window.addEventListener('message', (event) => {
      if (event?.data?.type === 'shuttle-h5-debug') {
        gameDebug('iframe H5 message', event.data.entry);
      }
    });
  }

  /**
   * Creates a new browsing surface (tab).
   * @param {string} [url='about:blank'] - Initial URL.
   * @returns {string} The ID of the new surface.
   */
  createSurface(url = 'about:blank') {
    const id = 'surface-' + Math.random().toString(36).substr(2, 9);
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'none'; // Hidden by default
    iframe.style.backgroundColor = 'transparent';
    
    this.container.appendChild(iframe);

    // Initialize Client
    const client = new ShaderClient({ frame: iframe });
    
    // Proxy events from the active client to the canvas
    this._bindSurfaceEvents(id, client);

    const surface = {
      id,
      iframe,
      client,
      title: 'New Tab',
      favicon: '',
      ready: false
    };

    this.surfaces.set(id, surface);
    
    // Initialize the client
    client.init().then(() => {
        surface.ready = true;
        if (url && url !== 'about:blank') {
            client.navigate(url);
        }
    });

    this.emit(ShaderCanvas.EVENTS.SURFACE_CREATED, surface);

    // Auto-switch if it's the first one
    if (this.surfaces.size === 1) {
      this.switchSurface(id);
    }

    return id;
  }

  /**
   * Creates a game surface using game:// protocol.
   * Fetches content and serves via srcdoc for same-origin benefits.
   * @param {string} url - The HTTPS URL to fetch.
   * @returns {Promise<string>} The ID of the new surface.
   */
  async createGameSurface(url) {
    const id = 'surface-' + Math.random().toString(36).substr(2, 9);
    gameDebug('createGameSurface start', { id, url });
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'none';
    iframe.style.backgroundColor = 'transparent';
    iframe.allow = 'accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; gamepad; gyroscope; picture-in-picture; screen-wake-lock; web-share';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    
    this.container.appendChild(iframe);

    // Store protocol URL
    const protocolUrl = url.replace(/^https:\/\//, 'game://');

    // Create surface
    const surface = {
      id,
      iframe,
      client: null,
      title: 'Loading Game...',
      favicon: '',
      isGame: true,
      gameUrl: url,
      protocolUrl: protocolUrl,
      adObserver: null
    };

    this.surfaces.set(id, surface);

    // Fetch and load game content (strict sanitized mode)
    try {
      this.emit(ShaderCanvas.EVENTS.LOADING_START);
      const response = await fetch(url + '?t=' + Date.now());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      gameDebug('fetched game html', {
        id,
        url,
        status: response.status,
        htmlLength: html.length,
      });
      const sanitizedHtml = sanitizeGameHtml(html);
      if (!sanitizedHtml) throw new Error('Sanitization failed');

      // Extract title from HTML
      const titleMatch = sanitizedHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
      const gameTitle = titleMatch ? titleMatch[1].trim() : 'Game';

      iframe.addEventListener(
        'load',
        () => {
          const frameDoc = iframe.contentDocument;
          if (!frameDoc?.documentElement) return;

          stripSidebarAdsFromDoc(frameDoc);

          if (surface.adObserver) surface.adObserver.disconnect();
          surface.adObserver = new MutationObserver(() => stripSidebarAdsFromDoc(frameDoc));
          surface.adObserver.observe(frameDoc.documentElement, {
            childList: true,
            subtree: true,
          });
        },
        { once: true }
      );

      iframe.srcdoc = sanitizedHtml;
      surface.title = gameTitle;
      gameDebug('game iframe srcdoc assigned', {
        id,
        title: gameTitle,
        sanitizedLength: sanitizedHtml.length,
      });

      this.emit(ShaderCanvas.EVENTS.LOADING_STOP);
      this.emit(ShaderCanvas.EVENTS.TITLE_CHANGE, gameTitle);
    } catch (err) {
      console.error('Failed to load game in strict mode:', err);
      gameDebug('createGameSurface failed', {
        id,
        url,
        message: err.message,
        stack: err.stack,
      });
      iframe.srcdoc = buildBlockedHtml(
        'This game was blocked because it could not be safely loaded through strict sanitization.'
      );
      surface.title = 'Blocked';
      this.emit(ShaderCanvas.EVENTS.LOADING_STOP);
      this.emit(ShaderCanvas.EVENTS.TITLE_CHANGE, 'Blocked');
    }

    this.emit(ShaderCanvas.EVENTS.SURFACE_CREATED, surface);

    // Auto-switch if it's the first one
    if (this.surfaces.size === 1) {
      this.switchSurface(id);
    }

    return id;
  }

  /**
   * Switches the active view to the specified surface.
   * @param {string} id - The surface ID.
   */
  switchSurface(id) {
    if (!this.surfaces.has(id)) return;

    // Hide current
    if (this.activeSurfaceId && this.surfaces.has(this.activeSurfaceId)) {
      this.surfaces.get(this.activeSurfaceId).iframe.style.display = 'none';
    }

    // Show new
    const surface = this.surfaces.get(id);
    surface.iframe.style.display = 'block';
    this.activeSurfaceId = id;

    this.emit(ShaderCanvas.EVENTS.SURFACE_CHANGE, surface);
    
    // Handle game surfaces (game:// protocol)
    if (surface.isGame) {
      // Game surfaces use srcdoc, no client
      this.emit(ShaderCanvas.EVENTS.STATUS_CHANGE, { ready: true, loading: false });
      return;
    }
    
    // Re-emit state for UI updates (proxy surfaces only)
    if (surface.client && surface.client.state) {
      const state = surface.client.getState();
      this.emit(ShaderCanvas.EVENTS.STATUS_CHANGE, state);

      // Sync loading spinner state
      if (state.loading) {
          this.emit(ShaderCanvas.EVENTS.LOADING_START);
      } else {
          this.emit(ShaderCanvas.EVENTS.LOADING_STOP);
      }
    }
  }

  /**
   * Closes a surface.
   * @param {string} id - The surface ID.
   */
  closeSurface(id) {
    if (!this.surfaces.has(id)) return;

    const surface = this.surfaces.get(id);

    // Cleanup game ad observer (if any)
    if (surface.adObserver) {
      surface.adObserver.disconnect();
      surface.adObserver = null;
    }

    // Cleanup DOM
    surface.iframe.remove();
    this.surfaces.delete(id);

    this.emit(ShaderCanvas.EVENTS.SURFACE_CLOSED, id);

    // Switch to another tab if we closed the active one
    if (this.activeSurfaceId === id) {
      this.activeSurfaceId = null;
      if (this.surfaces.size > 0) {
        const nextId = this.surfaces.keys().next().value;
        this.switchSurface(nextId);
      } else {
        this.emit(ShaderCanvas.EVENTS.SURFACE_CHANGE, null); // No tabs left
      }
    }
  }

  /**
   * Gets the currently active surface object.
   */
  get activeSurface() {
    return this.activeSurfaceId ? this.surfaces.get(this.activeSurfaceId) : null;
  }

  /**
   * Proxy method to navigate the active surface.
   */
  navigate(url) {
    if (this.activeSurface) {
      return this.activeSurface.client.navigate(url);
    }
  }

  goBack() { this.activeSurface?.client.goBack(); }
  goForward() { this.activeSurface?.client.goForward(); }
  reload() { this.activeSurface?.client.reloadFrame(); }

  /**
   * Internal event binding.
   */
  _bindSurfaceEvents(id, client) {
    // Notify general updates regardless of active state
    const notifyUpdate = () => {
        const surface = this.surfaces.get(id);
        if (surface) this.emit(ShaderCanvas.EVENTS.SURFACE_UPDATE, surface);
    };

    // We only bubble specific events if they come from the ACTIVE surface
    const bubble = (event, data) => {
      if (this.activeSurfaceId === id) {
        this.emit(event, data);
      }
    };

    client.on(ShaderClient.EVENTS.NAVIGATING, d => bubble(ShaderCanvas.EVENTS.NAVIGATING, d));
    client.on(ShaderClient.EVENTS.URL_CHANGE, d => bubble(ShaderCanvas.EVENTS.URL_CHANGE, d));
    
    client.on(ShaderClient.EVENTS.TITLE_CHANGE, d => {
        const surface = this.surfaces.get(id);
        if (surface) surface.title = d;
        notifyUpdate();
        bubble(ShaderCanvas.EVENTS.TITLE_CHANGE, d);
    });

    client.on(ShaderClient.EVENTS.FAVICON_CHANGE, d => {
        const surface = this.surfaces.get(id);
        if (surface) surface.favicon = d;
        notifyUpdate();
        bubble(ShaderCanvas.EVENTS.FAVICON_CHANGE, d);
    });

    client.on(ShaderClient.EVENTS.STATUS_CHANGE, d => bubble(ShaderCanvas.EVENTS.STATUS_CHANGE, d));
    
    client.on(ShaderClient.EVENTS.LOADING_START, d => {
        notifyUpdate();
        bubble(ShaderCanvas.EVENTS.LOADING_START, d);
    });
    
    client.on(ShaderClient.EVENTS.LOADING_STOP, d => {
        notifyUpdate();
        bubble(ShaderCanvas.EVENTS.LOADING_STOP, d);
    });

    client.on(ShaderClient.EVENTS.READY, d => bubble(ShaderCanvas.EVENTS.READY, d));
    client.on(ShaderClient.EVENTS.ERROR, d => bubble(ShaderCanvas.EVENTS.ERROR, d));
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  }
}

window.ShaderCanvas = ShaderCanvas;
export { ShaderCanvas };
