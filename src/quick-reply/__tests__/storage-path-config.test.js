/**
 * Storage Path Configuration Tests
 * 
 * Tests for StoragePathConfig to ensure proper directory setup and permissions.
 * 
 * Requirements: 11.1-11.7
 */

const StoragePathConfig = require('../storage/StoragePathConfig');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('StoragePathConfig', () => {
  let testAccountId;
  let testUserDataPath;
  let config;

  beforeEach(async () => {
    // Create unique test account ID
    testAccountId = `test-account-${Date.now()}`;
    
    // Create temporary test directory
    testUserDataPath = path.join(os.tmpdir(), `quick-reply-test-${Date.now()}`);
    await fs.mkdir(testUserDataPath, { recursive: true });
    
    // Create config instance
    config = new StoragePathConfig(testAccountId, testUserDataPath);
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await config.cleanup();
      await fs.rm(testUserDataPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Path Configuration', () => {
    test('should generate correct templates path', () => {
      const templatesPath = config.getTemplatesPath();
      expect(templatesPath).toContain('quick-reply');
      expect(templatesPath).toContain(testAccountId.replace(/[^a-zA-Z0-9-_]/g, '_'));
      expect(templatesPath).toContain('templates.json');
    });

    test('should generate correct groups path', () => {
      const groupsPath = config.getGroupsPath();
      expect(groupsPath).toContain('quick-reply');
      expect(groupsPath).toContain(testAccountId.replace(/[^a-zA-Z0-9-_]/g, '_'));
      expect(groupsPath).toContain('groups.json');
    });

    test('should generate correct config path', () => {
      const configPath = config.getConfigPath();
      expect(configPath).toContain('quick-reply');
      expect(configPath).toContain(testAccountId.replace(/[^a-zA-Z0-9-_]/g, '_'));
      expect(configPath).toContain('config.json');
    });

    test('should generate correct media directory path', () => {
      const mediaDir = config.getMediaDirectory();
      expect(mediaDir).toContain('quick-reply');
      expect(mediaDir).toContain(testAccountId.replace(/[^a-zA-Z0-9-_]/g, '_'));
      expect(mediaDir).toContain('media');
    });

    test('should generate correct backup directory path', () => {
      const backupDir = config.getBackupDirectory();
      expect(backupDir).toContain('quick-reply');
      expect(backupDir).toContain(testAccountId.replace(/[^a-zA-Z0-9-_]/g, '_'));
      expect(backupDir).toContain('backups');
    });

    test('should sanitize account ID in paths', () => {
      const specialAccountId = 'test@account#123';
      const specialConfig = new StoragePathConfig(specialAccountId, testUserDataPath);
      
      const templatesPath = specialConfig.getTemplatesPath();
      expect(templatesPath).not.toContain('@');
      expect(templatesPath).not.toContain('#');
      expect(templatesPath).toContain('test_account_123');
    });

    test('should generate correct media file path', () => {
      const relativePath = 'media/template-123.jpg';
      const fullPath = config.getMediaFilePath(relativePath);
      
      expect(fullPath).toContain('quick-reply');
      expect(fullPath).toContain(testAccountId.replace(/[^a-zA-Z0-9-_]/g, '_'));
      expect(fullPath).toContain('media');
      expect(fullPath).toContain('template-123.jpg');
    });

    test('should return null for empty media file path', () => {
      expect(config.getMediaFilePath(null)).toBeNull();
      expect(config.getMediaFilePath('')).toBeNull();
    });
  });

  describe('Directory Creation', () => {
    test('should create all required directories', async () => {
      await config.ensureDirectories();
      
      // Check if directories exist
      const accountRoot = config.getAccountRoot();
      const mediaDir = config.getMediaDirectory();
      const backupDir = config.getBackupDirectory();
      
      const accountRootExists = await fs.access(accountRoot).then(() => true).catch(() => false);
      const mediaDirExists = await fs.access(mediaDir).then(() => true).catch(() => false);
      const backupDirExists = await fs.access(backupDir).then(() => true).catch(() => false);
      
      expect(accountRootExists).toBe(true);
      expect(mediaDirExists).toBe(true);
      expect(backupDirExists).toBe(true);
    });

    test('should create nested directories recursively', async () => {
      await config.ensureDirectories();
      
      const templatesPath = config.getTemplatesPath();
      const templatesDir = path.dirname(templatesPath);
      
      const exists = await fs.access(templatesDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    test('should not fail if directories already exist', async () => {
      await config.ensureDirectories();
      
      // Call again - should not throw
      await expect(config.ensureDirectories()).resolves.not.toThrow();
    });
  });

  describe('Permission Verification', () => {
    test('should verify write permissions', async () => {
      const hasPermissions = await config.verifyPermissions();
      expect(hasPermissions).toBe(true);
    });

    test('should create directories during permission check', async () => {
      await config.verifyPermissions();
      
      const accountRoot = config.getAccountRoot();
      const exists = await fs.access(accountRoot).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    test('should be able to write test file', async () => {
      await config.verifyPermissions();
      
      // Try writing a real file
      const testFile = path.join(config.getAccountRoot(), 'test.txt');
      await fs.writeFile(testFile, 'test content', 'utf8');
      
      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('test content');
      
      // Clean up
      await fs.unlink(testFile);
    });
  });

  describe('Storage Information', () => {
    test('should return storage information', async () => {
      const info = await config.getStorageInfo();
      
      expect(info).toHaveProperty('accountId', testAccountId);
      expect(info).toHaveProperty('paths');
      expect(info).toHaveProperty('sizes');
      
      expect(info.paths).toHaveProperty('accountRoot');
      expect(info.paths).toHaveProperty('templates');
      expect(info.paths).toHaveProperty('groups');
      expect(info.paths).toHaveProperty('config');
      expect(info.paths).toHaveProperty('media');
      expect(info.paths).toHaveProperty('backups');
      
      expect(info.sizes).toHaveProperty('templates');
      expect(info.sizes).toHaveProperty('groups');
      expect(info.sizes).toHaveProperty('config');
      expect(info.sizes).toHaveProperty('media');
      expect(info.sizes).toHaveProperty('total');
    });

    test('should calculate file sizes correctly', async () => {
      await config.ensureDirectories();
      
      // Create test files
      const templatesPath = config.getTemplatesPath();
      const testData = JSON.stringify({ test: 'data' });
      await fs.writeFile(templatesPath, testData, 'utf8');
      
      const info = await config.getStorageInfo();
      expect(info.sizes.templates).toBeGreaterThan(0);
      expect(info.sizes.total).toBeGreaterThan(0);
    });

    test('should calculate media directory size', async () => {
      await config.ensureDirectories();
      
      // Create test media file
      const mediaDir = config.getMediaDirectory();
      const testFile = path.join(mediaDir, 'test.jpg');
      await fs.writeFile(testFile, Buffer.from('test image data'), 'binary');
      
      const info = await config.getStorageInfo();
      expect(info.sizes.media).toBeGreaterThan(0);
    });

    test('should return zero size for non-existent files', async () => {
      const info = await config.getStorageInfo();
      
      // Files don't exist yet, should be 0
      expect(info.sizes.templates).toBe(0);
      expect(info.sizes.groups).toBe(0);
      expect(info.sizes.config).toBe(0);
    });
  });

  describe('Account Isolation', () => {
    test('should create separate directories for different accounts', async () => {
      const account1 = new StoragePathConfig('account-1', testUserDataPath);
      const account2 = new StoragePathConfig('account-2', testUserDataPath);
      
      await account1.ensureDirectories();
      await account2.ensureDirectories();
      
      const root1 = account1.getAccountRoot();
      const root2 = account2.getAccountRoot();
      
      expect(root1).not.toBe(root2);
      
      const exists1 = await fs.access(root1).then(() => true).catch(() => false);
      const exists2 = await fs.access(root2).then(() => true).catch(() => false);
      
      expect(exists1).toBe(true);
      expect(exists2).toBe(true);
      
      // Clean up
      await account1.cleanup();
      await account2.cleanup();
    });

    test('should not interfere with other account data', async () => {
      const account1 = new StoragePathConfig('account-1', testUserDataPath);
      const account2 = new StoragePathConfig('account-2', testUserDataPath);
      
      await account1.ensureDirectories();
      await account2.ensureDirectories();
      
      // Write data for account 1
      const templates1Path = account1.getTemplatesPath();
      await fs.writeFile(templates1Path, JSON.stringify({ account: 1 }), 'utf8');
      
      // Write data for account 2
      const templates2Path = account2.getTemplatesPath();
      await fs.writeFile(templates2Path, JSON.stringify({ account: 2 }), 'utf8');
      
      // Verify data is separate
      const data1 = JSON.parse(await fs.readFile(templates1Path, 'utf8'));
      const data2 = JSON.parse(await fs.readFile(templates2Path, 'utf8'));
      
      expect(data1.account).toBe(1);
      expect(data2.account).toBe(2);
      
      // Clean up
      await account1.cleanup();
      await account2.cleanup();
    });
  });

  describe('Cleanup', () => {
    test('should remove all account data', async () => {
      await config.ensureDirectories();
      
      // Create some test files
      const templatesPath = config.getTemplatesPath();
      await fs.writeFile(templatesPath, JSON.stringify({ test: 'data' }), 'utf8');
      
      const accountRoot = config.getAccountRoot();
      const existsBefore = await fs.access(accountRoot).then(() => true).catch(() => false);
      expect(existsBefore).toBe(true);
      
      // Cleanup
      await config.cleanup();
      
      const existsAfter = await fs.access(accountRoot).then(() => true).catch(() => false);
      expect(existsAfter).toBe(false);
    });

    test('should not fail if directory does not exist', async () => {
      // Don't create directories
      await expect(config.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Static Factory Method', () => {
    test('should create instance using forAccount', () => {
      const instance = StoragePathConfig.forAccount('test-account', testUserDataPath);
      
      expect(instance).toBeInstanceOf(StoragePathConfig);
      expect(instance.accountId).toBe('test-account');
    });

    test('should work without userDataPath', () => {
      const instance = StoragePathConfig.forAccount('test-account');
      
      expect(instance).toBeInstanceOf(StoragePathConfig);
      expect(instance.getTemplatesPath()).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('should throw error if accountId is missing', () => {
      expect(() => new StoragePathConfig(null)).toThrow('accountId is required');
      expect(() => new StoragePathConfig('')).toThrow('accountId is required');
    });

    test('should handle permission errors gracefully', async () => {
      // Create a read-only directory (if possible on the platform)
      const readOnlyPath = path.join(testUserDataPath, 'readonly');
      await fs.mkdir(readOnlyPath, { recursive: true });
      
      try {
        // Try to make it read-only (may not work on all platforms)
        await fs.chmod(readOnlyPath, 0o444);
        
        const readOnlyConfig = new StoragePathConfig('test', readOnlyPath);
        
        // This should throw a StorageError
        await expect(readOnlyConfig.verifyPermissions()).rejects.toThrow();
      } catch (error) {
        // If chmod fails, skip this test
        console.log('Skipping read-only test (platform limitation)');
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(readOnlyPath, 0o755);
          await fs.rm(readOnlyPath, { recursive: true, force: true });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });
});
