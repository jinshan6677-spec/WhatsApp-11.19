
const assert = require('assert');
const SendManager = require('./src/quick-reply/managers/SendManager');

// Mock dependencies
const mockTranslationService = {
    translate: async () => 'I&#39;ll go &amp; eat' // Returns encoded text
};

const mockWhatsappWebInterface = {
    insertText: async (text) => {
        console.log('Inserted text:', text);
        if (text.includes('&amp;') || text.includes('&#39;')) {
            throw new Error('Text still contains HTML entities: ' + text);
        }
        return true;
    },
    sendMessage: async (text) => {
        console.log('Sent message:', text);
        if (text.includes('&amp;') || text.includes('&#39;')) {
            throw new Error('Message still contains HTML entities: ' + text);
        }
        return true;
    },
    sendImage: async () => true,
    attachMedia: async () => true,
    focusInput: async () => true
};


const fs = require('fs');
const logFile = './verify_output.txt';

function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

async function runTest() {
    fs.writeFileSync(logFile, ''); // Clear file
    log('Starting verification test...');

    const sendManager = new SendManager(mockTranslationService, mockWhatsappWebInterface, 'account-1');

    // Test Case 1: insertTranslated (TEXT)
    log('\nTesting insertTranslated (TEXT)...');
    const textTemplate = {
        id: 't1',
        type: 'text',
        content: { text: "I'll go & eat" }
    };

    // Mock TranslationIntegration
    sendManager.translationIntegration = {
        isAvailable: () => true,
        isConfigured: () => true,
        translate: async () => 'I&#39;ll go &amp; eat'
    };

    try {
        await sendManager.insertTranslated(textTemplate, 'zh-CN', 'general');
        log('PASSED: insertTranslated (TEXT)');
    } catch (error) {
        log('FAILED: insertTranslated (TEXT): ' + error.message);
        process.exit(1);
    }

    // Test Case 2: sendTranslated (MIXED) -> sendImageWithText
    log('\nTesting sendTranslated (MIXED)...');
    const mixedTemplate = {
        id: 't2',
        type: 'mixed',
        content: {
            text: "I'll go & eat",
            mediaPath: 'image.png'
        }
    };

    try {
        await sendManager.sendTranslated(mixedTemplate, 'zh-CN', 'general');
        log('PASSED: sendTranslated (MIXED)');
    } catch (error) {
        log('FAILED: sendTranslated (MIXED): ' + error.message);
        process.exit(1);
    }

    // Test Case 3: insertTranslated (MIXED)
    log('\nTesting insertTranslated (MIXED)...');

    try {
        await sendManager.insertTranslated(mixedTemplate, 'zh-CN', 'general');
        log('PASSED: insertTranslated (MIXED)');
    } catch (error) {
        log('FAILED: insertTranslated (MIXED): ' + error.message);
        process.exit(1);
    }

    log('\nAll verification tests passed!');
}


runTest();
