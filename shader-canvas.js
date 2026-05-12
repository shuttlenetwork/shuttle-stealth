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

// ─── H5 Rewarded Unit Replacement ─────────────────────────────────
// Goal: keep the existing gn-math H5 rewarded logic, but replace the
// rewarded GPT unit path with yours.
const YOUR_H5_ADS = {
  rewardedUnitPath: '/22921845643/H5_Game_Rewarded',
  rewardedElementId: 'gpt_unit_/22921845643/H5_Game_Rewarded',
  enabled: true,
};

function replaceRewardedUnitStrings(html) {
  if (!YOUR_H5_ADS.enabled || !html) return html;

  return html
    // Exact observed gn-math rewarded element id/path.
    .replaceAll('gpt_unit_/23334778486/gn-math.dev/REWARD-1_5', YOUR_H5_ADS.rewardedElementId)
    .replaceAll('/23334778486/gn-math.dev/REWARD-1_5', YOUR_H5_ADS.rewardedUnitPath)

    // Generic future-proof replacements for gn-math rewarded GPT ids/paths.
    .replace(/gpt_unit_\/\d+\/[^'"<>()\s]+\/REWARD[-_\w]*/g, YOUR_H5_ADS.rewardedElementId)
    .replace(/\/\d+\/[^'"<>()\s]+\/REWARD[-_\w]*/g, YOUR_H5_ADS.rewardedUnitPath);
}

/**
 * Injected before the game/gn-math scripts run.
 * Backup runtime patch for GPT slot creation:
 *   googletag.defineOutOfPageSlot(oldRewardPath, REWARDED)
 *   googletag.defineSlot(oldRewardPath, ...)
 * become your unit path.
 *
 * It does NOT create banners, iframes, or its own ad UI.
 */
function buildRewardedUnitOverrideScript() {
  return [
    '<script>',
    '(function(){',
    "  'use strict';",
    "  var TARGET_UNIT = '" + YOUR_H5_ADS.rewardedUnitPath + "';",
    '  function isRewardedUnit(path){',
    '    return typeof path === "string" && /REWARD/i.test(path);',
    '  }',
    '  function isRewardedFormat(format, gt){',
    '    try {',
    '      return !!format && (',
    '        (gt && gt.enums && gt.enums.OutOfPageFormat && format === gt.enums.OutOfPageFormat.REWARDED) ||',
    '        String(format).toUpperCase().indexOf("REWARDED") !== -1',
    '      );',
    '    } catch(e) { return false; }',
    '  }',
    '  function patchGPT(){',
    '    var gt = window.googletag;',
    '    if (!gt) return;',
    '    if (gt.cmd && typeof gt.cmd.push === "function" && !gt.cmd.__shuttleRewardedPatch){',
    '      var originalPush = gt.cmd.push.bind(gt.cmd);',
    '      gt.cmd.push = function(fn){',
    '        if (typeof fn === "function") {',
    '          return originalPush(function(){ patchGPT(); return fn.apply(this, arguments); });',
    '        }',
    '        return originalPush(fn);',
    '      };',
    '      gt.cmd.__shuttleRewardedPatch = true;',
    '    }',
    '    if (typeof gt.defineOutOfPageSlot === "function" && !gt.defineOutOfPageSlot.__shuttleRewardedPatch){',
    '      var originalDefineOOP = gt.defineOutOfPageSlot;',
    '      gt.defineOutOfPageSlot = function(adUnitPath, format){',
    '        if (isRewardedFormat(format, gt) || isRewardedUnit(adUnitPath)) {',
    '          console.log("[ShuttleAds] Replacing rewarded GPT unit", adUnitPath, "→", TARGET_UNIT);',
    '          adUnitPath = TARGET_UNIT;',
    '        }',
    '        return originalDefineOOP.call(this, adUnitPath, format);',
    '      };',
    '      gt.defineOutOfPageSlot.__shuttleRewardedPatch = true;',
    '    }',
    '    if (typeof gt.defineSlot === "function" && !gt.defineSlot.__shuttleRewardedPatch){',
    '      var originalDefineSlot = gt.defineSlot;',
    '      gt.defineSlot = function(adUnitPath, size, div){',
    '        if (isRewardedUnit(adUnitPath)) {',
    '          console.log("[ShuttleAds] Replacing rewarded GPT defineSlot unit", adUnitPath, "→", TARGET_UNIT);',
    '          adUnitPath = TARGET_UNIT;',
    '        }',
    '        return originalDefineSlot.call(this, adUnitPath, size, div);',
    '      };',
    '      gt.defineSlot.__shuttleRewardedPatch = true;',
    '    }',
    '  }',
    '  window.googletag = window.googletag || { cmd: [] };',
    '  patchGPT();',
    '  var tries = 0;',
    '  var timer = setInterval(function(){',
    '    patchGPT();',
    '    if (++tries > 400) clearInterval(timer);',
    '  }, 25);',
    '})();',
    '</script>',
  ].join('\n');
}

/**
 * Strips ALL third-party ad scripts, trackers, and obfuscated ad code from a game document.
 * This removes the CDN owner's monetization before we inject our own.
 */
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
    '[id*="ad-"]',
    '[class*="ad-"]',
    '[id*="banner"]',
    '[class*="banner-ad"]',
    '[class*="ad-container"]',
    '.ad-wrapper',
    '.game-ad',
    '#adContainer',
    '#preroll',
    '.preroll-ad',
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
    const isGnMathObfuscatedAd =
      code.length > 10000 &&
      (code.includes('uravpbgesyjdunqxkcf') ||
        code.includes('sffekk$fmzibajzwzbkuvp') ||
        code.includes('ykjyjgqrqvlq') ||
        code.includes('vwjqavltnv'));

    if (
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
    stats.adNodesRemoved += 1;
    el.remove();
  });

  gameDebug('sanitized ad nodes', stats);
  return stats;
}

function sanitizeGameHtml(html) {
  const patchedHtml = replaceRewardedUnitStrings(html);
  const parser = new DOMParser();
  const parsed = parser.parseFromString(patchedHtml, 'text/html');

  try {
    if (YOUR_H5_ADS.enabled) {
      const overrideFragment = document
        .createRange()
        .createContextualFragment(buildRewardedUnitOverrideScript());

      // Must run before gn-math/game scripts, so inject as early as possible.
      if (parsed.head) {
        parsed.head.insertBefore(overrideFragment, parsed.head.firstChild);
      } else if (parsed.documentElement) {
        parsed.documentElement.insertBefore(overrideFragment, parsed.documentElement.firstChild);
      }
    }

    gameDebug('game html patched', {
      title: parsed.title,
      htmlLengthBefore: html.length,
      htmlLengthAfter: parsed.documentElement.outerHTML.length,
      rewardedUnitPath: YOUR_H5_ADS.rewardedUnitPath,
    });

    return '<!doctype html>\n' + parsed.documentElement.outerHTML;
  } catch (err) {
    // Fail open: never block the game because ad patching failed.
    gameDebug('rewarded unit patch failed, serving raw html', { error: err.message, stack: err.stack });
    return html;
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
      if (event?.data?.__av || event?.data?.type === 'avdebug') {
        gameDebug('iframe AV message', event.data);
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
      // Patch the game HTML: keep gn-math's H5 rewarded logic, but swap its GPT rewarded unit to ours.
      const sanitizedHtml = sanitizeGameHtml(html);
      if (!sanitizedHtml) {
        throw new Error('Sanitization blocked unsafe game payload');
      }

      // Extract title from HTML
      const titleMatch = sanitizedHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
      const gameTitle = titleMatch ? titleMatch[1].trim() : 'Game';

      iframe.addEventListener(
        'load',
        () => {
          const frameDoc = iframe.contentDocument;
          if (!frameDoc?.documentElement) return;

          gameDebug('raw game iframe loaded', {
            id,
            title: frameDoc.title,
            scriptCount: frameDoc.scripts.length,
            iframeCount: frameDoc.querySelectorAll('iframe').length,
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
