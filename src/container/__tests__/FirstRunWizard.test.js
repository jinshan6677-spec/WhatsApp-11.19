/**
 * FirstRunWizard 测试
 */

const FirstRunWizard = require('../FirstRunWizard');

describe('FirstRunWizard', () => {
  let wizard;
  let mockMigrationManager;

  beforeEach(() => {
    // 创建模拟的迁移管理器
    mockMigrationManager = {
      needsMigration: jest.fn(),
      migrate: jest.fn(),
      getMigrationStatus: jest.fn()
    };

    wizard = new FirstRunWizard({
      migrationManager: mockMigrationManager,
      onComplete: jest.fn(),
      onSkip: jest.fn()
    });
  });

  afterEach(() => {
    if (wizard) {
      wizard.cleanup();
    }
  });

  describe('shouldShow', () => {
    it('should return true when migration is needed', async () => {
      mockMigrationManager.needsMigration.mockResolvedValue(true);

      const result = await wizard.shouldShow();

      expect(result).toBe(true);
      expect(mockMigrationManager.needsMigration).toHaveBeenCalled();
    });

    it('should return false when migration is not needed', async () => {
      mockMigrationManager.needsMigration.mockResolvedValue(false);

      const result = await wizard.shouldShow();

      expect(result).toBe(false);
      expect(mockMigrationManager.needsMigration).toHaveBeenCalled();
    });

    it('should return false when migration manager is not available', async () => {
      wizard = new FirstRunWizard({});

      const result = await wizard.shouldShow();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockMigrationManager.needsMigration.mockRejectedValue(new Error('Test error'));

      const result = await wizard.shouldShow();

      expect(result).toBe(false);
    });
  });

  describe('executeMigration', () => {
    it('should execute migration successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Migration completed',
        details: { steps: ['step1', 'step2'] }
      };
      mockMigrationManager.migrate.mockResolvedValue(mockResult);

      const result = await wizard.executeMigration();

      expect(result).toEqual(mockResult);
      expect(mockMigrationManager.migrate).toHaveBeenCalled();
    });

    it('should handle migration failure', async () => {
      const mockResult = {
        success: false,
        message: 'Migration failed',
        details: { error: 'Test error' }
      };
      mockMigrationManager.migrate.mockResolvedValue(mockResult);

      const result = await wizard.executeMigration();

      expect(result).toEqual(mockResult);
      expect(result.success).toBe(false);
    });

    it('should handle migration errors', async () => {
      mockMigrationManager.migrate.mockRejectedValue(new Error('Test error'));

      const result = await wizard.executeMigration();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Migration failed');
    });

    it('should return error when migration manager is not available', async () => {
      wizard = new FirstRunWizard({});

      const result = await wizard.executeMigration();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Migration manager not available');
    });
  });

  describe('sendToWindow', () => {
    it('should not throw when window is not available', () => {
      expect(() => {
        wizard.sendToWindow('test:channel', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('close', () => {
    it('should not throw when window is not available', () => {
      expect(() => {
        wizard.close();
      }).not.toThrow();
    });
  });

  describe('registerHandlers', () => {
    it('should register IPC handlers without errors', () => {
      expect(() => {
        wizard.registerHandlers();
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup IPC handlers without errors', () => {
      wizard.registerHandlers();
      
      expect(() => {
        wizard.cleanup();
      }).not.toThrow();
    });
  });
});
