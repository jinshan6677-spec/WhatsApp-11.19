/**
 * Storage Migration Integration Tests
 * 
 * Tests that storage classes correctly handle data migration.
 * 
 * Task 20: Data Migration
 */

const TemplateStorage = require('../storage/TemplateStorage');
const GroupStorage = require('../storage/GroupStorage');
const ConfigStorage = require('../storage/ConfigStorage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Storage Migration Integration', () => {
  let tempDir;
  let accountId;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-migration-test-'));
    accountId = 'test-account-' + Date.now();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('TemplateStorage Migration', () => {
    test('should migrate legacy template data on load', async () => {
      const storage = new TemplateStorage(accountId, tempDir);
      
      // Create legacy data file (no version)
      const legacyData = {
        templates: [
          {
            id: 't1',
            groupId: 'g1',
            type: 'text',
            label: 'Test',
            content: { text: 'Hello' }
          }
        ]
      };
      
      const storagePath = path.join(tempDir, 'quick-reply', accountId, 'templates.json');
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, JSON.stringify(legacyData), 'utf8');

      // Load data (should trigger migration)
      const templates = await storage.getAll();

      // Check migrated data
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('t1');
      expect(templates[0].usageCount).toBe(0);
      expect(templates[0].lastUsedAt).toBeNull();
      expect(templates[0].createdAt).toBeDefined();
      expect(templates[0].updatedAt).toBeDefined();

      // Check that file was updated with version
      const savedData = JSON.parse(await fs.readFile(storagePath, 'utf8'));
      expect(savedData.version).toBe('1.0.0');
      expect(savedData.templates[0].usageCount).toBe(0);
    });

    test('should create backup before migration', async () => {
      const storage = new TemplateStorage(accountId, tempDir);
      
      // Create legacy data file
      const legacyData = {
        templates: [
          { id: 't1', groupId: 'g1', type: 'text', label: 'Test', content: { text: 'Hello' } }
        ]
      };
      
      const storagePath = path.join(tempDir, 'quick-reply', accountId, 'templates.json');
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, JSON.stringify(legacyData), 'utf8');

      // Load data (should trigger migration and backup)
      await storage.getAll();

      // Check that backup was created
      const files = await fs.readdir(path.dirname(storagePath));
      const backupFiles = files.filter(f => f.includes('.backup-'));
      expect(backupFiles.length).toBeGreaterThan(0);

      // Verify backup content
      const backupPath = path.join(path.dirname(storagePath), backupFiles[0]);
      const backupContent = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      expect(backupContent.templates).toHaveLength(1);
      expect(backupContent.templates[0].id).toBe('t1');
    });

    test('should not migrate if already current version', async () => {
      const storage = new TemplateStorage(accountId, tempDir);
      
      // Create current version data
      const currentData = {
        version: '1.0.0',
        accountId: accountId,
        templates: [
          {
            id: 't1',
            groupId: 'g1',
            type: 'text',
            label: 'Test',
            content: { text: 'Hello' },
            usageCount: 5,
            lastUsedAt: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            order: 1
          }
        ],
        updatedAt: Date.now()
      };
      
      const storagePath = path.join(tempDir, 'quick-reply', accountId, 'templates.json');
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, JSON.stringify(currentData), 'utf8');

      // Load data (should not trigger migration)
      const templates = await storage.getAll();

      // Check data is unchanged
      expect(templates).toHaveLength(1);
      expect(templates[0].usageCount).toBe(5);

      // Check that no backup was created
      const files = await fs.readdir(path.dirname(storagePath));
      const backupFiles = files.filter(f => f.includes('.backup-'));
      expect(backupFiles.length).toBe(0);
    });

    test('should handle array format legacy data', async () => {
      const storage = new TemplateStorage(accountId, tempDir);
      
      // Create very old format (just array)
      const legacyData = [
        { id: 't1', groupId: 'g1', type: 'text', label: 'Test', content: { text: 'Hello' } }
      ];
      
      const storagePath = path.join(tempDir, 'quick-reply', accountId, 'templates.json');
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, JSON.stringify(legacyData), 'utf8');

      // Load data (should trigger migration)
      const templates = await storage.getAll();

      // Check migrated data
      expect(templates).toHaveLength(1);
      expect(templates[0].usageCount).toBe(0);
    });
  });

  describe('GroupStorage Migration', () => {
    test('should migrate legacy group data on load', async () => {
      const storage = new GroupStorage(accountId, tempDir);
      
      // Create legacy data file
      const legacyData = {
        groups: [
          { id: 'g1', name: 'Group 1', parentId: null }
        ]
      };
      
      const storagePath = path.join(tempDir, 'quick-reply', accountId, 'groups.json');
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, JSON.stringify(legacyData), 'utf8');

      // Load data (should trigger migration)
      const groups = await storage.getAll();

      // Check migrated data
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('g1');
      expect(groups[0].createdAt).toBeDefined();
      expect(groups[0].updatedAt).toBeDefined();
      expect(groups[0].expanded).toBe(true);

      // Check that file was updated with version
      const savedData = JSON.parse(await fs.readFile(storagePath, 'utf8'));
      expect(savedData.version).toBe('1.0.0');
    });

    test('should preserve expanded state during migration', async () => {
      const storage = new GroupStorage(accountId, tempDir);
      
      // Create legacy data with expanded state
      const legacyData = {
        groups: [
          { id: 'g1', name: 'Group 1', parentId: null, expanded: false }
        ]
      };
      
      const storagePath = path.join(tempDir, 'quick-reply', accountId, 'groups.json');
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, JSON.stringify(legacyData), 'utf8');

      // Load data
      const groups = await storage.getAll();

      // Check that expanded state was preserved
      expect(groups[0].expanded).toBe(false);
    });
  });

  describe('ConfigStorage Migration', () => {
    test('should migrate legacy config data on load', async () => {
      const storage = new ConfigStorage(accountId, tempDir);
      
      // Create legacy data file
      const legacyData = {
        accountId: accountId,
        sendMode: 'translated'
      };
      
      const storagePath = path.join(tempDir, 'quick-reply', accountId, 'config.json');
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, JSON.stringify(legacyData), 'utf8');

      // Load data (should trigger migration)
      const config = await storage.get();

      // Check migrated data
      expect(config.sendMode).toBe('translated');
      expect(config.expandedGroups).toEqual([]);
      expect(config.lastSelectedGroupId).toBeNull();
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();

      // Check that file was updated with version
      const savedData = JSON.parse(await fs.readFile(storagePath, 'utf8'));
      expect(savedData.version).toBe('1.0.0');
    });

    test('should handle config with wrapper format', async () => {
      const storage = new ConfigStorage(accountId, tempDir);
      
      // Create legacy data with wrapper
      const legacyData = {
        accountId: accountId,
        config: {
          sendMode: 'original',
          expandedGroups: ['g1']
        }
      };
      
      const storagePath = path.join(tempDir, 'quick-reply', accountId, 'config.json');
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, JSON.stringify(legacyData), 'utf8');

      // Load data
      const config = await storage.get();

      // Check migrated data
      expect(config.sendMode).toBe('original');
      expect(config.expandedGroups).toEqual(['g1']);
    });
  });

  describe('Multiple Load Operations', () => {
    test('should only migrate once', async () => {
      const storage = new TemplateStorage(accountId, tempDir);
      
      // Create legacy data
      const legacyData = {
        templates: [
          { id: 't1', groupId: 'g1', type: 'text', label: 'Test', content: { text: 'Hello' } }
        ]
      };
      
      const storagePath = path.join(tempDir, 'quick-reply', accountId, 'templates.json');
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, JSON.stringify(legacyData), 'utf8');

      // First load (triggers migration)
      await storage.getAll();

      // Check backup count
      let files = await fs.readdir(path.dirname(storagePath));
      let backupFiles = files.filter(f => f.includes('.backup-'));
      expect(backupFiles.length).toBe(1);

      // Clear cache to force reload
      storage.clearCache();

      // Second load (should not trigger migration)
      await storage.getAll();

      // Check backup count hasn't increased
      files = await fs.readdir(path.dirname(storagePath));
      backupFiles = files.filter(f => f.includes('.backup-'));
      expect(backupFiles.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted data gracefully', async () => {
      const storage = new TemplateStorage(accountId, tempDir);
      
      // Create corrupted data file
      const storagePath = path.join(tempDir, 'quick-reply', accountId, 'templates.json');
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, 'invalid json{', 'utf8');

      // Should throw error
      await expect(storage.getAll()).rejects.toThrow();
    });
  });
});
