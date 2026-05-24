// SuperWoman OS — Service Worker v7.1
// GitHub Auto-Update + Cache robusto + offline + sync
const CACHE_NAME = 'sw-os-v71-cache';
const CACHE_VERSION = 'v7.1';
const APP_VERSION = '7.1.0';
const GITHUB_PAGES_URL = 'https://luhpessoa33-coder.github.io/SuperWoman-OS-v5/';
const VERSION_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutos

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

// Activate: limpar caches antigos + iniciar auto-update
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

  const url = new URL(event.request.url);
  const isExternal = !url.origin.includes(self.location.hostname) &&
                     !url.hostname.includes('github.io') &&
                     !url.hostname.includes('scispace.co');

  if (isExternal) return;

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
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ══ GITHUB AUTO-UPDATE SYSTEM ══
async function checkForUpdates() {
  try {
    const response = await fetch(GITHUB_PAGES_URL + 'manifest.json?t=' + Date.now(), {
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const manifest = await response.json();
    const remoteVersion = manifest.version || '';
    if (remoteVersion && remoteVersion !== APP_VERSION) {
      // Nova versão disponível!
      console.log(`[SW] Nova versão detectada: ${remoteVersion} (atual: ${APP_VERSION})`);
      // Notificar todos os clientes
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          currentVersion: APP_VERSION,
          newVersion: remoteVersion,
          source: 'github'
        });
      });
      // Limpar cache antigo para forçar refresh
      await caches.delete(CACHE_NAME);
      return remoteVersion;
    }
    return null;
  } catch(e) {
    console.log('[SW] Update check failed (offline?):', e.message);
    return null;
  }
}

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

  if (event.data.type === 'CHECK_UPDATE') {
    checkForUpdates();
  }

  if (event.data.type === 'GET_VERSION') {
    event.source.postMessage({
      type: 'VERSION_INFO',
      version: APP_VERSION,
      cacheVersion: CACHE_VERSION,
      github: GITHUB_PAGES_URL
    });
  }
});

// Background Sync
self.addEventListener('sync', event => {
  if (event.tag === 'check-updates') {
    event.waitUntil(checkForUpdates());
  }
});

// Periodic check via interval (quando SW está ativo)
setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);
