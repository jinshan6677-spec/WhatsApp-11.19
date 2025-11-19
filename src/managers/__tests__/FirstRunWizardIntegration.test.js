/**
 * FirstRunWizardIntegration 测试
 */

const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { autoMigrate, getMigrationStatus } = require('../FirstRunWizardIntegration');

describe('FirstRunWizardIntegration', () => {
  let testUserDataPath;

  beforeEach(async () => {
    // 创建临时测试目录
    testUserDataPath = path.join(os.tmpdir(), `wizard-test-${Date.now()}`);
    await fs.mkdir(testUserDataPath, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testUserDataPath, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test directory:', error);
    }
  });

  describe('autoMigrate', () => {
    it('should throw error when userDataPath is not provided', async () => {
      await expect(autoMigrate({})).rejects.toThrow('userDataPath is required');
    });

    it('should return migrated: false when no migration is needed', async () => {
      const result = await autoMigrate({
        userDataPath: testUserDataPath,
        silent: true
      });

      expect(result.migrated).toBe(false);
    });

    it('should execute migration when old data exists', async () => {
      // 创建旧的 session-data 目录
      const oldSessionPath = path.join(testUserDataPath, 'session-data', 'session');
      await fs.mkdir(oldSessionPath, { recursive: true });
      
      // 创建一些测试文件
      await fs.writeFile(path.join(oldSessionPath, 'test.txt'), 'test data');

      const result = await autoMigrate({
        userDataPath: testUserDataPath,
        silent: true
      });

      expect(result.migrated).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.success).toBe(true);

      // 验证迁移结果
      const newProfilePath = path.join(testUserDataPath, 'profiles', 'default');
      const profileExists = await fs.access(newProfilePath).then(() => true).catch(() => false);
      expect(profileExists).toBe(true);
    });

    it('should handle migration errors gracefully', async () => {
      // 创建一个无效的场景来触发错误
      const invalidPath = '/invalid/path/that/does/not/exist';

      await expect(autoMigrate({
        userDataPath: invalidPath,
        silent: true
      })).rejects.toThrow();
    });
  });

  describe('getMigrationStatus', () => {
    it('should throw error when userDataPath is not provided', async () => {
      await expect(getMigrationStatus()).rejects.toThrow('userDataPath is required');
    });

    it('should return completed: false when migration is not done', async () => {
      const status = await getMigrationStatus(testUserDataPath);

      expect(status.completed).toBe(false);
      expect(status.needsMigration).toBe(false);
    });

    it('should return completed: true after migration', async () => {
      // 创建旧数据并执行迁移
      const oldSessionPath = path.join(testUserDataPath, 'session-data', 'session');
      await fs.mkdir(oldSessionPath, { recursive: true });
      await fs.writeFile(path.join(oldSessionPath, 'test.txt'), 'test data');

      await autoMigrate({
        userDataPath: testUserDataPath,
        silent: true
      });

      const status = await getMigrationStatus(testUserDataPath);

      expect(status.completed).toBe(true);
      expect(status.needsMigration).toBe(false);
      expect(status.migrationDate).toBeDefined();
      expect(status.version).toBeDefined();
    });
  });
});
