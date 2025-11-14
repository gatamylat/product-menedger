// Service Worker для офлайн работы
const CACHE_NAME = 'product-manager-v1';

// Динамически определяем базовый путь
const BASE_PATH = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/'));

// URL для кэширования - относительные пути
const urlsToCache = [
    './',
    './product-manager.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
].filter(url => url); // Фильтруем пустые значения

// Установка Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Кэш открыт');
                // Пытаемся добавить каждый URL отдельно
                return Promise.all(
                    urlsToCache.map(url => {
                        return cache.add(url).catch(err => {
                            console.warn(`Не удалось кэшировать ${url}:`, err);
                        });
                    })
                );
            })
    );
    // Активируем воркер сразу
    self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Берем контроль над всеми клиентами
            return self.clients.claim();
        })
    );
});

// Обработка запросов
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Возвращаем кэшированный ответ если есть
                if (response) {
                    return response;
                }

                // Клонируем запрос
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(response => {
                    // Проверяем валидность ответа
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Клонируем ответ
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
            .catch(() => {
                // Офлайн fallback
                return new Response('Приложение работает в офлайн режиме');
            })
    );
});
