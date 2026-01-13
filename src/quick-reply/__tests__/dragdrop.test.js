/**
 * Drag and Drop Tests
 * 
 * Tests for drag and drop functionality
 * Requirements: 21.1-21.6
 */

const {
  DragTypes,
  createDragData,
  parseDragData,
  validateDragOperation,
  calculateNewIndex,
  validateGroupHierarchy,
  getDropPosition
} = require('../utils/dragDrop');

describe('Drag and Drop Utilities', () => {
  describe('createDragData and parseDragData', () => {
    test('should create and parse drag data correctly', () => {
      const data = { id: 'test-1', name: 'Test Item' };
      const dragData = createDragData(DragTypes.GROUP, data);
      
      expect(typeof dragData).toBe('string');
      
      const parsed = parseDragData(dragData);
      expect(parsed).toEqual({
        type: DragTypes.GROUP,
        data: data
      });
    });

    test('should return null for invalid drag data', () => {
      expect(parseDragData('invalid json')).toBeNull();
      expect(parseDragData('{}')).toBeNull();
      expect(parseDragData('{"type":"test"}')).toBeNull();
    });
  });

  describe('validateDragOperation', () => {
    test('should validate correct drag operation', () => {
      const draggedItem = {
        type: DragTypes.GROUP,
        data: { id: 'group-1', name: 'Group 1' }
      };
      const targetItem = { id: 'group-2', name: 'Group 2' };

      expect(validateDragOperation(draggedItem, targetItem, DragTypes.GROUP)).toBe(true);
    });

    test('should reject drag on itself', () => {
      const draggedItem = {
        type: DragTypes.GROUP,
        data: { id: 'group-1', name: 'Group 1' }
      };
      const targetItem = { id: 'group-1', name: 'Group 1' };

      expect(validateDragOperation(draggedItem, targetItem, DragTypes.GROUP)).toBe(false);
    });

    test('should reject wrong drag type', () => {
      const draggedItem = {
        type: DragTypes.TEMPLATE,
        data: { id: 'template-1' }
      };
      const targetItem = { id: 'group-1' };

      expect(validateDragOperation(draggedItem, targetItem, DragTypes.GROUP)).toBe(false);
    });

    test('should reject null items', () => {
      expect(validateDragOperation(null, { id: 'test' }, DragTypes.GROUP)).toBe(false);
      expect(validateDragOperation({ type: DragTypes.GROUP, data: { id: 'test' } }, null, DragTypes.GROUP)).toBe(false);
    });
  });

  describe('calculateNewIndex', () => {
    const items = [
      { id: 'item-1', order: 1 },
      { id: 'item-2', order: 2 },
      { id: 'item-3', order: 3 },
      { id: 'item-4', order: 4 }
    ];

    test('should calculate correct new index', () => {
      expect(calculateNewIndex(items, 'item-1', 'item-3')).toBe(2);
      expect(calculateNewIndex(items, 'item-4', 'item-1')).toBe(0);
      expect(calculateNewIndex(items, 'item-2', 'item-4')).toBe(3);
    });

    test('should return -1 for invalid items', () => {
      expect(calculateNewIndex(items, 'invalid', 'item-1')).toBe(-1);
      expect(calculateNewIndex(items, 'item-1', 'invalid')).toBe(-1);
    });
  });

  describe('validateGroupHierarchy', () => {
    const groups = [
      { id: 'group-1', name: 'Group 1', parentId: null },
      { id: 'group-2', name: 'Group 2', parentId: 'group-1' },
      { id: 'group-3', name: 'Group 3', parentId: 'group-2' },
      { id: 'group-4', name: 'Group 4', parentId: null }
    ];

    test('should allow valid group moves', () => {
      // Move group-1 to group-4 (both are root level)
      expect(validateGroupHierarchy('group-1', 'group-4', groups)).toBe(true);
      
      // Move group-4 to group-2 (no circular dependency)
      expect(validateGroupHierarchy('group-4', 'group-2', groups)).toBe(true);
    });

    test('should reject dropping on itself', () => {
      expect(validateGroupHierarchy('group-1', 'group-1', groups)).toBe(false);
    });

    test('should reject circular dependencies', () => {
      // Can't move group-1 to group-2 (group-2 is child of group-1)
      expect(validateGroupHierarchy('group-1', 'group-2', groups)).toBe(false);
      
      // Can't move group-1 to group-3 (group-3 is grandchild of group-1)
      expect(validateGroupHierarchy('group-1', 'group-3', groups)).toBe(false);
    });
  });

  describe('getDropPosition', () => {
    test('should return "before" when dropping above midpoint', () => {
      const mockEvent = {
        clientY: 100
      };
      const mockElement = {
        getBoundingClientRect: () => ({
          top: 90,
          height: 40
        })
      };

      expect(getDropPosition(mockEvent, mockElement)).toBe('before');
    });

    test('should return "after" when dropping below midpoint', () => {
      const mockEvent = {
        clientY: 120
      };
      const mockElement = {
        getBoundingClientRect: () => ({
          top: 90,
          height: 40
        })
      };

      expect(getDropPosition(mockEvent, mockElement)).toBe('after');
    });
  });
});

describe('Drag and Drop Integration', () => {
  test('should handle complete drag and drop flow', () => {
    // Create drag data
    const sourceItem = { id: 'item-1', name: 'Item 1' };
    const dragData = createDragData(DragTypes.TEMPLATE, sourceItem);

    // Parse drag data
    const parsed = parseDragData(dragData);
    expect(parsed.type).toBe(DragTypes.TEMPLATE);
    expect(parsed.data).toEqual(sourceItem);

    // Validate operation
    const targetItem = { id: 'item-2', name: 'Item 2' };
    expect(validateDragOperation(parsed, targetItem, DragTypes.TEMPLATE)).toBe(true);

    // Calculate new index
    const items = [
      { id: 'item-1', order: 1 },
      { id: 'item-2', order: 2 },
      { id: 'item-3', order: 3 }
    ];
    const newIndex = calculateNewIndex(items, 'item-1', 'item-2');
    expect(newIndex).toBe(1);
  });
});
