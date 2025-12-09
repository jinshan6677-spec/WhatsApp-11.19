const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/quick-reply/__tests__/integration.test.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix all remaining createTemplate calls with null groupId
// Pattern 1: Simple template creation
content = content.replace(
  /(\s+)(\/\/ Create template\n\s+const template = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create template\n$1const template = await controller.templateManager.createTemplate(\n$1  group.id,'
);

// Pattern 2: Mixed template
content = content.replace(
  /(\s+)(\/\/ Create mixed template\n\s+const template = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create mixed template\n$1const template = await controller.templateManager.createTemplate(\n$1  group.id,'
);

// Pattern 3: Image template
content = content.replace(
  /(\s+)(\/\/ Create image template\n\s+const template = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create image template\n$1const template = await controller.templateManager.createTemplate(\n$1  group.id,'
);

// Pattern 4: Create and send image template
content = content.replace(
  /(\s+)(\/\/ Create and send image template\n\s+const imageTemplate = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create and send image template\n$1const imageTemplate = await controller.templateManager.createTemplate(\n$1  group.id,'
);

// Pattern 5: Create and send audio template
content = content.replace(
  /(\s+)(\/\/ Create and send audio template\n\s+const audioTemplate = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// Create and send audio template\n$1const audioTemplate = await controller.templateManager.createTemplate(\n$1  group.id,'
);

// Pattern 6: Create and send video template
content = content.replace(
  /(\s+)(\/\/ Create and send video template\n\s+const videoTemplate = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// Create and send video template\n$1const videoTemplate = await controller.templateManager.createTemplate(\n$1  group.id,'
);

// Pattern 7: Create template for account 1
content = content.replace(
  /(\s+)(\/\/ Create template for account 1\n\s+const template1 = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create template for account 1\n$1const template1 = await controller.templateManager.createTemplate(\n$1  group.id,'
);

// Pattern 8: 1. Create template (E2E workflow)
content = content.replace(
  /(\s+)(\/\/ 1\. Create template\n\s+const template = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// 1. Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// 2. Create template\n$1const template = await controller.templateManager.createTemplate(\n$1  group.id,'
);

// Pattern 9: Concurrent write operations
content = content.replace(
  /(\s+)(\/\/ Create templates in group\n\s+const promises = \[\];\n\s+for \(let i = 0; i < 10; i\+\+\) \{\n\s+promises\.push\(\n\s+controller\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create templates in group\n$1const promises = [];\n$1for (let i = 0; i < 10; i++) {\n$1  promises.push(\n$1    controller.templateManager.createTemplate(\n$1      group.id,'
);

// Pattern 10: Recovery test
content = content.replace(
  /(\s+)(\/\/ Verify system still works\n\s+const template = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Verify system still works\n$1const template = await controller.templateManager.createTemplate(\n$1  group.id,'
);

// Pattern 11: Account 2 template creation
content = content.replace(
  /(\s+)(\/\/ Create template for account 2\n\s+const template2 = await controller2\.templateManager\.createTemplate\(\n\s+null,)/g,
  '$1// Ensure default group for account 2\n$1const group2 = await controller2.groupManager.createGroup(\'Default Group\');\n$1\n$1// Create template for account 2\n$1const template2 = await controller2.templateManager.createTemplate(\n$1  group2.id,'
);

// Fix the group expansion test - groups default to expanded=true
content = content.replace(
  /(\s+)(\/\/ Toggle expansion \(simulating operation panel\)\n\s+await controller\.groupManager\.toggleExpanded\(group\.id\);\n\s+\n\s+\/\/ Verify state is synced\n\s+const expandedState = await controller\.groupManager\.getExpandedState\(group\.id\);\n\s+expect\(expandedState\)\.toBe\(true\);)/g,
  '$1// Verify initial state (groups default to expanded=true)\n$1let expandedState = await controller.groupManager.getExpandedState(group.id);\n$1expect(expandedState).toBe(true);\n$1\n$1// Toggle expansion (simulating operation panel)\n$1await controller.groupManager.toggleExpanded(group.id);\n$1\n$1// Verify state is synced (should now be false)\n$1expandedState = await controller.groupManager.getExpandedState(group.id);\n$1expect(expandedState).toBe(false);'
);

// Fix search results test - searchTemplates returns template IDs, not templates
content = content.replace(
  /(\s+)(\/\/ Search \(simulating operation panel search\)\n\s+const templates = await controller\.templateManager\.storage\.getAll\(\);\n\s+const groups = await controller\.groupManager\.storage\.getAll\(\);\n\s+const results = searchTemplates\('Hello', templates, groups\);\n\s+\n\s+\/\/ Verify search results\n\s+expect\(results\)\.toHaveLength\(1\);\n\s+expect\(results\[0\]\.label\)\.toBe\('Hello Template'\);)/g,
  '$1// Search (simulating operation panel search)\n$1const templates = await controller.templateManager.storage.getAll();\n$1const groups = await controller.groupManager.storage.getAll();\n$1const resultIds = searchTemplates(\'Hello\', templates, groups);\n$1\n$1// Get actual templates from IDs\n$1const results = templates.filter(t => resultIds.includes(t.id));\n$1\n$1// Verify search results\n$1expect(results).toHaveLength(1);\n$1expect(results[0].label).toBe(\'Hello Template\');'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed remaining integration tests!');
