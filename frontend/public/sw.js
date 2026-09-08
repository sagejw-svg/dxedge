// DXEdge Service Worker
// Caches static assets for offline/fast load. Never caches API responses.

const CACHE_NAME = 'dxedge-v33'
const STATIC_ASSETS = [
  '/',
  '/world.json',
  '/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Cache-first is only safe for a URL whose content can never change: a Vite
// bundle carries a content hash, so a new build is a new URL. Everything else
// on this site keeps its filename across deploys - the page shell at /, and the
// whole Crane Cab folder, which ships as plain ES modules with stable names.
// Serving those from the cache is what made deploys invisible to anyone who had
// visited before: the shell kept pointing at the previous bundle and the game
// kept running the previous phase, with no way in for a fix.
function isVersionedAsset(url) {
  return url.pathname.startsWith('/assets/')
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never cache API calls, WebSocket, health reports, or external resources
  if (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/ws/') ||
      url.pathname.startsWith('/health/') ||
      url.origin !== location.origin) {
    return // Let network handle it
  }

  if (request.method !== 'GET') return

  // Network-first for anything whose URL outlives its content. The cache is
  // still written, so it stays the offline fallback, but a reachable network
  // always wins and a deploy lands on the next load.
  //
  // That includes /crane-cab/audio/, the ground crew's voice clips, and it is
  // meant to. They look like immutable assets - a hundred small files that
  // rarely change - and moving them to the cache-first branch below would save a
  // few kilobytes a load. It would also mean a re-recorded line never reaching
  // anyone who had visited before, unless whoever re-recorded it remembered to
  // bump CACHE_NAME. That manual step is exactly what put a year-old build in
  // front of real people last time. The clips are ~10 KB each and only the ones
  // a lift actually uses are ever fetched. Leave them here.
  const mutable = request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.startsWith('/crane-cab/') ||
    (!isVersionedAsset(url) && url.pathname.endsWith('.js'))

  if (mutable) {
    // cache: 'reload' is the whole point. A bare fetch() inside a service worker
    // still goes through the browser's own HTTP cache, so "network first" was
    // network first only for URLs the HTTP cache had nothing fresh for. Every
    // client that visited while nginx was still marking these paths
    // `max-age=31536000, immutable` has entries that stay fresh until 2027, and
    // for those clients this fetch returned the year-old file without a single
    // packet leaving the machine. The symptom was a current index.html running
    // Phase 0 modules: 708 bytes of pendulum.js inside a page that had every
    // later feature in its markup. curl could never see it, because curl has no
    // HTTP cache. 'reload' bypasses that cache for the request and rewrites the
    // stored entry with what the server actually has, so one visit repairs it.
    event.respondWith(
      fetch(request.url, { cache: 'reload', credentials: 'same-origin' }).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      }).catch(() => caches.match(request).then(cached => cached || Response.error()))
    )
    return
  }

  // Cache-first for content-hashed assets and the small precached set.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      })
    })
  )
})
