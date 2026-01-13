# Task 18: Account Switching Implementation Summary

## Overview

Implemented comprehensive account switching functionality for the Quick Reply feature, including state persistence, data isolation, and UI refresh capabilities.

## Requirements Addressed

- **11.1**: Account switching with automatic data loading
- **11.2**: Account-level data isolation (templates only affect current account)
- **11.3**: Account-level deletion isolation
- **11.4**: Account-level import isolation
- **11.5**: Account-level export isolation
- **11.6**: First-time account initialization
- **11.7**: Account-based data storage namespacing

## Implementation Details

### 1. AccountSwitchHandler (`src/quick-reply/handlers/AccountSwitchHandler.js`)

A dedicated handler class that manages all aspects of account switching:

#### Key Features:
- **Event Listening**: Listens for `account-switched` and `account:active-changed` events from the main application
- **State Management**: Saves and restores account-specific state (UI state, expanded groups, search keywords, etc.)
- **Data Lifecycle**: Handles data unloading and loading during account switches
- **UI Refresh**: Triggers UI refresh after account switch
- **First-time Detection**: Detects and initializes first-time account usage

#### Key Methods:
- `startListening()`: Start listening for account switch events
- `stopListening()`: Stop listening for account switch events
- `handleAccountSwitch(newAccountId)`: Main account switch handler
- `saveCurrentState()`: Save current account state before switching
- `unloadCurrentData()`: Unload current account data
- `loadAccountData(accountId)`: Load data for new account
- `restoreAccountState(accountId)`: Restore saved state for account
- `refreshUI()`: Refresh UI after switch

#### Events Emitted:
- `listening:started`: When handler starts listening
- `listening:stopped`: When handler stops listening
- `switching`: Before account switch begins
- `switched`: After account switch completes
- `switch:error`: When account switch fails
- `state:saved`: When state is saved
- `state:restored`: When state is restored
- `data:unloaded`: When data is unloaded
- `data:loaded`: When data is loaded
- `account:first-use`: When account is used for first time
- `ui:refresh`: When UI should refresh

### 2. QuickReplyController Integration

Updated the QuickReplyController to integrate the AccountSwitchHandler:

#### Changes:
- Added `accountSwitchHandler` property
- Initialize handler in constructor
- Start listening in `initialize()` method
- Forward account switch events from handler to controller
- Destroy handler in `destroy()` method

#### Event Forwarding:
- `account:switching` → forwarded from handler
- `account:switched` → forwarded from handler
- `account:switch-error` → forwarded from handler

### 3. State Persistence

The handler saves and restores the following state:

#### Controller State:
- `accountId`: Current account ID
- `isOperationPanelOpen`: Operation panel open state
- `isManagementInterfaceOpen`: Management interface open state

#### UI State:
- **Operation Panel**:
  - `isOpen`: Panel open state
  - `sendMode`: Send mode ('original' or 'translated')
  - `searchKeyword`: Current search keyword
  - `expandedGroups`: Set of expanded group IDs

- **Management Interface**:
  - `isOpen`: Interface open state
  - `selectedGroupId`: Currently selected group
  - `activeTab`: Active content type tab

#### Persistence:
- State is saved to memory (Map)
- State is also persisted to ConfigStorage
- State is restored when switching back to an account

### 4. Data Isolation

Each account has completely isolated data:

#### Storage Isolation:
- Templates are stored per account: `{userDataPath}/quick-reply/{accountId}/templates.json`
- Groups are stored per account: `{userDataPath}/quick-reply/{accountId}/groups.json`
- Config is stored per account: `{userDataPath}/quick-reply/{accountId}/config.json`

#### Manager Isolation:
- TemplateManager is recreated with new accountId
- GroupManager is recreated with new accountId
- SendManager switches translation account

### 5. First-time Account Usage

When an account is used for the first time:

1. Handler detects no existing config
2. Creates empty config with defaults:
   - `sendMode`: 'original'
   - `expandedGroups`: []
   - `lastSelectedGroupId`: null
3. Emits `account:first-use` event
4. Saves config to storage

## Testing

### Unit Tests (`src/quick-reply/__tests__/account-switch.test.js`)

Comprehensive test suite covering:

1. **Initialization**
   - Handler initialization with controller
   - Automatic listening start

2. **State Management**
   - State saving
   - State restoration
   - State clearing
   - Multiple account states

3. **Account Switching**
   - Basic account switch
   - Event emission
   - State preservation
   - Data unloading
   - Data loading
   - UI refresh
   - Error handling

4. **Data Loading**
   - Account data loading
   - First-use detection
   - Config creation

5. **Data Unloading**
   - Panel closing
   - Interface closing

6. **UI Refresh**
   - Event emission
   - Controller refresh

7. **Listening Control**
   - Start/stop listening
   - Idempotent operations

8. **Cleanup**
   - Handler destruction
   - Resource cleanup

9. **Integration**
   - Event forwarding to controller
   - Data isolation between accounts

### Verification Script (`src/quick-reply/__tests__/verify-account-switch.js`)

Interactive verification demonstrating:

1. Controller initialization for Account 1
2. Template creation for Account 1
3. State setup for Account 1
4. Switching to Account 2
5. Account 2 state verification
6. Template creation for Account 2
7. Switching back to Account 1
8. Account 1 data preservation
9. State restoration
10. Data isolation testing
11. Saved state persistence
12. First-time account usage

## Usage Example

```javascript
const QuickReplyController = require('./controllers/QuickReplyController');

// Create controller
const controller = new QuickReplyController(
  'account-1',
  translationService,
  whatsappWebInterface
);

// Initialize (starts listening for account switches)
await controller.initialize();

// Listen for account switch events
controller.on('account:switching', (data) => {
  console.log(`Switching from ${data.oldAccountId} to ${data.newAccountId}`);
});

controller.on('account:switched', (data) => {
  console.log(`Switched to ${data.newAccountId}`);
  // Refresh UI here
});

// Account switch will be triggered automatically by the main application
// via 'account-switched' or 'account:active-changed' events

// Or manually trigger a switch
await controller.accountSwitchHandler.handleAccountSwitch('account-2');

// Get saved state for an account
const savedState = controller.accountSwitchHandler.getSavedState('account-1');

// Clean up
controller.destroy();
```

## Integration with Main Application

The AccountSwitchHandler integrates with the existing account switching mechanism:

### Event Sources:
1. `window.electronAPI.on('account-switched', ...)` - Main account switch event
2. `window.electronAPI.on('account:active-changed', ...)` - Active account change event

### Event Flow:
```
Main Application
  ↓ (emits 'account-switched')
AccountSwitchHandler
  ↓ (calls handleAccountSwitch)
  ├─ Save current state
  ├─ Unload current data
  ├─ Switch account in controller
  ├─ Load new account data
  ├─ Restore saved state
  └─ Refresh UI
  ↓ (emits 'account:switched')
QuickReplyController
  ↓ (forwards event)
UI Components
  └─ Update display
```

## Files Created/Modified

### Created:
1. `src/quick-reply/handlers/AccountSwitchHandler.js` - Main handler implementation
2. `src/quick-reply/__tests__/account-switch.test.js` - Unit tests
3. `src/quick-reply/__tests__/verify-account-switch.js` - Verification script
4. `src/quick-reply/__tests__/TASK-18-SUMMARY.md` - This summary

### Modified:
1. `src/quick-reply/controllers/QuickReplyController.js` - Integrated AccountSwitchHandler

## Key Benefits

1. **Automatic Switching**: Listens for account switch events from main application
2. **State Preservation**: Saves and restores UI state per account
3. **Data Isolation**: Complete data isolation between accounts
4. **First-time Handling**: Automatically initializes new accounts
5. **Error Handling**: Graceful error handling with event emission
6. **Memory Management**: Proper cleanup and resource management
7. **Event-driven**: Emits events for UI integration
8. **Testable**: Comprehensive test coverage

## Verification

Run the verification script:

```bash
node src/quick-reply/__tests__/verify-account-switch.js
```

Run the unit tests:

```bash
npm test -- account-switch.test.js
```

## Next Steps

1. Integrate with UI components (Operation Panel and Management Interface)
2. Add visual feedback during account switching
3. Add loading indicators
4. Test with real WhatsApp account switching
5. Add error recovery mechanisms
6. Add state migration for version updates

## Notes

- The handler is designed to work in both Electron and non-Electron environments
- State persistence uses both memory and storage for reliability
- All operations are async to support future enhancements
- Error handling is non-blocking to prevent account switch failures
- The handler is fully event-driven for loose coupling
