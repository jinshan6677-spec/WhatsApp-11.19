/**
 * Property-based tests for Sidebar State Module
 * 
 * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation** (partial)
 * **Validates: Requirements 1.3, 4.2**
 * 
 * Tests that the state module correctly manages sidebar state with consistent behavior.
 */

'use strict';

const fc = require('fast-check');
const SidebarState = require('../state');

// ==================== Arbitraries ====================

/**
 * Account ID arbitrary - generates valid UUID-like strings
 */
const accountIdArbitrary = fc.uuid();

/**
 * Account name arbitrary
 */
const accountNameArbitrary = fc.string({ minLength: 1, maxLength: 50 });

/**
 * Account object arbitrary
 */
const accountArbitrary = fc.record({
  id: accountIdArbitrary,
  name: accountNameArbitrary,
  profileName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  phoneNumber: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: undefined }),
  note: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  status: fc.constantFrom('online', 'offline', 'loading', 'error'),
  runningStatus: fc.constantFrom('not_started', 'loading', 'connected', 'error'),
  isRunning: fc.boolean(),
  order: fc.integer({ min: 0, max: 999 })
});

/**
 * Array of accounts arbitrary
 */
const accountsArrayArbitrary = fc.array(accountArbitrary, { minLength: 0, maxLength: 20 });

/**
 * Filter query arbitrary
 */
const filterQueryArbitrary = fc.string({ maxLength: 100 });

// ==================== Property Tests ====================

describe('Sidebar State Module Property Tests', () => {
  
  beforeEach(() => {
    // Reset state before each test
    SidebarState.setAccounts([]);
    SidebarState.setActiveAccountId(null);
    SidebarState.setFilterQuery('');
    SidebarState.setSelectionMode(false);
    SidebarState.clearSelectedAccounts();
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
   * **Validates: Requirements 1.3, 4.2**
   * 
   * For any accounts array set via setAccounts, getAccounts should return
   * the same accounts array.
   */
  describe('Property 1: State Getter/Setter Consistency', () => {
    
    test('setAccounts/getAccounts round-trip preserves accounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountsArrayArbitrary,
          async (accounts) => {
            SidebarState.setAccounts(accounts);
            const retrieved = SidebarState.getAccounts();
            
            // Should return the same array reference
            expect(retrieved).toBe(accounts);
            expect(retrieved.length).toBe(accounts.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('setActiveAccountId/getActiveAccountId round-trip preserves ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(accountIdArbitrary, { nil: null }),
          async (accountId) => {
            SidebarState.setActiveAccountId(accountId);
            const retrieved = SidebarState.getActiveAccountId();
            
            expect(retrieved).toBe(accountId);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('setFilterQuery/getFilterQuery round-trip preserves query', async () => {
      await fc.assert(
        fc.asyncProperty(
          filterQueryArbitrary,
          async (query) => {
            SidebarState.setFilterQuery(query);
            const retrieved = SidebarState.getFilterQuery();
            
            expect(retrieved).toBe(query);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('setFilterQuery with null/undefined returns empty string', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(null, undefined),
          async (value) => {
            SidebarState.setFilterQuery(value);
            const retrieved = SidebarState.getFilterQuery();
            
            expect(retrieved).toBe('');
          }
        ),
        { numRuns: 10 }
      );
    });

    test('incrementRenderVersion always increases version', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (incrementCount) => {
            const initialVersion = SidebarState.getRenderVersion();
            
            for (let i = 0; i < incrementCount; i++) {
              SidebarState.incrementRenderVersion();
            }
            
            const finalVersion = SidebarState.getRenderVersion();
            expect(finalVersion).toBe(initialVersion + incrementCount);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
   * **Validates: Requirements 1.3, 4.2**
   * 
   * Selection mode operations should maintain consistent state.
   */
  describe('Property 1: Selection Mode Consistency', () => {
    
    test('toggleSelectionModeState alternates between true and false', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async (toggleCount) => {
            const initialMode = SidebarState.isSelectionMode();
            
            for (let i = 0; i < toggleCount; i++) {
              SidebarState.toggleSelectionModeState();
            }
            
            const finalMode = SidebarState.isSelectionMode();
            
            // After odd number of toggles, mode should be opposite
            // After even number of toggles, mode should be same
            if (toggleCount % 2 === 0) {
              expect(finalMode).toBe(initialMode);
            } else {
              expect(finalMode).toBe(!initialMode);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('setSelectionMode directly sets the mode', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (mode) => {
            SidebarState.setSelectionMode(mode);
            expect(SidebarState.isSelectionMode()).toBe(mode);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('addSelectedAccount/isAccountSelected consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(accountIdArbitrary, { minLength: 1, maxLength: 10 }),
          async (accountIds) => {
            SidebarState.clearSelectedAccounts();
            
            // Add all accounts
            accountIds.forEach(id => SidebarState.addSelectedAccount(id));
            
            // All should be selected
            accountIds.forEach(id => {
              expect(SidebarState.isAccountSelected(id)).toBe(true);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    test('removeSelectedAccount removes account from selection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(accountIdArbitrary, { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0 }),
          async (accountIds, removeIndex) => {
            SidebarState.clearSelectedAccounts();
            
            // Add all accounts
            accountIds.forEach(id => SidebarState.addSelectedAccount(id));
            
            // Remove one account
            const indexToRemove = removeIndex % accountIds.length;
            const idToRemove = accountIds[indexToRemove];
            SidebarState.removeSelectedAccount(idToRemove);
            
            // Removed account should not be selected
            expect(SidebarState.isAccountSelected(idToRemove)).toBe(false);
            
            // Other accounts should still be selected
            accountIds.forEach((id, idx) => {
              if (idx !== indexToRemove) {
                expect(SidebarState.isAccountSelected(id)).toBe(true);
              }
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    test('clearSelectedAccounts removes all selections', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(accountIdArbitrary, { minLength: 1, maxLength: 10 }),
          async (accountIds) => {
            // Add all accounts
            accountIds.forEach(id => SidebarState.addSelectedAccount(id));
            
            // Clear all
            SidebarState.clearSelectedAccounts();
            
            // None should be selected
            accountIds.forEach(id => {
              expect(SidebarState.isAccountSelected(id)).toBe(false);
            });
            
            expect(SidebarState.getSelectedAccountIds().size).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('selectAllAccounts selects all accounts in state', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountsArrayArbitrary.filter(arr => arr.length > 0),
          async (accounts) => {
            SidebarState.setAccounts(accounts);
            SidebarState.clearSelectedAccounts();
            
            SidebarState.selectAllAccounts();
            
            // All accounts should be selected
            accounts.forEach(account => {
              expect(SidebarState.isAccountSelected(account.id)).toBe(true);
            });
            
            expect(SidebarState.getSelectedAccountIds().size).toBe(accounts.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
   * **Validates: Requirements 1.3, 4.2**
   * 
   * Account operations should work correctly.
   */
  describe('Property 1: Account Operations Consistency', () => {
    
    test('getAccountById returns correct account', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountsArrayArbitrary.filter(arr => arr.length > 0),
          fc.integer({ min: 0 }),
          async (accounts, index) => {
            SidebarState.setAccounts(accounts);
            
            const targetIndex = index % accounts.length;
            const targetAccount = accounts[targetIndex];
            
            const retrieved = SidebarState.getAccountById(targetAccount.id);
            
            expect(retrieved).toBe(targetAccount);
            expect(retrieved.id).toBe(targetAccount.id);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('getAccountById returns undefined for non-existent ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountsArrayArbitrary,
          accountIdArbitrary,
          async (accounts, randomId) => {
            SidebarState.setAccounts(accounts);
            
            // Ensure the random ID is not in the accounts
            const existingIds = new Set(accounts.map(a => a.id));
            if (existingIds.has(randomId)) {
              return; // Skip this case
            }
            
            const retrieved = SidebarState.getAccountById(randomId);
            expect(retrieved).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('updateAccount modifies account properties', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountsArrayArbitrary.filter(arr => arr.length > 0),
          fc.integer({ min: 0 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (accounts, index, newName) => {
            SidebarState.setAccounts(accounts);
            
            const targetIndex = index % accounts.length;
            const targetAccount = accounts[targetIndex];
            
            const updated = SidebarState.updateAccount(targetAccount.id, { name: newName });
            
            expect(updated).not.toBeNull();
            expect(updated.name).toBe(newName);
            expect(updated.id).toBe(targetAccount.id);
            
            // Verify the account in state is also updated
            const retrieved = SidebarState.getAccountById(targetAccount.id);
            expect(retrieved.name).toBe(newName);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('updateAccount returns null for non-existent ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountsArrayArbitrary,
          accountIdArbitrary,
          async (accounts, randomId) => {
            SidebarState.setAccounts(accounts);
            
            // Ensure the random ID is not in the accounts
            const existingIds = new Set(accounts.map(a => a.id));
            if (existingIds.has(randomId)) {
              return; // Skip this case
            }
            
            const updated = SidebarState.updateAccount(randomId, { name: 'test' });
            expect(updated).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('getAccountName returns correct name or fallback', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountsArrayArbitrary.filter(arr => arr.length > 0),
          fc.integer({ min: 0 }),
          async (accounts, index) => {
            SidebarState.setAccounts(accounts);
            
            const targetIndex = index % accounts.length;
            const targetAccount = accounts[targetIndex];
            
            const name = SidebarState.getAccountName(targetAccount.id);
            
            // Should return name, profileName, or '未命名'
            const expectedName = targetAccount.name || targetAccount.profileName || '未命名';
            expect(name).toBe(expectedName);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('getAccountName returns "未知账号" for non-existent ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountsArrayArbitrary,
          accountIdArbitrary,
          async (accounts, randomId) => {
            SidebarState.setAccounts(accounts);
            
            // Ensure the random ID is not in the accounts
            const existingIds = new Set(accounts.map(a => a.id));
            if (existingIds.has(randomId)) {
              return; // Skip this case
            }
            
            const name = SidebarState.getAccountName(randomId);
            expect(name).toBe('未知账号');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
