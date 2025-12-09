/**
 * Drag and Drop Utility
 * 
 * Provides utilities for implementing drag and drop functionality
 * for groups and templates.
 * 
 * Requirements: 21.1-21.6
 */

/**
 * Drag data types
 */
const DragTypes = {
  GROUP: 'quick-reply/group',
  TEMPLATE: 'quick-reply/template'
};

/**
 * Create drag data for transfer
 * @param {string} type - Drag type (GROUP or TEMPLATE)
 * @param {Object} data - Data to transfer
 * @returns {string} JSON string of drag data
 */
function createDragData(type, data) {
  return JSON.stringify({ type, data });
}

/**
 * Parse drag data from transfer
 * @param {string} dragData - JSON string from dataTransfer
 * @returns {Object|null} Parsed drag data or null if invalid
 */
function parseDragData(dragData) {
  try {
    const parsed = JSON.parse(dragData);
    if (!parsed.type || !parsed.data) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

/**
 * Validate drag operation
 * @param {Object} draggedItem - Item being dragged
 * @param {Object} targetItem - Target item
 * @param {string} expectedType - Expected drag type
 * @returns {boolean} True if valid
 */
function validateDragOperation(draggedItem, targetItem, expectedType) {
  if (!draggedItem || !targetItem) {
    return false;
  }

  if (draggedItem.type !== expectedType) {
    return false;
  }

  // Can't drop on itself
  if (draggedItem.data.id === targetItem.id) {
    return false;
  }

  return true;
}

/**
 * Calculate new index for reordering
 * @param {Array} items - Array of items
 * @param {string} draggedId - ID of dragged item
 * @param {string} targetId - ID of target item
 * @returns {number} New index position
 */
function calculateNewIndex(items, draggedId, targetId) {
  const draggedIndex = items.findIndex(item => item.id === draggedId);
  const targetIndex = items.findIndex(item => item.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1) {
    return -1;
  }

  return targetIndex;
}

/**
 * Get drop position relative to target element
 * @param {DragEvent} event - Drag event
 * @param {HTMLElement} targetElement - Target DOM element
 * @returns {string} 'before' or 'after'
 */
function getDropPosition(event, targetElement) {
  const rect = targetElement.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  return event.clientY < midpoint ? 'before' : 'after';
}

/**
 * Add drag preview styling
 * @param {HTMLElement} element - Element to style
 */
function addDragPreview(element) {
  if (!element) return;
  
  element.style.opacity = '0.5';
  element.style.cursor = 'grabbing';
}

/**
 * Remove drag preview styling
 * @param {HTMLElement} element - Element to restore
 */
function removeDragPreview(element) {
  if (!element) return;
  
  element.style.opacity = '';
  element.style.cursor = '';
}

/**
 * Add drop indicator styling
 * @param {HTMLElement} element - Element to style
 * @param {string} position - 'before' or 'after'
 */
function addDropIndicator(element, position) {
  if (!element) return;
  
  element.classList.add('drop-target');
  element.classList.add(`drop-${position}`);
}

/**
 * Remove drop indicator styling
 * @param {HTMLElement} element - Element to restore
 */
function removeDropIndicator(element) {
  if (!element) return;
  
  element.classList.remove('drop-target');
  element.classList.remove('drop-before');
  element.classList.remove('drop-after');
}

/**
 * Validate group hierarchy for drag and drop
 * Prevents dropping a parent group into its own child
 * @param {string} draggedGroupId - ID of dragged group
 * @param {string} targetGroupId - ID of target group
 * @param {Array} allGroups - All groups
 * @returns {boolean} True if valid
 */
function validateGroupHierarchy(draggedGroupId, targetGroupId, allGroups) {
  // Can't drop on itself
  if (draggedGroupId === targetGroupId) {
    return false;
  }

  // Check if target is a descendant of dragged group
  let currentGroup = allGroups.find(g => g.id === targetGroupId);
  
  while (currentGroup && currentGroup.parentId) {
    if (currentGroup.parentId === draggedGroupId) {
      return false; // Target is a descendant
    }
    currentGroup = allGroups.find(g => g.id === currentGroup.parentId);
  }

  return true;
}

/**
 * Validate template cross-group drag
 * @param {string} draggedTemplateId - ID of dragged template
 * @param {string} targetGroupId - ID of target group
 * @param {Object} templateManager - Template manager instance
 * @returns {Promise<boolean>} True if valid
 */
async function validateTemplateCrossGroupDrag(
  draggedTemplateId,
  targetGroupId,
  templateManager
) {
  try {
    const template = await templateManager.getTemplate(draggedTemplateId);
    if (!template) {
      return false;
    }

    // Can drop into different group
    return template.groupId !== targetGroupId;
  } catch (error) {
    return false;
  }
}

/**
 * Create drag image for better visual feedback
 * @param {HTMLElement} element - Element to clone
 * @param {DragEvent} event - Drag event
 */
function createDragImage(element, event) {
  if (!element) return;

  const clone = element.cloneNode(true);
  clone.style.position = 'absolute';
  clone.style.top = '-9999px';
  clone.style.opacity = '0.8';
  clone.style.pointerEvents = 'none';
  
  document.body.appendChild(clone);
  
  if (event.dataTransfer && event.dataTransfer.setDragImage) {
    event.dataTransfer.setDragImage(clone, 0, 0);
  }
  
  // Clean up after drag
  setTimeout(() => {
    document.body.removeChild(clone);
  }, 0);
}

// Export for CommonJS (Node.js/Jest)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
    validateGroupHierarchy,
    validateTemplateCrossGroupDrag,
    createDragImage
  };
}

// Export for ES6 modules (React)
if (typeof exports !== 'undefined') {
  exports.DragTypes = DragTypes;
  exports.createDragData = createDragData;
  exports.parseDragData = parseDragData;
  exports.validateDragOperation = validateDragOperation;
  exports.calculateNewIndex = calculateNewIndex;
  exports.getDropPosition = getDropPosition;
  exports.addDragPreview = addDragPreview;
  exports.removeDragPreview = removeDragPreview;
  exports.addDropIndicator = addDropIndicator;
  exports.removeDropIndicator = removeDropIndicator;
  exports.validateGroupHierarchy = validateGroupHierarchy;
  exports.validateTemplateCrossGroupDrag = validateTemplateCrossGroupDrag;
  exports.createDragImage = createDragImage;
}
