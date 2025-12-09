/**
 * Performance Optimization Utilities
 * 
 * Provides utilities for:
 * - Debouncing
 * - Throttling
 * - Caching
 * - Lazy loading
 * 
 * Requirements: Performance optimization for all features
 */

/**
 * Debounce function
 * Delays execution until after wait milliseconds have elapsed since the last call
 * 
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
  let timeoutId;
  
  const debounced = function(...args) {
    const context = this;
    
    clearTimeout(timeoutId);
    
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
  
  // Add cancel method
  debounced.cancel = function() {
    clearTimeout(timeoutId);
  };
  
  return debounced;
}

/**
 * Throttle function
 * Ensures function is called at most once per specified time period
 * 
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between calls
 * @returns {Function} Throttled function
 */
function throttle(func, limit = 300) {
  let inThrottle;
  let lastResult;
  
  return function(...args) {
    const context = this;
    
    if (!inThrottle) {
      lastResult = func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  };
}

/**
 * Simple LRU (Least Recently Used) Cache
 * Caches query results with automatic eviction
 */
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Add to end
    this.cache.set(key, value);
    
    // Evict oldest if over size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Delete specific key
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }
}

/**
 * Memoize function results
 * Caches function results based on arguments
 * 
 * @param {Function} func - Function to memoize
 * @param {Function} keyGenerator - Optional custom key generator
 * @returns {Function} Memoized function
 */
function memoize(func, keyGenerator = JSON.stringify) {
  const cache = new Map();
  
  const memoized = function(...args) {
    const key = keyGenerator(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func.apply(this, args);
    cache.set(key, result);
    
    return result;
  };
  
  // Add cache control methods
  memoized.cache = cache;
  memoized.clear = () => cache.clear();
  
  return memoized;
}

/**
 * Lazy loader for media files
 * Loads media files only when needed
 */
class LazyMediaLoader {
  constructor() {
    this.loadedMedia = new Set();
    this.loadingMedia = new Map();
    this.observers = new Map();
  }

  /**
   * Load media file lazily using Intersection Observer
   * @param {HTMLElement} element - Element to observe
   * @param {string} mediaPath - Path to media file
   * @param {Function} onLoad - Callback when loaded
   */
  observe(element, mediaPath, onLoad) {
    // Already loaded
    if (this.loadedMedia.has(mediaPath)) {
      onLoad(mediaPath);
      return;
    }

    // Currently loading
    if (this.loadingMedia.has(mediaPath)) {
      this.loadingMedia.get(mediaPath).push(onLoad);
      return;
    }

    // Create observer if not exists
    if (!this.observers.has(element)) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.loadMedia(mediaPath, onLoad);
              observer.unobserve(element);
              this.observers.delete(element);
            }
          });
        },
        {
          rootMargin: '50px', // Start loading 50px before visible
          threshold: 0.01
        }
      );

      observer.observe(element);
      this.observers.set(element, observer);
    }

    // Initialize loading queue
    this.loadingMedia.set(mediaPath, [onLoad]);
  }

  /**
   * Load media file
   * @param {string} mediaPath - Path to media file
   * @param {Function} onLoad - Callback when loaded
   */
  async loadMedia(mediaPath, onLoad) {
    try {
      // Simulate loading (in real implementation, this would load the actual file)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mark as loaded
      this.loadedMedia.add(mediaPath);
      
      // Call all waiting callbacks
      const callbacks = this.loadingMedia.get(mediaPath) || [];
      callbacks.forEach(cb => cb(mediaPath));
      
      this.loadingMedia.delete(mediaPath);
    } catch (error) {
      console.error('Failed to load media:', mediaPath, error);
      this.loadingMedia.delete(mediaPath);
    }
  }

  /**
   * Preload media file immediately
   * @param {string} mediaPath - Path to media file
   */
  preload(mediaPath) {
    if (!this.loadedMedia.has(mediaPath) && !this.loadingMedia.has(mediaPath)) {
      this.loadingMedia.set(mediaPath, []);
      this.loadMedia(mediaPath, () => {});
    }
  }

  /**
   * Check if media is loaded
   * @param {string} mediaPath - Path to media file
   * @returns {boolean}
   */
  isLoaded(mediaPath) {
    return this.loadedMedia.has(mediaPath);
  }

  /**
   * Clear all loaded media
   */
  clear() {
    this.loadedMedia.clear();
    this.loadingMedia.clear();
    
    // Disconnect all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }

  /**
   * Unobserve element
   * @param {HTMLElement} element - Element to unobserve
   */
  unobserve(element) {
    const observer = this.observers.get(element);
    if (observer) {
      observer.disconnect();
      this.observers.delete(element);
    }
  }
}

/**
 * Batch processor for operations
 * Batches multiple operations together for efficiency
 */
class BatchProcessor {
  constructor(processFn, delay = 100) {
    this.processFn = processFn;
    this.delay = delay;
    this.queue = [];
    this.timeoutId = null;
  }

  /**
   * Add item to batch queue
   * @param {*} item - Item to process
   * @returns {Promise} Promise that resolves when batch is processed
   */
  add(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      
      // Clear existing timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      
      // Schedule batch processing
      this.timeoutId = setTimeout(() => {
        this.processBatch();
      }, this.delay);
    });
  }

  /**
   * Process all queued items
   */
  async processBatch() {
    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0);
    
    try {
      const items = batch.map(b => b.item);
      const results = await this.processFn(items);
      
      // Resolve all promises
      batch.forEach((b, index) => {
        b.resolve(results[index]);
      });
    } catch (error) {
      // Reject all promises
      batch.forEach(b => {
        b.reject(error);
      });
    }
  }

  /**
   * Flush queue immediately
   */
  async flush() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    await this.processBatch();
  }

  /**
   * Clear queue without processing
   */
  clear() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    // Reject all pending promises
    this.queue.forEach(b => {
      b.reject(new Error('Batch processor cleared'));
    });
    
    this.queue = [];
  }
}

/**
 * Request Animation Frame throttle
 * Ensures function is called at most once per animation frame
 * 
 * @param {Function} func - Function to throttle
 * @returns {Function} Throttled function
 */
function rafThrottle(func) {
  let rafId = null;
  let lastArgs = null;
  
  const throttled = function(...args) {
    lastArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, lastArgs);
        rafId = null;
        lastArgs = null;
      });
    }
  };
  
  throttled.cancel = function() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      lastArgs = null;
    }
  };
  
  return throttled;
}

/**
 * Create a cached version of a function with TTL (Time To Live)
 * @param {Function} func - Function to cache
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Function} Cached function
 */
function cacheWithTTL(func, ttl = 60000) {
  const cache = new Map();
  
  const cached = function(...args) {
    const key = JSON.stringify(args);
    const now = Date.now();
    
    if (cache.has(key)) {
      const { value, timestamp } = cache.get(key);
      
      if (now - timestamp < ttl) {
        return value;
      }
      
      cache.delete(key);
    }
    
    const value = func.apply(this, args);
    cache.set(key, { value, timestamp: now });
    
    return value;
  };
  
  cached.clear = () => cache.clear();
  
  return cached;
}

// Export singleton instances for common use
const searchCache = new LRUCache(50);
const mediaLoader = new LazyMediaLoader();

// CommonJS exports
module.exports = {
  debounce,
  throttle,
  LRUCache,
  memoize,
  LazyMediaLoader,
  BatchProcessor,
  rafThrottle,
  cacheWithTTL,
  searchCache,
  mediaLoader
};
