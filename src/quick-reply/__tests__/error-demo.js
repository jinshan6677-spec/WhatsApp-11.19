/**
 * Error Handling System Demonstration
 * 
 * This script demonstrates how the error handling system works
 * in the quick-reply feature.
 */

const {
  ValidationError,
  StorageError,
  TranslationError,
  SendError,
  ImportError,
  ErrorHandler
} = require('../errors');

console.log('=== Quick Reply Error Handling System Demo ===\n');

// Create error handler
const errorHandler = new ErrorHandler();

// Mock UI object
const mockUI = {
  showErrorMessage: (msg) => console.log(`  [UI] Error Message: ${msg}`),
  highlightErrorField: (field) => console.log(`  [UI] Highlight Field: ${field}`),
  showRetryButton: () => console.log(`  [UI] Show Retry Button`),
  showAlternativeOptions: (options) => console.log(`  [UI] Alternative Options: ${options.join(', ')}`),
  preserveMessageContent: () => console.log(`  [UI] Preserve Message Content`),
  showFormatHint: () => console.log(`  [UI] Show Format Hint`)
};

// Demo 1: ValidationError
console.log('1. ValidationError Demo:');
console.log('   Scenario: User enters a template label that is too long');
try {
  const label = 'A'.repeat(51);
  if (label.length > 50) {
    throw new ValidationError('模板标签不能超过50个字符', 'templateLabel');
  }
} catch (error) {
  console.log(`   Error caught: ${error.name} - ${error.message}`);
  errorHandler.handleValidationError(error, mockUI);
}
console.log();

// Demo 2: StorageError
console.log('2. StorageError Demo:');
console.log('   Scenario: Disk is full when saving template');
try {
  const diskError = new Error('ENOSPC: no space left on device');
  throw new StorageError('保存模板失败', diskError);
} catch (error) {
  console.log(`   Error caught: ${error.name} - ${error.message}`);
  console.log(`   Caused by: ${error.cause.message}`);
  errorHandler.handleStorageError(error, mockUI);
}
console.log();

// Demo 3: TranslationError
console.log('3. TranslationError Demo:');
console.log('   Scenario: Translation service is unavailable');
try {
  const apiError = new Error('Service Unavailable');
  throw new TranslationError('翻译服务不可用', apiError);
} catch (error) {
  console.log(`   Error caught: ${error.name} - ${error.message}`);
  errorHandler.handleTranslationError(error, mockUI);
}
console.log();

// Demo 4: SendError
console.log('4. SendError Demo:');
console.log('   Scenario: Network error when sending message');
try {
  const networkError = new Error('Network timeout');
  throw new SendError('发送消息失败', networkError);
} catch (error) {
  console.log(`   Error caught: ${error.name} - ${error.message}`);
  errorHandler.handleSendError(error, mockUI);
}
console.log();

// Demo 5: ImportError
console.log('5. ImportError Demo:');
console.log('   Scenario: Invalid JSON format in import file');
try {
  const parseError = new Error('Unexpected token in JSON');
  throw new ImportError('导入文件格式无效', parseError);
} catch (error) {
  console.log(`   Error caught: ${error.name} - ${error.message}`);
  errorHandler.handleImportError(error, mockUI);
}
console.log();

console.log('=== Demo Complete ===');
console.log('\nAll error types are working correctly!');
console.log('The error handling system is ready for use in the quick-reply feature.');
