// Service Worker for AI Photobooth
// Provides offline functionality and caching strategies

const CACHE_NAME = 'ai-photobooth-v2';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';
const IMAGE_CACHE = 'images-v2';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add other critical assets that should be cached
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first for static assets
  CACHE_FIRST: 'cache-first',
  // Network first for API calls
  NETWORK_FIRST: 'network-first',
  // Stale while revalidate for images
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IMAGE_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isAPIRequest(url)) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  } else if (isImageRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
  } else {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

// Cache strategies implementation

async function cacheFirst(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Validate URL before making network request
    if (!isValidUrl(request.url)) {
      throw new Error('Invalid URL detected');
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    return new Response('Offline - content not available', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

async function networkFirst(request, cacheName) {
  try {
    // Validate URL before making network request
    if (!isValidUrl(request.url)) {
      throw new Error('Invalid URL detected');
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || new Response('Offline', { 
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
    
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = isValidUrl(request.url) ? fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Silently fail network requests for this strategy
    return null;
  }) : Promise.resolve(null);

  return cachedResponse || fetchPromise;
}

// Helper functions

function isStaticAsset(url) {
  // Temporarily disable CSS caching to prevent hermesSDK.css errors
  return url.pathname.match(/\.(js|png|jpg|jpeg|svg|gif|ico|woff|woff2|ttf|eot)$/);
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isImageRequest(url) {
  return url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/);
}

// URL validation to prevent SSRF attacks
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // Only allow HTTPS and same-origin requests
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return false;
    }
    
    // Prevent access to private IP ranges
    const hostname = url.hostname;
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.startsWith('169.254.') // AWS metadata service
    ) {
      return false;
    }
    
    // Get current origin
    const currentOrigin = self.location.origin;
    
    // Allow same-origin requests
    if (url.origin === currentOrigin) {
      return true;
    }
    
    // Allow specific trusted domains
    const trustedDomains = [
      'amazonaws.com',
      's3.amazonaws.com',
      's3.us-east-1.amazonaws.com',
      'cloudfront.net',
      'googleapis.com',
      'gstatic.com'
    ];
    
    return trustedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch (error) {
    return false;
  }
}

// Background sync for failed uploads
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-upload') {
    event.waitUntil(retryFailedUploads());
  }
});

async function retryFailedUploads() {
  // Implementation for retrying failed uploads when back online
  console.log('Retrying failed uploads...');
  
  // This would integrate with the upload queue in the main app
  // For now, just log the attempt
}

// Push notifications (for future enhancement)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'ai-photobooth-notification'
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Only open same-origin URLs to prevent malicious redirects
  const targetUrl = event.notification.data?.url || '/';
  
  try {
    const url = new URL(targetUrl, self.location.origin);
    if (url.origin === self.location.origin) {
      event.waitUntil(
        clients.openWindow(url.pathname)
      );
    }
  } catch (error) {
    // Invalid URL, default to home
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('Service Worker loaded successfully');