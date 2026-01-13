/**
 * VirtualList Component
 * 
 * Efficiently renders large lists by only rendering visible items
 * Uses virtual scrolling to improve performance
 * 
 * Requirements: Performance optimization
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useThrottledCallback } from '../../hooks/usePerformance';
import './VirtualList.css';

/**
 * VirtualList component
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of items to render
 * @param {number} props.itemHeight - Height of each item in pixels
 * @param {number} props.height - Height of the container
 * @param {number} props.overscan - Number of items to render outside viewport
 * @param {Function} props.renderItem - Function to render each item
 * @param {string} props.className - Additional CSS class
 */
export default function VirtualList({
  items = [],
  itemHeight = 80,
  height = 600,
  overscan = 3,
  renderItem,
  className = '',
  ...props
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate visible range
  const visibleRange = React.useMemo(() => {
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - overscan
    );
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + height) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, height, items.length, overscan]);

  // Calculate total height
  const totalHeight = items.length * itemHeight;

  // Handle scroll with throttling
  const handleScroll = useThrottledCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, 16); // ~60fps

  // Get visible items
  const visibleItems = React.useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    const result = [];

    for (let i = startIndex; i <= endIndex; i++) {
      if (i < items.length) {
        result.push({
          index: i,
          item: items[i],
          style: {
            position: 'absolute',
            top: i * itemHeight,
            height: itemHeight,
            width: '100%',
            left: 0
          }
        });
      }
    }

    return result;
  }, [visibleRange, items, itemHeight]);

  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className}`}
      style={{ height, overflow: 'auto', position: 'relative' }}
      onScroll={handleScroll}
      {...props}
    >
      <div
        className="virtual-list-spacer"
        style={{ height: totalHeight, position: 'relative' }}
      >
        {visibleItems.map(({ index, item, style }) => (
          <div key={index} style={style} className="virtual-list-item">
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * VirtualGrid Component
 * Similar to VirtualList but for grid layouts
 */
export function VirtualGrid({
  items = [],
  itemWidth = 200,
  itemHeight = 200,
  height = 600,
  gap = 10,
  overscan = 3,
  renderItem,
  className = '',
  ...props
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        if (entries[0]) {
          setContainerWidth(entries[0].contentRect.width);
        }
      });

      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Calculate columns
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (itemWidth + gap)));

  // Calculate rows
  const rows = Math.ceil(items.length / columns);
  const rowHeight = itemHeight + gap;

  // Calculate visible range
  const visibleRange = React.useMemo(() => {
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endRow = Math.min(
      rows - 1,
      Math.ceil((scrollTop + height) / rowHeight) + overscan
    );

    return { startRow, endRow };
  }, [scrollTop, rowHeight, height, rows, overscan]);

  // Handle scroll
  const handleScroll = useThrottledCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, 16);

  // Get visible items
  const visibleItems = React.useMemo(() => {
    const { startRow, endRow } = visibleRange;
    const result = [];

    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        if (index < items.length) {
          result.push({
            index,
            item: items[index],
            style: {
              position: 'absolute',
              top: row * rowHeight,
              left: col * (itemWidth + gap),
              width: itemWidth,
              height: itemHeight
            }
          });
        }
      }
    }

    return result;
  }, [visibleRange, items, columns, rowHeight, itemWidth, itemHeight, gap]);

  const totalHeight = rows * rowHeight;

  return (
    <div
      ref={containerRef}
      className={`virtual-grid ${className}`}
      style={{ height, overflow: 'auto', position: 'relative' }}
      onScroll={handleScroll}
      {...props}
    >
      <div
        className="virtual-grid-spacer"
        style={{ height: totalHeight, position: 'relative' }}
      >
        {visibleItems.map(({ index, item, style }) => (
          <div key={index} style={style} className="virtual-grid-item">
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}
