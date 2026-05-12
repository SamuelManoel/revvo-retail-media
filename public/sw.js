// Service worker do site institucional (Revvo).
// Estratégia: network-first com fallback ao cache. Mantém o site instalável
// como PWA e oferece uma experiência offline básica para a landing page.
// Não interfere em rotas /api/* nem em assets do admin (/login, /(admin)).

const CACHE_NAME = 'revvo-landing-v1'
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll falha se 1 recurso falhar — usa addMany tolerante
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => { /* ignora pré-cache não disponível */ })
        )
      )
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Não interfere em APIs nem em rotas autenticadas (admin/login)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/admin')
  ) {
    return
  }

  // Same-origin: network-first com fallback ao cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cacheia respostas básicas pra fallback offline
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    )
  }
})
