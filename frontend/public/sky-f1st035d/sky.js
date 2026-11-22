/* Sky: shared viewer for the two hidden photo-history pages on dxedge.net.
 *
 * One page = one folder (/<slug>/) holding index.html, data/site.json,
 * data/points.geojson, the web JPGs and, served by nginx from the droplet,
 * tiles/<name>.dzi deep-zoom pyramids built by scripts/build_sky_tiles.sh.
 * Everything the page shows comes from site.json; this file has no
 * property-specific text in it.
 *
 * Libraries (vendored next to this file, no CDN): OpenSeadragon 6.1.1 for
 * deep zoom, Leaflet 1.9.4 for the points map and for live Esri slides.
 *
 * Plain ES2018, no build step. Test hook: window.__sky.
 */
(function () {
  'use strict';

  var SHARED = document.currentScript ? document.currentScript.src.replace(/\/[^/]*$/, '') : '../sky-f1st035d';
  var SLUG_DIR = location.pathname.replace(/\/[^/]*$/, '');  // "/ranch-z4swx8er55"
  var DATA = SLUG_DIR + '/data/';
  var TILES = SLUG_DIR + '/tiles/';

  var site = null, points = null, tileIndex = null;
  var slides = [];          // per-slide runtime state
  var current = -1;
  var sections = [];        // all scroll sections (title, slides..., about)
  var scrub = null, mapPanel = null, leafletMap = null;

  // --- small helpers ------------------------------------------------------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }
  function isMobile() { return window.matchMedia('(max-width: 760px)').matches; }
  function fmtCoord(p) { return p.lat.toFixed(7) + ', ' + p.lon.toFixed(7); }

  // --- boot ----------------------------------------------------------------
  Promise.all([
    fetchJSON(DATA + 'site.json'),
    fetchJSON(DATA + 'points.geojson').catch(function () { return { features: [] }; }),
    fetchJSON(TILES + 'index.json').catch(function () { return null; })
  ]).then(function (res) {
    site = res[0]; points = res[1]; tileIndex = res[2];
    build();
  }).catch(function (err) {
    document.getElementById('app').innerHTML = '<p style="padding:80px 24px;color:#ff5d5d">Could not load this page\'s data: ' + esc(err.message) + '</p>';
  });

  function hasTiles(name) {
    if (!tileIndex || !tileIndex.tiles) return false;
    return tileIndex.tiles.indexOf(name) !== -1;
  }

  // --- DOM ------------------------------------------------------------------
  function build() {
    document.title = site.title + ' · ' + site.subtitle;
    var app = document.getElementById('app');
    app.innerHTML = '';

    // top bar
    var top = el('div', 'sky-top');
    top.appendChild(el('span', 'brand', site.title));
    top.appendChild(el('span', 'sub', site.subtitle));
    var counter = el('span', 'counter', '');
    top.appendChild(counter);
    var bMap = el('button', 'sky-btn', 'Map');
    bMap.addEventListener('click', openMap);
    top.appendChild(bMap);
    var bAbout = el('button', 'sky-btn ghost', 'About');
    bAbout.addEventListener('click', function () { sections[sections.length - 1].scrollIntoView(); });
    top.appendChild(bAbout);
    app.appendChild(top);

    var stack = el('div', 'sky-stack');
    app.appendChild(stack);

    // title section
    var t = el('section', 'sky-section sky-title');
    t.appendChild(el('h1', null, site.title));
    t.appendChild(el('p', 'lead', site.subtitle + '. ' + site.slides.length + ' images, oldest first, from ' + site.slides[0].year + ' to ' + site.slides[site.slides.length - 1].year + '.'));
    var loc = el('div', 'loc');
    site.location_lines.forEach(function (l) { loc.appendChild(el('div', null, l)); });
    t.appendChild(loc);
    var acts = el('div', 'actions');
    var start = el('button', 'sky-btn big', 'Start ↓');
    start.addEventListener('click', function () { goTo(0); });
    acts.appendChild(start);
    var mapb = el('button', 'sky-btn big ghost', 'Map of nearby sites');
    mapb.addEventListener('click', openMap);
    acts.appendChild(mapb);
    t.appendChild(acts);
    t.appendChild(el('p', 'hint', 'Scroll or swipe for the next image. Tap or click an image to zoom and pan; tap Done to scroll on. Keys: ↑ ↓ PgUp PgDn Home End, M for the map, Esc to leave zoom.'));
    stack.appendChild(t);
    sections.push(t);

    // slides
    site.slides.forEach(function (s, i) {
      var sec = el('section', 'sky-section sky-slide');
      sec.id = 'y' + s.year + '-' + i;
      sec.dataset.index = i;
      var view = el('div', 'sky-view');
      view.id = 'view-' + i;
      sec.appendChild(view);

      var tap = el('button', 'sky-tap');
      tap.setAttribute('aria-label', 'Zoom into the ' + s.year + ' image');
      tap.appendChild(el('span', null, 'tap to zoom · swipe for next'));
      tap.addEventListener('click', function () { setExplore(i, true); });
      sec.appendChild(tap);

      var done = el('button', 'sky-btn sky-done', '✕ Done zooming');
      done.addEventListener('click', function () { setExplore(i, false); });
      sec.appendChild(done);

      var arrows = el('div', 'sky-arrows');
      var up = el('button', 'sky-btn ghost', '↑');
      up.title = 'Previous'; up.addEventListener('click', function () { goTo(i - 1); });
      var dn = el('button', 'sky-btn ghost', '↓');
      dn.title = 'Next'; dn.addEventListener('click', function () { goTo(i + 1); });
      arrows.appendChild(up); arrows.appendChild(dn);
      sec.appendChild(arrows);

      sec.appendChild(buildCard(s, i));
      stack.appendChild(sec);
      sections.push(sec);
      slides.push({ sec: sec, view: view, osd: null, leaflet: null, ticks: null, srcIndex: 0, explore: false });
    });

    // about / credits
    var about = buildAbout();
    stack.appendChild(about);
    sections.push(about);

    // scrubber
    scrub = buildScrub();
    app.appendChild(scrub.root);

    // map panel
    mapPanel = buildMapPanel();
    app.appendChild(mapPanel.root);

    // Which slide is "current": the one covering the middle of the viewport.
    // Driven by scroll (rAF-throttled) rather than IntersectionObserver alone,
    // because a fast jump past several slides delivers their observer entries
    // in one batch and the last one processed is not always the one on screen.
    var rafPending = false;
    function updateCurrent() {
      rafPending = false;
      var mid = window.innerHeight / 2, best = -1, bestD = Infinity;
      for (var k = 0; k < slides.length; k++) {
        var r = slides[k].sec.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= window.innerHeight) continue;
        var d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < bestD) { bestD = d; best = k; }
      }
      if (best >= 0) {
        var rb = slides[best].sec.getBoundingClientRect();
        if (rb.top < mid && rb.bottom > mid) setCurrent(best);
      }
    }
    function onScroll() { if (!rafPending) { rafPending = true; requestAnimationFrame(updateCurrent); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    var io = new IntersectionObserver(onScroll, { threshold: [0.25, 0.5, 0.75] });
    slides.forEach(function (sl) { io.observe(sl.sec); });

    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', function () { slides.forEach(function (sl) { if (sl.leaflet) sl.leaflet.invalidateSize(); }); });

    // deep link: #y1994 or #3
    var h = location.hash.replace('#', '');
    var startIdx = -1;
    if (/^\d+$/.test(h)) startIdx = Math.min(+h, slides.length - 1);
    else if (/^y\d{4}/.test(h)) startIdx = site.slides.findIndex(function (s) { return String(s.year) === h.slice(1, 5); });
    if (startIdx >= 0) setTimeout(function () { goTo(startIdx, true); }, 50);
    else ensureLoaded(0);

    counter.id = 'sky-counter';
    window.__sky = { site: site, slides: slides, goTo: goTo, current: function () { return current; }, setExplore: setExplore, openMap: openMap, closeMap: closeMap, hasTiles: hasTiles };
  }

  function buildCard(s, i) {
    var card = el('div', 'sky-card' + (isMobile() ? ' collapsed' : ''));
    var head = el('div', 'head');
    head.appendChild(el('span', 'year', String(s.year)));
    head.appendChild(el('span', 'date', s.date));
    head.appendChild(el('span', 'tog', isMobile() ? '▲ details' : '▼'));
    head.addEventListener('click', function () {
      card.classList.toggle('collapsed');
      head.querySelector('.tog').textContent = card.classList.contains('collapsed') ? '▲ details' : '▼';
    });
    card.appendChild(head);

    var body = el('div', 'body');
    var dl = el('dl');
    function row(k, v) { dl.appendChild(el('dt', null, k)); var dd = el('dd'); if (typeof v === 'string') dd.textContent = v; else dd.appendChild(v); dl.appendChild(dd); }
    row('Source', s.source);
    row('Owner', s.owner);
    var locd = el('div');
    locd.appendChild(el('div', null, site.label));
    locd.appendChild(el('div', null, fmtCoord(site.pin)));
    if (site.location_lines[1] && /Sec|T\d/.test(site.location_lines[1]) && site.location_lines[1] !== site.label) locd.appendChild(el('div', 'dim', site.location_lines[1].split(';')[0]));
    row('Location', locd);
    body.appendChild(dl);

    if (s.facts && s.facts.length) {
      var ul = el('ul', 'facts');
      s.facts.forEach(function (f) { ul.appendChild(el('li', null, f)); });
      body.appendChild(ul);
    }
    if (s.caption) body.appendChild(el('p', 'caption', s.caption));

    if (s.hires.length > 1) {
      var alts = el('div', 'alts');
      s.hires.forEach(function (h, k) {
        var b = el('button', 'sky-btn' + (k === 0 ? ' on' : ''), h.label || h.name);
        b.addEventListener('click', function () {
          slides[i].srcIndex = k;
          alts.querySelectorAll('button').forEach(function (x, j) { x.classList.toggle('on', j === k); });
          mountSlide(i, true);
        });
        alts.appendChild(b);
      });
      body.appendChild(alts);
    }
    var note = el('div', 'note');
    note.id = 'note-' + i;
    body.appendChild(note);
    body.appendChild(el('div', 'credit', (s.esri ? 'Esri, Maxar/Vantor, Earthstar Geographics, Microsoft, and the GIS User Community. ' : '') + (/Sentinel/.test(s.source) ? 'Contains modified Copernicus Sentinel data ' + s.year + '. ' : '') + 'Image ' + (i + 1) + ' of ' + site.slides.length + '.'));
    card.appendChild(body);
    return card;
  }

  function buildAbout() {
    var a = el('section', 'sky-section sky-about');
    a.appendChild(el('h2', null, 'About this record'));
    a.appendChild(el('p', null, site.subtitle + '. Images are shown oldest first with the year, date, source, land owner for that era, the exact location and a few facts. Owners are named only where a cited source supports it; everything else says unknown.'));

    a.appendChild(el('h3', null, 'Timeline'));
    var ul = el('ul');
    site.intro.forEach(function (x) { ul.appendChild(el('li', null, x)); });
    a.appendChild(ul);

    a.appendChild(el('h3', null, 'Land owner by era'));
    if (site.owners_note) a.appendChild(el('p', 'note', site.owners_note));
    var tb = el('table');
    var thead = el('thead'); var tr = el('tr');
    ['Era', 'Owner / control', 'Basis'].forEach(function (h) { tr.appendChild(el('th', null, h)); });
    thead.appendChild(tr); tb.appendChild(thead);
    var tbody = el('tbody');
    site.owners.forEach(function (r) { var tr2 = el('tr'); r.forEach(function (c) { tr2.appendChild(el('td', null, c)); }); tbody.appendChild(tr2); });
    tb.appendChild(tbody);
    a.appendChild(tb);

    if (site.homesteaders) {
      a.appendChild(el('h3', null, 'Homesteader families'));
      var hu = el('ul');
      site.homesteaders.forEach(function (x) { hu.appendChild(el('li', null, x)); });
      a.appendChild(hu);
    }

    a.appendChild(el('h3', null, 'Image credits'));
    var cu = el('ul');
    site.credits.imagery.forEach(function (x) { cu.appendChild(el('li', null, x)); });
    a.appendChild(cu);
    a.appendChild(el('h3', null, 'History and map points'));
    var hu2 = el('ul');
    site.credits.history.forEach(function (x) { hu2.appendChild(el('li', null, x)); });
    a.appendChild(hu2);
    a.appendChild(el('h3', null, 'Accuracy and terms'));
    a.appendChild(el('p', 'dim', site.credits.accuracy));
    a.appendChild(el('p', 'note', site.credits.esri_note));

    var sis = el('div', 'sister');
    sis.appendChild(el('span', 'dim', 'Sister site:'));
    var link = el('a', null, site.sister.title);
    link.href = '/' + site.sister.slug + '/';
    sis.appendChild(link);
    var idx = el('a', 'dim', 'both pages');
    idx.href = SHARED + '/';
    sis.appendChild(idx);
    a.appendChild(sis);

    var f = el('footer');
    f.appendChild(el('div', null, 'Source files: data/site.json, data/points.geojson, data/history.md' + (site.homesteaders ? ', data/homesteaders.md' : '') + ' in this folder. Hi-res originals: GitHub release sky-assets-v1 of sagejw-svg/dxedge. Rebuild: scripts/build_sky_tiles.sh.'));
    f.appendChild(el('div', null, 'Viewer: OpenSeadragon 6.1.1 (BSD-3) and Leaflet 1.9.4 (BSD-2), vendored. Basemap: USGS The National Map.'));
    a.appendChild(f);
    return a;
  }

  // --- scrubber -----------------------------------------------------------------
  function buildScrub() {
    // Dots are spaced by slide index, not by year: the series is dense after
    // 2010 and sparse before 1970, so a true year scale would pile a dozen
    // dots into a few pixels. Decade labels sit at the first slide of each
    // decade, which keeps the sense of time without the overlap.
    var root = el('nav', 'sky-scrub');
    root.setAttribute('aria-label', 'Timeline');
    root.appendChild(el('div', 'rail'));
    var n = site.slides.length;
    var mobile = isMobile();
    function pos(i) { return n === 1 ? 50 : 4 + 92 * i / (n - 1); }
    function place(e, p) { if (mobile) e.style.left = p + '%'; else e.style.top = p + '%'; }
    var dots = [], labels = [], lastDecade = -1, lastLabelPos = -99;
    var minGap = mobile ? 9 : 4;   // percent of rail between decade labels
    site.slides.forEach(function (s, i) {
      var p = pos(i);
      var decade = Math.floor(s.year / 10) * 10;
      if (decade !== lastDecade && p - lastLabelPos >= minGap) {
        var tk = el('div', 'tick'); place(tk, p); root.appendChild(tk);
        var lb = el('div', 'tick-label', String(decade)); place(lb, p); root.appendChild(lb);
        labels.push({ el: lb, p: p });
        lastDecade = decade; lastLabelPos = p;
      }
      var d = el('button', 'dot'); place(d, p);
      d.title = s.year + ' · ' + s.date;
      d.setAttribute('aria-label', 'Go to ' + s.year);
      d.addEventListener('click', function () { goTo(i); });
      root.appendChild(d);
      dots.push({ el: d, p: p });
    });
    var cur = el('div', 'cur', '');
    root.appendChild(cur);
    return {
      root: root, dots: dots, cur: cur, mobile: mobile,
      set: function (i) {
        dots.forEach(function (d, k) { d.el.classList.toggle('on', k === i); });
        if (i < 0) { cur.textContent = ''; return; }
        cur.textContent = site.slides[i].year;
        place(cur, dots[i].p);
        // keep the current-year label from sitting on a decade label
        labels.forEach(function (l) { l.el.style.visibility = Math.abs(l.p - dots[i].p) < (mobile ? 7 : 3) ? 'hidden' : ''; });
      }
    };
  }

  // --- navigation ---------------------------------------------------------------
  function goTo(i, instant) {
    if (i < 0 || i >= slides.length) return;
    if (current >= 0) setExplore(current, false);
    slides[i].sec.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
    ensureLoaded(i);
  }

  function setCurrent(i) {
    if (i === current) return;
    if (current >= 0) { slides[current].sec.classList.remove('current'); setExplore(current, false); }
    current = i;
    slides[i].sec.classList.add('current');
    scrub.set(i);
    var c = document.getElementById('sky-counter');
    if (c) c.textContent = site.slides[i].year + ' · ' + (i + 1) + '/' + slides.length;
    if (history.replaceState) history.replaceState(null, '', '#y' + site.slides[i].year + '-' + i);
    ensureLoaded(i);
  }

  function ensureLoaded(i) {
    // Mount the current slide and its neighbours; unmount the rest to free memory.
    slides.forEach(function (sl, k) {
      if (Math.abs(k - i) <= 1) mountSlide(k, false);
      else if (Math.abs(k - i) > 2) unmountSlide(k);
    });
  }

  function onKey(ev) {
    if (mapPanel.root.classList.contains('open')) {
      if (ev.key === 'Escape' || ev.key === 'm' || ev.key === 'M') closeMap();
      return;
    }
    if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    var cur = current < 0 ? -1 : current;
    switch (ev.key) {
      case 'ArrowDown': case 'PageDown': case 'j': ev.preventDefault(); goTo(Math.min(cur + 1, slides.length - 1)); break;
      case 'ArrowUp': case 'PageUp': case 'k': ev.preventDefault(); goTo(Math.max(cur - 1, 0)); break;
      case 'Home': ev.preventDefault(); goTo(0); break;
      case 'End': ev.preventDefault(); goTo(slides.length - 1); break;
      case 'Escape': slides.forEach(function (sl, k) { if (sl.explore) setExplore(k, false); }); break;
      case 'm': case 'M': openMap(); break;
      case 'Enter': case 'z': if (cur >= 0) setExplore(cur, !slides[cur].explore); break;
    }
  }

  // --- explore mode (gestures on/off) -------------------------------------------
  function setExplore(i, on) {
    var sl = slides[i];
    if (!sl || sl.explore === on) return;
    sl.explore = on;
    sl.sec.classList.toggle('explore', on);
    if (sl.osd) {
      sl.osd.setMouseNavEnabled(on);
      if (sl.osd.outerTracker) sl.osd.outerTracker.setTracking(on);
    }
    var s = site.slides[i];
    if (s.esri && s.esri_live && esriTemplate(s.esri_live)) mountSlide(i, false);
    if (on) sl.sec.scrollIntoView({ block: 'start' });
  }

  // --- slide mounting -------------------------------------------------------------
  function unmountSlide(i) {
    var sl = slides[i];
    if (sl.osd) {
      var v = sl.osd; sl.osd = null;
      // Destroying a viewer whose tile source is still being fetched makes
      // OpenSeadragon assert when the fetch lands. Let 'open' finish first.
      if (v.__opened) { try { v.destroy(); } catch (e) { } }
      else v.__destroyWhenOpen = true;
    }
    if (sl.leaflet) {
      try { sl.leaflet.remove(); } catch (e) { }
      sl.leaflet = null;
      // Leaflet leaves its classes, tabindex and inline style on the container.
      sl.view.className = 'sky-view';
      sl.view.removeAttribute('tabindex');
      sl.view.removeAttribute('style');
    }
    sl.view.innerHTML = '';
    if (sl.ticks) { sl.ticks.remove(); sl.ticks = null; }
    sl.mounted = null;
  }

  // Four thin red ticks on the edges of the slide frame, aligned with the pin:
  // top and bottom share the pin's x, left and right share its y. Each tick
  // hides when the pin is off that edge's axis. The caller recomputes on every
  // move, zoom and resize.
  function makeTicks(sl) {
    if (sl.ticks) sl.ticks.remove();
    var box = el('div', 'sky-ticks');
    var t = { top: el('div', 'tick top'), bottom: el('div', 'tick bottom'), left: el('div', 'tick left'), right: el('div', 'tick right') };
    Object.keys(t).forEach(function (k) { box.appendChild(t[k]); });
    sl.sec.appendChild(box);
    sl.ticks = box;
    return {
      // x, y: pin position in the viewer element's pixels. The tick frame is
      // inset from the viewer by the top bar and the scrubber, so translate.
      update: function (x, y) {
        var vr = sl.view.getBoundingClientRect(), br = box.getBoundingClientRect();
        x = x + vr.left - br.left; y = y + vr.top - br.top;
        var w = br.width, h = br.height;
        var xin = x >= 0 && x <= w, yin = y >= 0 && y <= h;
        t.top.style.display = t.bottom.style.display = xin ? '' : 'none';
        t.left.style.display = t.right.style.display = yin ? '' : 'none';
        if (xin) { t.top.style.left = t.bottom.style.left = x + 'px'; }
        if (yin) { t.left.style.top = t.right.style.top = y + 'px'; }
      }
    };
  }

  function mountSlide(i, force) {
    var sl = slides[i], s = site.slides[i];
    var h = s.hires[sl.srcIndex] || s.hires[0];
    var live = !!(s.esri && s.esri_live && esriTemplate(s.esri_live) && sl.explore);
    var key = (h ? h.name : s.file) + ':' + sl.srcIndex + (live ? ':live' : '');
    if (!force && sl.mounted === key) return;
    unmountSlide(i);
    sl.mounted = key;
    var note = document.getElementById('note-' + i);
    note.textContent = '';

    // 1. Esri slide with a live source, and only while the user is exploring
    //    it: stream Esri tiles with attribution. While merely scrolled past,
    //    the slide is a plain picture like every other, so a live map never
    //    holds events, focus or network while it is just on screen.
    if (live) {
      mountLeafletSlide(i, s, h);
      return;
    }
    // 2. Deep zoom from our own pyramid (never for Esri images).
    if (h && !s.esri && hasTiles(h.name)) {
      mountOSD(i, { tileSource: TILES + h.name + '.dzi', w: h.width, h: h.height, pin: h.pin_px });
      return;
    }
    // 3. Fallback: the committed web JPG, a clean pin-centred window with
    //    nothing drawn on it; the pin is at its centre (site.json "web").
    var web = s.web || {};
    mountOSD(i, { tileSource: { type: 'image', url: DATA + s.file }, fallback: true, w: web.width, h: web.height, pin: web.pin_px });
    if (s.esri && s.esri_live && esriTemplate(s.esri_live)) note.textContent = 'Esri image, web copy. Tap to zoom for the live Esri imagery (streamed with attribution; no re-hosted tiles).';
    else if (s.esri) note.textContent = 'Esri image: shown from the web copy only (' + (s.esri_live && s.esri_live.note ? s.esri_live.note + '; ' : '') + 'no re-hosted tiles). Zoom is limited.';
    else if (h) note.textContent = 'Deep-zoom tiles for this image are not available yet; showing the web copy.';
  }

  function mountOSD(i, opt) {
    var sl = slides[i];
    var viewer = OpenSeadragon({
      element: sl.view,
      prefixUrl: SHARED + '/vendor/openseadragon/images/',
      tileSources: opt.tileSource,
      showNavigationControl: true,
      navigationControlAnchor: OpenSeadragon.ControlAnchor.TOP_LEFT,
      showRotationControl: false,
      showFullPageControl: false,
      mouseNavEnabled: sl.explore,
      visibilityRatio: 0.6,
      minZoomImageRatio: 0.6,
      maxZoomPixelRatio: opt.fallback ? 2.5 : 1.6,
      gestureSettingsMouse: { scrollToZoom: true, clickToZoom: false, dblClickToZoom: true, flickEnabled: true },
      gestureSettingsTouch: { pinchToZoom: true, flickEnabled: true, dblClickToZoom: true },
      animationTime: 0.6,
      springStiffness: 8,
      immediateRender: true,
      preserveViewport: false,
      crossOriginPolicy: false,
      loadTilesWithAjax: false
    });
    viewer.addHandler('open', function () {
      viewer.__opened = true;
      if (viewer.__destroyWhenOpen) { try { viewer.destroy(); } catch (e) { } return; }
      var size = viewer.world.getItemAt(0).getContentSize();
      var W = size.x, H = size.y;
      // Location marker: four edge ticks on the frame, not a dot on the image.
      if (opt.pin) {
        var ticks = makeTicks(sl);
        var vpPin = new OpenSeadragon.Point(opt.pin[0] / W, opt.pin[1] / W);
        var updateTicks = function () {
          if (!sl.osd) return;
          var p = viewer.viewport.viewportToViewerElementCoordinates(vpPin);
          ticks.update(p.x, p.y);
        };
        ['animation', 'viewport-change', 'resize', 'rotate', 'flip', 'animation-finish'].forEach(function (ev) { viewer.addHandler(ev, updateTicks); });
        updateTicks();
      }
      // Opening view: whole image for small frames, a window around the pin for big sheets.
      if (opt.pin && W > 2600) {
        var win = Math.max(2000, W / 3);
        var ar = sl.view.clientWidth / Math.max(1, sl.view.clientHeight);
        var ww = win / W, wh = (win / ar) / W;
        viewer.viewport.fitBounds(new OpenSeadragon.Rect(opt.pin[0] / W - ww / 2, opt.pin[1] / W - wh / 2, ww, wh), true);
      }
    });
    viewer.addHandler('open-failed', function () {
      viewer.__opened = true;
      if (viewer.__destroyWhenOpen) { try { viewer.destroy(); } catch (e) { } return; }
      var note = document.getElementById('note-' + i);
      if (!opt.fallback) { var web = site.slides[i].web || {}; opt.fallback = true; sl.mounted = null; mountOSD(i, { tileSource: { type: 'image', url: DATA + site.slides[i].file }, fallback: true, w: web.width, h: web.height, pin: web.pin_px }); if (note) note.textContent = 'Tiles failed to load; showing the web copy.'; }
    });
    sl.osd = viewer;
  }

  // Esri live tiles. Templates follow Esri's public REST tile services.
  function esriTemplate(live) {
    if (live.kind === 'current') return 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    if (live.kind === 'wayback' && live.release) return 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/' + live.release + '/{z}/{y}/{x}';
    return null;
  }

  function mountLeafletSlide(i, s, h) {
    var sl = slides[i];
    var m = L.map(sl.view, { zoomControl: true, attributionControl: true, maxZoom: s.esri_live.max_zoom || 19, minZoom: 12, zoomSnap: 0.5 });
    L.tileLayer(esriTemplate(s.esri_live), { maxNativeZoom: s.esri_live.max_zoom || 19, maxZoom: 19, attribution: 'Esri, Maxar/Vantor, Earthstar Geographics, Microsoft, and the GIS User Community' }).addTo(m);
    var pin = [site.pin.lat, site.pin.lon];
    m.setView(pin, 17);
    var ticks = makeTicks(sl);
    var updateTicks = function () {
      if (!sl.leaflet) return;
      var p = m.latLngToContainerPoint(pin);
      ticks.update(p.x, p.y);
    };
    m.on('move zoom moveend zoomend resize viewreset', updateTicks);
    updateTicks();
    sl.leaflet = m;
    var note = document.getElementById('note-' + i);
    note.textContent = 'Live Esri World Imagery (current release), streamed from Esri with attribution. The committed web copy is from ' + s.date + '. Tap Done to return to the picture.';
    setTimeout(function () { m.invalidateSize(); }, 50);
  }

  // --- points map -----------------------------------------------------------------
  function buildMapPanel() {
    var root = el('div', 'sky-mappanel');
    root.setAttribute('role', 'dialog');
    var bar = el('div', 'bar');
    bar.appendChild(el('span', 't', 'Nearby historic sites · ' + site.label));
    var base = el('select', 'sky-btn');
    [['topo', 'USGS topo'], ['img', 'USGS imagery']].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; base.appendChild(op); });
    bar.appendChild(base);
    var close = el('button', 'sky-btn', '✕ Close');
    close.addEventListener('click', closeMap);
    bar.appendChild(close);
    root.appendChild(bar);
    var mapDiv = el('div', 'map');
    root.appendChild(mapDiv);
    var legend = el('div', 'legend');
    (site.map.legend || []).forEach(function (l) {
      var sp = el('span');
      var sw = el('span', 'sw sky-mk ' + l[0]);
      sp.appendChild(sw); sp.appendChild(document.createTextNode(l[1]));
      legend.appendChild(sp);
    });
    var sp0 = el('span'); sp0.appendChild(el('span', 'sw sky-mk pin')); sp0.appendChild(document.createTextNode(site.label)); legend.insertBefore(sp0, legend.firstChild);
    root.appendChild(legend);
    var unknown = el('div', 'unknown');
    root.appendChild(unknown);
    return { root: root, mapDiv: mapDiv, base: base, unknown: unknown };
  }

  var baseLayers = null;
  function openMap() {
    mapPanel.root.classList.add('open');
    if (!leafletMap) {
      var pin = [site.pin.lat, site.pin.lon];
      leafletMap = L.map(mapPanel.mapDiv, { zoomControl: true, maxZoom: 16, minZoom: 7 });
      baseLayers = {
        topo: L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', { attribution: 'USGS The National Map: National Boundaries Dataset, 3DEP Elevation Program, Geographic Names Information System, National Hydrography Dataset, National Land Cover Database, National Structures Dataset, and National Transportation Dataset; USGS Global Ecosystems; U.S. Census Bureau TIGER/Line data; USFS Road Data; Natural Earth Data; U.S. Department of State HIU; NOAA National Centers for Environmental Information', maxZoom: 16 }),
        img: L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}', { attribution: 'USGS The National Map: Orthoimagery', maxZoom: 16 })
      };
      baseLayers.topo.addTo(leafletMap);
      mapPanel.base.addEventListener('change', function () {
        Object.keys(baseLayers).forEach(function (k) { leafletMap.removeLayer(baseLayers[k]); });
        baseLayers[mapPanel.base.value].addTo(leafletMap);
      });
      var icons = site.map.icons || {};
      var unknownItems = [];
      var bounds = L.latLngBounds([pin]);
      (points.features || []).forEach(function (f) {
        var p = f.properties || {};
        var cls = icons[p.type] || 'mine-gray';
        var dist = p.distance_km != null ? p.distance_km + ' km ' + (p.direction_from_pin || '') : (p.dist_from_pin || '');
        if (!f.geometry || !f.geometry.coordinates) {
          unknownItems.push('<b>' + esc(p.name) + '</b>' + (p.dates ? ' · ' + esc(p.dates) : '') + (p.note || p.notes ? ' · ' + esc(p.note || p.notes) : '') + (p.source ? ' <span class="dim">(' + esc(String(p.source).split(/\s*;\s*/)[0].replace(/^https?:\/\//, '')) + ')</span>' : ''));
          return;
        }
        var ll = [f.geometry.coordinates[1], f.geometry.coordinates[0]];
        var glyph = cls === 'pin' ? '' : cls === 'po' ? '✉' : cls === 'landmark' ? '🏛' : cls === 'rancho' ? '📜' : cls === 'fire' ? '🔥' : '⛏';
        var size = cls === 'pin' ? 16 : 22;
        var mk = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="sky-mk ' + cls + '" style="width:' + size + 'px;height:' + size + 'px">' + glyph + '</div>', iconSize: [size, size], iconAnchor: [size / 2, size / 2] }), title: p.name });
        var src = p.source ? String(p.source).split(/\s*;\s*/).map(function (u) { return /^https?:/.test(u) ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\//, '').split('/')[0]) + '</a>' : esc(u); }).join(', ') : '';
        mk.bindPopup('<b>' + esc(p.name) + '</b><br>' + (p.dates ? esc(p.dates) + '<br>' : '') + (dist ? 'From the pin: ' + esc(dist) + '<br>' : '') + (p.note || p.notes ? esc(p.note || p.notes) + '<br>' : '') + (src ? '<span style="color:#8a8a8a">Source: ' + src + '</span>' : ''));
        mk.addTo(leafletMap);
        if (cls !== 'pin' && (p.distance_km == null || p.distance_km < 20)) bounds.extend(ll);
      });
      if (!(points.features || []).some(function (f) { return f.properties && icons[f.properties.type] === 'pin'; })) {
        L.marker(pin, { icon: L.divIcon({ className: '', html: '<div class="sky-mk pin" style="width:16px;height:16px"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }) }).bindPopup('<b>' + esc(site.label) + '</b><br>' + fmtCoord(site.pin)).addTo(leafletMap);
      }
      leafletMap.fitBounds(bounds.pad(0.15), { maxZoom: site.map.zoom || 12 });
      mapPanel.unknown.innerHTML = unknownItems.length ? '<b>Not on the map (location unknown or no point):</b><ul>' + unknownItems.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '';
    }
    setTimeout(function () { leafletMap.invalidateSize(); }, 30);
  }
  function closeMap() { mapPanel.root.classList.remove('open'); }
})();
