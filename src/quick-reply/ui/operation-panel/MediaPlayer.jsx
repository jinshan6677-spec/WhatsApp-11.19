import React, { useState, useRef, useEffect } from 'react';
import './MediaPlayer.css';

/**
 * MediaPlayer component
 * Supports audio and video playback with controls
 * Requirements: 16.1-16.10
 */
export default function MediaPlayer({ type, src, compact = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  const mediaRef = useRef(null);
  const volumeMenuRef = useRef(null);
  const moreMenuRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (volumeMenuRef.current && !volumeMenuRef.current.contains(event.target)) {
        setShowVolumeSlider(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreOptions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update current time
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handleTimeUpdate = () => {
      setCurrentTime(media.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(media.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    media.addEventListener('timeupdate', handleTimeUpdate);
    media.addEventListener('loadedmetadata', handleLoadedMetadata);
    media.addEventListener('ended', handleEnded);

    return () => {
      media.removeEventListener('timeupdate', handleTimeUpdate);
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
      media.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Handle play/pause
  const handlePlayPause = () => {
    const media = mediaRef.current;
    if (!media) return;

    if (isPlaying) {
      media.pause();
    } else {
      media.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle progress bar change
  const handleProgressChange = (e) => {
    const media = mediaRef.current;
    if (!media) return;

    const newTime = parseFloat(e.target.value);
    media.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const media = mediaRef.current;
    if (!media) return;

    const newVolume = parseFloat(e.target.value);
    media.volume = newVolume;
    setVolume(newVolume);
  };

  // Handle playback rate change
  const handlePlaybackRateChange = (rate) => {
    const media = mediaRef.current;
    if (!media) return;

    media.playbackRate = rate;
    setPlaybackRate(rate);
    setShowMoreOptions(false);
  };

  // Format time (mm:ss)
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render audio player
  if (type === 'audio') {
    return (
      <div className={`media-player audio ${compact ? 'compact' : ''}`}>
        <audio ref={mediaRef} src={src} preload="metadata" />
        
        <button
          className="media-player-play-button"
          onClick={handlePlayPause}
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="media-player-progress-container">
          <input
            type="range"
            className="media-player-progress"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleProgressChange}
            aria-label="播放进度"
          />
        </div>

        <div className="media-player-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {!compact && (
          <>
            <div className="media-player-volume-container" ref={volumeMenuRef}>
              <button
                className="media-player-volume-button"
                onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                aria-label="音量控制"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  {volume === 0 ? (
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  ) : volume < 0.5 ? (
                    <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                  ) : (
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  )}
                </svg>
              </button>

              {showVolumeSlider && (
                <div className="media-player-volume-slider">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    aria-label="音量"
                  />
                </div>
              )}
            </div>

            <div className="media-player-more-container" ref={moreMenuRef}>
              <button
                className="media-player-more-button"
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                aria-label="更多选项"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>

              {showMoreOptions && (
                <div className="media-player-more-menu">
                  <div className="media-player-more-menu-title">播放速度</div>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                    <button
                      key={rate}
                      className={`media-player-more-menu-item ${playbackRate === rate ? 'active' : ''}`}
                      onClick={() => handlePlaybackRateChange(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Render video player
  if (type === 'video') {
    return (
      <div className={`media-player video ${compact ? 'compact' : ''}`}>
        <video
          ref={mediaRef}
          src={src}
          preload="metadata"
          className="media-player-video-element"
          onClick={handlePlayPause}
        />

        <div className="media-player-video-controls">
          <button
            className="media-player-play-button"
            onClick={handlePlayPause}
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="media-player-progress-container">
            <input
              type="range"
              className="media-player-progress"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleProgressChange}
              aria-label="播放进度"
            />
          </div>

          <div className="media-player-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {!isPlaying && (
          <div className="media-player-video-overlay" onClick={handlePlayPause}>
            <button className="media-player-video-play-icon" aria-label="播放视频">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
