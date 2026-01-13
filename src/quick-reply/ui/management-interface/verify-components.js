/**
 * Component Verification Script
 * 
 * This script verifies that all management interface components are properly
 * exported and can be imported.
 * 
 * Run with: node verify-components.js
 */

const fs = require('fs');
const path = require('path');

// Expected components
const expectedComponents = [
  'ManagementInterface',
  'ManagementInterfaceProvider',
  'useManagementInterface',
  'Header',
  'PlatformSelector',
  'GroupPanel',
  'GroupListItem',
  'ContentArea',
  'TabBar',
  'TemplateListView',
  'TemplateListItem',
  'TemplateEditor'
];

// Expected files
const expectedFiles = [
  'ManagementInterface.jsx',
  'ManagementInterface.css',
  'Header.jsx',
  'Header.css',
  'PlatformSelector.jsx',
  'PlatformSelector.css',
  'GroupPanel.jsx',
  'GroupPanel.css',
  'GroupListItem.jsx',
  'GroupListItem.css',
  'ContentArea.jsx',
  'ContentArea.css',
  'TabBar.jsx',
  'TabBar.css',
  'TemplateListView.jsx',
  'TemplateListView.css',
  'TemplateListItem.jsx',
  'TemplateListItem.css',
  'TemplateEditor.jsx',
  'TemplateEditor.css',
  'index.js',
  'README.md',
  'TASK-10-SUMMARY.md',
  'demo.jsx',
  'verify-components.js'
];

console.log('🔍 Verifying Management Interface Components...\n');

// Check if all expected files exist
console.log('📁 Checking files...');
let allFilesExist = true;
expectedFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file}`);
  if (!exists) allFilesExist = false;
});

console.log('\n📦 Checking exports...');

// Read index.js to verify exports
const indexPath = path.join(__dirname, 'index.js');
const indexContent = fs.readFileSync(indexPath, 'utf8');

let allExportsPresent = true;
expectedComponents.forEach(component => {
  const isExported = indexContent.includes(component);
  const status = isExported ? '✅' : '❌';
  console.log(`${status} ${component}`);
  if (!isExported) allExportsPresent = false;
});

// Summary
console.log('\n📊 Summary:');
console.log(`Files: ${allFilesExist ? '✅ All present' : '❌ Some missing'}`);
console.log(`Exports: ${allExportsPresent ? '✅ All present' : '❌ Some missing'}`);
console.log(`Total files: ${expectedFiles.length}`);
console.log(`Total components: ${expectedComponents.length}`);

if (allFilesExist && allExportsPresent) {
  console.log('\n✨ All components verified successfully!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some components are missing or not exported properly.');
  process.exit(1);
}
