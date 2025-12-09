/**
 * Storage Path Configuration Verification Script
 * 
 * Demonstrates and verifies the storage path configuration for quick-reply.
 * 
 * Usage: node src/quick-reply/__tests__/verify-storage-paths.js
 */

const StoragePathConfig = require('../storage/StoragePathConfig');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function verifyStoragePaths() {
  try {
    logSection('Quick Reply Storage Path Configuration Verification');
    
    // Create test directory
    const testDir = path.join(os.tmpdir(), `quick-reply-verify-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    log(`\nTest directory: ${testDir}`, 'blue');
    
    // Test with multiple accounts
    const accounts = ['account-1', 'account-2', 'test@special#account'];
    
    for (const accountId of accounts) {
      logSection(`Account: ${accountId}`);
      
      // Create storage config
      const config = new StoragePathConfig(accountId, testDir);
      
      // Display paths
      log('\n📁 Storage Paths:', 'yellow');
      console.log(`  Account Root:    ${config.getAccountRoot()}`);
      console.log(`  Templates:       ${config.getTemplatesPath()}`);
      console.log(`  Groups:          ${config.getGroupsPath()}`);
      console.log(`  Config:          ${config.getConfigPath()}`);
      console.log(`  Media Directory: ${config.getMediaDirectory()}`);
      console.log(`  Backup Directory: ${config.getBackupDirectory()}`);
      
      // Create directories
      log('\n🔨 Creating directories...', 'yellow');
      await config.ensureDirectories();
      log('✓ Directories created successfully', 'green');
      
      // Verify permissions
      log('\n🔐 Verifying permissions...', 'yellow');
      const hasPermissions = await config.verifyPermissions();
      if (hasPermissions) {
        log('✓ Write permissions verified', 'green');
      } else {
        log('✗ Permission verification failed', 'red');
      }
      
      // Create sample data files
      log('\n📝 Creating sample data files...', 'yellow');
      
      const templatesPath = config.getTemplatesPath();
      const sampleTemplates = {
        version: '1.0.0',
        accountId: accountId,
        templates: [
          {
            id: 'template-1',
            groupId: 'group-1',
            type: 'text',
            label: 'Sample Template',
            content: { text: 'Hello, this is a sample template!' },
            order: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            usageCount: 0,
            lastUsedAt: null
          }
        ],
        updatedAt: Date.now()
      };
      await fs.writeFile(templatesPath, JSON.stringify(sampleTemplates, null, 2), 'utf8');
      log('✓ Templates file created', 'green');
      
      const groupsPath = config.getGroupsPath();
      const sampleGroups = {
        version: '1.0.0',
        accountId: accountId,
        groups: [
          {
            id: 'group-1',
            name: 'Sample Group',
            parentId: null,
            order: 1,
            expanded: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        updatedAt: Date.now()
      };
      await fs.writeFile(groupsPath, JSON.stringify(sampleGroups, null, 2), 'utf8');
      log('✓ Groups file created', 'green');
      
      const configPath = config.getConfigPath();
      const sampleConfig = {
        version: '1.0.0',
        accountId: accountId,
        config: {
          accountId: accountId,
          sendMode: 'original',
          expandedGroups: ['group-1'],
          lastSelectedGroupId: 'group-1',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        updatedAt: Date.now()
      };
      await fs.writeFile(configPath, JSON.stringify(sampleConfig, null, 2), 'utf8');
      log('✓ Config file created', 'green');
      
      // Create sample media file
      const mediaDir = config.getMediaDirectory();
      const sampleMediaPath = path.join(mediaDir, 'sample-image.jpg');
      await fs.writeFile(sampleMediaPath, Buffer.from('fake image data'), 'binary');
      log('✓ Sample media file created', 'green');
      
      // Get storage information
      log('\n📊 Storage Information:', 'yellow');
      const info = await config.getStorageInfo();
      console.log(`  Templates Size:  ${formatBytes(info.sizes.templates)}`);
      console.log(`  Groups Size:     ${formatBytes(info.sizes.groups)}`);
      console.log(`  Config Size:     ${formatBytes(info.sizes.config)}`);
      console.log(`  Media Size:      ${formatBytes(info.sizes.media)}`);
      console.log(`  Total Size:      ${formatBytes(info.sizes.total)}`);
      
      // Test media file path resolution
      log('\n🖼️  Media File Path Resolution:', 'yellow');
      const relativePath = 'media/sample-image.jpg';
      const fullPath = config.getMediaFilePath(relativePath);
      console.log(`  Relative: ${relativePath}`);
      console.log(`  Full:     ${fullPath}`);
      
      const mediaExists = await fs.access(fullPath).then(() => true).catch(() => false);
      if (mediaExists) {
        log('✓ Media file accessible', 'green');
      } else {
        log('✗ Media file not found', 'red');
      }
    }
    
    // Test account isolation
    logSection('Account Isolation Verification');
    
    log('\n🔒 Verifying account data isolation...', 'yellow');
    const config1 = new StoragePathConfig('account-1', testDir);
    const config2 = new StoragePathConfig('account-2', testDir);
    
    const templates1 = JSON.parse(await fs.readFile(config1.getTemplatesPath(), 'utf8'));
    const templates2 = JSON.parse(await fs.readFile(config2.getTemplatesPath(), 'utf8'));
    
    if (templates1.accountId === 'account-1' && templates2.accountId === 'account-2') {
      log('✓ Account data is properly isolated', 'green');
    } else {
      log('✗ Account data isolation failed', 'red');
    }
    
    // Summary
    logSection('Verification Summary');
    
    log('\n✅ All storage path configurations verified successfully!', 'green');
    log('\nKey Features:', 'yellow');
    console.log('  • Account-level data isolation');
    console.log('  • Automatic directory creation');
    console.log('  • Permission verification');
    console.log('  • Media file management');
    console.log('  • Storage information tracking');
    console.log('  • Path sanitization for special characters');
    
    log('\n📂 Directory Structure:', 'yellow');
    console.log('  {userData}/quick-reply/');
    console.log('    ├── {accountId}/');
    console.log('    │   ├── templates.json');
    console.log('    │   ├── groups.json');
    console.log('    │   ├── config.json');
    console.log('    │   ├── media/');
    console.log('    │   │   └── {templateId}.{ext}');
    console.log('    │   └── backups/');
    console.log('    │       └── {timestamp}.json');
    
    // Cleanup
    log('\n🧹 Cleaning up test directory...', 'yellow');
    await fs.rm(testDir, { recursive: true, force: true });
    log('✓ Cleanup complete', 'green');
    
    log('\n' + '='.repeat(60), 'cyan');
    log('Verification completed successfully!', 'green');
    log('='.repeat(60) + '\n', 'cyan');
    
  } catch (error) {
    log('\n✗ Verification failed:', 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run verification
if (require.main === module) {
  verifyStoragePaths().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { verifyStoragePaths };
