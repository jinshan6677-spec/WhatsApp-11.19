# Drag and Drop Implementation

## Overview

This document describes the drag and drop functionality implemented for the Quick Reply feature, allowing users to reorder groups and templates through intuitive drag and drop interactions.

## Requirements

Implements requirements **21.1-21.6**:
- 21.1: Group drag and drop sorting
- 21.2: Template drag and drop sorting  
- 21.3: Template cross-group drag
- 21.4: Drag preview effects
- 21.5: Drag validation
- 21.6: Invalid drop target indication

## Architecture

### Core Components

1. **dragDrop.js** - Utility functions for drag and drop operations
2. **useDragDrop.js** - React hooks for drag and drop state management
3. **DragDrop.css** - Visual styles for drag and drop feedback
4. **GroupPanel.jsx** - Group list with drag and drop
5. **TemplateListView.jsx** - Template list with drag and drop

### Drag and Drop Flow

```
User starts dragging
    ↓
handleDragStart() - Set drag data, add visual feedback
    ↓
User drags over target
    ↓
handleDragOver() - Validate drop, show drop indicator
    ↓
User releases mouse
    ↓
handleDrop() - Execute reorder/move operation
    ↓
handleDragEnd() - Clean up visual feedback
```

## Features

### 1. Group Drag and Drop Sorting

Groups can be reordered within the same level by dragging and dropping.

**Validation:**
- Cannot drop a group on itself
- Cannot create circular dependencies (parent into child)
- Only groups at the same level can be reordered

**Visual Feedback:**
- Dragged group becomes semi-transparent
- Drop target shows blue indicator line
- Invalid targets show red indicator

### 2. Template Drag and Drop Sorting

Templates can be reordered within the same group.

**Validation:**
- Cannot drop a template on itself
- Templates maintain group association during reorder

**Visual Feedback:**
- Dragged template becomes semi-transparent
- Drop position indicator (before/after)
- Smooth animation on drop

### 3. Template Cross-Group Drag

Templates can be moved to different groups by dragging.

**Behavior:**
- Drag template from one group
- Drop on template in different group
- Template moves to target group
- Order is adjusted based on drop position

### 4. Drag Preview Effects

**Visual Feedback:**
- **Dragging State**: Semi-transparent with dashed border
- **Drop Indicator**: Blue line showing drop position
- **Invalid Drop**: Red background with ⛔ icon
- **Drop Animation**: Scale animation on successful drop

**CSS Classes:**
- `.dragging` - Applied to dragged element
- `.drop-target` - Applied to valid drop target
- `.drop-before` / `.drop-after` - Drop position indicator
- `.drop-invalid` - Applied to invalid drop target

### 5. Drag Validation

**Group Validation:**
```javascript
validateGroupHierarchy(draggedGroupId, targetGroupId, allGroups)
```
- Prevents circular dependencies
- Checks parent-child relationships
- Validates group structure integrity

**Template Validation:**
```javascript
validateDragOperation(draggedItem, targetItem, expectedType)
```
- Validates drag type matches
- Prevents dropping on self
- Checks item existence

### 6. Drop Position Calculation

Drop position is calculated based on mouse position relative to target element:

```javascript
getDropPosition(event, targetElement)
```
- Returns 'before' if mouse is in top half
- Returns 'after' if mouse is in bottom half
- Used to determine insertion point

## Usage

### Using the Hook

```javascript
import { useGroupDragDrop } from './useDragDrop';

function GroupPanel() {
  const dragDropHandlers = useGroupDragDrop({
    groups: filteredGroups,
    allGroups: state.groups,
    onReorder: handleGroupReorder
  });

  return (
    <GroupListItem
      group={group}
      dragDropHandlers={dragDropHandlers}
    />
  );
}
```

### Implementing in Components

```javascript
function GroupListItem({ group, dragDropHandlers }) {
  const elementRef = useRef(null);

  return (
    <div
      ref={elementRef}
      draggable
      onDragStart={(e) => dragDropHandlers.handleDragStart(e, group, elementRef.current)}
      onDragOver={(e) => dragDropHandlers.handleDragOver(e, group, elementRef.current)}
      onDragLeave={(e) => dragDropHandlers.handleDragLeave(e, elementRef.current)}
      onDrop={(e) => dragDropHandlers.handleDrop(e, group, elementRef.current)}
      onDragEnd={dragDropHandlers.handleDragEnd}
    >
      {/* Content */}
    </div>
  );
}
```

## API Reference

### Utility Functions

#### `createDragData(type, data)`
Creates serialized drag data for transfer.

**Parameters:**
- `type` - Drag type (GROUP or TEMPLATE)
- `data` - Data object to transfer

**Returns:** JSON string

#### `parseDragData(dragData)`
Parses drag data from transfer.

**Parameters:**
- `dragData` - JSON string from dataTransfer

**Returns:** Object with `type` and `data` properties, or null if invalid

#### `validateDragOperation(draggedItem, targetItem, expectedType)`
Validates if drag operation is allowed.

**Parameters:**
- `draggedItem` - Item being dragged
- `targetItem` - Target item
- `expectedType` - Expected drag type

**Returns:** Boolean

#### `calculateNewIndex(items, draggedId, targetId)`
Calculates new index position for reordering.

**Parameters:**
- `items` - Array of items
- `draggedId` - ID of dragged item
- `targetId` - ID of target item

**Returns:** Number (new index)

#### `validateGroupHierarchy(draggedGroupId, targetGroupId, allGroups)`
Validates group hierarchy to prevent circular dependencies.

**Parameters:**
- `draggedGroupId` - ID of dragged group
- `targetGroupId` - ID of target group
- `allGroups` - Array of all groups

**Returns:** Boolean

### React Hooks

#### `useDragDrop(options)`
Main hook for drag and drop functionality.

**Options:**
- `type` - Drag type (GROUP or TEMPLATE)
- `items` - Array of items
- `onReorder` - Callback for reordering
- `onMove` - Callback for cross-group move
- `validateDrop` - Custom validation function

**Returns:** Object with handlers and state

#### `useGroupDragDrop(options)`
Specialized hook for group drag and drop.

**Options:**
- `groups` - Array of groups
- `allGroups` - All groups (for hierarchy validation)
- `onReorder` - Reorder callback

#### `useTemplateDragDrop(options)`
Specialized hook for template drag and drop.

**Options:**
- `templates` - Array of templates
- `onReorder` - Reorder callback
- `onMove` - Cross-group move callback

## Testing

### Unit Tests

Run unit tests:
```bash
npm test -- dragdrop.test.js
```

### Verification Script

Run verification script:
```bash
node src/quick-reply/ui/management-interface/verify-dragdrop.js
```

### Manual Testing

1. **Group Reordering:**
   - Open management interface
   - Drag a group to new position
   - Verify order changes

2. **Template Reordering:**
   - Select a group
   - Drag a template to new position
   - Verify order changes

3. **Cross-Group Move:**
   - Drag template from one group
   - Drop on template in different group
   - Verify template moves to new group

4. **Invalid Operations:**
   - Try to drag group into its child
   - Verify red indicator appears
   - Verify drop is prevented

## Browser Compatibility

Uses HTML5 Drag and Drop API, supported in:
- Chrome 4+
- Firefox 3.5+
- Safari 3.1+
- Edge (all versions)
- Opera 12+

## Performance Considerations

1. **Debouncing:** Drag over events are not debounced as they need immediate feedback
2. **Virtual Scrolling:** Works with react-window for large lists
3. **Memory:** Drag state is cleaned up on drag end
4. **Reflows:** Minimal DOM manipulation during drag

## Accessibility

- Keyboard navigation not yet implemented (future enhancement)
- Screen reader support limited to native drag and drop
- Visual feedback is clear and high contrast

## Future Enhancements

1. **Keyboard Support:** Arrow keys for reordering
2. **Touch Support:** Touch events for mobile devices
3. **Multi-Select Drag:** Drag multiple items at once
4. **Undo/Redo:** Undo drag and drop operations
5. **Drag Handles:** Optional drag handles for better control

## Troubleshooting

### Drag not working
- Check that `draggable` attribute is set to `true`
- Verify drag handlers are properly connected
- Check browser console for errors

### Drop not working
- Verify `onDragOver` calls `preventDefault()`
- Check validation logic
- Ensure drop handler is connected

### Visual feedback not showing
- Import `DragDrop.css`
- Check CSS class names match
- Verify element refs are set correctly

## Related Files

- `src/quick-reply/utils/dragDrop.js` - Core utilities
- `src/quick-reply/ui/management-interface/useDragDrop.js` - React hooks
- `src/quick-reply/ui/management-interface/DragDrop.css` - Styles
- `src/quick-reply/__tests__/dragdrop.test.js` - Tests
- `src/quick-reply/managers/GroupManager.js` - Group reorder logic
- `src/quick-reply/managers/TemplateManager.js` - Template reorder logic
