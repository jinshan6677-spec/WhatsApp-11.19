/**
 * LazyMedia Component
 * 
 * Lazy loads media files (images, videos, audio) when they become visible
 * Improves performance by not loading all media at once
 * 
 * Requirements: Performance optimization
 */

import React, { useState, useEffect } from 'react';
import { useLazyMedia, useIntersectionObserver } from '../../hooks/usePerformance';
import './LazyMedia.css';

/**
 * LazyImage Component
 * Lazy loads images
 */
export function LazyImage({ src, alt, className = '', placeholder, ...props }) {
  const { ref, isLoaded, load } = useLazyMedia(src);
  const [imageSrc, setImageSrc] = useState(placeholder || null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (isLoaded && src) {
      setImageSrc(src);
    }
  }, [isLoaded, src]);

  const handleError = () => {
    setHasError(true);
  };

  const handleLoad = () => {
    // Image loaded successfully
  };

  return (
    <div ref={ref} className={`lazy-image ${className}`}>
      {hasError ? (
        <div className="lazy-image-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>加载失败</span>
        </div>
      ) : imageSrc ? (
        <img
          src={imageSrc}
          alt={alt}
          onError={handleError}
          onLoad={handleLoad}
          className={isLoaded ? 'lazy-image-loaded' : 'lazy-image-loading'}
          {...props}
        />
      ) : (
        <div className="lazy-image-placeholder">
          <div className="lazy-image-spinner"></div>
        </div>
      )}
    </div>
  );
}

/**
 * LazyVideo Component
 * Lazy loads videos
 */
export function LazyVideo({ src, poster, className = '', ...props }) {
  const { ref, isLoaded } = useLazyMedia(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div ref={ref} className={`lazy-video ${className}`}>
      {hasError ? (
        <div className="lazy-video-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>视频加载失败</span>
        </div>
      ) : isLoaded ? (
        <video
          src={src}
          poster={poster}
          onError={handleError}
          controls
          className="lazy-video-loaded"
          {...props}
        />
      ) : (
        <div className="lazy-video-placeholder">
          {poster && <img src={poster} alt="Video poster" />}
          <div className="lazy-video-spinner"></div>
        </div>
      )}
    </div>
  );
}

/**
 * LazyAudio Component
 * Lazy loads audio
 */
export function LazyAudio({ src, className = '', ...props }) {
  const { ref, isLoaded } = useLazyMedia(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div ref={ref} className={`lazy-audio ${className}`}>
      {hasError ? (
        <div className="lazy-audio-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <span>音频加载失败</span>
        </div>
      ) : isLoaded ? (
        <audio
          src={src}
          onError={handleError}
          controls
          className="lazy-audio-loaded"
          {...props}
        />
      ) : (
        <div className="lazy-audio-placeholder">
          <div className="lazy-audio-spinner"></div>
          <span>加载中...</span>
        </div>
      )}
    </div>
  );
}

/**
 * LazyMediaThumbnail Component
 * Shows thumbnail with lazy loading
 */
export function LazyMediaThumbnail({ type, src, alt, className = '', onClick }) {
  const [elementRef, isIntersecting] = useIntersectionObserver({
    threshold: 0.01,
    rootMargin: '50px'
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (isIntersecting && !isLoaded) {
      setIsLoaded(true);
    }
  }, [isIntersecting, isLoaded]);

  const renderThumbnail = () => {
    switch (type) {
      case 'image':
        return isLoaded ? (
          <LazyImage src={src} alt={alt} />
        ) : (
          <div className="lazy-thumbnail-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        );

      case 'video':
        return (
          <div className="lazy-thumbnail-video">
            {isLoaded ? (
              <LazyImage src={src} alt={alt} />
            ) : (
              <div className="lazy-thumbnail-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="lazy-thumbnail-play-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="lazy-thumbnail-audio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={elementRef}
      className={`lazy-media-thumbnail ${className}`}
      onClick={onClick}
    >
      {renderThumbnail()}
    </div>
  );
}

export default LazyImage;
