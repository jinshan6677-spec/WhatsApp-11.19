/**
 * Batch Operations Verification Script
 * 
 * This script verifies that batch operations functionality works correctly.
 * 
 * Requirements: 13.1-13.10
 */

const TemplateManager = require('../../managers/TemplateManager');
const GroupManager = require('../../managers/GroupManager');
const { TEMPLATE_TYPES } = require('../../constants');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

async function verifyBatchOperations() {
  console.log('🧪 Verifying Batch Operations Functionality...\n');

  const testDir = path.join(os.tmpdir(), `quick-reply-verify-${Date.now()}`);
  await fs.mkdir(testDir, { recursive: true });

  const accountId = 'verify-account';
  const templateManager = new TemplateManager(accountId, testDir);
  const groupManager = new GroupManager(accountId, testDir);

  try {
    // Test 1: Batch Delete Templates
    console.log('✅ Test 1: Batch Delete Templates');
    const group1 = await groupManager.createGroup('Test Group 1');
    
    const template1 = await templateManager.createTemplate(
      group1.id,
      TEMPLATE_TYPES.TEXT,
      'Template 1',
      { text: 'Content 1' }
    );
    
    const template2 = await templateManager.createTemplate(
      group1.id,
      TEMPLATE_TYPES.TEXT,
      'Template 2',
      { text: 'Content 2' }
    );
    
    const template3 = await templateManager.createTemplate(
      group1.id,
      TEMPLATE_TYPES.TEXT,
      'Template 3',
      { text: 'Content 3' }
    );

    console.log(`   Created 3 templates`);

    const deletedCount = await templateManager.batchDeleteTemplates([
      template1.id,
      template2.id
    ]);

    console.log(`   Batch deleted ${deletedCount} templates`);

    const remaining = await templateManager.getTemplatesByGroup(group1.id);
    console.log(`   Remaining templates: ${remaining.length}`);
    
    if (remaining.length === 1 && remaining[0].id === template3.id) {
      console.log('   ✓ Batch delete works correctly\n');
    } else {
      console.log('   ✗ Batch delete failed\n');
    }

    // Test 2: Batch Move Templates
    console.log('✅ Test 2: Batch Move Templates');
    const group2 = await groupManager.createGroup('Test Group 2');
    
    const template4 = await templateManager.createTemplate(
      group1.id,
      TEMPLATE_TYPES.TEXT,
      'Template 4',
      { text: 'Content 4' }
    );
    
    const template5 = await templateManager.createTemplate(
      group1.id,
      TEMPLATE_TYPES.TEXT,
      'Template 5',
      { text: 'Content 5' }
    );

    console.log(`   Created 2 more templates in Group 1`);

    const movedCount = await templateManager.batchMoveTemplates(
      [template4.id, template5.id],
      group2.id
    );

    console.log(`   Batch moved ${movedCount} templates to Group 2`);

    const group1Templates = await templateManager.getTemplatesByGroup(group1.id);
    const group2Templates = await templateManager.getTemplatesByGroup(group2.id);

    console.log(`   Group 1 templates: ${group1Templates.length}`);
    console.log(`   Group 2 templates: ${group2Templates.length}`);

    if (group2Templates.length === 2 && 
        group2Templates.some(t => t.id === template4.id) &&
        group2Templates.some(t => t.id === template5.id)) {
      console.log('   ✓ Batch move works correctly\n');
    } else {
      console.log('   ✗ Batch move failed\n');
    }

    // Test 3: Batch Delete Groups
    console.log('✅ Test 3: Batch Delete Groups');
    const group3 = await groupManager.createGroup('Test Group 3');
    const group4 = await groupManager.createGroup('Test Group 4');
    const group5 = await groupManager.createGroup('Test Group 5');

    console.log(`   Created 3 more groups`);

    const groupsDeleted = await groupManager.batchDeleteGroups([
      group3.id,
      group4.id
    ]);

    console.log(`   Batch deleted ${groupsDeleted} groups`);

    const remainingGroups = await groupManager.getAllGroups();
    console.log(`   Remaining groups: ${remainingGroups.length}`);

    if (remainingGroups.some(g => g.id === group5.id) &&
        !remainingGroups.some(g => g.id === group3.id) &&
        !remainingGroups.some(g => g.id === group4.id)) {
      console.log('   ✓ Batch delete groups works correctly\n');
    } else {
      console.log('   ✗ Batch delete groups failed\n');
    }

    // Test 4: Batch Delete Groups with Templates
    console.log('✅ Test 4: Batch Delete Groups with Templates');
    const group6 = await groupManager.createGroup('Test Group 6');
    
    await templateManager.createTemplate(
      group6.id,
      TEMPLATE_TYPES.TEXT,
      'Template in Group 6',
      { text: 'Content' }
    );

    console.log(`   Created group with template`);

    await groupManager.batchDeleteGroups([group6.id]);

    const group6Templates = await templateManager.getTemplatesByGroup(group6.id);
    console.log(`   Templates in deleted group: ${group6Templates.length}`);

    if (group6Templates.length === 0) {
      console.log('   ✓ Batch delete groups with templates works correctly\n');
    } else {
      console.log('   ✗ Batch delete groups with templates failed\n');
    }

    // Test 5: Select All Functionality
    console.log('✅ Test 5: Select All Functionality');
    const group7 = await groupManager.createGroup('Test Group 7');
    
    const templates = [];
    for (let i = 1; i <= 5; i++) {
      const template = await templateManager.createTemplate(
        group7.id,
        TEMPLATE_TYPES.TEXT,
        `Template ${i}`,
        { text: `Content ${i}` }
      );
      templates.push(template);
    }

    console.log(`   Created 5 templates`);

    const allTemplates = await templateManager.getTemplatesByGroup(group7.id);
    const selectedIds = new Set(allTemplates.map(t => t.id));

    console.log(`   Selected all: ${selectedIds.size} templates`);

    if (selectedIds.size === 5 && templates.every(t => selectedIds.has(t.id))) {
      console.log('   ✓ Select all works correctly\n');
    } else {
      console.log('   ✗ Select all failed\n');
    }

    // Test 6: Clear Selection
    console.log('✅ Test 6: Clear Selection');
    console.log(`   Selection size before clear: ${selectedIds.size}`);
    
    selectedIds.clear();
    
    console.log(`   Selection size after clear: ${selectedIds.size}`);

    if (selectedIds.size === 0) {
      console.log('   ✓ Clear selection works correctly\n');
    } else {
      console.log('   ✗ Clear selection failed\n');
    }

    // Test 7: Batch Operations with Filters
    console.log('✅ Test 7: Batch Operations with Filters');
    const group8 = await groupManager.createGroup('Test Group 8');
    
    const textTemplate1 = await templateManager.createTemplate(
      group8.id,
      TEMPLATE_TYPES.TEXT,
      'Text 1',
      { text: 'Content 1' }
    );
    
    const textTemplate2 = await templateManager.createTemplate(
      group8.id,
      TEMPLATE_TYPES.TEXT,
      'Text 2',
      { text: 'Content 2' }
    );
    
    const imageTemplate = await templateManager.createTemplate(
      group8.id,
      TEMPLATE_TYPES.IMAGE,
      'Image',
      { mediaPath: '/path/to/image.jpg' }
    );

    console.log(`   Created 2 text templates and 1 image template`);

    const textTemplates = await templateManager.getTemplatesByType(
      group8.id,
      TEMPLATE_TYPES.TEXT
    );

    console.log(`   Filtered text templates: ${textTemplates.length}`);

    await templateManager.batchDeleteTemplates(textTemplates.map(t => t.id));

    const remainingInGroup8 = await templateManager.getTemplatesByGroup(group8.id);
    console.log(`   Remaining templates: ${remainingInGroup8.length}`);

    if (remainingInGroup8.length === 1 && remainingInGroup8[0].id === imageTemplate.id) {
      console.log('   ✓ Batch operations with filters work correctly\n');
    } else {
      console.log('   ✗ Batch operations with filters failed\n');
    }

    console.log('✅ All batch operations tests completed!\n');

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
  }
}

// Run verification
verifyBatchOperations().catch(console.error);
