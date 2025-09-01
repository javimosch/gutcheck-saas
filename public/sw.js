// GutCheck Service Worker
const CACHE_NAME = 'gutcheck-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  self.clients.claim();
});

// Fetch event
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
      .catch(() => {
        // Network request failed, return error response
        if (event.request.mode === 'navigate') {
          return new Response('Network error - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/html' }
          });
        }
        
        return new Response('Network error', {
          status: 503,
          statusText: 'Service Unavailable'
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
