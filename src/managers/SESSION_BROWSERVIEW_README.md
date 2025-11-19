# SessionManager - BrowserView Support

## Overview

The SessionManager has been enhanced to support BrowserView sessions with comprehensive proxy configuration and session isolation capabilities. This enables the single-window multi-account architecture where each account runs in an isolated BrowserView with independent session data and network configuration.

## Key Features

### 1. Session Creation for BrowserViews

Create isolated sessions for each account with automatic partition management:

```javascript
const sessionManager = new SessionManager({
  userDataPath: app.getPath('userData')
});

// Create a session for an account
const result = await sessionManager.createSession('account-001', {
  proxy: {
    enabled: true,
    protocol: 'socks5',
    host: '127.0.0.1',
    port: 1080,
    username: 'user',  // optional
    password: 'pass'   // optional
  }
});

if (result.success) {
  const session = result.session;
  // Use this session when creating BrowserView
  const view = new BrowserView({
    webPreferences: {
      session: session,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
}
```

### 2. Session Isolation

Each account gets its own isolated session with separate:
- Cookies
- LocalStorage
- IndexedDB
- Service Workers
- Cache
- Network proxy settings

```javascript
// Verify session isolation
const isolation = await sessionManager.verifySessionIsolation('account-001');
console.log(isolation.isolated); // true
console.log(isolation.details);
// {
//   partition: 'persist:account_account-001',
//   userDataDir: '/path/to/profiles/account-001',
//   hasOwnCookies: true,
//   hasOwnLocalStorage: true,
//   hasOwnIndexedDB: true,
//   hasOwnCache: true
// }
```

### 3. Proxy Configuration

Configure independent proxy settings for each account:

```javascript
// Configure HTTP proxy
await sessionManager.configureProxy('account-001', {
  protocol: 'http',
  host: 'proxy.example.com',
  port: 8080
});

// Configure SOCKS5 proxy with authentication
await sessionManager.configureProxy('account-002', {
  protocol: 'socks5',
  host: '127.0.0.1',
  port: 1080,
  username: 'proxyuser',
  password: 'proxypass',
  bypass: '<local>' // optional bypass rules
});

// Clear proxy (use direct connection)
await sessionManager.clearProxy('account-001');
```

#### Supported Proxy Protocols
- `http` - HTTP proxy
- `https` - HTTPS proxy
- `socks5` - SOCKS5 proxy
- `socks4` - SOCKS4 proxy

#### Proxy Authentication
Proxy authentication is handled automatically through Electron's webRequest API. When username and password are provided, the SessionManager sets up an interceptor to add the `Proxy-Authorization` header to all requests.

### 4. Login Status Detection

Detect WhatsApp Web login status for both BrowserWindow and BrowserView:

```javascript
// For BrowserView
const view = viewManager.getView('account-001');
const isLoggedIn = await sessionManager.detectLoginStatus('account-001', view);

// For BrowserWindow (backward compatible)
const window = new BrowserWindow({...});
const isLoggedIn = await sessionManager.detectLoginStatus('account-001', window);
```

### 5. Session Data Management

```javascript
// Check if session data exists
const hasData = await sessionManager.hasSessionData('account-001');

// Get session data statistics
const stats = await sessionManager.getSessionDataStats('account-001');
console.log(`Size: ${stats.size} bytes, Files: ${stats.files}`);

// Clear session data (force logout)
await sessionManager.clearSessionData('account-001');

// Delete user data directory
await sessionManager.deleteUserDataDir('account-001');

// Backup session data
const backup = await sessionManager.backupSessionData('account-001', '/backup/path');
console.log(`Backed up to: ${backup.backupPath}`);

// Restore session data
await sessionManager.restoreSessionData('account-001', '/backup/path/backup-account-001-...');
```

### 6. Cache Management

```javascript
// Get cached login status
const status = sessionManager.getCachedLoginStatus('account-001');

// Set login status
sessionManager.setLoginStatus('account-001', true);

// Clear all caches for an account
sessionManager.clearAccountCache('account-001');
```

## Integration with ViewManager

The SessionManager is designed to work seamlessly with the ViewManager:

```javascript
class ViewManager {
  constructor(mainWindow, sessionManager) {
    this.mainWindow = mainWindow;
    this.sessionManager = sessionManager;
    this.views = new Map();
  }

  async createView(accountId, config) {
    // Create session with proxy configuration
    const sessionResult = await this.sessionManager.createSession(accountId, config);
    
    if (!sessionResult.success) {
      throw new Error(`Failed to create session: ${sessionResult.error}`);
    }

    // Create BrowserView with isolated session
    const view = new BrowserView({
      webPreferences: {
        session: sessionResult.session,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload-view.js')
      }
    });

    // Load WhatsApp Web
    await view.webContents.loadURL('https://web.whatsapp.com');

    // Store view
    this.views.set(accountId, {
      view,
      session: sessionResult.session,
      config
    });

    return view;
  }

  async detectLoginStatus(accountId) {
    const viewData = this.views.get(accountId);
    if (!viewData) return false;

    return await this.sessionManager.detectLoginStatus(accountId, viewData.view);
  }
}
```

## Error Handling

All methods return structured error responses:

```javascript
const result = await sessionManager.createSession('invalid-id', config);
if (!result.success) {
  console.error(`Error: ${result.error}`);
  // Handle error appropriately
}
```

### Common Errors

1. **Invalid accountId**: Empty or non-string account ID
2. **Invalid proxy configuration**: Invalid protocol, host, or port
3. **Session not found**: Attempting to configure proxy for non-existent session
4. **Network errors**: Proxy connection failures

## Migration from Multi-Window Architecture

The SessionManager maintains backward compatibility with the old multi-window architecture:

```javascript
// Old method (still works)
const session = sessionManager.getInstanceSession('instance-001');

// New method (recommended)
const session = sessionManager.getSession('account-001');
```

## Requirements Satisfied

This implementation satisfies the following requirements from the design document:

- **4.1**: Unique user data directory per account
- **4.2**: Isolated browser session using Electron's partition API
- **4.3**: Separate cookies, localStorage, IndexedDB, and Service Workers
- **4.4**: Separate cache and browsing data
- **4.5**: Independent proxy configuration per session
- **8.1**: Proxy configuration with protocol, host, port, and authentication
- **8.2**: Support for HTTP, HTTPS, and SOCKS5 protocols
- **8.3**: Apply proxy settings only to specific account session
- **8.4**: Update proxy settings for active sessions
- **8.5**: Validate proxy connectivity

## Performance Considerations

- Sessions are cached in memory to avoid repeated partition lookups
- Proxy configurations are cached to enable quick reconfiguration
- Login status is cached to reduce DOM queries
- User data directories are created lazily (only when needed)

## Security Considerations

- Proxy credentials are handled securely through Electron's webRequest API
- Each session has complete isolation from other sessions
- Session data is stored in separate directories with proper permissions
- Proxy authentication headers are added only to proxy requests
