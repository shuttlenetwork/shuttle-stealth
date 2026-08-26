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

// URL -> { ok, code } cache of youtube-playables SDKs with the CDN's
// appended third-party ("MarzLib") payload stripped off.
const cleanedSdkCache = new Map();

// Known-dead CDN sources -> working mirrors. Games hardcode these inside
// their bundles (e.g. Construct 2's CDN_LINK), so we rewrite them at
// request time with a small in-game shim instead of editing game code.
const DEAD_CDN_REMAPS = [
  {
    // genizy/ovo-3-dimension is 403/removed on jsdelivr; the wrapper's other
    // assets come from the bubblfan mirror, which still serves everything.
    // Matches both hashed (CDN_LINK) and hash-less (derived base) URLs.
    host: 'cdn.jsdelivr.net',
    from: '/gh/genizy/ovo-3-dimension(?:@[^/]+)?/',
    to: '/gh/bubblfan/ovo-3-dimension@102179bf4242fd237c46c555ba154c2f325d351c/',
  },
  {
    // Same story for Ice Dodo: genizy copy is dead, bubblfan mirror serves it.
    host: 'cdn.jsdelivr.net',
    from: '/gh/genizy/ice-dodo(?:@[^/]+)?/',
    to: '/gh/bubblfan/ice-dodo@b950830c255518c930fbc2a0bd3182e7d4cc920c/',
  },
  {
    // Monster Tracks (and friends) from the dead genizy/google-class repo;
    // the catalog's other google-class games use the taskmaster773 mirror.
    host: 'cdn.jsdelivr.net',
    from: '/gh/genizy/google-class(?:@[^/]+)?/',
    to: '/gh/taskmaster773/google-class@cd06df26d3c4d9f73c8151fc13f7b2dc27f3adda/',
  },
  {
    // Jetpack Joyride's genizy/jride copy is dead; bubblfan/jride serves it.
    host: 'cdn.jsdelivr.net',
    from: '/gh/genizy/jride(?:@[^/]+)?/',
    to: '/gh/bubblfan/jride/',
  },
  {
    // Gobble pulls poki SDK from dead genizy/fancade; bubblfan/fancade works.
    host: 'cdn.jsdelivr.net',
    from: '/gh/genizy/fancade(?:@[^/]+)?/',
    to: '/gh/bubblfan/fancade/',
  },
  {
    // cg-rip Unity parts (and everything else in this repo) are 20MB+ per
    // file, which jsdelivr refuses to serve. raw.githubusercontent.com has a
    // 100MB cap and sends CORS headers, so Unity's fetches still work.
    host: 'cdn.jsdelivr.net',
    from: '/gh/bubblfan/cg-rip@main/',
    toHost: 'rawcdn.githack.com',
    to: '/bubblfan/cg-rip/main/',
  },
  {
    // Slendytubbies 1 & 2: all data/wasm parts are 20MB+; served from raw.
    // Note wrapper's base has no ref for SLENDYTUBBIES (default branch).
    host: 'cdn.jsdelivr.net',
    from: '/gh/web-ports/SLENDYTUBBIES/',
    toHost: 'rawcdn.githack.com',
    to: '/web-ports/SLENDYTUBBIES/main/',
  },
  {
    host: 'cdn.jsdelivr.net',
    from: '/gh/web-ports/slendytubbies@latest/',
    toHost: 'rawcdn.githack.com',
    to: '/web-ports/slendytubbies/main/',
  },
  {
    // That's Not My Neighbor: wrapper pins an old commit whose main.js and
    // pck parts don't exist; current main has everything (parts ~19.6MB).
    host: 'cdn.jsdelivr.net',
    from:
      '/gh/giorgirick2-gif/game-webports-onawebsite@de75523557e46f375fc9173a9a0c0d34d8ed34f9/thats-not-my-neighbor/',
    toHost: 'rawcdn.githack.com',
    to: '/giorgirick2-gif/game-webports-onawebsite/main/thats-not-my-neighbor/',
  },
  {
    // Minecraft 1.8.8 (Eaglercraft): wrapper base has a typo'd jsdelivr URL
    // (missing /gh/) and classes.js is 22MB, over jsdelivr's cap. The
    // Theprocat27 copy is also a broken build (its classes.js was stripped
    // of the TeaVM `main` bootstrap), so we serve the complete client from
    // the eaglercraftx1-8 site mirror (main = $rt_mainStarter present).
    host: 'cdn.jsdelivr.net',
    from: '/Theprocat27/Eaglercraft_1.8.8@main/',
    toHost: 'rawcdn.githack.com',
    to: '/eaglercraftx1-8/eaglercraftx1-8.github.io/main/eagler-files/1.8/Main/',
  },
  {
    // Tall Man Run: wrapper pins an old youtube-playables commit whose
    // tall-man-run/unarchiver2.min.js is missing; a later commit has it.
    host: 'cdn.jsdelivr.net',
    from: '/gh/bubbls/youtube-playables@8b29ce29cd86c8fb4f46fa5b63d3a0f4f32c5d4e/tall-man-run/',
    to: '/gh/bubbls/youtube-playables@216925d0a4a27778c555e5b6ec010d9f809aa0d5/tall-man-run/',
  },
  {
    // Tag: the wrapper points at bubblfan/UGS-Assets (an old fork without
    // the tag/ game); the upstream bubbls/UGS-Assets has tag/scripts/*.
    host: 'cdn.jsdelivr.net',
    from: '/gh/bubblfan/UGS-Assets@main/tag/',
    to: '/gh/bubbls/UGS-Assets@main/tag/',
  },
  {
    // Papery Planes: master-loader.js hardcodes UnityLoader.2019.2.js which
    // does not exist in genizy/assets; the 2019.1 loader is the right one.
    host: 'rawcdn.githack.com',
    from: '/genizy/assets/main/papery-planes/UnityLoader\\.2019\\.2\\.js$',
    to: '/genizy/assets/main/papery-planes/UnityLoader.2019.1.js',
  },
];

/**
 * Fetches the repo-root ytgame.js and removes everything appended after the
 * actual SDK's closing `}).call(this);`. On the CDN that file has a
 * third-party wrapper bolted on after the SDK ends; it tries to navigate to
 * a computed "home page" URL, which inside srcdoc resolves to
 * "<game-dir>/undefined/pages/home.html" -> 404.
 */
async function fetchCleanYtgameSdk(src) {
  if (cleanedSdkCache.has(src)) return cleanedSdkCache.get(src);

  const result = { ok: false, code: '' };
  try {
    const res = await fetch(src);
    if (res.ok) {
      const code = await res.text();
      const end = code.lastIndexOf('}).call(this);');
      // Only trust the cut when the SDK body is the bulk of the file.
      if (end > 1000 && end > code.length * 0.5) {
        result.ok = true;
        result.code = code.slice(0, end + '}).call(this);'.length);
      }
    }
  } catch (err) {
    gameDebug('fetchCleanYtgameSdk failed', { src, error: err.message });
  }

  cleanedSdkCache.set(src, result);
  return result;
}

/**
 * Strips ALL third-party ad scripts, trackers, and obfuscated ad code from a game document.
 * This removes the CDN owner's monetization.
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

/**
 * Repairs games that load the wrapper repo's root ytgame.js. On the CDN that
 * file carries an appended third-party payload (removed by
 * fetchCleanYtgameSdk), so we inline the stripped, official SDK instead -
 * it handles running outside YouTube gracefully (no service-worker calls,
 * no host-message crashes). Falls back to the per-game customytgame.js in
 * case the fetch failed.
 */
function remapDeadCdnUrl(url) {
  for (const r of DEAD_CDN_REMAPS) {
    const hostRe = r.host.replace(/\./g, '\\.');
    const re = new RegExp('^https://' + hostRe + r.from);
    if (re.test(url)) return url.replace(re, 'https://' + (r.toHost || r.host) + r.to);
  }
  return null;
}

/**
 * Rewrites src/href attributes that point at known-dead CDN sources so
 * static references in the wrapper HTML are fixed before the game runs.
 * Also re-bases root-anchored paths ("/js/x.js"), which can never resolve
 * inside the srcdoc sandbox, against the document's base when one exists.
 */
function remapDeadCdnUrls(parsed) {
  let rewritten = 0;
  const baseEl = parsed.querySelector('base[href]');
  const baseHref = baseEl ? baseEl.getAttribute('href') : null;
  parsed.querySelectorAll('[src],[href]').forEach((el) => {
    for (const attr of ['src', 'href']) {
      const val = el.getAttribute(attr);
      if (!val) continue;
      let mapped = remapDeadCdnUrl(val);
      if (!mapped && baseHref && /^\/[^/]/.test(val)) {
        mapped = new URL(val.slice(1), baseHref).href;
      }
      if (mapped && mapped !== val) {
        el.setAttribute(attr, mapped);
        rewritten++;
      }
    }
  });
  if (rewritten) {
    gameDebug('remapped dead cdn urls in html', { rewritten });
  }
  return rewritten;
}

/**
 * Small in-game shim installed before any game script. It rewrites requests
 * that hit known-dead CDN sources (DEAD_CDN_REMAPS) to their working
 * mirrors, which fixes games whose bundles hardcode dead base URLs (e.g.
 * Construct 2's CDN_LINK constant, plugin script includes and image loads).
 */
function buildUrlRemapScript() {
  const entries = DEAD_CDN_REMAPS.map((r) => ({ host: r.host, from: r.from, to: r.to, toHost: r.toHost }));
  return [
    '(function(){',
    "  'use strict';",
    '  var REMAPS = ' + JSON.stringify(entries) + ';',
    // Same-origin proxy base (the app's game-serve/ directory root).
    '  var appRoot = null;',
    '  try {',
    '    var _hi = location.href.split(/[?#]/)[0], _gi = _hi.indexOf("game-serve/");',
    '    if (_gi >= 0) appRoot = _hi.slice(0, _gi);',
    '  } catch (e) {}',
    // Assets that must be served through the app's game-asset/ proxy with a
    // literal marker segment in the path (UnityLoader's progress handler
    // requires /Build/ inside the responseURL of its downloads).
    '  var GUARDED = [{ host: "rawcdn.githack.com", from: "/genizy/assets/main/papery-planes/unity/" }];',
    '  function segEncode(u){',
    '    var seg = String(u).split("/");',
    '    for (var i = 0; i < seg.length; i++) seg[i] = encodeURIComponent(seg[i]);',
    '    return seg.join("/");',
    '  }',
    // Sinkhole URL patterns: the CDN's wrapper payloads probe a "home page"
    // or a null asset that can never exist; answering them in-page removes
    // the 404 noise and keeps games from waiting on the network.
    '  var SINK = [/\\/undefined\\/pages\\/home\\.html$/i, /(^|\\/)null(\\.html)?(\\?.*)?$/i];',
    '  function sinkhole(u){',
    '    if (typeof u !== "string" || !u) return false;',
    '    try {',
    '      var x = new URL(u, document.baseURI);',
    '      if (x.protocol !== "http:" && x.protocol !== "https:") return false;',
    '      for (var i = 0; i < SINK.length; i++) if (SINK[i].test(x.pathname)) return true;',
    '    } catch (e) {}',
    '    return false;',
    '  }',
    "  var DUMMY_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';",
    '  function remapUrl(u){',
    '    if (typeof u !== "string" || !u) return null;',
    '    if (sinkhole(u)) return DUMMY_IMG;',
    '    try {',
    '      var x = new URL(u, document.baseURI);',
    '      if (x.protocol !== "https:") return null;',
    '      if (appRoot) {',
    '        for (var gi = 0; gi < GUARDED.length; gi++) {',
    '          var g = GUARDED[gi];',
    '          if (x.hostname === g.host && x.pathname.indexOf(g.from) === 0) return appRoot + "game-asset/Build/" + segEncode(x.href);',
    '        }',
    '      }',
    '      for (var i = 0; i < REMAPS.length; i++) {',
    '        var r = REMAPS[i];',
    '        if (x.hostname !== r.host) continue;',
    '        var re = new RegExp(r.from);',
    '        if (re.test(x.pathname)) {',
    '          if (r.toHost) x.hostname = r.toHost;',
    '          x.pathname = x.pathname.replace(re, r.to);',
    '          return x.href;',
    '        }',
    '      }',
    '    } catch (e) {}',
    '    return null;',
    '  }',
    '  function remapText(s){',
    '    if (typeof s !== "string") return s;',
    '    for (var i = 0; i < REMAPS.length; i++) {',
    '      var r = REMAPS[i];',
    '      var g = new RegExp("https://" + r.host.replace(/\./g, "\\\\.") + r.from, "g");',
    '      s = s.replace(g, "https://" + (r.toHost || r.host) + r.to);',
    '    }',
    '    return s;',
    '  }',
    '  var of = window.fetch;',
    '  if (of) {',
    '    window.fetch = function(input, init) {',
    '      var u = typeof input === "string" ? input : (input && input.url) || "";',
    '      if (sinkhole(u)) return Promise.resolve(new Response("", { status: 200, statusText: "OK" }));',
    '      var r = remapUrl(u);',
    '      return r === DUMMY_IMG ? Promise.reject(new TypeError("Failed to fetch")) : (r ? of.call(this, r, init) : of.apply(this, arguments));',
    '    };',
    '  }',
    '  var ox = XMLHttpRequest.prototype.open;',
    '  XMLHttpRequest.prototype.open = function(method, url) {',
    '    var r = sinkhole(url) ? "data:text/plain," : remapUrl(url);',
    '    if (r === DUMMY_IMG) r = "data:text/plain,";',
    '    return ox.call(this, method, r || url);',
    '  };',
    '  var ld = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, "href");',
    '  if (ld && ld.set) Object.defineProperty(HTMLLinkElement.prototype, "href", {',
    '    get: function(){ return ld.get.call(this); },',
    '    set: function(v){ var r = remapUrl(v); ld.set.call(this, r || v); },',
    '    configurable: true',
    '  });',
    // Sinkholed URLs feed bytes to whatever consumed them; script elements
    // must get an empty script body instead of the 1px GIF or the browser
    // tries to parse image bytes as JavaScript (SyntaxError, no URL).
    '  function sinkForElement(el, v){',
    '    var r = remapUrl(v);',
    '    if (r === DUMMY_IMG && el && el.tagName === "SCRIPT") r = "data:text/javascript,";',
    '    return r || v;',
    '  }',
    "  ['HTMLImageElement','HTMLScriptElement','HTMLIFrameElement','HTMLAudioElement','HTMLVideoElement','HTMLSourceElement'].forEach(function(name){",
    '    var proto = window[name] && window[name].prototype;',
    '    if (!proto) return;',
    '    var d = Object.getOwnPropertyDescriptor(proto, "src");',
    '    if (d && d.set) Object.defineProperty(proto, "src", {',
    '      get: function(){ return d.get.call(this); },',
    '      set: function(v){ d.set.call(this, sinkForElement(this, v)); },',
    '      configurable: true',
    '    });',
    '  });',
    '  var dw = document.write, dwl = document.writeln;',
    '  document.write = function(){ for (var i = 0; i < arguments.length; i++) arguments[i] = remapText(arguments[i]); return dw.apply(document, arguments); };',
    '  document.writeln = function(){ for (var i = 0; i < arguments.length; i++) arguments[i] = remapText(arguments[i]); return dwl.apply(document, arguments); };',
    "  var sa = Element.prototype.setAttribute;",
    '  Element.prototype.setAttribute = function(name, value){',
    '    if ((name === "src" || name === "href") && typeof value === "string") {',
    '      var r = remapUrl(value);',
    '      if (r) value = r;',
    '    }',
    '    return sa.call(this, name, value);',
    '  };',
    '  var ih = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");',
    '  if (ih && ih.set) Object.defineProperty(Element.prototype, "innerHTML", {',
    '    get: function(){ return ih.get.call(this); },',
    '    set: function(v){ return ih.set.call(this, remapText(v)); },',
    '    configurable: true',
    '  });',
    '  if (navigator && navigator.serviceWorker) {',
    '    ["getRegistration","register","unregister","getRegistrations"].forEach(function(m){',
    '      var orig = navigator.serviceWorker[m];',
    '      if (!orig) return;',
    '      navigator.serviceWorker[m] = function(){',
    '        try {',
    '          var p = orig.apply(navigator.serviceWorker, arguments);',
    '          if (p && typeof p.catch === "function") p.catch(function(){});',
    '          return p;',
    '        }',
    '        catch (e) { return Promise.resolve(m === "register" ? null : undefined); }',
    '      };',
    '    });',
    '  }',
    // Cross-origin workers cannot be constructed from the game document;
    // route them through the same-origin game-worker/ proxy (the service
    // worker fetches the script and serves it with JS MIME). Each path
    // segment of the remote URL is encoded individually so real slashes
    // survive in the proxied path: worker code that derives its own
    // directory (e.g. emscripten's scriptDirectory via lastIndexOf('/'))
    // and then fetches same-dir assets keeps working through the SW.
    '  var NW = window.Worker;',
    '  if (NW && appRoot) {',
    '    function proxyWorkerUrl(u){',
    '      return appRoot + "game-worker/" + segEncode(u);',
    '    }',
    '    window.Worker = function(url, opts) {',
    '      var u = String(url);',
    '      try {',
    '        var abs = new URL(u, document.baseURI).href;',
    '        if (/^https?:/.test(abs)) {',
    '          var au = new URL(abs);',
    '          if (au.origin !== location.origin) return new NW(proxyWorkerUrl(abs), opts);',
    '        }',
    '      } catch (e) {}',
    '      return new NW(url, opts);',
    '    };',
    '    try { window.Worker.prototype = NW.prototype; } catch (e) {}',
    '  }',
    '})();',
  ].join('\n');
}

function repairSdkReferences(parsed) {
  const baseEl = parsed.querySelector('base[href]');
  if (!baseEl) return 0;

  let rewritten = 0;
  parsed.querySelectorAll('script[src]').forEach((script) => {
    const src = (script.getAttribute('src') || '').trim();
    // Root-level generic SDK loaded from a youtube-playables repo.
    if (!/^https:\/\/cdn\.jsdelivr\.net\/gh\/[^/]+\/youtube-playables@[^/]+\/ytgame\.js$/.test(src)) return;

    const cleaned = cleanedSdkCache.get(src);
    if (cleaned && cleaned.ok) {
      script.removeAttribute('src');
      script.textContent = cleaned.code;
      rewritten++;
      gameDebug('inlined cleaned ytgame.js', { src, length: cleaned.code.length });
      return;
    }

    // Fallback: per-game customytgame.js (clean of wrappers, but noisier
    // outside YouTube - only used when the SDK fetch failed).
    const perGameSdk = new URL('customytgame.js', baseEl.getAttribute('href')).href;
    if (perGameSdk === src) return;
    script.setAttribute('src', perGameSdk);
    rewritten++;
  });

  if (rewritten) {
    gameDebug('repaired sdk references', { rewritten });
  }
  return rewritten;
}

/**
 * Wrappers that omit a <base> leave relative script/asset references
 * unresolvable inside the srcdoc sandbox (they only work when the game is
 * served from its own directory). Derive the game's base directory from its
 * jsdelivr asset URLs (in src/href attributes AND inline script text, since
 * some wrappers only mention their repo there) and inject a <base> element.
 */
function injectMissingBase(parsed) {
  if (parsed.querySelector('base[href]')) return 0;

  const urls = [];
  parsed.querySelectorAll('[src],[href]').forEach((el) => {
    for (const attr of ['src', 'href']) {
      const val = el.getAttribute(attr);
      if (val && /^https:\/\/cdn\.jsdelivr\.net\/gh\//.test(val)) urls.push(val);
    }
  });
  parsed.querySelectorAll('script').forEach((script) => {
    const text = script.textContent || '';
    const re = /https:\/\/cdn\.jsdelivr\.net\/gh\/[\w.-]+\/[\w.-]+@[\w.-]+\//g;
    let m;
    while ((m = re.exec(text)) && urls.length < 200) urls.push(m[0]);
  });
  if (urls.length < 2) return 0;

  // Longest common directory prefix shared by all asset URLs.
  let prefix = '';
  const parts = urls.map((u) => (u.indexOf('/') ? u.split('/') : []));
  const first = parts[0];
  outer: for (let i = 0; i < first.length - 1; i++) {
    for (const p of parts) {
      if (p[i] !== first[i]) break outer;
    }
    prefix += first[i] + '/';
  }
  // Must point into a pinned gh repo directory (e.g. .../repo@rev/), not a
  // bare host prefix.
  if (!/\/gh\/[^/]+\/[^/]+@[^/]+\/$/.test(prefix)) return 0;

  const base = parsed.createElement('base');
  base.setAttribute('href', prefix);
  const head = parsed.head || parsed.documentElement;
  head.insertBefore(base, head.firstChild);
  gameDebug('injected missing base', { href: prefix, supportingUrls: urls.length });
  return 1;
}

/**
 * Fetches a game wrapper, with a fallback for stale catalog filenames:
 * the wrappers are occasionally renamed (114-f.html -> 114.html), so when
 * the exact URL misses we retry the plain {id}.html form.
 */
const GAME_PAGE_OVERRIDES = [
  {
    // Slendytubbies 1: the catalog wrapper boots via a dead 2018-era loader
    // (Build/ST1.json, Build/UnityLoader.js, *.unityweb parts) that does not
    // exist in web-ports/SLENDYTUBBIES. The repo's own index.html is the
    // working boot (2019 loader + part merging) and even uses relative asset
    // refs, which the runtime remap re-bases onto raw.githubusercontent.
    match: /\/796\.html$/,
    url: 'https://raw.githubusercontent.com/web-ports/SLENDYTUBBIES/main/1/index.html',
  },
];

/**
 * Per-game repairs applied to the raw wrapper HTML before sanitization.
 * These fix broken boot sequences / missing config files in specific
 * catalog wrappers without touching the remote bundles.
 */
function repairWrapperHtml(html, url) {
  if (/\/806\.html$/.test(url)) {
    // Slendytubbies 2: the wrapper instantiates Unity BEFORE its loader
    // script has loaded (head/before-body: ``UnityLoader is not defined``),
    // and passes a Build/Build.json that does not exist in the repo (the
    // repo only ships the split .unityweb parts, which the wrapper merges
    // into blob URLs via an XHR patch). Replace both "Build.json" args with
    // an inline config whose codeUrl/dataUrl match the patch targets, and
    // drop the premature head-block instantiate.
    html = html.replace(/\s*<script>\s*var gameInstance = UnityLoader\.instantiate[^<]*<\/script>/, '');
    html = html.replace(
      /"Build\/Build\.json"/g,
      '{ codeUrl:"Build/Build.asm.code.unityweb", dataUrl:"Build/Build.data.unityweb", frameworkUrl:"Build/Build.asm.framework.unityweb", memoryUrl:"Build/Build.asm.memory.unityweb" }'
    );
  }
  return html;
}

async function fetchGameWrapper(url) {
  const override = GAME_PAGE_OVERRIDES.find((o) => o.match.test(url));
  if (override) {
    const res = await fetch(override.url + '?t=' + Date.now());
    if (res.ok) {
      gameDebug('wrapper page override', { url, to: override.url });
      return { ok: true, text: repairWrapperHtml(await res.text(), url), status: res.status };
    }
    gameDebug('wrapper page override failed, using catalog wrapper', { url });
  }

  const attempt = async (u) => {
    const res = await fetch(u + '?t=' + Date.now());
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, text: repairWrapperHtml(await res.text(), url), status: res.status };
  };

  const r = await attempt(url);
  if (r.ok) return r;

  const slash = url.lastIndexOf('/');
  const base = url.slice(0, slash + 1);
  const file = url.slice(slash + 1);
  // Stale catalog filenames: fall back to the plain {id}.html and {id}-f.html forms.
  const candidates = [file.replace(/^(\d+).*$/, '$1.html'), file.replace(/^(\d+).*$/, '$1-f.html')];
  for (const plain of candidates) {
    if (plain === file) continue;
    const alt = base + plain;
    const a = await attempt(alt);
    if (a.ok) {
      gameDebug('wrapper fetch fallback', { from: url, to: alt, status: r.status });
      return a;
    }
  }
  throw new Error('HTTP ' + r.status);
}

function buildHostCompatScript() {
  return [
    '(function(){',
    "  'use strict';",
    // Many catalog games ping their original iframe host on boot
    // (window.parent.maeExportApis_ ...) and abort when the call throws.
    // Provide a no-op host API so they keep booting.
    '  try {',
    '    var p = window.parent;',
    '    if (p && p !== window && typeof p.maeExportApis_ !== "function") {',
    '      Object.defineProperty(p, "maeExportApis_", { value: function(){}, writable: true, configurable: true });',
    '    }',
    '  } catch (e) {}',
    // Modal dialogs block the whole renderer (the app shares one process
    // with every game tab). Suppress them so a game's alert/confirm/prompt
    // can never freeze the app; the message still lands in the console.
    '  try { window.alert = function(m){ try{ console.warn("[shuttle] alert suppressed:", m); }catch(e){} }; } catch (e) {}',
    '  try { window.confirm = function(){ return false; }; } catch (e) {}',
    '  try { window.prompt = function(){ return null; }; } catch (e) {}',
    '})();',
  ].join('\n');
}

async function waitForSwController(timeoutMs = 4000) {
  if (navigator.serviceWorker.controller) return true;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 150));
    if (navigator.serviceWorker.controller) return true;
  }
  return false;
}

async function trimGameServeCache(cache, maxEntries) {
  try {
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
    }
  } catch (e) {}
}

function sanitizeGameHtml(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');

  try {
    repairSdkReferences(parsed);
    remapDeadCdnUrls(parsed);
    injectMissingBase(parsed);
    const sanitizeStats = stripSidebarAdsFromDoc(parsed);

    // Always install the URL-repair shim: dead CDN sources only surface
    // inside game bundles (CDN_LINK constants, plugin includes, audio),
    // so we can't know from the HTML alone whether a game needs it. It is
    // passive unless a request matches a known-dead source.
    const remapScript = parsed.createElement('script');
    remapScript.textContent = buildUrlRemapScript();
    const head = parsed.head || parsed.documentElement;
    head.insertBefore(remapScript, head.firstChild);

    // Host-API stub: some games notify their original parent host on boot
    // and crash if the call throws.
    const compatScript = parsed.createElement('script');
    compatScript.textContent = buildHostCompatScript();
    head.insertBefore(compatScript, head.firstChild);

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
    (parsed.head || parsed.documentElement).appendChild(blockStyle);

    gameDebug('game html sanitized', {
      title: parsed.title,
      htmlLengthBefore: html.length,
      htmlLengthAfter: parsed.documentElement.outerHTML.length,
      sanitizeStats,
    });

    return '<!doctype html>\n' + parsed.documentElement.outerHTML;
  } catch (err) {
    gameDebug('sanitization/injection failed, serving raw html', { error: err.message, stack: err.stack });
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
      const fetched = await fetchGameWrapper(url);
      const html = fetched.text;
      gameDebug('fetched game html', {
        id,
        url,
        status: fetched.status,
        htmlLength: html.length,
      });
      // Pre-fetch the repo-root youtube SDK (if the wrapper uses it) so the
      // sanitizer can inline a cleaned copy instead of the CDN's wrapped one.
      const sdkSrcMatch = html.match(/<script[^>]+src=["']([^"']*\/youtube-playables@[^"'/]*\/ytgame\.js)["']/);
      if (sdkSrcMatch) {
        await fetchCleanYtgameSdk(sdkSrcMatch[1]);
      }
      // Patch the game HTML: strip third-party ads and trackers.
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

      // Serve the game at a real same-origin URL when the service worker is
      // available: many games parse location.* (host checks, query strings)
      // and crash or misbehave under about:srcdoc. The sanitized snapshot is
      // stored in CacheStorage and the SW serves it back for ./game-serve/...
      let serveUrl = null;
      try {
        if ('caches' in window && 'serviceWorker' in navigator) {
          await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((r) => setTimeout(() => r(undefined), 3000)),
          ]);
          if (await waitForSwController(3000)) {
            serveUrl = new URL('game-serve/' + id + '.html', location.href).href;
            const cache = await caches.open('shuttle-game-serve');
            await cache.put(
              serveUrl,
              new Response(sanitizedHtml, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              })
            );
            trimGameServeCache(cache, 40);
          }
        }
      } catch (err) {
        gameDebug('game-serve cache failed, falling back to srcdoc', { id, error: err.message });
        serveUrl = null;
      }

      if (serveUrl) {
        // The game-serve path only exists on the service worker. A stale SW
        // from an older deployment still controls the page but does not
        // handle the prefix: the iframe request would fall through to the
        // static host and 404. Probe the URL first; anything other than the
        // cached HTML means fall back to srcdoc.
        try {
          const probe = await fetch(serveUrl);
          if (!probe.ok || !(probe.headers.get('content-type') || '').includes('text/html')) {
            gameDebug('game-serve probe failed, falling back to srcdoc', { id, status: probe.status });
            serveUrl = null;
          }
        } catch (err) {
          gameDebug('game-serve probe threw, falling back to srcdoc', { id, error: err.message });
          serveUrl = null;
        }
      }

      if (serveUrl) {
        iframe.src = serveUrl;
        gameDebug('game served at real url', { id, serveUrl });
      } else {
        iframe.srcdoc = sanitizedHtml;
        gameDebug('game iframe srcdoc assigned', {
          id,
          title: gameTitle,
          sanitizedLength: sanitizedHtml.length,
        });
      }
      surface.title = gameTitle;

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
