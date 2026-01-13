# Performance Optimization Integration Guide

This guide explains how to integrate the performance optimizations into the Quick Reply feature.

## Quick Start

### 1. Install Dependencies (if needed)

No additional dependencies required! All optimizations use native browser APIs and React.

### 2. Import Performance Utilities

```javascript
// Core utilities
import { debounce, throttle, LRUCache } from './utils/performance';

// React hooks
import {
  useDebounce,
  useDebouncedCallback,
  useLazyMedia,
  useCachedSearch
} from './hooks/usePerformance';

// Components
import VirtualList from './ui/common/VirtualList';
import { LazyImage, LazyVideo, LazyAudio } from './ui/common/LazyMedia';
```

## Integration Steps

### Step 1: Update Operation Panel

Replace the existing SearchBox with OptimizedSearchBox:

**File:** `src/quick-reply/ui/operation-panel/OperationPanel.jsx`

```javascript
// Before
import SearchBox from './SearchBox';

// After
import OptimizedSearchBox from './OptimizedSearchBox';

// In render
<OptimizedSearchBox />
```

### Step 2: Add Virtual Scrolling to Template Lists

**File:** `src/quick-reply/ui/operation-panel/GroupList.jsx`

```javascript
import VirtualList from '../common/VirtualList';

function GroupList() {
  const { state } = useOperationPanel();
  
  return (
    <VirtualList
      items={state.filteredTemplates}
      itemHeight={80}
      height={600}
      overscan={3}
      renderItem={(template) => (
        <TemplateItem template={template} />
      )}
    />
  );
}
```

### Step 3: Add Lazy Loading to Media Components

**File:** `src/quick-reply/ui/operation-panel/TemplatePreview.jsx`

```javascript
import { LazyImage, LazyVideo, LazyAudio } from '../common/LazyMedia';

function TemplatePreview({ template }) {
  switch (template.type) {
    case 'image':
      return <LazyImage src={template.content.mediaPath} alt={template.label} />;
    
    case 'video':
      return <LazyVideo src={template.content.mediaPath} poster={template.content.poster} />;
    
    case 'audio':
      return <LazyAudio src={template.content.mediaPath} />;
    
    default:
      return <div>{template.content.text}</div>;
  }
}
```

### Step 4: Update Management Interface

**File:** `src/quick-reply/ui/management-interface/TemplateListView.jsx`

```javascript
import VirtualList from '../common/VirtualList';

function TemplateListView() {
  const { state } = useManagementInterface();
  
  return (
    <VirtualList
      items={state.filteredTemplates}
      itemHeight={100}
      height={800}
      overscan={5}
      renderItem={(template) => (
        <TemplateListItem template={template} />
      )}
    />
  );
}
```

### Step 5: Add Caching to Search Functions

**File:** `src/quick-reply/utils/search.js`

```javascript
import { memoize } from './performance';

// Memoize the search function
export const searchTemplates = memoize((keyword, templates, groups) => {
  // ... existing search logic
});
```

## Component-by-Component Guide

### Operation Panel Components

#### 1. SearchBox → OptimizedSearchBox
```javascript
// src/quick-reply/ui/operation-panel/OperationPanel.jsx
import OptimizedSearchBox from './OptimizedSearchBox';

// Replace
<SearchBox />
// With
<OptimizedSearchBox />
```

#### 2. GroupList with Virtual Scrolling
```javascript
// src/quick-reply/ui/operation-panel/GroupList.jsx
import VirtualList from '../common/VirtualList';

<VirtualList
  items={templates}
  itemHeight={80}
  height={600}
  renderItem={(template) => <TemplateItem template={template} />}
/>
```

#### 3. TemplateItem with Lazy Media
```javascript
// src/quick-reply/ui/operation-panel/TemplateItem.jsx
import { LazyImage } from '../common/LazyMedia';

{template.type === 'image' && (
  <LazyImage src={template.content.mediaPath} alt={template.label} />
)}
```

#### 4. MediaPlayer with Lazy Loading
```javascript
// src/quick-reply/ui/operation-panel/MediaPlayer.jsx
import { LazyVideo, LazyAudio } from '../common/LazyMedia';

{type === 'video' && <LazyVideo src={src} poster={poster} />}
{type === 'audio' && <LazyAudio src={src} />}
```

### Management Interface Components

#### 1. TemplateListView with Virtual Scrolling
```javascript
// src/quick-reply/ui/management-interface/TemplateListView.jsx
import VirtualList from '../common/VirtualList';

<VirtualList
  items={filteredTemplates}
  itemHeight={100}
  height={800}
  renderItem={(template) => <TemplateListItem template={template} />}
/>
```

#### 2. TemplateEditor with Lazy Media
```javascript
// src/quick-reply/ui/management-interface/TemplateEditor.jsx
import { LazyImage } from '../common/LazyMedia';

{previewImage && (
  <LazyImage src={previewImage} alt="Preview" />
)}
```

#### 3. GroupPanel with Debounced Search
```javascript
// src/quick-reply/ui/management-interface/GroupPanel.jsx
import { useDebouncedCallback } from '../../hooks/usePerformance';

const handleSearch = useDebouncedCallback((keyword) => {
  performSearch(keyword);
}, 300);
```

## Performance Hooks Usage

### useDebounce
```javascript
import { useDebounce } from '../hooks/usePerformance';

function SearchComponent() {
  const [input, setInput] = useState('');
  const debouncedInput = useDebounce(input, 300);
  
  useEffect(() => {
    // This only runs 300ms after user stops typing
    performSearch(debouncedInput);
  }, [debouncedInput]);
}
```

### useDebouncedCallback
```javascript
import { useDebouncedCallback } from '../hooks/usePerformance';

function SearchComponent() {
  const handleSearch = useDebouncedCallback((keyword) => {
    performSearch(keyword);
  }, 300);
  
  return <input onChange={(e) => handleSearch(e.target.value)} />;
}
```

### useLazyMedia
```javascript
import { useLazyMedia } from '../hooks/usePerformance';

function MediaComponent({ mediaPath }) {
  const { ref, isLoaded, load } = useLazyMedia(mediaPath);
  
  return (
    <div ref={ref}>
      {isLoaded ? (
        <img src={mediaPath} />
      ) : (
        <button onClick={load}>Load</button>
      )}
    </div>
  );
}
```

### useCachedSearch
```javascript
import { useCachedSearch } from '../hooks/usePerformance';

function SearchComponent({ templates, groups }) {
  const [keyword, setKeyword] = useState('');
  
  const results = useCachedSearch(
    searchTemplates,
    keyword,
    templates,
    [groups]
  );
  
  return <div>{results.length} results</div>;
}
```

## Migration Checklist

### Phase 1: Core Optimizations
- [ ] Replace SearchBox with OptimizedSearchBox
- [ ] Add virtual scrolling to main template list
- [ ] Add lazy loading to template thumbnails
- [ ] Test basic functionality

### Phase 2: Management Interface
- [ ] Add virtual scrolling to management template list
- [ ] Add lazy loading to media previews
- [ ] Add debounced search to group panel
- [ ] Test management interface

### Phase 3: Advanced Optimizations
- [ ] Add caching to search functions
- [ ] Add batch processing for bulk operations
- [ ] Add performance monitoring
- [ ] Optimize re-renders with React.memo

### Phase 4: Testing & Validation
- [ ] Run performance tests
- [ ] Measure render times
- [ ] Check memory usage
- [ ] Validate scroll performance
- [ ] Test with large datasets (1000+ templates)

## Performance Testing

### Test Render Performance
```javascript
import { performance } from 'perf_hooks';

const start = performance.now();
// Render component
const end = performance.now();
console.log(`Render time: ${end - start}ms`);
```

### Test Memory Usage
```javascript
// In browser console
console.log(performance.memory.usedJSHeapSize / 1048576 + ' MB');
```

### Test Scroll Performance
```javascript
let frameCount = 0;
let lastTime = performance.now();

function measureFPS() {
  frameCount++;
  const currentTime = performance.now();
  
  if (currentTime >= lastTime + 1000) {
    console.log(`FPS: ${frameCount}`);
    frameCount = 0;
    lastTime = currentTime;
  }
  
  requestAnimationFrame(measureFPS);
}

measureFPS();
```

## Troubleshooting

### Issue: Virtual scrolling items jumping
**Solution:** Ensure itemHeight is accurate and consistent

```javascript
<VirtualList
  items={templates}
  itemHeight={80} // Must match actual item height
  height={600}
/>
```

### Issue: Lazy loading not working
**Solution:** Check Intersection Observer support

```javascript
if ('IntersectionObserver' in window) {
  // Use lazy loading
} else {
  // Fallback to immediate loading
}
```

### Issue: Search still slow
**Solution:** Verify debounce is working

```javascript
const debouncedSearch = useDebounce(searchInput, 300);
console.log('Debounced:', debouncedSearch); // Should update 300ms after typing stops
```

### Issue: High memory usage
**Solution:** Check cache size limits

```javascript
const cache = new LRUCache(100); // Limit to 100 items
```

## Best Practices

### 1. Always Use Virtual Scrolling for Large Lists
```javascript
// Good: Virtual scrolling for 100+ items
<VirtualList items={templates} itemHeight={80} height={600} />

// Bad: Rendering all items
{templates.map(t => <TemplateItem template={t} />)}
```

### 2. Debounce All User Input
```javascript
// Good: Debounced search
const debouncedKeyword = useDebounce(keyword, 300);

// Bad: Immediate search on every keystroke
onChange={(e) => performSearch(e.target.value)}
```

### 3. Lazy Load All Media
```javascript
// Good: Lazy loading
<LazyImage src={imagePath} />

// Bad: Immediate loading
<img src={imagePath} />
```

### 4. Cache Expensive Computations
```javascript
// Good: Cached search
const results = useCachedSearch(searchFn, keyword, data);

// Bad: Recompute on every render
const results = searchFn(keyword, data);
```

## Performance Targets

### Target Metrics
- Initial render: < 200ms
- Search latency: < 100ms
- Scroll FPS: 60fps
- Memory usage: < 50MB
- Cache hit rate: > 80%

### Monitoring
```javascript
// Add performance monitoring
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});

observer.observe({ entryTypes: ['measure'] });
```

## Next Steps

1. **Integrate optimizations** into existing components
2. **Test thoroughly** with large datasets
3. **Monitor performance** in production
4. **Iterate and improve** based on metrics
5. **Document learnings** for future reference

## Support

For questions or issues:
- Check `PERFORMANCE_README.md` for detailed documentation
- Review `performance-usage-example.jsx` for code examples
- Run `performance-demo.js` for interactive demonstrations
- Consult `performance.test.js` for test examples

---

**Last Updated:** December 9, 2025
**Version:** 1.0.0
