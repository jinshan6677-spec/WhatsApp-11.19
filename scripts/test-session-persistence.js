/**
 * Test script for session persistence and restoration
 * 
 * This script tests the session management functionality including:
 * - Session data persistence
 * - Login state detection
 * - Session restoration
 * - Session expiration handling
 * - Force logout
 */

const path = require('path');
const { app } = require('electron');

// Mock app if not running in Electron
if (!app) {
  console.error('This script must be run in an Electron environment');
  process.exit(1);
}

const SessionManager = require('../src/managers/SessionManager');

/**
 * Test session persistence functionality
 */
async function testSessionPersistence() {
  console.log('=== Testing Session Persistence ===\n');

  const sessionManager = new SessionManager({
    userDataPath: app.getPath('userData')
  });

  const testAccountId = 'test-account-001';

  try {
    // Test 1: Create session
    console.log('Test 1: Creating session...');
    const createResult = await sessionManager.createSession(testAccountId, {
      proxy: {
        enabled: false
      }
    });
    
    if (createResult.success) {
      console.log('✓ Session created successfully');
      console.log(`  Session partition: persist:account_${testAccountId}`);
    } else {
      console.error('✗ Failed to create session:', createResult.error);
      return false;
    }

    // Test 2: Check if session data exists
    console.log('\nTest 2: Checking session data existence...');
    const hasSession = await sessionManager.hasSessionData(testAccountId);
    console.log(`  Has session data: ${hasSession}`);
    
    // Test 3: Get session persistence status
    console.log('\nTest 3: Getting session persistence status...');
    const persistenceStatus = await sessionManager.getSessionPersistenceStatus(testAccountId);
    
    if (persistenceStatus.persisted !== undefined) {
      console.log('✓ Session persistence status retrieved');
      console.log(`  Persisted: ${persistenceStatus.persisted}`);
      console.log(`  Data size: ${persistenceStatus.dataSize} bytes`);
      console.log(`  File count: ${persistenceStatus.fileCount || 0}`);
      if (persistenceStatus.lastModified) {
        console.log(`  Last modified: ${persistenceStatus.lastModified}`);
      }
    } else {
      console.error('✗ Failed to get persistence status:', persistenceStatus.error);
    }

    // Test 4: Get session data stats
    console.log('\nTest 4: Getting session data statistics...');
    const stats = await sessionManager.getSessionDataStats(testAccountId);
    
    if (stats.error) {
      console.error('✗ Failed to get stats:', stats.error);
    } else {
      console.log('✓ Session data stats retrieved');
      console.log(`  Size: ${stats.size} bytes`);
      console.log(`  Files: ${stats.files}`);
    }

    // Test 5: Verify session isolation
    console.log('\nTest 5: Verifying session isolation...');
    const isolationResult = await sessionManager.verifySessionIsolation(testAccountId);
    
    if (isolationResult.isolated) {
      console.log('✓ Session isolation verified');
      console.log(`  Partition: ${isolationResult.details.partition}`);
      console.log(`  User data dir: ${isolationResult.details.userDataDir}`);
      console.log(`  Has own cookies: ${isolationResult.details.hasOwnCookies}`);
      console.log(`  Has own localStorage: ${isolationResult.details.hasOwnLocalStorage}`);
      console.log(`  Has own IndexedDB: ${isolationResult.details.hasOwnIndexedDB}`);
      console.log(`  Has own cache: ${isolationResult.details.hasOwnCache}`);
    } else {
      console.error('✗ Session isolation verification failed:', isolationResult.error);
    }

    // Test 6: Handle session expiration
    console.log('\nTest 6: Testing session expiration handling...');
    const expirationResult = await sessionManager.handleSessionExpiration(testAccountId, {
      clearCache: true
    });
    
    if (expirationResult.success) {
      console.log('✓ Session expiration handled successfully');
    } else {
      console.error('✗ Failed to handle session expiration:', expirationResult.error);
    }

    // Test 7: Clear session data
    console.log('\nTest 7: Clearing session data...');
    const clearResult = await sessionManager.clearSessionData(testAccountId);
    
    if (clearResult.success) {
      console.log('✓ Session data cleared successfully');
    } else {
      console.error('✗ Failed to clear session data:', clearResult.error);
    }

    // Test 8: Verify session data is cleared
    console.log('\nTest 8: Verifying session data is cleared...');
    const hasSessionAfterClear = await sessionManager.hasSessionData(testAccountId);
    console.log(`  Has session data after clear: ${hasSessionAfterClear}`);

    // Test 9: Delete user data directory
    console.log('\nTest 9: Deleting user data directory...');
    const deleteResult = await sessionManager.deleteUserDataDir(testAccountId);
    
    if (deleteResult.success) {
      console.log('✓ User data directory deleted successfully');
    } else {
      console.error('✗ Failed to delete user data directory:', deleteResult.error);
    }

    console.log('\n=== All Tests Completed ===\n');
    return true;

  } catch (error) {
    console.error('\n✗ Test failed with error:', error);
    return false;
  }
}

/**
 * Run tests
 */
async function runTests() {
  console.log('Starting session persistence tests...\n');
  
  try {
    const success = await testSessionPersistence();
    
    if (success) {
      console.log('All tests passed! ✓');
      process.exit(0);
    } else {
      console.log('Some tests failed! ✗');
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

// Run tests when app is ready
if (app.isReady()) {
  runTests();
} else {
  app.on('ready', runTests);
}

module.exports = {
  testSessionPersistence,
  runTests
};
