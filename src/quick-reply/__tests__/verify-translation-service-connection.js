/**
 * Verification Script: Translation Service Connection
 * 
 * Verifies that the translation service is properly connected to the SendManager
 * and that translation functionality works end-to-end.
 */

const SendManager = require('../managers/SendManager');
const TranslationServiceAdapter = require('../services/TranslationServiceAdapter');
const { TEMPLATE_TYPES } = require('../constants');

console.log('='.repeat(60));
console.log('Translation Service Connection Verification');
console.log('='.repeat(60));

async function runVerification() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Create TranslationServiceAdapter
  console.log('\n1. Creating TranslationServiceAdapter...');
  try {
    const mockTranslationService = {
      initialized: false,
      initialize: async () => {
        mockTranslationService.initialized = true;
        console.log('   ✓ Translation service initialized');
      },
      translate: async (text, sourceLang, targetLang, engine, options) => {
        console.log(`   ✓ Translating: "${text}" (${sourceLang} → ${targetLang}, engine: ${engine})`);
        return `[TRANSLATED] ${text}`;
      },
      getConfig: (accountId) => {
        return {
          inputBox: {
            enabled: true,
            engine: 'google',
            style: '通用',
            targetLang: 'zh-CN'
          }
        };
      },
      configManager: {
        getEngineConfig: (engine) => {
          return {
            enabled: true,
            apiKey: 'test-key'
          };
        }
      }
    };

    const adapter = new TranslationServiceAdapter(mockTranslationService);
    await adapter.initialize();

    if (adapter.isAvailable()) {
      console.log('   ✓ Adapter is available');
      testsPassed++;
    } else {
      console.log('   ✗ Adapter is not available');
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ✗ Failed: ${error.message}`);
    testsFailed++;
  }

  // Test 2: Create SendManager with translation service
  console.log('\n2. Creating SendManager with translation service...');
  try {
    const mockTranslationService = {
      initialized: true,
      translate: async (text, sourceLang, targetLang, engine, options) => {
        return `[TRANSLATED] ${text}`;
      },
      getConfig: (accountId) => {
        return {
          inputBox: {
            enabled: true,
            engine: 'google',
            style: '通用',
            targetLang: 'zh-CN'
          }
        };
      },
      configManager: {
        getEngineConfig: (engine) => {
          return {
            enabled: true,
            apiKey: 'test-key'
          };
        }
      }
    };

    const mockWhatsAppWeb = {
      sendMessage: async (text) => {
        console.log(`   ✓ WhatsApp Web would send: "${text}"`);
      }
    };

    const sendManager = new SendManager(
      mockTranslationService,
      mockWhatsAppWeb,
      'test-account-123'
    );

    console.log('   ✓ SendManager created');
    testsPassed++;
  } catch (error) {
    console.log(`   ✗ Failed: ${error.message}`);
    testsFailed++;
  }

  // Test 3: Initialize translation integration
  console.log('\n3. Initializing translation integration...');
  try {
    const mockTranslationService = {
      initialized: true,
      translate: async (text, sourceLang, targetLang, engine, options) => {
        return `[TRANSLATED] ${text}`;
      },
      getConfig: (accountId) => {
        return {
          inputBox: {
            enabled: true,
            engine: 'google',
            style: '通用',
            targetLang: 'zh-CN'
          }
        };
      },
      configManager: {
        getEngineConfig: (engine) => {
          return {
            enabled: true,
            apiKey: 'test-key'
          };
        }
      }
    };

    const mockWhatsAppWeb = {
      sendMessage: async (text) => {
        console.log(`   ✓ Message sent: "${text}"`);
      }
    };

    const sendManager = new SendManager(
      mockTranslationService,
      mockWhatsAppWeb,
      'test-account-123'
    );

    await sendManager.initializeTranslation('test-account-123');

    if (sendManager.isTranslationAvailable()) {
      console.log('   ✓ Translation integration initialized and available');
      testsPassed++;
    } else {
      console.log('   ✗ Translation integration not available');
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ✗ Failed: ${error.message}`);
    testsFailed++;
  }

  // Test 4: Translate text through SendManager
  console.log('\n4. Translating text through SendManager...');
  try {
    const mockTranslationService = {
      initialized: true,
      translate: async (text, sourceLang, targetLang, engine, options) => {
        console.log(`   ✓ Translation called: "${text}" → "${targetLang}"`);
        return `你好世界`; // Translated "Hello World"
      },
      getConfig: (accountId) => {
        return {
          inputBox: {
            enabled: true,
            engine: 'google',
            style: '通用',
            targetLang: 'zh-CN'
          }
        };
      },
      configManager: {
        getEngineConfig: (engine) => {
          return {
            enabled: true,
            apiKey: 'test-key'
          };
        }
      }
    };

    const mockWhatsAppWeb = {
      sendMessage: async (text) => {
        console.log(`   ✓ Message sent: "${text}"`);
      }
    };

    const sendManager = new SendManager(
      mockTranslationService,
      mockWhatsAppWeb,
      'test-account-123'
    );

    await sendManager.initializeTranslation('test-account-123');

    const translatedText = await sendManager.translateText('Hello World', 'zh-CN', '通用');

    if (translatedText === '你好世界') {
      console.log(`   ✓ Translation successful: "${translatedText}"`);
      testsPassed++;
    } else {
      console.log(`   ✗ Translation result unexpected: "${translatedText}"`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ✗ Failed: ${error.message}`);
    testsFailed++;
  }

  // Test 5: Send translated template
  console.log('\n5. Sending translated template...');
  try {
    const mockTranslationService = {
      initialized: true,
      translate: async (text, sourceLang, targetLang, engine, options) => {
        return `[TRANSLATED] ${text}`;
      },
      getConfig: (accountId) => {
        return {
          inputBox: {
            enabled: true,
            engine: 'google',
            style: '通用',
            targetLang: 'zh-CN'
          }
        };
      },
      configManager: {
        getEngineConfig: (engine) => {
          return {
            enabled: true,
            apiKey: 'test-key'
          };
        }
      }
    };

    let sentMessage = null;
    const mockWhatsAppWeb = {
      sendMessage: async (text) => {
        sentMessage = text;
        console.log(`   ✓ Message sent: "${text}"`);
      }
    };

    const sendManager = new SendManager(
      mockTranslationService,
      mockWhatsAppWeb,
      'test-account-123'
    );

    await sendManager.initializeTranslation('test-account-123');

    const template = {
      id: 'template-1',
      type: TEMPLATE_TYPES.TEXT,
      content: {
        text: 'Hello, how can I help you?'
      }
    };

    await sendManager.sendTranslated(template, 'zh-CN', '通用');

    if (sentMessage && sentMessage.includes('[TRANSLATED]')) {
      console.log('   ✓ Translated template sent successfully');
      testsPassed++;
    } else {
      console.log('   ✗ Template was not translated');
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ✗ Failed: ${error.message}`);
    testsFailed++;
  }

  // Test 6: Get translation status
  console.log('\n6. Getting translation status...');
  try {
    const mockTranslationService = {
      initialized: true,
      translate: async (text, sourceLang, targetLang, engine, options) => {
        return `[TRANSLATED] ${text}`;
      },
      getConfig: (accountId) => {
        return {
          inputBox: {
            enabled: true,
            engine: 'google',
            style: '通用',
            targetLang: 'zh-CN'
          }
        };
      },
      configManager: {
        getEngineConfig: (engine) => {
          return {
            enabled: true,
            apiKey: 'test-key'
          };
        }
      }
    };

    const mockWhatsAppWeb = {
      sendMessage: async (text) => {}
    };

    const sendManager = new SendManager(
      mockTranslationService,
      mockWhatsAppWeb,
      'test-account-123'
    );

    await sendManager.initializeTranslation('test-account-123');

    const status = sendManager.getTranslationStatus();

    if (status.available && status.configured) {
      console.log('   ✓ Translation status retrieved successfully');
      console.log(`      - Available: ${status.available}`);
      console.log(`      - Configured: ${status.configured}`);
      console.log(`      - Engine: ${status.engine}`);
      console.log(`      - Target Language: ${status.targetLanguage}`);
      testsPassed++;
    } else {
      console.log('   ✗ Translation status indicates not available or configured');
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ✗ Failed: ${error.message}`);
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Verification Summary');
  console.log('='.repeat(60));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  console.log('='.repeat(60));

  if (testsFailed === 0) {
    console.log('\n✓ All verification tests passed!');
    console.log('Translation service is properly connected to SendManager.');
    return 0;
  } else {
    console.log('\n✗ Some verification tests failed.');
    console.log('Please review the errors above.');
    return 1;
  }
}

// Run verification
runVerification()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('\n✗ Verification script failed:', error);
    process.exit(1);
  });
