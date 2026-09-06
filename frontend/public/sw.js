// DXEdge Service Worker
// Caches static assets for offline/fast load. Never caches API responses.

const CACHE_NAME = 'dxedge-v18'
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
  const mutable = request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.startsWith('/crane-cab/') ||
    (!isVersionedAsset(url) && url.pathname.endsWith('.js'))

  if (mutable) {
    event.respondWith(
      fetch(request).then(response => {
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
