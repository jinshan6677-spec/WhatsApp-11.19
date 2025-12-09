# Data Migration System

## Overview

The data migration system ensures backward compatibility when the quick-reply data format changes. It automatically detects legacy data formats and migrates them to the current version.

## Current Version

**Version: 1.0.0**

This is the current data format version. All new data is saved with this version.

## Migration Features

### 1. Automatic Version Detection

The system automatically detects the version of stored data:

```javascript
const { detectVersion } = require('./migration');

const data = loadDataFromFile();
const version = detectVersion(data);
// Returns: '1.0.0' or '0.0.0' (legacy)
```

### 2. Automatic Migration

When legacy data is detected, it's automatically migrated:

```javascript
const { needsMigration, migrateData } = require('./migration');

if (needsMigration(version)) {
  const migratedData = migrateData(data, version);
  // Data is now in current format
}
```

### 3. Automatic Backup

Before migration, a backup is automatically created:

```javascript
const { createBackup } = require('./migration');

const backupPath = await createBackup(data, storagePath);
// Backup saved to: storagePath.backup-2024-12-09T10-30-45
```

### 4. Data Validation

After migration, data is validated to ensure correctness:

```javascript
const { validateMigratedData } = require('./migration');

validateMigratedData(migratedData, 'templates');
// Throws error if validation fails
```

## Migration Path

### Legacy (0.0.0) → Current (1.0.0)

**Templates Migration:**
- Adds `usageCount` field (default: 0)
- Adds `lastUsedAt` field (default: null)
- Adds `createdAt` field (default: current timestamp)
- Adds `updatedAt` field (default: current timestamp)
- Adds `order` field (default: 0)
- Wraps array format in object with version and accountId

**Groups Migration:**
- Adds `createdAt` field (default: current timestamp)
- Adds `updatedAt` field (default: current timestamp)
- Adds `order` field (default: 0)
- Adds `expanded` field (default: true)
- Wraps array format in object with version and accountId

**Config Migration:**
- Adds `sendMode` field (default: 'original')
- Adds `expandedGroups` field (default: [])
- Adds `lastSelectedGroupId` field (default: null)
- Adds `createdAt` field (default: current timestamp)
- Adds `updatedAt` field (default: current timestamp)
- Wraps config in object with version and accountId

## Data Format Examples

### Legacy Format (0.0.0)

**Templates (Array Format):**
```json
[
  {
    "id": "t1",
    "groupId": "g1",
    "type": "text",
    "label": "Greeting",
    "content": { "text": "Hello!" }
  }
]
```

**Templates (Object Format without version):**
```json
{
  "accountId": "account-123",
  "templates": [
    {
      "id": "t1",
      "groupId": "g1",
      "type": "text",
      "label": "Greeting",
      "content": { "text": "Hello!" }
    }
  ]
}
```

### Current Format (1.0.0)

**Templates:**
```json
{
  "version": "1.0.0",
  "accountId": "account-123",
  "templates": [
    {
      "id": "t1",
      "groupId": "g1",
      "type": "text",
      "label": "Greeting",
      "content": { "text": "Hello!" },
      "order": 1,
      "usageCount": 0,
      "lastUsedAt": null,
      "createdAt": 1702123456789,
      "updatedAt": 1702123456789
    }
  ],
  "updatedAt": 1702123456789
}
```

**Groups:**
```json
{
  "version": "1.0.0",
  "accountId": "account-123",
  "groups": [
    {
      "id": "g1",
      "name": "Greetings",
      "parentId": null,
      "order": 1,
      "expanded": true,
      "createdAt": 1702123456789,
      "updatedAt": 1702123456789
    }
  ],
  "updatedAt": 1702123456789
}
```

**Config:**
```json
{
  "version": "1.0.0",
  "accountId": "account-123",
  "config": {
    "sendMode": "original",
    "expandedGroups": ["g1", "g2"],
    "lastSelectedGroupId": "g1",
    "createdAt": 1702123456789,
    "updatedAt": 1702123456789
  },
  "updatedAt": 1702123456789
}
```

## Storage Integration

The migration system is integrated into all storage classes:

### TemplateStorage

```javascript
const storage = new TemplateStorage(accountId);

// Automatically migrates on first load
const templates = await storage.getAll();
```

### GroupStorage

```javascript
const storage = new GroupStorage(accountId);

// Automatically migrates on first load
const groups = await storage.getAll();
```

### ConfigStorage

```javascript
const storage = new ConfigStorage(accountId);

// Automatically migrates on first load
const config = await storage.get();
```

## Migration Process

1. **Load Data**: Storage class loads data from file
2. **Detect Version**: System detects data version
3. **Check Migration**: System checks if migration is needed
4. **Create Backup**: If migration needed, backup is created
5. **Migrate Data**: Data is migrated to current version
6. **Validate Data**: Migrated data is validated
7. **Save Data**: Migrated data is saved to file
8. **Return Data**: Migrated data is returned to caller

## Backup Files

Backup files are created with the following naming convention:

```
{original-filename}.backup-{timestamp}
```

Example:
```
templates.json.backup-2024-12-09T10-30-45-123Z
```

Backups are stored in the same directory as the original file.

## Error Handling

### Migration Errors

If migration fails, a `StorageError` is thrown with details:

```javascript
try {
  const data = await storage.getAll();
} catch (error) {
  if (error instanceof StorageError) {
    console.error('Migration failed:', error.message);
  }
}
```

### Validation Errors

If validation fails after migration, an error is thrown:

```javascript
// Error: Migrated data missing version field
// Error: Migrated templates data must have templates array
```

## Adding New Migrations

To add a new migration (e.g., from 1.0.0 to 1.1.0):

1. **Update CURRENT_VERSION**:
```javascript
const CURRENT_VERSION = '1.1.0';
```

2. **Add Migration Function**:
```javascript
function migrateFrom_1_0_0_to_1_1_0(data) {
  // Migration logic
  return migratedData;
}
```

3. **Register Migration**:
```javascript
const MIGRATIONS = {
  '0.0.0': migrateFrom_0_0_0_to_1_0_0,
  '1.0.0': migrateFrom_1_0_0_to_1_1_0, // New migration
};
```

4. **Update getMigrationPath** (if multi-step migration needed):
```javascript
function getMigrationPath(sourceVersion, targetVersion) {
  // Add logic for multi-step migrations
}
```

## Testing

Comprehensive tests are available in:
- `__tests__/migration.test.js` - Unit tests for migration utilities
- `__tests__/storage-migration.test.js` - Integration tests with storage classes

Run tests:
```bash
npm test -- migration
```

## Best Practices

1. **Always Backup**: Backups are created automatically, but you can also create manual backups
2. **Test Migrations**: Always test migrations with real data before deploying
3. **Validate Data**: Always validate data after migration
4. **Log Migration**: Migration events are logged for debugging
5. **Handle Errors**: Always handle migration errors gracefully

## Troubleshooting

### Migration Not Triggered

Check if data already has current version:
```javascript
const version = detectVersion(data);
console.log('Data version:', version);
```

### Migration Fails

Check logs for error details:
```javascript
const logger = require('./logger');
logger.error('migration', 'Migration failed', error);
```

### Backup Not Created

Ensure write permissions for storage directory:
```bash
ls -la /path/to/storage/directory
```

### Data Corrupted After Migration

Restore from backup:
```bash
cp templates.json.backup-{timestamp} templates.json
```

## Future Enhancements

Potential future improvements:
1. Multi-step migrations (e.g., 0.0.0 → 0.5.0 → 1.0.0)
2. Rollback support
3. Migration progress reporting
4. Automatic backup cleanup (keep last N backups)
5. Migration dry-run mode
6. Migration statistics and reporting

## Related Files

- `utils/migration.js` - Migration utilities
- `storage/TemplateStorage.js` - Template storage with migration
- `storage/GroupStorage.js` - Group storage with migration
- `storage/ConfigStorage.js` - Config storage with migration
- `__tests__/migration.test.js` - Migration tests
- `__tests__/storage-migration.test.js` - Storage migration tests
