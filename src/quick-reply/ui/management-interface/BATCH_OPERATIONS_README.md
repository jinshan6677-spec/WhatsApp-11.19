# Batch Operations Feature

## Overview

The Batch Operations feature allows users to perform actions on multiple templates or groups simultaneously, improving efficiency when managing large numbers of items.

## Requirements

This feature implements requirements **13.1-13.10** from the requirements document:

- 13.1: Batch selection mode with checkboxes
- 13.2: Batch operations toolbar with "Move to Group" and "Delete" buttons
- 13.3: Group selection menu for batch move
- 13.4: Batch move functionality
- 13.5: Batch delete confirmation dialog
- 13.6: Batch delete execution
- 13.7: Select all functionality
- 13.8: Clear selection functionality
- 13.9: Batch operations for groups
- 13.10: Auto-select all templates in a group when group is selected

## Components

### BatchOperations Component

**Location:** `src/quick-reply/ui/management-interface/BatchOperations.jsx`

The main component that provides batch operation controls.

**Props:**
- `type` (string): Either 'template' or 'group' to determine which type of items to operate on

**Features:**
- Displays selected item count
- Provides batch delete button
- Provides batch move button (templates only)
- Provides clear selection button
- Shows move to group dialog with group selection

**Usage:**
```jsx
import BatchOperations from './BatchOperations';

// For templates
<BatchOperations type="template" />

// For groups
<BatchOperations type="group" />
```

## State Management

The batch operations feature uses the ManagementInterface context for state management:

### State Properties

```javascript
{
  selectedTemplateIds: Set,  // Set of selected template IDs
  selectedGroupIds: Set,      // Set of selected group IDs
  templates: Array,           // All templates
  groups: Array,              // All groups
  filteredTemplates: Array    // Filtered templates based on search/tab
}
```

### Actions

```javascript
// Template selection
{ type: 'TOGGLE_TEMPLATE_SELECTION', payload: templateId }
{ type: 'SELECT_ALL_TEMPLATES' }
{ type: 'CLEAR_TEMPLATE_SELECTION' }

// Group selection
{ type: 'TOGGLE_GROUP_SELECTION', payload: groupId }
{ type: 'SELECT_ALL_GROUPS' }
{ type: 'CLEAR_GROUP_SELECTION' }
```

## Manager Methods

### TemplateManager

```javascript
// Batch delete templates
async batchDeleteTemplates(templateIds: string[]): Promise<number>

// Batch move templates to another group
async batchMoveTemplates(templateIds: string[], targetGroupId: string): Promise<number>
```

### GroupManager

```javascript
// Batch delete groups (also deletes templates in groups)
async batchDeleteGroups(groupIds: string[]): Promise<number>
```

## User Workflows

### Batch Delete Templates

1. User checks checkboxes next to templates they want to delete
2. BatchOperations toolbar appears showing selected count
3. User clicks "Delete" button
4. Confirmation dialog appears
5. User confirms deletion
6. Templates are deleted
7. Selection is cleared
8. UI updates to show remaining templates

### Batch Move Templates

1. User checks checkboxes next to templates they want to move
2. BatchOperations toolbar appears showing selected count
3. User clicks "Move to Group" button
4. Group selection dialog appears
5. User selects target group
6. User clicks "Confirm Move"
7. Templates are moved to target group
8. Selection is cleared
9. UI updates to show templates in new locations

### Batch Delete Groups

1. User checks checkboxes next to groups they want to delete
2. BatchOperations toolbar appears showing selected count
3. User clicks "Delete" button
4. Confirmation dialog appears with warning about templates
5. User confirms deletion
6. Groups and their templates are deleted
7. Selection is cleared
8. UI updates to show remaining groups

### Select All

1. User clicks "Select All" checkbox in list header
2. All visible items (templates or groups) are selected
3. BatchOperations toolbar appears
4. User can perform batch operations on all items

### Clear Selection

1. User clicks "Clear Selection" button in BatchOperations toolbar
2. All selections are cleared
3. BatchOperations toolbar disappears

## Integration

### TemplateListView Integration

```jsx
import BatchOperations from './BatchOperations';

function TemplateListView() {
  return (
    <div className="template-list-view">
      {/* Batch Operations Toolbar */}
      <BatchOperations type="template" />
      
      {/* Template list with checkboxes */}
      {templates.map(template => (
        <TemplateListItem
          key={template.id}
          template={template}
          isChecked={selectedTemplateIds.has(template.id)}
          onCheckboxToggle={handleCheckboxToggle}
        />
      ))}
    </div>
  );
}
```

### GroupPanel Integration

```jsx
import BatchOperations from './BatchOperations';

function GroupPanel() {
  return (
    <div className="group-panel">
      {/* Group search and actions */}
      
      {/* Batch Operations for Groups */}
      <BatchOperations type="group" />
      
      {/* Group list with checkboxes */}
      {groups.map(group => (
        <GroupListItem
          key={group.id}
          group={group}
          isChecked={selectedGroupIds.has(group.id)}
          onCheckboxToggle={handleCheckboxToggle}
        />
      ))}
    </div>
  );
}
```

## Styling

The BatchOperations component uses the following CSS classes:

- `.batch-operations` - Main container
- `.batch-operations-info` - Info section with count
- `.batch-operations-count` - Selected count text
- `.batch-operations-actions` - Action buttons container
- `.batch-move-dialog` - Move to group dialog
- `.batch-move-dialog-groups` - Group list in dialog
- `.batch-move-dialog-group` - Individual group item
- `.batch-move-dialog-group.selected` - Selected group
- `.batch-move-dialog-actions` - Dialog action buttons

## Error Handling

The component handles the following error scenarios:

1. **Empty selection**: Batch operations are disabled when no items are selected
2. **Invalid target group**: Shows error message if target group doesn't exist
3. **Network errors**: Shows error message if operation fails
4. **Partial failures**: Handles cases where some items fail to delete/move

## Testing

### Unit Tests

Location: `src/quick-reply/__tests__/batch-operations.test.js`

Tests cover:
- Batch delete templates
- Batch move templates
- Batch delete groups
- Select all functionality
- Clear selection functionality
- Error handling
- Edge cases (empty arrays, non-existing items)

### Verification Script

Location: `src/quick-reply/ui/management-interface/verify-batch-operations.js`

Run with:
```bash
node src/quick-reply/ui/management-interface/verify-batch-operations.js
```

## Performance Considerations

1. **Batch operations are atomic**: All items are processed in a single transaction
2. **UI updates are debounced**: Selection changes don't trigger immediate re-renders
3. **Large selections**: The component handles selections of 100+ items efficiently
4. **Memory management**: Selection state uses Set for O(1) lookup performance

## Accessibility

- All checkboxes have proper labels
- Keyboard navigation is supported
- Screen reader announcements for selection changes
- Focus management in dialogs

## Future Enhancements

Potential improvements for future versions:

1. **Undo functionality**: Allow users to undo batch operations
2. **Progress indicators**: Show progress for large batch operations
3. **Batch edit**: Allow editing multiple templates at once
4. **Export selected**: Export only selected templates
5. **Keyboard shortcuts**: Add shortcuts for select all (Ctrl+A) and delete (Delete key)
6. **Drag and drop**: Allow dragging multiple selected items
7. **Smart selection**: Select all templates of a certain type
8. **Batch tagging**: Add tags to multiple templates at once

## Troubleshooting

### Selection not working

- Check that `selectedTemplateIds` or `selectedGroupIds` is properly initialized as a Set
- Verify that `TOGGLE_TEMPLATE_SELECTION` or `TOGGLE_GROUP_SELECTION` actions are dispatched
- Ensure checkboxes are properly bound to selection state

### Batch operations not executing

- Check that manager methods are properly called
- Verify that template/group IDs are valid
- Check console for error messages
- Ensure user has confirmed the operation

### UI not updating after batch operation

- Verify that state is updated after operation completes
- Check that `SET_TEMPLATES` or `SET_GROUPS` actions are dispatched
- Ensure selection is cleared after operation

## Related Documentation

- [Management Interface README](./README.md)
- [Template Manager](../../managers/TemplateManager.js)
- [Group Manager](../../managers/GroupManager.js)
- [Requirements Document](../../../.kiro/specs/quick-reply/requirements.md)
