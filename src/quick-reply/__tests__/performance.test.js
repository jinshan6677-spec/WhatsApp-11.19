/**
 * Performance Optimization Tests
 * 
 * Tests for:
 * - Debouncing
 * - Throttling
 * - Caching
 * - Lazy loading
 * - Virtual scrolling
 */

const {
  debounce,
  throttle,
  LRUCache,
  memoize,
  BatchProcessor,
  rafThrottle,
  cacheWithTTL
} = require('../utils/performance');

describe('Performance Utilities', () => {
  describe('debounce', () => {
    jest.useFakeTimers();

    test('should delay function execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 300);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should reset timer on multiple calls', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 300);

      debounced();
      jest.advanceTimersByTime(100);
      debounced();
      jest.advanceTimersByTime(100);
      debounced();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should cancel pending execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 300);

      debounced();
      debounced.cancel();

      jest.advanceTimersByTime(300);
      expect(fn).not.toHaveBeenCalled();
    });

    test('should pass arguments correctly', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 300);

      debounced('arg1', 'arg2');
      jest.advanceTimersByTime(300);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    jest.useRealTimers();
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    test('should limit function execution frequency', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 300);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(300);
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('should return last result', () => {
      const fn = jest.fn((x) => x * 2);
      const throttled = throttle(fn, 300);

      const result1 = throttled(5);
      expect(result1).toBe(10);

      const result2 = throttled(10);
      expect(result2).toBe(10); // Still returns first result

      jest.advanceTimersByTime(300);
      const result3 = throttled(15);
      expect(result3).toBe(30);
    });

    jest.useRealTimers();
  });

  describe('LRUCache', () => {
    test('should store and retrieve values', () => {
      const cache = new LRUCache(3);

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });

    test('should evict least recently used item', () => {
      const cache = new LRUCache(3);

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // Should evict 'a'

      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    test('should update item position on get', () => {
      const cache = new LRUCache(3);

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.get('a'); // Move 'a' to end

      cache.set('d', 4); // Should evict 'b', not 'a'

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    test('should check if key exists', () => {
      const cache = new LRUCache(3);

      cache.set('a', 1);

      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
    });

    test('should clear all entries', () => {
      const cache = new LRUCache(3);

      cache.set('a', 1);
      cache.set('b', 2);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });

    test('should delete specific key', () => {
      const cache = new LRUCache(3);

      cache.set('a', 1);
      cache.set('b', 2);

      cache.delete('a');

      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.size).toBe(1);
    });
  });

  describe('memoize', () => {
    test('should cache function results', () => {
      const fn = jest.fn((x) => x * 2);
      const memoized = memoize(fn);

      const result1 = memoized(5);
      const result2 = memoized(5);

      expect(result1).toBe(10);
      expect(result2).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should use custom key generator', () => {
      const fn = jest.fn((obj) => obj.value * 2);
      const memoized = memoize(fn, (args) => args[0].id);

      const result1 = memoized({ id: 1, value: 5 });
      const result2 = memoized({ id: 1, value: 10 }); // Different value, same id

      expect(result1).toBe(10);
      expect(result2).toBe(10); // Cached result
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should clear cache', () => {
      const fn = jest.fn((x) => x * 2);
      const memoized = memoize(fn);

      memoized(5);
      memoized.clear();
      memoized(5);

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('BatchProcessor', () => {
    jest.useFakeTimers();

    test('should batch multiple operations', async () => {
      const processFn = jest.fn(async (items) => {
        return items.map(x => x * 2);
      });

      const processor = new BatchProcessor(processFn, 100);

      const promise1 = processor.add(1);
      const promise2 = processor.add(2);
      const promise3 = processor.add(3);

      jest.advanceTimersByTime(100);

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toEqual([2, 4, 6]);
      expect(processFn).toHaveBeenCalledTimes(1);
      expect(processFn).toHaveBeenCalledWith([1, 2, 3]);
    });

    test('should flush queue immediately', async () => {
      const processFn = jest.fn(async (items) => {
        return items.map(x => x * 2);
      });

      const processor = new BatchProcessor(processFn, 100);

      const promise1 = processor.add(1);
      const promise2 = processor.add(2);

      await processor.flush();

      const results = await Promise.all([promise1, promise2]);

      expect(results).toEqual([2, 4]);
      expect(processFn).toHaveBeenCalledTimes(1);
    });

    test('should handle errors', async () => {
      const processFn = jest.fn(async () => {
        throw new Error('Processing failed');
      });

      const processor = new BatchProcessor(processFn, 100);

      const promise = processor.add(1);

      jest.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Processing failed');
    });

    test('should clear queue', async () => {
      const processFn = jest.fn(async (items) => {
        return items.map(x => x * 2);
      });

      const processor = new BatchProcessor(processFn, 100);

      const promise = processor.add(1);

      processor.clear();

      await expect(promise).rejects.toThrow('Batch processor cleared');
      expect(processFn).not.toHaveBeenCalled();
    });

    jest.useRealTimers();
  });

  describe('cacheWithTTL', () => {
    jest.useFakeTimers();

    test('should cache results with TTL', () => {
      const fn = jest.fn((x) => x * 2);
      const cached = cacheWithTTL(fn, 1000);

      const result1 = cached(5);
      const result2 = cached(5);

      expect(result1).toBe(10);
      expect(result2).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should expire cache after TTL', () => {
      const fn = jest.fn((x) => x * 2);
      const cached = cacheWithTTL(fn, 1000);

      cached(5);
      jest.advanceTimersByTime(1001);
      cached(5);

      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('should clear cache', () => {
      const fn = jest.fn((x) => x * 2);
      const cached = cacheWithTTL(fn, 1000);

      cached(5);
      cached.clear();
      cached(5);

      expect(fn).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });
});

describe('Performance Benchmarks', () => {
  test('debounce should reduce function calls', () => {
    jest.useFakeTimers();

    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    // Simulate rapid user input
    for (let i = 0; i < 100; i++) {
      debounced();
      jest.advanceTimersByTime(10);
    }

    jest.advanceTimersByTime(300);

    // Should only call once instead of 100 times
    expect(fn).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  test('LRU cache should improve lookup performance', () => {
    const cache = new LRUCache(1000);

    // Fill cache
    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, i);
    }

    // Measure lookup time
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      cache.get(`key${i}`);
    }
    const duration = Date.now() - start;

    // Should be very fast (< 10ms for 1000 lookups)
    expect(duration).toBeLessThan(10);
  });

  test('memoize should improve computation performance', () => {
    // Expensive computation
    const fibonacci = (n) => {
      if (n <= 1) return n;
      return fibonacci(n - 1) + fibonacci(n - 2);
    };

    const memoizedFib = memoize(fibonacci);

    // First call (slow)
    const start1 = Date.now();
    memoizedFib(30);
    const duration1 = Date.now() - start1;

    // Second call (fast, cached)
    const start2 = Date.now();
    memoizedFib(30);
    const duration2 = Date.now() - start2;

    // Cached call should be much faster
    expect(duration2).toBeLessThan(duration1 / 10);
  });
});
