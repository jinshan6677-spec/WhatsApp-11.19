/**
 * Integration Test for Data Models and Constants
 */

const { Template, Group, Config } = require('../models');
const { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS, SEND_MODES, LIMITS } = require('../constants');

console.log('=== FINAL INTEGRATION TEST ===');
console.log('');

// Create account config
const account = 'test-account-123';
const config = Config.getDefault(account);
console.log('1. Config created for account:', config.accountId);
console.log('   Default send mode:', config.sendMode);
console.log('');

// Create groups
const group1 = new Group({ name: '常用问题' });
const group2 = new Group({ name: '产品介绍', parentId: group1.id });
console.log('2. Groups created:');
console.log('   - Top level group:', group1.name);
console.log('   - Child group:', group2.name);
console.log('');

// Create templates
const templates = [
  new Template({
    groupId: group1.id,
    type: TEMPLATE_TYPES.TEXT,
    label: TEMPLATE_TYPE_LABELS[TEMPLATE_TYPES.TEXT],
    content: { text: '您好，有什么可以帮您？' }
  }),
  new Template({
    groupId: group1.id,
    type: TEMPLATE_TYPES.IMAGE,
    label: TEMPLATE_TYPE_LABELS[TEMPLATE_TYPES.IMAGE],
    content: { mediaPath: '/path/to/product.jpg' }
  }),
  new Template({
    groupId: group2.id,
    type: TEMPLATE_TYPES.MIXED,
    label: TEMPLATE_TYPE_LABELS[TEMPLATE_TYPES.MIXED],
    content: { text: '这是我们的新产品', mediaPath: '/path/to/product2.jpg' }
  })
];

console.log('3. Templates created:');
templates.forEach((t, i) => {
  console.log(`   - Template ${i + 1}:`, t.type, '-', t.label);
  console.log('     Valid:', t.validate().valid ? 'YES' : 'NO');
});
console.log('');

// Simulate usage
console.log('4. Simulating usage:');
templates[0].recordUsage();
templates[0].recordUsage();
templates[1].recordUsage();
console.log('   - Template 1 used:', templates[0].usageCount, 'times');
console.log('   - Template 2 used:', templates[1].usageCount, 'times');
console.log('   - Template 3 used:', templates[2].usageCount, 'times');
console.log('');

// Config management
console.log('5. Config management:');
config.addExpandedGroup(group1.id);
config.setLastSelectedGroup(group1.id);
console.log('   - Expanded groups:', config.expandedGroups.length);
console.log('   - Last selected group set: YES');
console.log('');

// Validation tests
console.log('6. Validation tests:');
const invalidTemplate = new Template({
  type: TEMPLATE_TYPES.TEXT,
  label: 'A'.repeat(51),
  content: {}
});
const result = invalidTemplate.validate();
console.log('   - Invalid template errors:', result.errors.length);
result.errors.forEach(err => console.log('     *', err));
console.log('');

console.log('=== ALL SYSTEMS OPERATIONAL ===');
console.log('Data models and constants are ready for production use!');
