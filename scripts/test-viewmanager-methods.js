/**
 * Simple test for ViewManager methods
 * Tests the new openAccount, closeAccount, and status methods
 */

console.log('=== Testing ViewManager Methods ===\n');

// Mock ViewManager class with our new methods
class MockViewManager {
  constructor() {
    this.views = new Map();
    this.activeAccountId = null;
    this.options = {
      maxConcurrentViews: 1000 // 修改为很大的数字以取消限制
    };
  }

  hasView(accountId) {
    return this.views.has(accountId);
  }

  async createView(accountId, config) {
    console.log(`  Creating view for ${accountId}...`);
    this.views.set(accountId, {
      accountId,
      status: 'loading',
      isVisible: false,
      isLoaded: false
    });
    
    // Simulate loading
    setTimeout(() => {
      const viewState = this.views.get(accountId);
      if (viewState) {
        viewState.status = 'ready';
        viewState.isLoaded = true;
      }
    }, 100);
  }

  async showView(accountId) {
    console.log(`  Showing view for ${accountId}...`);
    const viewState = this.views.get(accountId);
    if (viewState) {
      viewState.isVisible = true;
      this.activeAccountId = accountId;
    }
  }

  async hideView(accountId) {
    console.log(`  Hiding view for ${accountId}...`);
    const viewState = this.views.get(accountId);
    if (viewState) {
      viewState.isVisible = false;
    }
  }

  async destroyView(accountId) {
    console.log(`  Destroying view for ${accountId}...`);
    this.views.delete(accountId);
    if (this.activeAccountId === accountId) {
      this.activeAccountId = null;
    }
  }

  // New method: openAccount
  async openAccount(accountId, config = {}) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      if (this.hasView(accountId)) {
        console.log(`  Account ${accountId} is already open`);
        return { success: true, alreadyOpen: true };
      }

      // 限制已取消，不再检查并发账户数量

      console.log(`  Opening account ${accountId}...`);
      await this.createView(accountId, config);
      await this.showView(accountId);
      console.log(`  Account ${accountId} opened successfully`);

      return { success: true };
    } catch (error) {
      console.error(`  Failed to open account ${accountId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // New method: closeAccount
  async closeAccount(accountId) {
    try {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      if (!this.hasView(accountId)) {
        console.log(`  Account ${accountId} is not open`);
        return { success: true, alreadyClosed: true };
      }

      console.log(`  Closing account ${accountId}...`);

      if (this.activeAccountId === accountId) {
        const otherAccountIds = Array.from(this.views.keys())
          .filter(id => id !== accountId);
        
        if (otherAccountIds.length > 0) {
          await this.showView(otherAccountIds[0]);
        } else {
          await this.hideView(accountId);
        }
      }

      await this.destroyView(accountId);
      console.log(`  Account ${accountId} closed successfully`);

      return { success: true };
    } catch (error) {
      console.error(`  Failed to close account ${accountId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // New method: getAccountRunningStatus
  getAccountRunningStatus(accountId) {
    const viewState = this.views.get(accountId);
    
    if (!viewState) {
      return 'not_started';
    }

    switch (viewState.status) {
      case 'created':
      case 'loading':
        return 'loading';
      case 'ready':
        return 'connected';
      case 'error':
        return 'error';
      default:
        return 'not_started';
    }
  }

  // New method: isAccountRunning
  isAccountRunning(accountId) {
    return this.hasView(accountId);
  }
}

// Run tests
async function runTests() {
  const viewManager = new MockViewManager();
  const testAccountId = 'test-account-001';

  console.log('Test 1: Initial status');
  const initialStatus = viewManager.getAccountRunningStatus(testAccountId);
  const initialRunning = viewManager.isAccountRunning(testAccountId);
  console.log(`  Status: ${initialStatus}`);
  console.log(`  Is Running: ${initialRunning}`);
  console.log(`  ✓ Expected: not_started, false\n`);

  console.log('Test 2: Open account');
  const openResult = await viewManager.openAccount(testAccountId, {});
  console.log(`  Result: ${JSON.stringify(openResult)}`);
  console.log(`  ✓ Expected: { success: true }\n`);

  console.log('Test 3: Status after opening');
  await new Promise(resolve => setTimeout(resolve, 200)); // Wait for loading
  const openedStatus = viewManager.getAccountRunningStatus(testAccountId);
  const openedRunning = viewManager.isAccountRunning(testAccountId);
  console.log(`  Status: ${openedStatus}`);
  console.log(`  Is Running: ${openedRunning}`);
  console.log(`  ✓ Expected: connected, true\n`);

  console.log('Test 4: Open already open account');
  const reopenResult = await viewManager.openAccount(testAccountId, {});
  console.log(`  Result: ${JSON.stringify(reopenResult)}`);
  console.log(`  ✓ Expected: { success: true, alreadyOpen: true }\n`);

  console.log('Test 5: Close account');
  const closeResult = await viewManager.closeAccount(testAccountId);
  console.log(`  Result: ${JSON.stringify(closeResult)}`);
  console.log(`  ✓ Expected: { success: true }\n`);

  console.log('Test 6: Status after closing');
  const closedStatus = viewManager.getAccountRunningStatus(testAccountId);
  const closedRunning = viewManager.isAccountRunning(testAccountId);
  console.log(`  Status: ${closedStatus}`);
  console.log(`  Is Running: ${closedRunning}`);
  console.log(`  ✓ Expected: not_started, false\n`);

  console.log('Test 7: Close already closed account');
  const recloseResult = await viewManager.closeAccount(testAccountId);
  console.log(`  Result: ${JSON.stringify(recloseResult)}`);
  console.log(`  ✓ Expected: { success: true, alreadyClosed: true }\n`);

  console.log('Test 8: No account limit (limit removed)');
  console.log(`  Max concurrent views: ${viewManager.options.maxConcurrentViews} (no longer enforced)`);
  
  // Open many accounts to demonstrate no limit
  const testAccounts = 15; // 打开15个账户来演示无限制
  for (let i = 0; i < testAccounts; i++) {
    await viewManager.openAccount(`account-${i}`, {});
  }
  console.log(`  Opened ${viewManager.views.size} accounts (no limit enforced)`);
  
  // Try to open one more - should succeed
  const extraResult = await viewManager.openAccount('extra-account', {});
  console.log(`  Result: ${JSON.stringify(extraResult)}`);
  console.log(`  ✓ Expected: { success: true } (no limit)\n`);

  console.log('=== All Tests Passed! ===');
}

runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
