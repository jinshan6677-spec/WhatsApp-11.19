# Quick Reply Storage Path Configuration

## Overview

The `StoragePathConfig` class provides centralized management of all storage paths for the quick-reply feature. It ensures consistent path configuration across all storage components and implements account-level data isolation.

## Requirements

Implements requirements **11.1-11.7**: Account-level configuration isolation

## Directory Structure

```
{userData}/
└── quick-reply/
    ├── {accountId-1}/
    │   ├── templates.json      # Template data
    │   ├── groups.json         # Group data
    │   ├── config.json         # Configuration data
    │   ├── media/              # Media files
    │   │   ├── template-1.jpg
    │   │   ├── template-2.mp3
    │   │   └── template-3.mp4
    │   └── backups/            # Data backups
    │       ├── templates-20231201.json
    │       └── groups-20231201.json
    ├── {accountId-2}/
    │   ├── templates.json
    │   ├── groups.json
    │   ├── config.json
    │   ├── media/
    │   └── backups/
    └── ...
```

## Features

### 1. Account-Level Isolation

Each WhatsApp account has its own isolated storage directory:

```javascript
const config1 = new StoragePathConfig('account-1');
const config2 = new StoragePathConfig('account-2');

// Different paths for different accounts
console.log(config1.getAccountRoot()); // .../quick-reply/account-1/
console.log(config2.getAccountRoot()); // .../quick-reply/account-2/
```

### 2. Path Sanitization

Account IDs are automatically sanitized for safe use in file paths:

```javascript
const config = new StoragePathConfig('user@example.com');
// Path will use: user_example_com
```

### 3. Automatic Directory Creation

Directories are created automatically when needed:

```javascript
const config = new StoragePathConfig('account-1');
await config.ensureDirectories();
// Creates: account root, media directory, backup directory
```

### 4. Permission Verification

Verify write permissions before operations:

```javascript
const config = new StoragePathConfig('account-1');
const hasPermissions = await config.verifyPermissions();
if (hasPermissions) {
  console.log('Storage is writable');
}
```

### 5. Storage Information

Get detailed storage information:

```javascript
const config = new StoragePathConfig('account-1');
const info = await config.getStorageInfo();

console.log(info);
// {
//   accountId: 'account-1',
//   paths: {
//     accountRoot: '...',
//     templates: '...',
//     groups: '...',
//     config: '...',
//     media: '...',
//     backups: '...'
//   },
//   sizes: {
//     templates: 1024,
//     groups: 512,
//     config: 256,
//     media: 10240,
//     total: 12032
//   }
// }
```

## Usage

### Basic Usage

```javascript
const StoragePathConfig = require('./storage/StoragePathConfig');

// Create configuration for an account
const config = new StoragePathConfig('my-account-id');

// Get paths
const templatesPath = config.getTemplatesPath();
const groupsPath = config.getGroupsPath();
const configPath = config.getConfigPath();
const mediaDir = config.getMediaDirectory();

// Ensure directories exist
await config.ensureDirectories();

// Verify permissions
const canWrite = await config.verifyPermissions();
```

### With Custom User Data Path (Testing)

```javascript
const config = new StoragePathConfig('test-account', '/tmp/test-data');
```

### Using Static Factory Method

```javascript
const config = StoragePathConfig.forAccount('my-account');
```

### Integration with Storage Classes

The storage classes (TemplateStorage, GroupStorage, ConfigStorage) can use StoragePathConfig:

```javascript
const StoragePathConfig = require('./StoragePathConfig');
const config = new StoragePathConfig(accountId, userDataPath);

// Use in storage class
this.storagePath = config.getTemplatesPath();
await config.ensureDirectories();
```

### Media File Path Resolution

```javascript
const config = new StoragePathConfig('account-1');

// Get full path for a media file
const relativePath = 'media/template-123.jpg';
const fullPath = config.getMediaFilePath(relativePath);

// Use the path
const imageData = await fs.readFile(fullPath);
```

### Storage Cleanup

```javascript
const config = new StoragePathConfig('account-1');

// Remove all data for this account
await config.cleanup();
```

## API Reference

### Constructor

```javascript
new StoragePathConfig(accountId, userDataPath?)
```

- `accountId` (string, required): WhatsApp account ID
- `userDataPath` (string, optional): Custom user data path (for testing)

### Methods

#### Path Getters

- `getTemplatesPath()`: Returns templates.json file path
- `getGroupsPath()`: Returns groups.json file path
- `getConfigPath()`: Returns config.json file path
- `getMediaDirectory()`: Returns media directory path
- `getBackupDirectory()`: Returns backup directory path
- `getAccountRoot()`: Returns account root directory path
- `getQuickReplyRoot()`: Returns quick-reply root directory path
- `getMediaFilePath(relativePath)`: Returns full path for a media file

#### Directory Management

- `ensureDirectories()`: Creates all required directories
- `verifyPermissions()`: Verifies write permissions
- `cleanup()`: Removes all account data (WARNING: destructive)

#### Information

- `getStorageInfo()`: Returns detailed storage information

#### Static Methods

- `StoragePathConfig.forAccount(accountId, userDataPath?)`: Factory method

## Path Configuration Details

### Base Storage Path

The base storage path is determined in the following order:

1. Custom `userDataPath` parameter (if provided)
2. Electron's `app.getPath('userData')` (in Electron environment)
3. `{cwd}/session-data` (fallback for testing)

### Account ID Sanitization

Account IDs are sanitized by replacing any character that's not alphanumeric, dash, or underscore with an underscore:

```javascript
'user@example.com' → 'user_example_com'
'account#123'      → 'account_123'
'test-account_1'   → 'test-account_1' (no change)
```

### Media File Paths

Media files are stored with the following naming convention:

```
media/{templateId}{extension}
```

Example:
```
media/template-abc123.jpg
media/template-def456.mp3
media/template-ghi789.mp4
```

## Testing

### Run Tests

```bash
npm test -- storage-path-config.test.js
```

### Run Verification Script

```bash
node src/quick-reply/__tests__/verify-storage-paths.js
```

The verification script will:
- Create test directories for multiple accounts
- Verify path generation
- Test directory creation
- Verify permissions
- Create sample data files
- Test account isolation
- Display storage information
- Clean up test data

## Error Handling

The class throws `StorageError` for the following conditions:

- Missing `accountId` parameter
- Failed directory creation
- Permission verification failure
- Storage information retrieval failure
- Cleanup failure

Example:

```javascript
try {
  const config = new StoragePathConfig('account-1');
  await config.ensureDirectories();
} catch (error) {
  if (error instanceof StorageError) {
    console.error('Storage error:', error.message);
  }
}
```

## Best Practices

1. **Always ensure directories before operations**:
   ```javascript
   await config.ensureDirectories();
   ```

2. **Verify permissions in critical operations**:
   ```javascript
   if (await config.verifyPermissions()) {
     // Proceed with operation
   }
   ```

3. **Use the same config instance for related operations**:
   ```javascript
   const config = new StoragePathConfig(accountId);
   const templatesPath = config.getTemplatesPath();
   const groupsPath = config.getGroupsPath();
   ```

4. **Handle cleanup carefully**:
   ```javascript
   // Only cleanup when absolutely necessary
   if (userConfirmed) {
     await config.cleanup();
   }
   ```

5. **Monitor storage sizes**:
   ```javascript
   const info = await config.getStorageInfo();
   if (info.sizes.total > MAX_SIZE) {
     // Handle storage limit
   }
   ```

## Integration Example

Complete example of integrating StoragePathConfig with a storage class:

```javascript
const StoragePathConfig = require('./StoragePathConfig');
const fs = require('fs').promises;

class TemplateStorage {
  constructor(accountId, userDataPath = null) {
    this.config = new StoragePathConfig(accountId, userDataPath);
    this.storagePath = this.config.getTemplatesPath();
  }

  async save(template) {
    // Ensure directories exist
    await this.config.ensureDirectories();
    
    // Verify permissions
    await this.config.verifyPermissions();
    
    // Save data
    const data = { templates: [template] };
    await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2));
  }

  async load() {
    await this.config.ensureDirectories();
    const data = await fs.readFile(this.storagePath, 'utf8');
    return JSON.parse(data);
  }
}
```

## Migration Notes

If you're migrating from the old storage implementation:

1. The path structure remains the same
2. StoragePathConfig provides a centralized way to manage paths
3. All storage classes should use StoragePathConfig for consistency
4. Existing data files will work without changes

## Security Considerations

1. **Path Sanitization**: Account IDs are sanitized to prevent path traversal attacks
2. **Permission Verification**: Write permissions are verified before operations
3. **Account Isolation**: Each account's data is completely isolated
4. **No Hardcoded Paths**: All paths are generated dynamically

## Performance Considerations

1. **Directory Caching**: Directory existence is checked once per operation
2. **Lazy Creation**: Directories are only created when needed
3. **Efficient Size Calculation**: Storage sizes are calculated recursively but efficiently
4. **Minimal File System Operations**: Operations are batched when possible

## Troubleshooting

### Issue: Directories not created

**Solution**: Call `ensureDirectories()` before operations:
```javascript
await config.ensureDirectories();
```

### Issue: Permission denied errors

**Solution**: Verify permissions and check directory ownership:
```javascript
const hasPermissions = await config.verifyPermissions();
if (!hasPermissions) {
  console.error('No write permissions');
}
```

### Issue: Account data mixing

**Solution**: Ensure each account uses its own StoragePathConfig instance:
```javascript
// Correct
const config1 = new StoragePathConfig('account-1');
const config2 = new StoragePathConfig('account-2');

// Incorrect - don't reuse config for different accounts
```

### Issue: Media files not found

**Solution**: Use `getMediaFilePath()` to resolve full paths:
```javascript
const fullPath = config.getMediaFilePath('media/template-123.jpg');
```

## Related Documentation

- [Storage Layer README](./README.md)
- [Migration Guide](../utils/MIGRATION_README.md)
- [File Utilities](../utils/file.js)
- [Quick Reply Integration Guide](../INTEGRATION_GUIDE.md)
