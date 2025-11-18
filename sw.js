const CACHE_NAME = 'history-app-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon128.png',
  './icons/icon192.png',
  './icons/icon512.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Установлен');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Активация
self.addEventListener('activate', event => {
  console.log('Service Worker: Активирован');
  // Удаляем старые кеши
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Перехват запросов
self.addEventListener('fetch', event => {
  // Пропускаем запросы к API и внешним ресурсам
  if (event.request.url.includes('/api/') || 
      event.request.url.startsWith('http://') && !event.request.url.startsWith(self.location.origin)) {
    return fetch(event.request);
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем кешированную версию или делаем запрос
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          // Кешируем только успешные GET запросы
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
      .catch(() => {
        // Fallback для офлайн режима
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      })
  );
});