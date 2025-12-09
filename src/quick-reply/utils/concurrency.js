/**
 * Concurrency Control Utilities
 * 
 * Provides utilities for managing concurrent operations and preventing race conditions.
 */

/**
 * ConcurrencyController class
 * Manages locks to prevent concurrent access to shared resources
 */
class ConcurrencyController {
  constructor() {
    this.locks = new Map();
    this.queues = new Map();
  }

  /**
   * Acquires a lock for the specified key
   * @param {string} key - Lock key
   * @returns {Promise<void>}
   */
  async acquireLock(key) {
    // If lock doesn't exist, acquire immediately
    if (!this.locks.has(key)) {
      this.locks.set(key, true);
      return;
    }

    // Lock exists, wait in queue
    return new Promise((resolve) => {
      if (!this.queues.has(key)) {
        this.queues.set(key, []);
      }
      this.queues.get(key).push(resolve);
    });
  }

  /**
   * Releases a lock for the specified key
   * @param {string} key - Lock key
   */
  releaseLock(key) {
    const queue = this.queues.get(key);

    // If there are waiting operations, resolve the next one
    if (queue && queue.length > 0) {
      const resolve = queue.shift();
      resolve();
    } else {
      // No waiting operations, remove lock
      this.locks.delete(key);
      this.queues.delete(key);
    }
  }

  /**
   * Executes a function with a lock
   * @param {string} key - Lock key
   * @param {Function} fn - Function to execute
   * @returns {Promise<*>} - Result of the function
   */
  async withLock(key, fn) {
    await this.acquireLock(key);
    try {
      return await fn();
    } finally {
      this.releaseLock(key);
    }
  }

  /**
   * Checks if a lock is currently held
   * @param {string} key - Lock key
   * @returns {boolean} - True if locked
   */
  isLocked(key) {
    return this.locks.has(key);
  }

  /**
   * Gets the number of operations waiting for a lock
   * @param {string} key - Lock key
   * @returns {number} - Number of waiting operations
   */
  getQueueLength(key) {
    const queue = this.queues.get(key);
    return queue ? queue.length : 0;
  }

  /**
   * Clears all locks (use with caution)
   */
  clearAll() {
    this.locks.clear();
    this.queues.clear();
  }
}

/**
 * Mutex class
 * A simple mutual exclusion lock
 */
class Mutex {
  constructor() {
    this.locked = false;
    this.queue = [];
  }

  /**
   * Acquires the mutex
   * @returns {Promise<void>}
   */
  async acquire() {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Releases the mutex
   */
  release() {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      resolve();
    } else {
      this.locked = false;
    }
  }

  /**
   * Executes a function with the mutex
   * @param {Function} fn - Function to execute
   * @returns {Promise<*>} - Result of the function
   */
  async runExclusive(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Checks if the mutex is locked
   * @returns {boolean} - True if locked
   */
  isLocked() {
    return this.locked;
  }
}

/**
 * Semaphore class
 * Limits the number of concurrent operations
 */
class Semaphore {
  /**
   * Creates a new Semaphore
   * @param {number} maxConcurrent - Maximum number of concurrent operations
   */
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }

  /**
   * Acquires a permit
   * @returns {Promise<void>}
   */
  async acquire() {
    if (this.current < this.maxConcurrent) {
      this.current++;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Releases a permit
   */
  release() {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      resolve();
    } else {
      this.current--;
    }
  }

  /**
   * Executes a function with a permit
   * @param {Function} fn - Function to execute
   * @returns {Promise<*>} - Result of the function
   */
  async runExclusive(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Gets the number of available permits
   * @returns {number} - Number of available permits
   */
  getAvailable() {
    return this.maxConcurrent - this.current;
  }

  /**
   * Gets the number of operations waiting
   * @returns {number} - Number of waiting operations
   */
  getQueueLength() {
    return this.queue.length;
  }
}

/**
 * Creates a throttled version of a function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
function throttle(fn, limit) {
  let inThrottle;
  let lastResult;

  return function(...args) {
    if (!inThrottle) {
      lastResult = fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastResult;
  };
}

/**
 * Creates a rate-limited version of a function
 * @param {Function} fn - Function to rate limit
 * @param {number} maxCalls - Maximum number of calls
 * @param {number} timeWindow - Time window in milliseconds
 * @returns {Function} - Rate-limited function
 */
function rateLimit(fn, maxCalls, timeWindow) {
  const calls = [];

  return async function(...args) {
    const now = Date.now();
    
    // Remove old calls outside the time window
    while (calls.length > 0 && calls[0] < now - timeWindow) {
      calls.shift();
    }

    // Check if we've exceeded the limit
    if (calls.length >= maxCalls) {
      const oldestCall = calls[0];
      const waitTime = timeWindow - (now - oldestCall);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return rateLimit(fn, maxCalls, timeWindow).apply(this, args);
    }

    // Record this call
    calls.push(now);
    return fn.apply(this, args);
  };
}

/**
 * Executes operations in batches
 * @param {Array} items - Items to process
 * @param {Function} fn - Function to execute for each item
 * @param {number} batchSize - Batch size
 * @returns {Promise<Array>} - Results
 */
async function batchExecute(items, fn, batchSize) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(item => fn(item)));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Retries a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<*>} - Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

module.exports = {
  ConcurrencyController,
  Mutex,
  Semaphore,
  throttle,
  rateLimit,
  batchExecute,
  retryWithBackoff
};
