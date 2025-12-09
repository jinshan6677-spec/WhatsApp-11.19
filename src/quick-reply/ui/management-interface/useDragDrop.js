/**
 * useDragDrop Hook
 * 
 * React hook for implementing drag and drop functionality
 * Requirements: 21.1-21.6
 */

import { useState, useCallback, useRef } from 'react';
import {
  DragTypes,
  createDragData,
  parseDragData,
  validateDragOperation,
  calculateNewIndex,
  getDropPosition,
  addDragPreview,
  removeDragPreview,
  addDropIndicator,
  removeDropIndicator,
  validateGroupHierarchy
} from '../../utils/dragDrop';

/**
 * Hook for drag and drop functionality
 * @param {Object} options - Configuration options
 * @param {string} options.type - Drag type (GROUP or TEMPLATE)
 * @param {Array} options.items - Array of items
 * @param {Function} options.onReorder - Callback when items are reordered
 * @param {Function} options.onMove - Callback when item is moved to different group
 * @param {Function} options.validateDrop - Custom validation function
 * @returns {Object} Drag and drop handlers
 */
export function useDragDrop({
  type,
  items = [],
  onReorder,
  onMove,
  validateDrop
}) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [dropPosition, setDropPosition] = useState(null);
  const draggedElementRef = useRef(null);
  const dropTargetElementRef = useRef(null);

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback((event, item, element) => {
    event.stopPropagation();
    
    setDraggedItem(item);
    draggedElementRef.current = element || event.currentTarget;

    // Set drag data
    const dragData = createDragData(type, item);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragData);

    // Add visual feedback
    addDragPreview(draggedElementRef.current);

    // Add dragging class after a small delay to avoid affecting drag image
    setTimeout(() => {
      if (draggedElementRef.current) {
        draggedElementRef.current.classList.add('dragging');
      }
    }, 0);
  }, [type]);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((event, item, element) => {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedItem || draggedItem.id === item.id) {
      return;
    }

    const targetElement = element || event.currentTarget;
    dropTargetElementRef.current = targetElement;

    // Calculate drop position
    const position = getDropPosition(event, targetElement);
    setDropPosition(position);

    // Validate drop
    const isValid = validateDrop
      ? validateDrop(draggedItem, item)
      : true;

    if (isValid) {
      event.dataTransfer.dropEffect = 'move';
      setDropTarget(item);
      addDropIndicator(targetElement, position);
    } else {
      event.dataTransfer.dropEffect = 'none';
      targetElement.classList.add('drop-invalid');
    }
  }, [draggedItem, validateDrop]);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((event, element) => {
    event.preventDefault();
    event.stopPropagation();

    const targetElement = element || event.currentTarget;
    
    // Only remove indicator if we're actually leaving the element
    if (!targetElement.contains(event.relatedTarget)) {
      removeDropIndicator(targetElement);
      targetElement.classList.remove('drop-invalid');
    }
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback(async (event, targetItem, element) => {
    event.preventDefault();
    event.stopPropagation();

    const targetElement = element || event.currentTarget;

    // Clean up visual feedback
    removeDropIndicator(targetElement);
    targetElement.classList.remove('drop-invalid');

    if (!draggedItem || draggedItem.id === targetItem.id) {
      return;
    }

    // Validate drop
    const isValid = validateDrop
      ? validateDrop(draggedItem, targetItem)
      : true;

    if (!isValid) {
      return;
    }

    try {
      // Calculate new index
      const newIndex = calculateNewIndex(items, draggedItem.id, targetItem.id);
      
      if (newIndex === -1) {
        return;
      }

      // Adjust index based on drop position
      const adjustedIndex = dropPosition === 'after' ? newIndex + 1 : newIndex;

      // Check if it's a cross-group move or reorder
      if (type === DragTypes.TEMPLATE && draggedItem.groupId !== targetItem.groupId) {
        // Cross-group move
        if (onMove) {
          await onMove(draggedItem.id, targetItem.groupId, adjustedIndex);
        }
      } else {
        // Same group reorder
        if (onReorder) {
          await onReorder(draggedItem.id, adjustedIndex);
        }
      }

      // Add drop animation
      targetElement.classList.add('drop-animation');
      setTimeout(() => {
        targetElement.classList.remove('drop-animation');
      }, 300);

    } catch (error) {
      console.error('Drop failed:', error);
    }
  }, [draggedItem, dropPosition, items, type, onReorder, onMove, validateDrop]);

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback((event) => {
    event.preventDefault();

    // Clean up visual feedback
    if (draggedElementRef.current) {
      removeDragPreview(draggedElementRef.current);
      draggedElementRef.current.classList.remove('dragging');
    }

    if (dropTargetElementRef.current) {
      removeDropIndicator(dropTargetElementRef.current);
      dropTargetElementRef.current.classList.remove('drop-invalid');
    }

    // Reset state
    setDraggedItem(null);
    setDropTarget(null);
    setDropPosition(null);
    draggedElementRef.current = null;
    dropTargetElementRef.current = null;
  }, []);

  return {
    draggedItem,
    dropTarget,
    dropPosition,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    isDragging: (itemId) => draggedItem?.id === itemId,
    isDropTarget: (itemId) => dropTarget?.id === itemId
  };
}

/**
 * Hook for group drag and drop
 * @param {Object} options - Configuration options
 * @returns {Object} Drag and drop handlers
 */
export function useGroupDragDrop({ groups, onReorder, allGroups }) {
  const validateDrop = useCallback((draggedGroup, targetGroup) => {
    // Validate hierarchy
    return validateGroupHierarchy(draggedGroup.id, targetGroup.id, allGroups || groups);
  }, [groups, allGroups]);

  return useDragDrop({
    type: DragTypes.GROUP,
    items: groups,
    onReorder,
    validateDrop
  });
}

/**
 * Hook for template drag and drop
 * @param {Object} options - Configuration options
 * @returns {Object} Drag and drop handlers
 */
export function useTemplateDragDrop({ templates, onReorder, onMove }) {
  return useDragDrop({
    type: DragTypes.TEMPLATE,
    items: templates,
    onReorder,
    onMove
  });
}
