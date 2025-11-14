// Service Worker для офлайн работы
const CACHE_NAME = 'product-manager-v2.1'; // Обновлена версия для Telegram функции
const CACHE_PREFIX = 'product-manager-'; // Префикс для нашего приложения

// Определяем текущий URL и базовый путь
const currentURL = new URL(self.location);
const basePath = currentURL.pathname.substring(0, currentURL.pathname.lastIndexOf('/') + 1);

// URL для кэширования - адаптивные пути
const urlsToCache = [
    basePath, // Корневая папка
    basePath + 'manifest.json',
    basePath + 'icon-192.png',
    basePath + 'icon-512.png'
];

// Если есть product-manager.html, добавляем его
if (basePath.includes('product-manager')) {
    urlsToCache.push(self.location.href.replace('sw.js', 'product-manager.html'));
} else {
    // Иначе пробуем index.html
    urlsToCache.push(basePath + 'index.html');
}

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('Установка Service Worker:', CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Кэш открыт, добавляем файлы...');
                // Пытаемся добавить каждый URL отдельно с обработкой ошибок
                const cachePromises = urlsToCache.map(url => {
                    return fetch(url)
                        .then(response => {
                            if (response.ok) {
                                return cache.put(url, response);
                            }
                            throw new Error(`Не удалось загрузить: ${url}`);
                        })
                        .catch(err => {
                            console.warn(`Пропускаем кэширование ${url}:`, err.message);
                            // Не прерываем установку из-за одного файла
                            return Promise.resolve();
                        });
                });
                return Promise.all(cachePromises);
            })
            .then(() => {
                console.log('Service Worker установлен успешно');
            })
    );
    // Активируем воркер сразу
    self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', event => {
    console.log('Активация Service Worker:', CACHE_NAME);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Удаляем только старые версии НАШЕГО приложения
                    if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME) {
                        console.log('Удаление старого кэша нашего приложения:', cacheName);
                        return caches.delete(cacheName);
                    }
                    // НЕ трогаем кэши других приложений (techcheck, memory-training и т.д.)
                    if (!cacheName.startsWith(CACHE_PREFIX)) {
                        console.log('Оставляем кэш другого приложения:', cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker активирован');
            // Берем контроль над всеми клиентами
            return self.clients.claim();
        })
    );
});

// Обработка запросов - стратегия "сначала сеть, потом кэш"
self.addEventListener('fetch', event => {
    // Для HTML файлов всегда пробуем загрузить свежую версию
    if (event.request.mode === 'navigate' || event.request.url.includes('.html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Если получили ответ из сети, кэшируем его
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                })
                .catch(() => {
                    // Если сеть недоступна, берем из кэша
                    return caches.match(event.request);
                })
        );
    } else {
        // Для остальных ресурсов - стандартная стратегия "кэш, потом сеть"
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then(response => {
                        // Проверяем валидность ответа
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        // Клонируем ответ для кэширования
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
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
    }
});
