// GutCheck Service Worker
const CACHE_NAME = 'gutcheck-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const ASSETS_TO_CACHE = [
  '/',
  '/ideas',
  '/register',
  '/js/app.js',
  '/js/home.js',
  '/js/ideas.js',
  '/js/idea-detail.js',
  '/js/register.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip requests to external domains (except Tailwind CSS)
  const url = new URL(event.request.url);
  if (url.origin !== location.origin && !url.hostname.includes('tailwindcss.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If request is successful, cache the response for future use
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // Network request failed, try to serve from cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If no cache match and it's a navigation request, serve offline page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL) || 
                     new Response('Offline - Please check your connection', {
                       status: 503,
                       statusText: 'Service Unavailable',
                       headers: { 'Content-Type': 'text/html' }
                     });
            }
            
            // For other requests, return a basic offline response
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'idea-submission') {
    console.log('Service Worker: Background syncing idea submission');
    event.waitUntil(
      syncIdeaSubmissions()
    );
  }
});

// Push notification support (for future enhancements)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Your idea analysis is complete!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.primaryKey || 'default'
    },
    actions: [
      {
        action: 'explore',
        title: 'View Analysis',
        icon: '/icons/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'GutCheck', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    // Open the app to the ideas page
    event.waitUntil(
      clients.openWindow('/ideas')
    );
  }
});

// Helper function for background sync
async function syncIdeaSubmissions() {
  try {
    // This would handle offline form submissions
    // For now, we'll just log that sync is available
    console.log('Service Worker: Sync capabilities ready');
    return Promise.resolve();
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
    return Promise.reject(error);
  }
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
