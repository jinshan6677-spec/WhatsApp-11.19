/**
 * Component Verification Script
 * 
 * Verifies that all common UI components are properly structured and exportable.
 * This script doesn't require JSX transformation.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Common UI Components...\n');

const componentsDir = __dirname;
const components = [
  { name: 'Button', file: 'Button.jsx' },
  { name: 'Input', file: 'Input.jsx' },
  { name: 'Modal', file: 'Modal.jsx' },
  { name: 'Dropdown', file: 'Dropdown.jsx' },
  { name: 'Toast', file: 'Toast.jsx' },
];

let allPassed = true;

// Check if files exist
console.log('📁 Checking file existence...');
components.forEach(({ name, file }) => {
  const filePath = path.join(componentsDir, file);
  const exists = fs.existsSync(filePath);
  
  if (exists) {
    console.log(`  ✅ ${name} (${file})`);
  } else {
    console.log(`  ❌ ${name} (${file}) - FILE NOT FOUND`);
    allPassed = false;
  }
});

// Check index.js exists
console.log('\n📦 Checking index.js...');
const indexPath = path.join(componentsDir, 'index.js');
if (fs.existsSync(indexPath)) {
  console.log('  ✅ index.js exists');
  
  // Check if index.js exports all components
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  components.forEach(({ name }) => {
    if (indexContent.includes(name)) {
      console.log(`  ✅ ${name} is exported`);
    } else {
      console.log(`  ❌ ${name} is NOT exported`);
      allPassed = false;
    }
  });
} else {
  console.log('  ❌ index.js NOT FOUND');
  allPassed = false;
}

// Check component structure
console.log('\n🔬 Checking component structure...');
components.forEach(({ name, file }) => {
  const filePath = path.join(componentsDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for React import
    if (content.includes("import React")) {
      console.log(`  ✅ ${name} - React imported`);
    } else {
      console.log(`  ❌ ${name} - React NOT imported`);
      allPassed = false;
    }
    
    // Check for PropTypes
    if (content.includes("PropTypes")) {
      console.log(`  ✅ ${name} - PropTypes defined`);
    } else {
      console.log(`  ⚠️  ${name} - PropTypes not found (optional)`);
    }
    
    // Check for export
    if (content.includes("export default")) {
      console.log(`  ✅ ${name} - Default export present`);
    } else {
      console.log(`  ❌ ${name} - Default export NOT found`);
      allPassed = false;
    }
    
    // Check for component documentation
    if (content.includes("/**")) {
      console.log(`  ✅ ${name} - Documentation present`);
    } else {
      console.log(`  ⚠️  ${name} - Documentation not found (optional)`);
    }
  }
});

// Check README
console.log('\n📖 Checking README...');
const readmePath = path.join(componentsDir, 'README.md');
if (fs.existsSync(readmePath)) {
  console.log('  ✅ README.md exists');
  
  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  components.forEach(({ name }) => {
    if (readmeContent.includes(`### ${name}`)) {
      console.log(`  ✅ ${name} documented in README`);
    } else {
      console.log(`  ⚠️  ${name} not documented in README`);
    }
  });
} else {
  console.log('  ⚠️  README.md not found (optional)');
}

// Summary
console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ All verifications passed!');
  console.log('\nComponents created:');
  components.forEach(({ name }) => {
    console.log(`  • ${name}`);
  });
  console.log('\nAll components are ready to use! 🎉');
  process.exit(0);
} else {
  console.log('❌ Some verifications failed!');
  console.log('Please review the errors above.');
  process.exit(1);
}
