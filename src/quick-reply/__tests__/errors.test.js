/**
 * Unit tests for error classes
 */

const {
  ValidationError,
  StorageError,
  TranslationError,
  SendError,
  ImportError,
  ErrorHandler
} = require('../errors');

describe('Error Classes', () => {
  describe('ValidationError', () => {
    test('should create ValidationError with message and field', () => {
      const error = new ValidationError('Invalid input', 'templateLabel');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
      expect(error.field).toBe('templateLabel');
      expect(error.stack).toBeDefined();
    });

    test('should create ValidationError without field', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.field).toBeNull();
    });
  });

  describe('StorageError', () => {
    test('should create StorageError with message and cause', () => {
      const cause = new Error('Disk full');
      const error = new StorageError('Failed to save data', cause);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StorageError);
      expect(error.name).toBe('StorageError');
      expect(error.message).toBe('Failed to save data');
      expect(error.cause).toBe(cause);
      expect(error.stack).toBeDefined();
    });

    test('should create StorageError without cause', () => {
      const error = new StorageError('Failed to save data');
      
      expect(error.cause).toBeNull();
    });
  });

  describe('TranslationError', () => {
    test('should create TranslationError with message and cause', () => {
      const cause = new Error('API key invalid');
      const error = new TranslationError('Translation failed', cause);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TranslationError);
      expect(error.name).toBe('TranslationError');
      expect(error.message).toBe('Translation failed');
      expect(error.cause).toBe(cause);
      expect(error.stack).toBeDefined();
    });

    test('should create TranslationError without cause', () => {
      const error = new TranslationError('Translation failed');
      
      expect(error.cause).toBeNull();
    });
  });

  describe('SendError', () => {
    test('should create SendError with message and cause', () => {
      const cause = new Error('Network error');
      const error = new SendError('Failed to send message', cause);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SendError);
      expect(error.name).toBe('SendError');
      expect(error.message).toBe('Failed to send message');
      expect(error.cause).toBe(cause);
      expect(error.stack).toBeDefined();
    });

    test('should create SendError without cause', () => {
      const error = new SendError('Failed to send message');
      
      expect(error.cause).toBeNull();
    });
  });

  describe('ImportError', () => {
    test('should create ImportError with message and cause', () => {
      const cause = new Error('Invalid JSON');
      const error = new ImportError('Failed to import templates', cause);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImportError);
      expect(error.name).toBe('ImportError');
      expect(error.message).toBe('Failed to import templates');
      expect(error.cause).toBe(cause);
      expect(error.stack).toBeDefined();
    });

    test('should create ImportError without cause', () => {
      const error = new ImportError('Failed to import templates');
      
      expect(error.cause).toBeNull();
    });
  });

  describe('ErrorHandler', () => {
    let errorHandler;
    let mockUI;
    let consoleErrorSpy;

    beforeEach(() => {
      errorHandler = new ErrorHandler();
      mockUI = {
        showErrorMessage: jest.fn(),
        highlightErrorField: jest.fn(),
        showRetryButton: jest.fn(),
        showAlternativeOptions: jest.fn(),
        preserveMessageContent: jest.fn(),
        showFormatHint: jest.fn()
      };
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    describe('handleValidationError', () => {
      test('should display error message and highlight field', () => {
        const error = new ValidationError('Label too long', 'templateLabel');
        
        errorHandler.handleValidationError(error, mockUI);
        
        expect(mockUI.showErrorMessage).toHaveBeenCalledWith('Label too long');
        expect(mockUI.highlightErrorField).toHaveBeenCalledWith('templateLabel');
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      test('should handle error without field', () => {
        const error = new ValidationError('Invalid input');
        
        errorHandler.handleValidationError(error, mockUI);
        
        expect(mockUI.showErrorMessage).toHaveBeenCalledWith('Invalid input');
        expect(mockUI.highlightErrorField).not.toHaveBeenCalled();
      });
    });

    describe('handleStorageError', () => {
      test('should display error message and retry button', () => {
        const error = new StorageError('Failed to save');
        
        errorHandler.handleStorageError(error, mockUI);
        
        expect(mockUI.showErrorMessage).toHaveBeenCalledWith('数据保存失败，请重试');
        expect(mockUI.showRetryButton).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('handleTranslationError', () => {
      test('should display error message and alternative options', () => {
        const error = new TranslationError('Translation service unavailable');
        
        errorHandler.handleTranslationError(error, mockUI);
        
        expect(mockUI.showErrorMessage).toHaveBeenCalledWith('翻译失败，是否以原文发送？');
        expect(mockUI.showAlternativeOptions).toHaveBeenCalledWith(['以原文发送', '重试翻译']);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('handleSendError', () => {
      test('should display error message, retry button, and preserve content', () => {
        const error = new SendError('Network error');
        
        errorHandler.handleSendError(error, mockUI);
        
        expect(mockUI.showErrorMessage).toHaveBeenCalledWith('消息发送失败');
        expect(mockUI.showRetryButton).toHaveBeenCalled();
        expect(mockUI.preserveMessageContent).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('handleImportError', () => {
      test('should display detailed error message and format hint', () => {
        const error = new ImportError('Invalid file format');
        
        errorHandler.handleImportError(error, mockUI);
        
        expect(mockUI.showErrorMessage).toHaveBeenCalledWith('导入失败：Invalid file format');
        expect(mockUI.showFormatHint).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('logError', () => {
      test('should log error with name, message, and stack', () => {
        const error = new ValidationError('Test error');
        
        errorHandler.logError(error);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[QuickReply Error] ValidationError: Test error')
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('at'));
      });

      test('should log error with cause', () => {
        const cause = new Error('Root cause');
        const error = new StorageError('Storage failed', cause);
        
        errorHandler.logError(error);
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[QuickReply Error] StorageError: Storage failed')
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith('Caused by:', cause);
      });
    });

    describe('error handling without UI', () => {
      test('should not throw when UI methods are not available', () => {
        const error = new ValidationError('Test error');
        
        expect(() => {
          errorHandler.handleValidationError(error, null);
        }).not.toThrow();
        
        expect(() => {
          errorHandler.handleStorageError(error, {});
        }).not.toThrow();
      });
    });
  });
});
