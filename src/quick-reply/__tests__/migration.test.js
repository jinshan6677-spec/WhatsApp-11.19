/**
 * Migration Tests
 * 
 * Tests for data migration functionality.
 * Ensures backward compatibility and correct version handling.
 * 
 * Task 20: Data Migration
 */

const {
  CURRENT_VERSION,
  LEGACY_VERSION,
  detectVersion,
  needsMigration,
  getMigrationPath,
  migrateData,
  migrateFrom_0_0_0_to_1_0_0,
  migrateGroupsFrom_0_0_0_to_1_0_0,
  migrateConfigFrom_0_0_0_to_1_0_0,
  validateMigratedData,
  createBackup
} = require('../utils/migration');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Migration Utilities', () => {
  describe('detectVersion', () => {
    test('should detect current version', () => {
      const data = { version: '1.0.0', templates: [] };
      expect(detectVersion(data)).toBe('1.0.0');
    });

    test('should detect legacy version when no version field', () => {
      const data = { templates: [] };
      expect(detectVersion(data)).toBe(LEGACY_VERSION);
    });

    test('should detect legacy version for null data', () => {
      expect(detectVersion(null)).toBe(LEGACY_VERSION);
    });

    test('should detect legacy version for undefined data', () => {
      expect(detectVersion(undefined)).toBe(LEGACY_VERSION);
    });
  });

  describe('needsMigration', () => {
    test('should return false for current version', () => {
      expect(needsMigration(CURRENT_VERSION)).toBe(false);
    });

    test('should return true for legacy version', () => {
      expect(needsMigration(LEGACY_VERSION)).toBe(true);
    });

    test('should return true for old versions', () => {
      expect(needsMigration('0.9.0')).toBe(true);
    });
  });

  describe('getMigrationPath', () => {
    test('should return empty array for same version', () => {
      const path = getMigrationPath(CURRENT_VERSION, CURRENT_VERSION);
      expect(path).toEqual([]);
    });

    test('should return migration path for legacy version', () => {
      const path = getMigrationPath(LEGACY_VERSION, CURRENT_VERSION);
      expect(path).toEqual([LEGACY_VERSION]);
    });

    test('should throw error for unknown version', () => {
      expect(() => getMigrationPath('99.0.0', CURRENT_VERSION)).toThrow();
    });
  });

  describe('migrateFrom_0_0_0_to_1_0_0', () => {
    test('should migrate array format to object format', () => {
      const legacyData = [
        { id: 't1', groupId: 'g1', type: 'text', label: 'Test', content: { text: 'Hello' } }
      ];

      const migrated = migrateFrom_0_0_0_to_1_0_0(legacyData);

      expect(migrated.version).toBe('1.0.0');
      expect(migrated.templates).toHaveLength(1);
      expect(migrated.templates[0].usageCount).toBe(0);
      expect(migrated.templates[0].lastUsedAt).toBeNull();
      expect(migrated.templates[0].createdAt).toBeDefined();
      expect(migrated.templates[0].updatedAt).toBeDefined();
    });

    test('should migrate object without version', () => {
      const legacyData = {
        accountId: 'test-account',
        templates: [
          { id: 't1', groupId: 'g1', type: 'text', label: 'Test', content: { text: 'Hello' } }
        ]
      };

      const migrated = migrateFrom_0_0_0_to_1_0_0(legacyData);

      expect(migrated.version).toBe('1.0.0');
      expect(migrated.accountId).toBe('test-account');
      expect(migrated.templates).toHaveLength(1);
      expect(migrated.templates[0].usageCount).toBe(0);
    });

    test('should add missing fields to templates', () => {
      const legacyData = {
        templates: [
          { id: 't1', groupId: 'g1', type: 'text', label: 'Test', content: { text: 'Hello' } }
        ]
      };

      const migrated = migrateFrom_0_0_0_to_1_0_0(legacyData);
      const template = migrated.templates[0];

      expect(template.usageCount).toBe(0);
      expect(template.lastUsedAt).toBeNull();
      expect(template.createdAt).toBeDefined();
      expect(template.updatedAt).toBeDefined();
      expect(template.order).toBe(0);
    });

    test('should preserve existing fields', () => {
      const legacyData = {
        templates: [
          {
            id: 't1',
            groupId: 'g1',
            type: 'text',
            label: 'Test',
            content: { text: 'Hello' },
            usageCount: 5,
            order: 3
          }
        ]
      };

      const migrated = migrateFrom_0_0_0_to_1_0_0(legacyData);
      const template = migrated.templates[0];

      expect(template.usageCount).toBe(5);
      expect(template.order).toBe(3);
    });
  });

  describe('migrateGroupsFrom_0_0_0_to_1_0_0', () => {
    test('should migrate array format to object format', () => {
      const legacyData = [
        { id: 'g1', name: 'Group 1', parentId: null }
      ];

      const migrated = migrateGroupsFrom_0_0_0_to_1_0_0(legacyData);

      expect(migrated.version).toBe('1.0.0');
      expect(migrated.groups).toHaveLength(1);
      expect(migrated.groups[0].createdAt).toBeDefined();
      expect(migrated.groups[0].updatedAt).toBeDefined();
      expect(migrated.groups[0].expanded).toBe(true);
    });

    test('should migrate object without version', () => {
      const legacyData = {
        accountId: 'test-account',
        groups: [
          { id: 'g1', name: 'Group 1', parentId: null }
        ]
      };

      const migrated = migrateGroupsFrom_0_0_0_to_1_0_0(legacyData);

      expect(migrated.version).toBe('1.0.0');
      expect(migrated.accountId).toBe('test-account');
      expect(migrated.groups).toHaveLength(1);
    });

    test('should add missing fields to groups', () => {
      const legacyData = {
        groups: [
          { id: 'g1', name: 'Group 1', parentId: null }
        ]
      };

      const migrated = migrateGroupsFrom_0_0_0_to_1_0_0(legacyData);
      const group = migrated.groups[0];

      expect(group.createdAt).toBeDefined();
      expect(group.updatedAt).toBeDefined();
      expect(group.order).toBe(0);
      expect(group.expanded).toBe(true);
    });

    test('should preserve existing expanded state', () => {
      const legacyData = {
        groups: [
          { id: 'g1', name: 'Group 1', parentId: null, expanded: false }
        ]
      };

      const migrated = migrateGroupsFrom_0_0_0_to_1_0_0(legacyData);
      expect(migrated.groups[0].expanded).toBe(false);
    });
  });

  describe('migrateConfigFrom_0_0_0_to_1_0_0', () => {
    test('should migrate config object without wrapper', () => {
      const legacyData = {
        accountId: 'test-account',
        sendMode: 'original'
      };

      const migrated = migrateConfigFrom_0_0_0_to_1_0_0(legacyData);

      expect(migrated.version).toBe('1.0.0');
      expect(migrated.accountId).toBe('test-account');
      expect(migrated.config.sendMode).toBe('original');
    });

    test('should migrate config with wrapper', () => {
      const legacyData = {
        accountId: 'test-account',
        config: {
          sendMode: 'translated'
        }
      };

      const migrated = migrateConfigFrom_0_0_0_to_1_0_0(legacyData);

      expect(migrated.version).toBe('1.0.0');
      expect(migrated.config.sendMode).toBe('translated');
    });

    test('should add missing fields to config', () => {
      const legacyData = {
        config: {}
      };

      const migrated = migrateConfigFrom_0_0_0_to_1_0_0(legacyData);
      const config = migrated.config;

      expect(config.sendMode).toBe('original');
      expect(config.expandedGroups).toEqual([]);
      expect(config.lastSelectedGroupId).toBeNull();
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();
    });
  });

  describe('validateMigratedData', () => {
    test('should validate templates data', () => {
      const data = {
        version: '1.0.0',
        accountId: 'test',
        templates: []
      };

      expect(() => validateMigratedData(data, 'templates')).not.toThrow();
    });

    test('should validate groups data', () => {
      const data = {
        version: '1.0.0',
        accountId: 'test',
        groups: []
      };

      expect(() => validateMigratedData(data, 'groups')).not.toThrow();
    });

    test('should validate config data', () => {
      const data = {
        version: '1.0.0',
        accountId: 'test',
        config: {}
      };

      expect(() => validateMigratedData(data, 'config')).not.toThrow();
    });

    test('should throw error for null data', () => {
      expect(() => validateMigratedData(null, 'templates')).toThrow('null or undefined');
    });

    test('should throw error for missing version', () => {
      const data = { accountId: 'test', templates: [] };
      expect(() => validateMigratedData(data, 'templates')).toThrow('missing version');
    });

    test('should throw error for missing accountId', () => {
      const data = { version: '1.0.0', templates: [] };
      expect(() => validateMigratedData(data, 'templates')).toThrow('missing accountId');
    });

    test('should throw error for missing templates array', () => {
      const data = { version: '1.0.0', accountId: 'test' };
      expect(() => validateMigratedData(data, 'templates')).toThrow('templates array');
    });

    test('should throw error for unknown data type', () => {
      const data = { version: '1.0.0', accountId: 'test' };
      expect(() => validateMigratedData(data, 'unknown')).toThrow('Unknown data type');
    });
  });

  describe('createBackup', () => {
    let tempDir;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-test-'));
    });

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should create backup file', async () => {
      const data = { version: '0.0.0', templates: [] };
      const storagePath = path.join(tempDir, 'templates.json');

      const backupPath = await createBackup(data, storagePath);

      expect(backupPath).toContain('.backup-');
      
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);

      const backupContent = await fs.readFile(backupPath, 'utf8');
      const parsed = JSON.parse(backupContent);
      expect(parsed).toEqual(data);
    });

    test('should include timestamp in backup filename', async () => {
      const data = { version: '0.0.0', templates: [] };
      const storagePath = path.join(tempDir, 'templates.json');

      const backupPath = await createBackup(data, storagePath);

      expect(backupPath).toMatch(/\.backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });
  });

  describe('migrateData', () => {
    test('should migrate from legacy to current version', () => {
      const legacyData = {
        templates: [
          { id: 't1', groupId: 'g1', type: 'text', label: 'Test', content: { text: 'Hello' } }
        ]
      };

      const migrated = migrateData(legacyData, LEGACY_VERSION, CURRENT_VERSION);

      expect(migrated.version).toBe(CURRENT_VERSION);
      expect(migrated.templates[0].usageCount).toBe(0);
    });

    test('should return same data if no migration needed', () => {
      const currentData = {
        version: CURRENT_VERSION,
        templates: []
      };

      const result = migrateData(currentData, CURRENT_VERSION, CURRENT_VERSION);

      expect(result).toEqual(currentData);
    });

    test('should throw error for unknown migration path', () => {
      const data = { version: '99.0.0' };

      expect(() => migrateData(data, '99.0.0', CURRENT_VERSION)).toThrow('No migration path');
    });
  });

  describe('Integration: Full migration workflow', () => {
    test('should handle complete template migration', () => {
      // Legacy data without version
      const legacyData = [
        {
          id: 't1',
          groupId: 'g1',
          type: 'text',
          label: 'Greeting',
          content: { text: 'Hello!' }
        },
        {
          id: 't2',
          groupId: 'g1',
          type: 'image',
          label: 'Logo',
          content: { mediaPath: '/path/to/logo.png' }
        }
      ];

      // Detect version
      const version = detectVersion(legacyData);
      expect(version).toBe(LEGACY_VERSION);

      // Check if migration needed
      expect(needsMigration(version)).toBe(true);

      // Migrate
      const migrated = migrateFrom_0_0_0_to_1_0_0(legacyData);

      // Validate
      expect(() => validateMigratedData(migrated, 'templates')).not.toThrow();

      // Check migrated data
      expect(migrated.version).toBe('1.0.0');
      expect(migrated.templates).toHaveLength(2);
      
      migrated.templates.forEach(template => {
        expect(template.usageCount).toBe(0);
        expect(template.lastUsedAt).toBeNull();
        expect(template.createdAt).toBeDefined();
        expect(template.updatedAt).toBeDefined();
      });
    });

    test('should handle complete group migration', () => {
      // Legacy data
      const legacyData = {
        accountId: 'test-account',
        groups: [
          { id: 'g1', name: 'Greetings', parentId: null },
          { id: 'g2', name: 'Products', parentId: null },
          { id: 'g3', name: 'Subcategory', parentId: 'g2' }
        ]
      };

      // Detect and migrate
      const version = detectVersion(legacyData);
      expect(needsMigration(version)).toBe(true);

      const migrated = migrateGroupsFrom_0_0_0_to_1_0_0(legacyData);

      // Validate
      expect(() => validateMigratedData(migrated, 'groups')).not.toThrow();

      // Check migrated data
      expect(migrated.version).toBe('1.0.0');
      expect(migrated.groups).toHaveLength(3);
      
      migrated.groups.forEach(group => {
        expect(group.createdAt).toBeDefined();
        expect(group.updatedAt).toBeDefined();
        expect(group.expanded).toBeDefined();
      });
    });

    test('should handle complete config migration', () => {
      // Legacy data
      const legacyData = {
        accountId: 'test-account',
        sendMode: 'translated',
        expandedGroups: ['g1', 'g2']
      };

      // Detect and migrate
      const version = detectVersion(legacyData);
      expect(needsMigration(version)).toBe(true);

      const migrated = migrateConfigFrom_0_0_0_to_1_0_0(legacyData);

      // Validate
      expect(() => validateMigratedData(migrated, 'config')).not.toThrow();

      // Check migrated data
      expect(migrated.version).toBe('1.0.0');
      expect(migrated.config.sendMode).toBe('translated');
      expect(migrated.config.expandedGroups).toEqual(['g1', 'g2']);
      expect(migrated.config.createdAt).toBeDefined();
    });
  });
});
