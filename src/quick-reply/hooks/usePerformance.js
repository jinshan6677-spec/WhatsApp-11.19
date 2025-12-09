/**
 * Performance Optimization React Hooks
 * 
 * Custom hooks for:
 * - Debounced values
 * - Throttled callbacks
 * - Lazy loading
 * - Memoized searches
 * 
 * Requirements: Performance optimization for all features
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { debounce, throttle, LRUCache, mediaLoader } from '../utils/performance';

/**
 * Hook for debounced value
 * Returns a debounced version of the value
 * 
 * @param {*} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {*} Debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for debounced callback
 * Returns a memoized debounced callback
 * 
 * @param {Function} callback - Callback to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {Array} deps - Dependencies array
 * @returns {Function} Debounced callback
 */
export function useDebouncedCallback(callback, delay = 300, deps = []) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useMemo(() => {
    const debouncedFn = debounce((...args) => {
      callbackRef.current(...args);
    }, delay);

    return debouncedFn;
  }, [delay, ...deps]);
}

/**
 * Hook for throttled callback
 * Returns a memoized throttled callback
 * 
 * @param {Function} callback - Callback to throttle
 * @param {number} limit - Limit in milliseconds
 * @param {Array} deps - Dependencies array
 * @returns {Function} Throttled callback
 */
export function useThrottledCallback(callback, limit = 300, deps = []) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useMemo(() => {
    return throttle((...args) => {
      callbackRef.current(...args);
    }, limit);
  }, [limit, ...deps]);
}

/**
 * Hook for lazy loading media
 * Loads media when element is visible
 * 
 * @param {string} mediaPath - Path to media file
 * @returns {Object} { ref, isLoaded, load }
 */
export function useLazyMedia(mediaPath) {
  const [isLoaded, setIsLoaded] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current || !mediaPath) {
      return;
    }

    // Check if already loaded
    if (mediaLoader.isLoaded(mediaPath)) {
      setIsLoaded(true);
      return;
    }

    // Observe element for lazy loading
    mediaLoader.observe(elementRef.current, mediaPath, () => {
      setIsLoaded(true);
    });

    return () => {
      if (elementRef.current) {
        mediaLoader.unobserve(elementRef.current);
      }
    };
  }, [mediaPath]);

  const load = useCallback(() => {
    if (mediaPath && !isLoaded) {
      mediaLoader.preload(mediaPath);
    }
  }, [mediaPath, isLoaded]);

  return {
    ref: elementRef,
    isLoaded,
    load
  };
}

/**
 * Hook for cached search results
 * Caches search results to avoid recomputation
 * 
 * @param {Function} searchFn - Search function
 * @param {string} keyword - Search keyword
 * @param {Array} data - Data to search
 * @param {Array} deps - Additional dependencies
 * @returns {Array} Search results
 */
export function useCachedSearch(searchFn, keyword, data, deps = []) {
  const cacheRef = useRef(new LRUCache(50));

  return useMemo(() => {
    if (!keyword || keyword.trim() === '') {
      return data;
    }

    const cacheKey = JSON.stringify({ keyword, dataLength: data.length });
    
    // Check cache
    if (cacheRef.current.has(cacheKey)) {
      return cacheRef.current.get(cacheKey);
    }

    // Compute and cache
    const results = searchFn(keyword, data);
    cacheRef.current.set(cacheKey, results);

    return results;
  }, [keyword, data, searchFn, ...deps]);
}

/**
 * Hook for virtual list calculations
 * Calculates visible items for virtual scrolling
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} Virtual list state and handlers
 */
export function useVirtualList({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 3
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, itemCount, overscan]);

  const totalHeight = itemCount * itemHeight;

  const handleScroll = useThrottledCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, 16); // ~60fps

  const getItemStyle = useCallback((index) => {
    return {
      position: 'absolute',
      top: index * itemHeight,
      height: itemHeight,
      width: '100%'
    };
  }, [itemHeight]);

  return {
    visibleRange,
    totalHeight,
    handleScroll,
    getItemStyle,
    scrollTop
  };
}

/**
 * Hook for intersection observer
 * Detects when element enters viewport
 * 
 * @param {Object} options - Intersection observer options
 * @returns {Array} [ref, isIntersecting]
 */
export function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.01,
        rootMargin: '50px',
        ...options
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options.threshold, options.rootMargin]);

  return [elementRef, isIntersecting];
}

/**
 * Hook for memoized value with custom equality
 * Only recomputes when dependencies change based on custom equality
 * 
 * @param {Function} factory - Factory function
 * @param {Array} deps - Dependencies
 * @param {Function} isEqual - Custom equality function
 * @returns {*} Memoized value
 */
export function useMemoWithEquality(factory, deps, isEqual) {
  const ref = useRef({ deps: undefined, value: undefined });

  if (!ref.current.deps || !isEqual(ref.current.deps, deps)) {
    ref.current.deps = deps;
    ref.current.value = factory();
  }

  return ref.current.value;
}

/**
 * Hook for batched updates
 * Batches multiple state updates together
 * 
 * @param {*} initialState - Initial state
 * @param {number} delay - Batch delay in milliseconds
 * @returns {Array} [state, queueUpdate, flush]
 */
export function useBatchedState(initialState, delay = 100) {
  const [state, setState] = useState(initialState);
  const queueRef = useRef([]);
  const timeoutRef = useRef(null);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (queueRef.current.length > 0) {
      const updates = queueRef.current;
      queueRef.current = [];

      setState(prevState => {
        let newState = prevState;
        updates.forEach(update => {
          newState = typeof update === 'function' ? update(newState) : update;
        });
        return newState;
      });
    }
  }, []);

  const queueUpdate = useCallback((update) => {
    queueRef.current.push(update);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(flush, delay);
  }, [delay, flush]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, queueUpdate, flush];
}

/**
 * Hook for measuring element size
 * Returns element dimensions
 * 
 * @returns {Array} [ref, dimensions]
 */
export function useElementSize() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return [elementRef, dimensions];
}
