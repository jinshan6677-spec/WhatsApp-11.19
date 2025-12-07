#!/usr/bin/env node

/**
 * Verification script for sidebar modular refactoring
 * Checks that all module files are under 500 lines
 */

const fs = require('fs');
const path = require('path');

const MAX_LINES = 500;

// JavaScript modules to check
const jsModules = [
  'src/single-window/renderer/sidebar.js',
  'src/single-window/renderer/sidebar/state.js',
  'src/single-window/renderer/sidebar/utils.js',
  'src/single-window/renderer/sidebar/render.js',
  'src/single-window/renderer/sidebar/events.js',
  'src/single-window/renderer/sidebar/actions.js',
  'src/single-window/renderer/sidebar/contextMenu.js',
  'src/single-window/renderer/sidebar/selection.js',
  'src/single-window/renderer/sidebar/ipInfo.js',
  'src/single-window/renderer/sidebar/sidebarToggle.js'
];

// CSS modules to check
const cssModules = [
  'src/single-window/renderer/styles.css',
  'src/single-window/renderer/styles/base.css',
  'src/single-window/renderer/styles/layout.css',
  'src/single-window/renderer/styles/accountItem.css',
  'src/single-window/renderer/styles/buttons.css',
  'src/single-window/renderer/styles/status.css',
  'src/single-window/renderer/styles/contextMenu.css',
  'src/single-window/renderer/styles/translatePanel.css',
  'src/single-window/renderer/styles/selection.css',
  'src/single-window/renderer/styles/responsive.css',
  'src/single-window/renderer/styles/collapsed.css'
];

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return -1;
  }
}

function verifyFiles(files, category) {
  console.log(`\n=== ${category} ===`);
  let allPassed = true;
  let totalLines = 0;

  files.forEach(file => {
    const lineCount = countLines(file);
    if (lineCount === -1) {
      console.log(`❌ ${file}: FILE NOT FOUND`);
      allPassed = false;
    } else {
      totalLines += lineCount;
      const status = lineCount <= MAX_LINES ? '✅' : '❌';
      const statusText = lineCount <= MAX_LINES ? 'PASS' : 'FAIL';
      console.log(`${status} ${file}: ${lineCount} lines (${statusText})`);
      if (lineCount > MAX_LINES) {
        allPassed = false;
      }
    }
  });

  console.log(`\nTotal lines in ${category}: ${totalLines}`);
  return allPassed;
}

function main() {
  console.log('Sidebar Modular Refactoring - Line Count Verification');
  console.log('=====================================================');
  console.log(`Maximum allowed lines per file: ${MAX_LINES}`);

  const jsPass = verifyFiles(jsModules, 'JavaScript Modules');
  const cssPass = verifyFiles(cssModules, 'CSS Modules');

  console.log('\n=== Summary ===');
  console.log(`JavaScript Modules: ${jsPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`CSS Modules: ${cssPass ? '✅ PASS' : '❌ FAIL'}`);

  if (jsPass && cssPass) {
    console.log('\n🎉 All files passed line count verification!');
    process.exit(0);
  } else {
    console.log('\n❌ Some files exceeded the 500 line limit');
    process.exit(1);
  }
}

main();
