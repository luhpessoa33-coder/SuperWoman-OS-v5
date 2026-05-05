// SuperWoman OS — Service Worker v5.6
// Cache robusto + offline + sync + background fetch
const CACHE_NAME = 'sw-os-v56-cache';
const CACHE_VERSION = 'v5.6';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-152.png',
  './icons/icon-144.png'
];

// Install: cache assets essenciais
self.addEventListener('install', event => {
  console.log(`[SW ${CACHE_VERSION}] Installing...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => {
        console.log(`[SW ${CACHE_VERSION}] Cached ${STATIC_ASSETS.length} assets`);
        return self.skipWaiting();
      })
      .catch(err => {
        console.warn('[SW] Cache failed (non-fatal):', err);
        return self.skipWaiting();
      })
  );
});

// Activate: limpar caches antigos
self.addEventListener('activate', event => {
  console.log(`[SW ${CACHE_VERSION}] Activating...`);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log(`[SW] Deleting old cache: ${k}`);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network first, fallback to cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Deixar passar chamadas externas (Gemini API, ipify, weather, etc.)
  const url = new URL(event.request.url);
  const isExternal = !url.origin.includes(self.location.hostname) &&
                     !url.hostname.includes('github.io') &&
                     !url.hostname.includes('scispace.co');

  if (isExternal) {
    // Externo: sempre network, sem cache (Gemini, APIs, etc.)
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback para index.html em navegação
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// Mensagens do app principal
self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CACHE_UPDATE') {
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(STATIC_ASSETS);
    });
  }
});

// Background Sync (quando voltar online)
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
});
