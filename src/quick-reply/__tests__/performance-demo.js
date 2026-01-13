/**
 * Performance Optimization Demo
 * 
 * Demonstrates how to use performance optimization utilities
 * Run with: node src/quick-reply/__tests__/performance-demo.js
 */

const {
  debounce,
  throttle,
  LRUCache,
  memoize,
  BatchProcessor,
  cacheWithTTL
} = require('../utils/performance');

console.log('=== Performance Optimization Demo ===\n');

// 1. Debounce Demo
console.log('1. Debounce Demo');
console.log('Simulating rapid user input...');

const searchFunction = debounce((keyword) => {
  console.log(`  Searching for: "${keyword}"`);
}, 300);

// Simulate rapid typing
searchFunction('h');
searchFunction('he');
searchFunction('hel');
searchFunction('hell');
searchFunction('hello');

setTimeout(() => {
  console.log('  Result: Only one search executed after 300ms\n');
}, 400);

// 2. Throttle Demo
setTimeout(() => {
  console.log('2. Throttle Demo');
  console.log('Simulating rapid scroll events...');

  let scrollCount = 0;
  const handleScroll = throttle(() => {
    scrollCount++;
    console.log(`  Scroll handler called: ${scrollCount}`);
  }, 100);

  // Simulate rapid scrolling
  for (let i = 0; i < 10; i++) {
    handleScroll();
  }

  setTimeout(() => {
    console.log('  Result: Handler called only once per 100ms\n');
  }, 200);
}, 500);

// 3. LRU Cache Demo
setTimeout(() => {
  console.log('3. LRU Cache Demo');
  console.log('Creating cache with max size 3...');

  const cache = new LRUCache(3);

  cache.set('a', 'Value A');
  cache.set('b', 'Value B');
  cache.set('c', 'Value C');
  console.log('  Added: a, b, c');

  cache.set('d', 'Value D'); // Evicts 'a'
  console.log('  Added: d (evicts a)');

  console.log(`  Get 'a': ${cache.get('a')}`); // undefined
  console.log(`  Get 'b': ${cache.get('b')}`); // Value B
  console.log(`  Get 'c': ${cache.get('c')}`); // Value C
  console.log(`  Get 'd': ${cache.get('d')}`); // Value D
  console.log('  Result: Least recently used item (a) was evicted\n');
}, 1000);

// 4. Memoize Demo
setTimeout(() => {
  console.log('4. Memoize Demo');
  console.log('Computing expensive Fibonacci...');

  let callCount = 0;
  const fibonacci = (n) => {
    callCount++;
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
  };

  const memoizedFib = memoize(fibonacci);

  console.log(`  First call fib(10): ${memoizedFib(10)}`);
  const firstCallCount = callCount;
  callCount = 0;

  console.log(`  Second call fib(10): ${memoizedFib(10)}`);
  const secondCallCount = callCount;

  console.log(`  First call: ${firstCallCount} function calls`);
  console.log(`  Second call: ${secondCallCount} function calls (cached)`);
  console.log('  Result: Memoization dramatically reduces computation\n');
}, 1500);

// 5. Batch Processor Demo
setTimeout(async () => {
  console.log('5. Batch Processor Demo');
  console.log('Processing items in batches...');

  let batchCount = 0;
  const processFn = async (items) => {
    batchCount++;
    console.log(`  Batch ${batchCount}: Processing ${items.length} items`);
    return items.map(x => x * 2);
  };

  const processor = new BatchProcessor(processFn, 100);

  // Add items individually
  const promises = [];
  for (let i = 1; i <= 5; i++) {
    promises.push(processor.add(i));
  }

  const results = await Promise.all(promises);
  console.log(`  Results: [${results.join(', ')}]`);
  console.log('  Result: All items processed in a single batch\n');
}, 2000);

// 6. Cache with TTL Demo
setTimeout(() => {
  console.log('6. Cache with TTL Demo');
  console.log('Creating cache with 1 second TTL...');

  let callCount = 0;
  const expensiveFunction = (x) => {
    callCount++;
    return x * 2;
  };

  const cached = cacheWithTTL(expensiveFunction, 1000);

  console.log(`  First call: ${cached(5)}`);
  console.log(`  Call count: ${callCount}`);

  console.log(`  Second call (within TTL): ${cached(5)}`);
  console.log(`  Call count: ${callCount} (cached)`);

  setTimeout(() => {
    console.log(`  Third call (after TTL): ${cached(5)}`);
    console.log(`  Call count: ${callCount} (cache expired)`);
    console.log('  Result: Cache expires after TTL\n');
  }, 1100);
}, 2500);

// 7. Performance Comparison
setTimeout(() => {
  console.log('7. Performance Comparison');
  console.log('Comparing cached vs uncached search...');

  const templates = [];
  for (let i = 0; i < 1000; i++) {
    templates.push({
      id: `t${i}`,
      label: `Template ${i}`,
      content: { text: `Content for template ${i}` }
    });
  }

  const searchTemplates = (keyword, templates) => {
    return templates.filter(t =>
      t.label.toLowerCase().includes(keyword.toLowerCase()) ||
      t.content.text.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  // Uncached search
  const start1 = Date.now();
  for (let i = 0; i < 100; i++) {
    searchTemplates('template', templates);
  }
  const uncachedTime = Date.now() - start1;

  // Cached search
  const cachedSearch = memoize(searchTemplates);
  const start2 = Date.now();
  for (let i = 0; i < 100; i++) {
    cachedSearch('template', templates);
  }
  const cachedTime = Date.now() - start2;

  console.log(`  Uncached: ${uncachedTime}ms for 100 searches`);
  console.log(`  Cached: ${cachedTime}ms for 100 searches`);
  console.log(`  Speedup: ${(uncachedTime / cachedTime).toFixed(2)}x faster\n`);
}, 4000);

// Summary
setTimeout(() => {
  console.log('=== Summary ===');
  console.log('Performance optimizations demonstrated:');
  console.log('✓ Debounce - Reduce unnecessary function calls');
  console.log('✓ Throttle - Limit execution frequency');
  console.log('✓ LRU Cache - Efficient caching with automatic eviction');
  console.log('✓ Memoize - Cache function results');
  console.log('✓ Batch Processor - Process multiple items together');
  console.log('✓ Cache with TTL - Time-based cache expiration');
  console.log('✓ Performance gains - Significant speedup with caching\n');
}, 5000);
