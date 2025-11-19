# Session Persistence and Restoration

This document describes the session persistence and restoration functionality implemented for the WhatsApp Desktop single-window architecture.

## Overview

The session persistence system ensures that user login states and session data are maintained across application restarts. Each account has its own isolated session storage, and the system can detect, restore, and manage login states automatically.

## Features

### 1. Session Data Persistence

- **Automatic Persistence**: Session data (cookies, localStorage, IndexedDB, etc.) is automatically saved to account-specific directories
- **Isolated Storage**: Each account has its own isolated storage partition
- **Directory Structure**: Session data is stored in `{userDataPath}/profiles/{accountId}/`

### 2. Login State Detection

The system can detect whether an account is logged in by analyzing the WhatsApp Web DOM:

- **QR Code Detection**: Identifies when the login QR code is displayed
- **Chat List Detection**: Identifies when the user is logged in and viewing chats
- **Real-time Updates**: Login status is updated as the page loads and changes

### 3. Login State Restoration

On application restart:

- **Automatic Restoration**: The system automatically attempts to restore the previous login state
- **Session Validation**: Checks if session data exists before attempting restoration
- **Timeout Handling**: Waits up to 15 seconds for WhatsApp Web to restore the session
- **Fallback**: If restoration fails, the user is prompted to log in again

### 4. Session Expiration Handling

The system can detect and handle expired sessions:

- **Expiration Detection**: Checks if session data exists but the user is not logged in
- **Graceful Handling**: Clears expired session data and prompts for re-authentication
- **Optional Cache Clearing**: Can optionally clear cache data during expiration handling

### 5. Force Logout

Users can force logout from an account:

- **Complete Data Clearing**: Removes all session data (cookies, localStorage, IndexedDB, etc.)
- **Automatic Reload**: Reloads WhatsApp Web to display the login screen
- **Clean State**: Ensures the account starts fresh after logout

### 6. Session Health Monitoring

Optional monitoring of session health:

- **Periodic Checks**: Monitors login status at regular intervals (every 30 seconds)
- **Status Change Notifications**: Notifies when login status changes
- **Automatic Detection**: Detects unexpected logouts or session issues

## API Reference

### SessionManager Methods

#### `createSession(accountId, config)`

Creates an isolated session for an account.

```javascript
const result = await sessionManager.createSession('account-001', {
  proxy: {
    enabled: false
  }
});
```

#### `hasSessionData(accountId)`

Checks if session data exists for an account.

```javascript
const hasData = await sessionManager.hasSessionData('account-001');
```

#### `restoreLoginState(accountId, viewOrWindow)`

Restores the login state for an account on app restart.

```javascript
const result = await sessionManager.restoreLoginState('account-001', browserView);
// result: { success: true, isLoggedIn: true }
```

#### `detectLoginStatus(accountId, viewOrWindow)`

Detects the current login status of an account.

```javascript
const isLoggedIn = await sessionManager.detectLoginStatus('account-001', browserView);
```

#### `handleSessionExpiration(accountId, options)`

Handles session expiration by clearing session data.

```javascript
const result = await sessionManager.handleSessionExpiration('account-001', {
  clearCache: true
});
```

#### `forceLogout(accountId, viewOrWindow)`

Forces logout by clearing all session data and reloading.

```javascript
const result = await sessionManager.forceLogout('account-001', browserView);
```

#### `checkSessionExpiration(accountId, viewOrWindow)`

Checks if a session is expired.

```javascript
const result = await sessionManager.checkSessionExpiration('account-001', browserView);
// result: { expired: false, needsReauth: false }
```

#### `monitorSessionHealth(accountId, viewOrWindow, onStatusChange)`

Starts monitoring session health with a callback for status changes.

```javascript
const monitor = sessionManager.monitorSessionHealth(
  'account-001',
  browserView,
  (statusUpdate) => {
    console.log(`Account ${statusUpdate.accountId} is now ${statusUpdate.status}`);
  }
);

// Stop monitoring later
monitor.stop();
```

#### `getSessionPersistenceStatus(accountId)`

Gets the persistence status of session data.

```javascript
const status = await sessionManager.getSessionPersistenceStatus('account-001');
// status: { persisted: true, dataSize: 1024000, fileCount: 15, lastModified: Date }
```

#### `clearSessionData(accountId)`

Clears all session data for an account.

```javascript
const result = await sessionManager.clearSessionData('account-001');
```

#### `deleteUserDataDir(accountId)`

Deletes the entire user data directory for an account.

```javascript
const result = await sessionManager.deleteUserDataDir('account-001');
```

### ViewManager Methods

#### `restoreActiveAccount(availableAccounts)`

Restores the previously active account on app restart.

```javascript
const result = await viewManager.restoreActiveAccount(['account-001', 'account-002']);
```

#### `restoreAllLoginStates()`

Restores login states for all accounts.

```javascript
const result = await viewManager.restoreAllLoginStates();
// result: { total: 3, restored: 2, failed: 1, details: [...] }
```

#### `handleSessionExpiration(accountId, options)`

Handles session expiration for an account view.

```javascript
const result = await viewManager.handleSessionExpiration('account-001', {
  clearCache: true
});
```

#### `forceLogout(accountId)`

Forces logout for an account view.

```javascript
const result = await viewManager.forceLogout('account-001');
```

#### `checkSessionExpiration(accountId)`

Checks session expiration for an account view.

```javascript
const result = await viewManager.checkSessionExpiration('account-001');
```

#### `startSessionHealthMonitoring(accountId)`

Starts session health monitoring for an account.

```javascript
const monitor = viewManager.startSessionHealthMonitoring('account-001');
// Returns monitor object with stop() method
```

#### `getSessionPersistenceStatus(accountId)`

Gets session persistence status for an account.

```javascript
const status = await viewManager.getSessionPersistenceStatus('account-001');
```

## IPC Handlers

The following IPC handlers are available for renderer processes:

### `account:force-logout`

Forces logout for an account.

```javascript
const result = await ipcRenderer.invoke('account:force-logout', accountId);
```

### `account:handle-session-expiration`

Handles session expiration for an account.

```javascript
const result = await ipcRenderer.invoke('account:handle-session-expiration', accountId, {
  clearCache: true
});
```

### `account:check-session-expiration`

Checks if a session is expired.

```javascript
const result = await ipcRenderer.invoke('account:check-session-expiration', accountId);
```

### `account:session-persistence-status`

Gets session persistence status.

```javascript
const status = await ipcRenderer.invoke('account:session-persistence-status', accountId);
```

### `account:restore-all-login-states`

Restores login states for all accounts.

```javascript
const result = await ipcRenderer.invoke('account:restore-all-login-states');
```

### `account:start-session-monitoring`

Starts session health monitoring.

```javascript
const result = await ipcRenderer.invoke('account:start-session-monitoring', accountId);
```

## Events

The system emits the following events to the renderer process:

### `login-status-restored`

Emitted when login status is restored for an account.

```javascript
{
  accountId: 'account-001',
  isLoggedIn: true
}
```

### `session-expired`

Emitted when a session expires.

```javascript
{
  accountId: 'account-001',
  timestamp: 1234567890
}
```

### `account-logged-out`

Emitted when an account is logged out.

```javascript
{
  accountId: 'account-001',
  forced: true,
  timestamp: 1234567890
}
```

### `session-health-update`

Emitted when session health status changes.

```javascript
{
  accountId: 'account-001',
  status: 'logged-in',
  isLoggedIn: true,
  timestamp: 1234567890
}
```

### `account:login-states-restored`

Emitted when all login states are restored.

```javascript
{
  total: 3,
  restored: 2,
  failed: 1,
  details: [...]
}
```

## Usage Examples

### Example 1: Restore Active Account on App Start

```javascript
// In main process initialization
app.on('ready', async () => {
  // ... initialize managers ...
  
  // Restore the previously active account
  const accounts = await accountManager.getAccountsSorted();
  const accountIds = accounts.map(acc => acc.id);
  
  const result = await viewManager.restoreActiveAccount(accountIds);
  
  if (result.success) {
    console.log(`Restored active account: ${result.accountId}`);
  } else {
    console.log('No active account to restore');
  }
});
```

### Example 2: Handle Session Expiration

```javascript
// Detect session expiration and handle it
const expirationCheck = await viewManager.checkSessionExpiration(accountId);

if (expirationCheck.expired && expirationCheck.needsReauth) {
  // Handle expiration
  await viewManager.handleSessionExpiration(accountId, {
    clearCache: true
  });
  
  // Notify user
  console.log('Session expired. Please log in again.');
}
```

### Example 3: Force Logout

```javascript
// Force logout from renderer process
const result = await ipcRenderer.invoke('account:force-logout', accountId);

if (result.success) {
  console.log('Successfully logged out');
} else {
  console.error('Logout failed:', result.error);
}
```

### Example 4: Monitor Session Health

```javascript
// Start monitoring session health
const monitor = viewManager.startSessionHealthMonitoring(accountId);

// Monitor will automatically notify about status changes
// Stop monitoring when no longer needed
// monitor.stop();
```

## Best Practices

1. **Always Check Session Data**: Before attempting to restore login state, check if session data exists
2. **Handle Timeouts**: Set appropriate timeouts when waiting for session restoration
3. **Graceful Degradation**: If restoration fails, provide a clear path for the user to log in again
4. **Monitor Critical Accounts**: Use session health monitoring for important accounts
5. **Clear Data on Logout**: Always clear session data when the user explicitly logs out
6. **Backup Before Clearing**: Consider backing up session data before clearing it
7. **Notify Users**: Always notify users about session status changes

## Troubleshooting

### Session Not Restoring

1. Check if session data exists: `hasSessionData(accountId)`
2. Verify session isolation: `verifySessionIsolation(accountId)`
3. Check for errors in the console logs
4. Ensure WhatsApp Web has enough time to load (increase timeout if needed)

### Session Expiring Frequently

1. Check network connectivity
2. Verify proxy configuration (if using proxy)
3. Check WhatsApp Web service status
4. Consider implementing session health monitoring

### Data Not Persisting

1. Verify user data directory permissions
2. Check available disk space
3. Ensure session partition is correctly configured
4. Verify no other process is accessing the data directory

## Testing

Run the test script to verify session persistence functionality:

```bash
npm run test:session-persistence
```

Or manually:

```bash
electron scripts/test-session-persistence.js
```

## Related Documentation

- [Session Isolation](./SESSION_ISOLATION.md)
- [Multi-Account Guide](./MULTI_ACCOUNT_GUIDE.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
