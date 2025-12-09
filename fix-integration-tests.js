const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/quick-reply/__tests__/integration.test.js');
let content = fs.readFileSync(filePath, 'utf8');

// Pattern to find createTemplate calls with null groupId
const patterns = [
  {
    search: /(\s+)(\/\/ Create template\n\s+const template = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
    replace: '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create template\n$1const template = await controller.templateManager.createTemplate(\n$1  group.id,'
  },
  {
    search: /(\s+)(\/\/ Create mixed template\n\s+const template = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
    replace: '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create mixed template\n$1const template = await controller.templateManager.createTemplate(\n$1  group.id,'
  },
  {
    search: /(\s+)(\/\/ Create image template\n\s+const template = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
    replace: '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create image template\n$1const template = await controller.templateManager.createTemplate(\n$1  group.id,'
  },
  {
    search: /(\s+)(\/\/ Create and send image template\n\s+const imageTemplate = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
    replace: '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create and send image template\n$1const imageTemplate = await controller.templateManager.createTemplate(\n$1  group.id,'
  },
  {
    search: /(\s+)(\/\/ Create and send audio template\n\s+const audioTemplate = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
    replace: '$1// Create and send audio template\n$1const audioTemplate = await controller.templateManager.createTemplate(\n$1  group.id,'
  },
  {
    search: /(\s+)(\/\/ Create and send video template\n\s+const videoTemplate = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
    replace: '$1// Create and send video template\n$1const videoTemplate = await controller.templateManager.createTemplate(\n$1  group.id,'
  },
  {
    search: /(\s+)(\/\/ Create template for account 1\n\s+const template1 = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
    replace: '$1// Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// Create template for account 1\n$1const template1 = await controller.templateManager.createTemplate(\n$1  group.id,'
  },
  {
    search: /(\s+)(\/\/ 1\. Create template\n\s+const template = await controller\.templateManager\.createTemplate\(\n\s+null,)/g,
    replace: '$1// 1. Ensure default group exists\n$1const group = await ensureDefaultGroup();\n$1\n$1// 2. Create template\n$1const template = await controller.templateManager.createTemplate(\n$1  group.id,'
  }
];

patterns.forEach(({ search, replace }) => {
  content = content.replace(search, replace);
});

// Simple replacements for inline calls
content = content.replace(
  /controller\.templateManager\.createTemplate\(\n\s+null,\n\s+TEMPLATE_TYPES\.TEXT,\n\s+`Template \$\{i\}`,\n\s+\{ text: `Text \$\{i\}` \}\n\s+\)/g,
  'controller.templateManager.createTemplate(\n            (await ensureDefaultGroup()).id,\n            TEMPLATE_TYPES.TEXT,\n            `Template ${i}`,\n            { text: `Text ${i}` }\n          )'
);

// Fix the recovery test
content = content.replace(
  /\/\/ Verify system still works\n\s+const template = await controller\.templateManager\.createTemplate\(\n\s+null,/g,
  '// Ensure default group exists\n      const group = await ensureDefaultGroup();\n      \n      // Verify system still works\n      const template = await controller.templateManager.createTemplate(\n        group.id,'
);

// Fix account 2 template creation
content = content.replace(
  /\/\/ Create template for account 2\n\s+const template2 = await controller2\.templateManager\.createTemplate\(\n\s+null,/g,
  '// Ensure default group for account 2\n      const group2 = await controller2.groupManager.createGroup(\'Default Group\');\n      \n      // Create template for account 2\n      const template2 = await controller2.templateManager.createTemplate(\n        group2.id,'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed integration tests!');
