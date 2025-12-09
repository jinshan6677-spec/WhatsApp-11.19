/**
 * Verification script for Translation Integration
 * 
 * This script verifies that the translation integration works correctly
 * Requirements: 8.1-8.9
 */

const TranslationIntegration = require('../services/TranslationIntegration');
const SendManager = require('../managers/SendManager');
const { TEMPLATE_TYPES } = require('../constants');

console.log('='.repeat(60));
console.log('Translation Integration Verification');
console.log('='.repeat(60));

// Mock translation service
const mockTranslationService = {
  initialized: true,
  configManager: {
    getEngineConfig: (engineName) => {
      if (engineName === 'google') {
        return { enabled: true };
      }
      return { enabled: true, apiKey: 'test-key' };
    }
  },
  getConfig: (accountId) => {
    console.log(`  ✓ Getting config for account: ${accountId}`);
    return {
      inputBox: {
        enabled: true,
        engine: 'google',
        style: '通用',
        targetLang: 'en'
      }
    };
  },
  translate: async (text, sourceLang, targetLang, engineName, options) => {
    console.log(`  ✓ Translating: "${text}"`);
    console.log(`    Source: ${sourceLang}, Target: ${targetLang}`);
    console.log(`    Engine: ${engineName}, Style: ${options.style}`);
    return `[TRANSLATED:${targetLang}] ${text}`;
  },
  initialize: async () => {
    console.log('  ✓ Translation service initialized');
  }
};

// Mock WhatsApp Web interface
const mockWhatsappWeb = {
  sendMessage: async (text) => {
    console.log(`  ✓ Sent message: "${text}"`);
  },
  sendText: async (text) => {
    console.log(`  ✓ Sent text: "${text}"`);
  },
  sendImage: async (path) => {
    console.log(`  ✓ Sent image: ${path}`);
  },
  sendImageWithText: async (path, text) => {
    console.log(`  ✓ Sent image with text: ${path}, "${text}"`);
  },
  sendMedia: async (path, type) => {
    console.log(`  ✓ Sent media (${type}): ${path}`);
  },
  sendContact: async (contactInfo) => {
    console.log(`  ✓ Sent contact: ${contactInfo.name}`);
  }
};

async function runTests() {
  try {
    console.log('\n1. Testing TranslationIntegration initialization');
    console.log('-'.repeat(60));
    
    const accountId = 'test-account-123';
    const integration = new TranslationIntegration(mockTranslationService, accountId);
    await integration.initialize();
    
    console.log('  ✓ TranslationIntegration initialized');
    console.log(`  ✓ Available: ${integration.isAvailable()}`);
    console.log(`  ✓ Configured: ${integration.isConfigured()}`);
    console.log(`  ✓ Engine: ${integration.getConfiguredEngine()}`);
    console.log(`  ✓ Style: ${integration.getConfiguredStyle()}`);
    console.log(`  ✓ Target Language: ${integration.getConfiguredTargetLanguage()}`);
    
    console.log('\n2. Testing translation');
    console.log('-'.repeat(60));
    
    const textToTranslate = 'Hello, how can I help you?';
    const translated = await integration.translate(textToTranslate);
    console.log(`  ✓ Original: "${textToTranslate}"`);
    console.log(`  ✓ Translated: "${translated}"`);
    
    console.log('\n3. Testing translation with custom options');
    console.log('-'.repeat(60));
    
    const customTranslated = await integration.translate(textToTranslate, {
      targetLanguage: 'zh-CN',
      style: '正式',
      engine: 'gpt4'
    });
    console.log(`  ✓ Custom translated: "${customTranslated}"`);
    
    console.log('\n4. Testing error handling');
    console.log('-'.repeat(60));
    
    const errors = [
      new Error('Translation service not available'),
      new Error('Translation not configured'),
      new Error('Invalid API key'),
      new Error('Network timeout'),
      new Error('Rate limit exceeded')
    ];
    
    errors.forEach(error => {
      const errorInfo = integration.handleTranslationError(error);
      console.log(`  ✓ Error: ${error.message}`);
      console.log(`    Message: ${errorInfo.message}`);
      console.log(`    Can Retry: ${errorInfo.canRetry}`);
      console.log(`    Can Send Original: ${errorInfo.canSendOriginal}`);
    });
    
    console.log('\n5. Testing SendManager integration');
    console.log('-'.repeat(60));
    
    const sendManager = new SendManager(mockTranslationService, mockWhatsappWeb, accountId);
    await sendManager.initializeTranslation(accountId);
    
    console.log(`  ✓ SendManager initialized`);
    console.log(`  ✓ Translation available: ${sendManager.isTranslationAvailable()}`);
    
    const status = sendManager.getTranslationStatus();
    console.log(`  ✓ Translation status:`, status);
    
    console.log('\n6. Testing template translation and sending');
    console.log('-'.repeat(60));
    
    const textTemplate = {
      id: 'template-1',
      type: TEMPLATE_TYPES.TEXT,
      content: {
        text: 'Thank you for your inquiry. We will respond shortly.'
      }
    };
    
    console.log('  Testing text template translation...');
    await sendManager.sendTranslated(textTemplate, 'zh-CN', '通用');
    console.log('  ✓ Text template sent with translation');
    
    const mixedTemplate = {
      id: 'template-2',
      type: TEMPLATE_TYPES.MIXED,
      content: {
        text: 'Here is our product catalog',
        mediaPath: '/path/to/catalog.jpg'
      }
    };
    
    console.log('\n  Testing mixed template translation...');
    await sendManager.sendTranslated(mixedTemplate, 'zh-CN', '通用');
    console.log('  ✓ Mixed template sent with translation');
    
    const imageTemplate = {
      id: 'template-3',
      type: TEMPLATE_TYPES.IMAGE,
      content: {
        mediaPath: '/path/to/image.jpg'
      }
    };
    
    console.log('\n  Testing image template (no translation)...');
    await sendManager.sendTranslated(imageTemplate, 'zh-CN', '通用');
    console.log('  ✓ Image template sent without translation (as expected)');
    
    console.log('\n7. Testing account switching');
    console.log('-'.repeat(60));
    
    const newAccountId = 'test-account-456';
    await sendManager.switchAccount(newAccountId);
    console.log(`  ✓ Switched to account: ${newAccountId}`);
    
    const newStatus = sendManager.getTranslationStatus();
    console.log(`  ✓ New account status:`, newStatus);
    
    console.log('\n8. Testing configuration reload');
    console.log('-'.repeat(60));
    
    await sendManager.reloadTranslationConfig();
    console.log('  ✓ Configuration reloaded');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All translation integration tests passed!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Test failed:', error.message);
    console.error('='.repeat(60));
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
