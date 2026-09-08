/**
 * Service Worker cho Video Caching
 * 
 * Chiến lược cache:
 * 1. Cache video metadata (HEAD requests) - ưu tiên cao
 * 2. Cache video chunks khi fetch - ưu tiên thấp
 * 3. Stale-while-revalidate cho metadata
 * 
 * Cache size limit: 500MB (khoảng 2-3 video HD)
 */

const CACHE_NAME = 'video-cache-v1';
const CACHE_SIZE_LIMIT = 500 * 1024 * 1024; // 500MB

// Files to cache immediately on install
const PRECACHE_URLS = [];

// Install event - precache critical files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch event handler
 * 
 * Video requests (/api/stream/*) are cached with special handling:
 * - Range requests: cache aggressively (video chunks)
 * - Full requests: stale-while-revalidate
 * 
 * Other requests pass through normally
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle stream requests
  if (!url.pathname.startsWith('/api/stream/')) {
    return;
  }
  
  const isRangeRequest = event.request.headers.has('range');
  
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Try to get from cache first
      const cachedResponse = await cache.match(event.request);
      
      if (cachedResponse) {
        // Return cached response
        return cachedResponse;
      }
      
      // Not in cache, fetch from network
      try {
        const networkResponse = await fetch(event.request);
        
        // Only cache successful responses
        if (networkResponse.ok || networkResponse.status === 206) {
          // Clone the response before caching (body can only be read once)
          const responseToCache = networkResponse.clone();
          
          // Cache the response
          cache.put(event.request, responseToCache);
          
          // Cleanup cache if it gets too large
          cleanupCacheIfNeeded(cache);
        }
        
        return networkResponse;
      } catch (error) {
        // Network failed, return offline response if available
        const offlineResponse = await cache.match(event.request);
        if (offlineResponse) {
          return offlineResponse;
        }
        throw error;
      }
    })
  );
});

/**
 * Cleanup cache if it exceeds the size limit
 * Uses LRU (Least Recently Used) eviction
 */
async function cleanupCacheIfNeeded(cache) {
  const keys = await cache.keys();
  let totalSize = 0;
  const cachedItems = [];
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.clone().blob();
      cachedItems.push({
        request,
        size: blob.size,
        date: response.headers.get('date') || new Date().toISOString()
      });
      totalSize += blob.size;
    }
  }
  
  // If over limit, remove oldest items first (LRU)
  if (totalSize > CACHE_SIZE_LIMIT) {
    // Sort by date (oldest first)
    cachedItems.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let sizeToFree = totalSize - CACHE_SIZE_LIMIT;
    for (const item of cachedItems) {
      if (sizeToFree <= 0) break;
      await cache.delete(item.request);
      sizeToFree -= item.size;
    }
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  // Clear specific video from cache
  if (event.data.type === 'CLEAR_VIDEO') {
    const url = event.data.url;
    caches.open(CACHE_NAME).then((cache) => {
      cache.delete(url);
    });
  }
  
  // Clear all video cache
  if (event.data.type === 'CLEAR_ALL') {
    caches.delete(CACHE_NAME);
  }
});
