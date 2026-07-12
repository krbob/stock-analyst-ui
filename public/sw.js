const CACHE_NAME = 'stock-analyst-v3';
const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/theme-init.js',
];

async function buildAssets() {
  const response = await fetch('/asset-manifest.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Asset manifest request failed: ${response.status}`);

  const manifest = await response.json();
  if (!Array.isArray(manifest.assets) || !manifest.assets.every(
    (asset) => typeof asset === 'string' && /^\/assets\/[A-Za-z0-9._/-]+$/.test(asset),
  )) {
    throw new Error('Asset manifest is invalid');
  }
  return manifest.assets;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    buildAssets()
      .then((assets) => caches.open(CACHE_NAME)
        .then((cache) => cache.addAll([...SHELL_ASSETS, ...assets])))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Skip API calls and non-same-origin requests
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          return response;
        })
        .catch(async () => (
          await caches.match('/')
          ?? await caches.match('/index.html')
          ?? Response.error()
        ))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => await caches.match(request, { ignoreSearch: true }) ?? Response.error())
  );
});
