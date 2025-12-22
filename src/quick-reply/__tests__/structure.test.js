/**
 * Structure Test
 * 
 * Verifies that the basic project structure is set up correctly.
 */

const { QuickReplyController } = require('../index');
const { TemplateManager, GroupManager, SendManager } = require('../managers');
const { TemplateStorage, GroupStorage, ConfigStorage } = require('../storage');
const { Template, Group, Config } = require('../models');
const { TEMPLATE_TYPES, SEND_MODES, LIMITS } = require('../constants');
const { ValidationError, StorageError, ErrorHandler } = require('../errors');

describe('Quick Reply Structure', () => {
  describe('Module Exports', () => {
    test('should export QuickReplyController', () => {
      expect(QuickReplyController).toBeDefined();
      expect(typeof QuickReplyController).toBe('function');
    });

    test('should export managers', () => {
      expect(TemplateManager).toBeDefined();
      expect(GroupManager).toBeDefined();
      expect(SendManager).toBeDefined();
    });

    test('should export storage classes', () => {
      expect(TemplateStorage).toBeDefined();
      expect(GroupStorage).toBeDefined();
      expect(ConfigStorage).toBeDefined();
    });

    test('should export models', () => {
      expect(Template).toBeDefined();
      expect(Group).toBeDefined();
      expect(Config).toBeDefined();
    });

    test('should export constants', () => {
      expect(TEMPLATE_TYPES).toBeDefined();
      expect(SEND_MODES).toBeDefined();
      expect(LIMITS).toBeDefined();
    });

    test('should export error classes', () => {
      expect(ValidationError).toBeDefined();
      expect(StorageError).toBeDefined();
      expect(ErrorHandler).toBeDefined();
    });
  });

  describe('QuickReplyController', () => {
    test('should create instance with required parameters', () => {
      const controller = new QuickReplyController('account-1', {}, {});
      expect(controller).toBeInstanceOf(QuickReplyController);
      expect(controller.accountId).toBe('account-1');
    });

    test('should throw error without accountId', () => {
      expect(() => new QuickReplyController()).toThrow('accountId is required');
    });

    test('should have required methods', () => {
      const controller = new QuickReplyController('account-1', {}, {});
      expect(typeof controller.openOperationPanel).toBe('function');
      expect(typeof controller.closeOperationPanel).toBe('function');
      expect(typeof controller.openManagementInterface).toBe('function');
      expect(typeof controller.closeManagementInterface).toBe('function');
      expect(typeof controller.sendTemplate).toBe('function');
      expect(typeof controller.insertTemplate).toBe('function');
      expect(typeof controller.searchTemplates).toBe('function');
    });
  });

  describe('Models', () => {
    test('Template should create instance', () => {
      const template = new Template({
        groupId: 'group-1',
        type: 'text',
        label: 'Test',
        content: { text: 'Hello' }
      });
      expect(template).toBeInstanceOf(Template);
      expect(template.groupId).toBe('group-1');
      expect(template.type).toBe('text');
    });

    test('Group should create instance', () => {
      const group = new Group({
        name: 'Test Group'
      });
      expect(group).toBeInstanceOf(Group);
      expect(group.name).toBe('Test Group');
    });

    test('Config should create instance', () => {
      const config = new Config({
        accountId: 'account-1'
      });
      expect(config).toBeInstanceOf(Config);
      expect(config.accountId).toBe('account-1');
    });
  });

  describe('Constants', () => {
    test('TEMPLATE_TYPES should have correct values', () => {
      expect(TEMPLATE_TYPES.TEXT).toBe('text');
      expect(TEMPLATE_TYPES.IMAGE).toBe('image');
      expect(TEMPLATE_TYPES.AUDIO).toBe('audio');
      expect(TEMPLATE_TYPES.VIDEO).toBe('video');
      expect(TEMPLATE_TYPES.MIXED).toBe('mixed');
      expect(TEMPLATE_TYPES.CONTACT).toBe('contact');
    });

    test('SEND_MODES should have correct values', () => {
      expect(SEND_MODES.ORIGINAL).toBe('original');
      expect(SEND_MODES.TRANSLATED).toBe('translated');
    });

    test('LIMITS should have correct values', () => {
      expect(LIMITS.LABEL_MAX_LENGTH).toBe(50);
      // Requirements 6.1, 6.2, 6.3: Image 5MB, Audio 16MB, Video 64MB
      expect(LIMITS.IMAGE_MAX_SIZE).toBe(5 * 1024 * 1024);
      expect(LIMITS.AUDIO_MAX_SIZE).toBe(16 * 1024 * 1024);
      expect(LIMITS.VIDEO_MAX_SIZE).toBe(64 * 1024 * 1024);
      expect(LIMITS.MAX_GROUP_DEPTH).toBe(3);
    });
  });

  describe('Error Classes', () => {
    test('ValidationError should work correctly', () => {
      const error = new ValidationError('Invalid input', 'label');
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid input');
      expect(error.field).toBe('label');
      expect(error.name).toBe('ValidationError');
    });

    test('StorageError should work correctly', () => {
      const cause = new Error('File not found');
      const error = new StorageError('Storage failed', cause);
      expect(error).toBeInstanceOf(StorageError);
      expect(error.message).toBe('Storage failed');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('StorageError');
    });
  });
});
