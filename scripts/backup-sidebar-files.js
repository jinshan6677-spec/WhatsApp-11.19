#!/usr/bin/env node

/**
 * Backup script for sidebar refactoring
 * Backs up original files before replacement
 */

const fs = require('fs');
const path = require('path');

const backupDir = 'archive/sidebar-refactoring-backup';

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`✅ Created backup directory: ${backupDir}`);
}

// Backup old styles.css
const oldStylesPath = 'src/single-window/renderer/styles.css';
const backupStylesPath = path.join(backupDir, 'styles.css.backup');

try {
  if (fs.existsSync(oldStylesPath)) {
    fs.copyFileSync(oldStylesPath, backupStylesPath);
    console.log(`✅ Backed up ${oldStylesPath} to ${backupStylesPath}`);
    
    const stats = fs.statSync(backupStylesPath);
    console.log(`   File size: ${stats.size} bytes`);
  } else {
    console.log(`⚠️  ${oldStylesPath} not found`);
  }
} catch (error) {
  console.error(`❌ Error backing up styles.css:`, error.message);
  process.exit(1);
}

console.log('\n✅ Backup complete!');
console.log('\nNext steps:');
console.log('1. Replace src/single-window/renderer/styles.css with styles-modular.css');
console.log('2. Test the application');
console.log('3. If issues arise, restore from backup');
