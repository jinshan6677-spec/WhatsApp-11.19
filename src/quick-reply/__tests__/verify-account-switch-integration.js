/**
 * Verification Script for Account Switch Integration
 * 
 * This script verifies that account switching works correctly
 * Requirements: 11.1-11.7
 */

const QuickReplyController = require('../controllers/QuickReplyController');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

async function verifyAccountSwitchIntegration() {
  console.log('=== Account Switch Integration Verification ===\n');

  const testDir = path.join(os.tmpdir(), `quick-reply-verify-${Date.now()}`);
  await fs.mkdir(testDir, { recursive: true });

  try {
    // Mock services
    const mockTranslationService = {
      translate: async (text) => `translated: ${text}`
    };

    const mockWhatsAppWebInterface = {
      sendMessage: async (text) => console.log(`[Mock] Sending message: ${text}`),
      insertText: async (text) => console.log(`[Mock] Inserting text: ${text}`),
      focusInput: async () => console.log(`[Mock] Focusing input`)
    };

    // Test 1: Create controllers for two accounts
    console.log('Test 1: Creating controllers for two accounts...');
    const controller1 = new QuickReplyController(
      'account-1',
      mockTranslationService,
      mockWhatsAppWebInterface,
      testDir
    );

    const controller2 = new QuickReplyController(
      'account-2',
      mockTranslationService,
      mockWhatsAppWebInterface,
      testDir
    );

    await controller1.initialize();
    await controller2.initialize();
    console.log('✓ Controllers created and initialized\n');

    // Test 2: Create data for account 1
    console.log('Test 2: Creating data for account 1...');
    const group1 = await controller1.groupManager.createGroup('Account 1 Group');
    const template1 = await controller1.templateManager.createTemplate(
      group1.id,
      'text',
      'Account 1 Template',
      { text: 'Hello from account 1' }
    );
    console.log(`✓ Created group: ${group1.name}`);
    console.log(`✓ Created template: ${template1.label}\n`);

    // Test 3: Create data for account 2
    console.log('Test 3: Creating data for account 2...');
    const group2 = await controller2.groupManager.createGroup('Account 2 Group');
    const template2 = await controller2.templateManager.createTemplate(
      group2.id,
      'text',
      'Account 2 Template',
      { text: 'Hello from account 2' }
    );
    console.log(`✓ Created group: ${group2.name}`);
    console.log(`✓ Created template: ${template2.label}\n`);

    // Test 4: Verify data isolation
    console.log('Test 4: Verifying data isolation...');
    const account1Groups = await controller1.groupManager.getAllGroups();
    const account1Templates = await controller1.templateManager.storage.getAll();
    const account2Groups = await controller2.groupManager.getAllGroups();
    const account2Templates = await controller2.templateManager.storage.getAll();

    console.log(`Account 1: ${account1Groups.length} groups, ${account1Templates.length} templates`);
    console.log(`Account 2: ${account2Groups.length} groups, ${account2Templates.length} templates`);

    if (account1Groups.length === 1 && account1Templates.length === 1 &&
        account2Groups.length === 1 && account2Templates.length === 1) {
      console.log('✓ Data isolation verified\n');
    } else {
      throw new Error('Data isolation failed');
    }

    // Test 5: Test account switch handler
    console.log('Test 5: Testing account switch handler...');
    const handler = controller1.accountSwitchHandler;

    // Track events
    const events = [];
    handler.on('switching', (data) => {
      console.log(`  Event: switching from ${data.oldAccountId} to ${data.newAccountId}`);
      events.push('switching');
    });
    handler.on('state:saved', (data) => {
      console.log(`  Event: state saved for ${data.accountId}`);
      events.push('state:saved');
    });
    handler.on('data:unloaded', (data) => {
      console.log(`  Event: data unloaded for ${data.accountId}`);
      events.push('data:unloaded');
    });
    handler.on('data:loaded', (data) => {
      console.log(`  Event: data loaded for ${data.accountId}`);
      events.push('data:loaded');
    });
    handler.on('switched', (data) => {
      console.log(`  Event: switched from ${data.oldAccountId} to ${data.newAccountId}`);
      events.push('switched');
    });

    // Perform account switch
    await handler.handleAccountSwitch('account-2');

    if (events.includes('switching') && events.includes('state:saved') &&
        events.includes('data:unloaded') && events.includes('data:loaded') &&
        events.includes('switched')) {
      console.log('✓ All account switch events emitted\n');
    } else {
      throw new Error('Missing account switch events');
    }

    // Test 6: Verify account ID was updated
    console.log('Test 6: Verifying account ID update...');
    if (controller1.accountId === 'account-2') {
      console.log(`✓ Account ID updated to: ${controller1.accountId}\n`);
    } else {
      throw new Error(`Account ID not updated: ${controller1.accountId}`);
    }

    // Test 7: Verify data after switch
    console.log('Test 7: Verifying data after switch...');
    const newGroups = await controller1.groupManager.getAllGroups();
    const newTemplates = await controller1.templateManager.storage.getAll();

    console.log(`After switch: ${newGroups.length} groups, ${newTemplates.length} templates`);
    if (newGroups.length === 1 && newGroups[0].name === 'Account 2 Group' &&
        newTemplates.length === 1 && newTemplates[0].label === 'Account 2 Template') {
      console.log('✓ Data correctly loaded for new account\n');
    } else {
      throw new Error('Data not correctly loaded after switch');
    }

    // Test 8: Test state persistence
    console.log('Test 8: Testing state persistence...');
    
    // Mock operation panel state
    controller1.operationPanel = {
      sendMode: 'translated',
      searchKeyword: 'test search',
      expandedGroups: new Set(['group-1'])
    };
    controller1.openOperationPanel();

    // Save state
    await handler.saveCurrentState();

    // Get saved state
    const savedState = handler.getSavedState('account-2');
    if (savedState && savedState.ui && savedState.ui.operationPanel) {
      console.log(`✓ State saved: sendMode=${savedState.ui.operationPanel.sendMode}`);
      console.log(`✓ State saved: searchKeyword="${savedState.ui.operationPanel.searchKeyword}"`);
      console.log(`✓ State saved: expandedGroups=${JSON.stringify(savedState.ui.operationPanel.expandedGroups)}\n`);
    } else {
      throw new Error('State not saved correctly');
    }

    // Test 9: Test controller switchAccount method
    console.log('Test 9: Testing controller switchAccount method...');
    
    // Track events
    const controllerEvents = [];
    controller1.on('account:switching', (data) => {
      console.log(`  Controller event: switching from ${data.oldAccountId} to ${data.newAccountId}`);
      controllerEvents.push('switching');
    });
    controller1.on('account:switched', (data) => {
      console.log(`  Controller event: switched from ${data.oldAccountId} to ${data.newAccountId}`);
      controllerEvents.push('switched');
    });

    // Switch back to account 1
    await controller1.switchAccount('account-1');

    if (controllerEvents.includes('switching') && controllerEvents.includes('switched')) {
      console.log('✓ Controller switch events emitted\n');
    } else {
      throw new Error('Missing controller switch events');
    }

    // Verify data after switch back
    const finalGroups = await controller1.groupManager.getAllGroups();
    const finalTemplates = await controller1.templateManager.storage.getAll();

    console.log(`After switch back: ${finalGroups.length} groups, ${finalTemplates.length} templates`);
    if (finalGroups.length === 1 && finalGroups[0].name === 'Account 1 Group' &&
        finalTemplates.length === 1 && finalTemplates[0].label === 'Account 1 Template') {
      console.log('✓ Data correctly restored for original account\n');
    } else {
      throw new Error('Data not correctly restored after switch back');
    }

    // Clean up
    controller1.destroy();
    controller2.destroy();

    console.log('=== All Tests Passed ===\n');
    return true;
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Run verification if executed directly
if (require.main === module) {
  verifyAccountSwitchIntegration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = verifyAccountSwitchIntegration;
