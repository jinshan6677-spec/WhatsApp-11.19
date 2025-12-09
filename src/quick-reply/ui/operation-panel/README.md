# Operation Panel UI Components

This directory contains all UI components for the Quick Reply operation panel, which displays on the right side of the chat interface.

## Components Overview

### OperationPanel (Main Component)
- **File**: `OperationPanel.jsx`
- **Purpose**: Main container component with state management using Context + useReducer
- **Features**:
  - Panel open/close logic
  - Global state management for all child components
  - Data loading and error handling
  - Requirements: 1.1-1.7

### Toolbar
- **File**: `Toolbar.jsx`
- **Purpose**: Top toolbar with action buttons
- **Features**:
  - Refresh button
  - Edit management button (opens management interface)
  - Copy button with dropdown menu
  - Settings menu with import/export/clear cache options
  - Requirements: 20.1-20.8

### SendModeSelector
- **File**: `SendModeSelector.jsx`
- **Purpose**: Radio button selector for send mode
- **Features**:
  - Original send mode
  - Translated send mode
  - Visual hint for translation mode
  - Requirements: 7.1-7.9, 8.1-8.9

### SearchBox
- **File**: `SearchBox.jsx`
- **Purpose**: Search input with debouncing
- **Features**:
  - Real-time search with 300ms debounce
  - Clear button
  - Empty state message
  - Filters templates by keyword
  - Requirements: 6.1-6.6

### GroupList
- **File**: `GroupList.jsx`
- **Purpose**: Displays list of template groups
- **Features**:
  - Hierarchical group structure
  - Recursive rendering of child groups
  - Empty state display
  - Requirements: 2.1-2.11

### GroupItem
- **File**: `GroupItem.jsx`
- **Purpose**: Single group item with expand/collapse
- **Features**:
  - Expand/collapse toggle
  - Indentation based on hierarchy level
  - Empty badge when no templates
  - Contains TemplateList
  - Requirements: 2.1-2.11

### TemplateList
- **File**: `TemplateList.jsx`
- **Purpose**: Displays list of templates within a group
- **Features**:
  - Renders multiple TemplateItem components
  - Shows template index numbers
  - Requirements: 4.1-4.12, 26.1-26.5

### TemplateItem
- **File**: `TemplateItem.jsx`
- **Purpose**: Single template item with actions
- **Features**:
  - Template number display
  - Content preview (compact mode)
  - Send button
  - Insert button
  - Click to open full preview modal
  - Loading state during send
  - Requirements: 4.1-4.12, 26.1-26.5, 27.1-27.6, 28.1-28.8

### TemplatePreview
- **File**: `TemplatePreview.jsx`
- **Purpose**: Displays template content preview
- **Features**:
  - Text preview (2 lines in compact mode)
  - Image preview with thumbnail
  - Audio preview with MediaPlayer
  - Video preview with MediaPlayer
  - Mixed (image + text) preview
  - Contact preview with icon
  - Compact and full modes
  - Requirements: 4.1-4.12

### MediaPlayer
- **File**: `MediaPlayer.jsx`
- **Purpose**: Audio and video playback controls
- **Features**:
  - Play/pause button
  - Progress bar with seek
  - Time display (mm:ss format)
  - Volume control (audio only)
  - Playback speed control (audio only)
  - Video overlay with play button
  - Compact mode support
  - Requirements: 16.1-16.10

## State Management

The operation panel uses React Context + useReducer for state management:

```javascript
const state = {
  isOpen: boolean,              // Panel open/close state
  sendMode: string,             // 'original' or 'translated'
  searchKeyword: string,        // Current search keyword
  expandedGroups: Set,          // Set of expanded group IDs
  templates: Array,             // All templates
  groups: Array,                // All groups
  filteredTemplates: Array,     // Filtered templates based on search
  selectedTemplateId: string,   // Currently selected template
  isLoading: boolean,           // Loading state
  error: string                 // Error message
};
```

## Usage Example

```javascript
import { OperationPanelProvider, OperationPanel } from './ui/operation-panel';

function App() {
  const controller = new QuickReplyController(accountId, translationService, whatsappWebInterface);

  return (
    <OperationPanelProvider controller={controller}>
      <OperationPanel
        controller={controller}
        onClose={() => console.log('Panel closed')}
      />
    </OperationPanelProvider>
  );
}
```

## Styling

Each component has its own CSS file with the same name. The styles follow these conventions:

- BEM-like naming: `.component-name-element`
- Consistent spacing: 8px, 12px, 16px, 20px
- Color palette:
  - Primary: #1976d2
  - Text: #333333
  - Secondary text: #666666
  - Disabled text: #999999
  - Border: #e0e0e0
  - Background: #f5f5f5
- Transitions for interactive elements
- Responsive design with media queries

## Dependencies

- React (hooks: useState, useEffect, useRef, useContext, useReducer)
- QuickReplyController (from controllers)
- TemplateManager, GroupManager, SendManager (from managers)
- searchTemplates utility (from utils/search)

## Testing

Tests for these components should be added in:
- `src/quick-reply/__tests__/ui/operation-panel/`

Test coverage should include:
- Component rendering
- User interactions (clicks, input changes)
- State updates
- Integration with controller
- Error handling

## Future Enhancements

- Virtual scrolling for large template lists
- Keyboard navigation support
- Drag and drop for template reordering
- Template preview caching
- Accessibility improvements (ARIA labels, keyboard shortcuts)
