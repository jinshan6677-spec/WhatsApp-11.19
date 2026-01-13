/**
 * Performance Optimization Usage Examples
 * 
 * This file demonstrates how to use the performance optimizations
 * in real React components.
 */

import React, { useState } from 'react';
import VirtualList from '../ui/common/VirtualList';
import { LazyImage, LazyVideo, LazyAudio } from '../ui/common/LazyMedia';
import { useDebounce, useCachedSearch, useLazyMedia } from '../hooks/usePerformance';
import { searchTemplates } from '../utils/search';

// Example 1: Virtual Scrolling for Large Lists
function TemplateListExample({ templates }) {
  return (
    <div>
      <h2>Template List (Virtual Scrolling)</h2>
      <VirtualList
        items={templates}
        itemHeight={80}
        height={600}
        overscan={3}
        renderItem={(template, index) => (
          <div className="template-item">
            <span className="template-number">{index + 1}</span>
            <span className="template-label">{template.label}</span>
            <span className="template-type">{template.type}</span>
          </div>
        )}
      />
    </div>
  );
}

// Example 2: Debounced Search
function SearchExample({ templates, groups }) {
  const [searchInput, setSearchInput] = useState('');
  
  // Debounce the search input
  const debouncedKeyword = useDebounce(searchInput, 300);
  
  // Use cached search
  const results = useCachedSearch(
    (keyword, data) => searchTemplates(keyword, data, groups),
    debouncedKeyword,
    templates,
    [groups]
  );

  return (
    <div>
      <h2>Search with Debouncing</h2>
      <input
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search templates..."
      />
      <p>Found {results.length} results</p>
      <ul>
        {results.map(template => (
          <li key={template.id}>{template.label}</li>
        ))}
      </ul>
    </div>
  );
}

// Example 3: Lazy Loading Images
function ImageGalleryExample({ images }) {
  return (
    <div>
      <h2>Image Gallery (Lazy Loading)</h2>
      <div className="image-grid">
        {images.map(image => (
          <div key={image.id} className="image-item">
            <LazyImage
              src={image.path}
              alt={image.alt}
              placeholder="/placeholder.png"
            />
            <p>{image.caption}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Example 4: Lazy Loading Videos
function VideoGalleryExample({ videos }) {
  return (
    <div>
      <h2>Video Gallery (Lazy Loading)</h2>
      <div className="video-grid">
        {videos.map(video => (
          <div key={video.id} className="video-item">
            <LazyVideo
              src={video.path}
              poster={video.poster}
            />
            <p>{video.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Example 5: Lazy Loading Audio
function AudioPlaylistExample({ tracks }) {
  return (
    <div>
      <h2>Audio Playlist (Lazy Loading)</h2>
      <div className="audio-list">
        {tracks.map(track => (
          <div key={track.id} className="audio-item">
            <LazyAudio src={track.path} />
            <div className="track-info">
              <h3>{track.title}</h3>
              <p>{track.artist}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Example 6: Custom Lazy Media Hook
function CustomMediaExample({ mediaPath }) {
  const { ref, isLoaded, load } = useLazyMedia(mediaPath);

  return (
    <div ref={ref}>
      <h2>Custom Lazy Media</h2>
      {isLoaded ? (
        <img src={mediaPath} alt="Loaded media" />
      ) : (
        <div className="placeholder">
          <button onClick={load}>Load Now</button>
        </div>
      )}
    </div>
  );
}

// Example 7: Combined Optimizations
function OptimizedTemplateList({ templates, groups }) {
  const [searchInput, setSearchInput] = useState('');
  
  // Debounced search
  const debouncedKeyword = useDebounce(searchInput, 300);
  
  // Cached search results
  const filteredTemplates = useCachedSearch(
    (keyword, data) => searchTemplates(keyword, data, groups),
    debouncedKeyword,
    templates,
    [groups]
  );

  return (
    <div>
      <h2>Optimized Template List</h2>
      
      {/* Debounced search */}
      <input
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search templates..."
      />
      
      {/* Virtual scrolling */}
      <VirtualList
        items={filteredTemplates}
        itemHeight={100}
        height={600}
        overscan={3}
        renderItem={(template) => (
          <div className="template-card">
            {/* Lazy loaded thumbnail */}
            {template.type === 'image' && (
              <LazyImage
                src={template.content.mediaPath}
                alt={template.label}
              />
            )}
            
            {template.type === 'video' && (
              <LazyVideo
                src={template.content.mediaPath}
                poster={template.content.poster}
              />
            )}
            
            {template.type === 'audio' && (
              <LazyAudio src={template.content.mediaPath} />
            )}
            
            <div className="template-info">
              <h3>{template.label}</h3>
              <p>{template.type}</p>
            </div>
          </div>
        )}
      />
    </div>
  );
}

// Example 8: Performance Monitoring
function PerformanceMonitorExample() {
  const [renderCount, setRenderCount] = useState(0);
  const [renderTime, setRenderTime] = useState(0);

  React.useEffect(() => {
    const start = performance.now();
    setRenderCount(prev => prev + 1);
    
    return () => {
      const end = performance.now();
      setRenderTime(end - start);
    };
  });

  return (
    <div>
      <h2>Performance Monitor</h2>
      <p>Render count: {renderCount}</p>
      <p>Last render time: {renderTime.toFixed(2)}ms</p>
    </div>
  );
}

// Export all examples
export {
  TemplateListExample,
  SearchExample,
  ImageGalleryExample,
  VideoGalleryExample,
  AudioPlaylistExample,
  CustomMediaExample,
  OptimizedTemplateList,
  PerformanceMonitorExample
};

// Usage in main component
export default function PerformanceExamples() {
  // Mock data
  const templates = Array.from({ length: 1000 }, (_, i) => ({
    id: `t${i}`,
    label: `Template ${i}`,
    type: i % 3 === 0 ? 'image' : i % 3 === 1 ? 'video' : 'text',
    content: {
      text: `Content for template ${i}`,
      mediaPath: `/media/template-${i}.jpg`
    }
  }));

  const groups = [
    { id: 'g1', name: 'Group 1' },
    { id: 'g2', name: 'Group 2' }
  ];

  return (
    <div className="performance-examples">
      <h1>Performance Optimization Examples</h1>
      
      <section>
        <TemplateListExample templates={templates} />
      </section>
      
      <section>
        <SearchExample templates={templates} groups={groups} />
      </section>
      
      <section>
        <OptimizedTemplateList templates={templates} groups={groups} />
      </section>
      
      <section>
        <PerformanceMonitorExample />
      </section>
    </div>
  );
}
