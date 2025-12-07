/**
 * Property-based tests for Sidebar Render Module
 * 
 * **Feature: sidebar-modular-refactoring, Property 3: User Interaction Equivalence** (rendering part)
 * **Validates: Requirements 4.4**
 * 
 * Tests that rendering functions produce consistent DOM output for all valid inputs.
 */

'use strict';

const fc = require('fast-check');

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

// Setup DOM BEFORE requiring modules that depend on it
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="account-list"></div><div id="empty-state" class="hidden"><p></p></div></body></html>', {
  url: 'http://localhost'
});

// Set up global references immediately
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.MouseEvent = dom.window.MouseEvent;

// Mock electronAPI
dom.window.electronAPI = {
  invoke: jest.fn().mockResolvedValue({ success: true, statuses: {} }),
  getAllAccountStatuses: jest.fn().mockResolvedValue({ success: true, statuses: {} }),
  on: jest.fn(),
  send: jest.fn()
};

// Now require the modules AFTER DOM is set up
const SidebarState = require('../state');
const SidebarUtils = require('../utils');
const SidebarRender = require('../render');

// Set up window globals for the render module
beforeEach(() => {
  dom.window.SidebarState = SidebarState;
  dom.window.SidebarUtils = SidebarUtils;
  dom.window.SidebarActions = {
    handleAccountSelect: jest.fn(),
    handleOpenAccount: jest.fn(),
    handleCloseAccount: jest.fn(),
    handleRetryAccount: jest.fn(),
    saveAccountNote: jest.fn(),
    syncAccountStatusWithRunningStatus: jest.fn(),
    syncAccountStatusesWithRunningStatus: jest.fn(),
    mergeRunningStatuses: jest.fn()
  };
  dom.window.SidebarContextMenu = {
    handleContextMenu: jest.fn()
  };
  dom.window.SidebarIPInfo = {
    fetchAndRenderIPInfo: jest.fn()
  };
  
  // Reset state
  SidebarState.setAccounts([]);
  SidebarState.setActiveAccountId(null);
  SidebarState.setFilterQuery('');
  SidebarState.setSelectionMode(false);
  SidebarState.clearSelectedAccounts();
  
  // Reset DOM
  const accountList = global.document.getElementById('account-list');
  if (accountList) {
    accountList.innerHTML = '';
  }
  const emptyState = global.document.getElementById('empty-state');
  if (emptyState) {
    emptyState.classList.add('hidden');
  }
});

afterAll(() => {
  delete global.document;
  delete global.window;
  delete global.HTMLElement;
  delete global.MouseEvent;
});

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
 * Status arbitrary
 */
const statusArbitrary = fc.constantFrom('online', 'offline', 'loading', 'error');

/**
 * Running status arbitrary
 */
const runningStatusArbitrary = fc.constantFrom('not_started', 'loading', 'connected', 'error');

/**
 * Account object arbitrary
 */
const accountArbitrary = fc.record({
  id: accountIdArbitrary,
  name: accountNameArbitrary,
  profileName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  phoneNumber: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: undefined }),
  note: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  avatarUrl: fc.option(fc.webUrl(), { nil: undefined }),
  status: statusArbitrary,
  runningStatus: runningStatusArbitrary,
  isRunning: fc.boolean(),
  loginStatus: fc.option(fc.boolean(), { nil: undefined }),
  hasQRCode: fc.option(fc.boolean(), { nil: undefined }),
  unreadCount: fc.option(fc.integer({ min: 0, max: 999 }), { nil: undefined }),
  order: fc.integer({ min: 0, max: 999 })
});

/**
 * Array of accounts arbitrary
 */
const accountsArrayArbitrary = fc.array(accountArbitrary, { minLength: 0, maxLength: 10 });

// ==================== Property Tests ====================

describe('Sidebar Render Module Property Tests', () => {

  /**
   * **Feature: sidebar-modular-refactoring, Property 3: User Interaction Equivalence**
   * **Validates: Requirements 4.4**
   * 
   * createAccountItem should produce consistent DOM structure for any valid account.
   */
  describe('Property 3: createAccountItem DOM Structure Consistency', () => {
    
    test('createAccountItem always produces valid DOM element', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const item = SidebarRender.createAccountItem(account, { skipIPFetch: true });
            
            // Should be a div element
            expect(item.tagName).toBe('DIV');
            expect(item.classList.contains('account-item')).toBe(true);
            
            // Should have data-account-id attribute
            expect(item.dataset.accountId).toBe(account.id);
            
            // Should have required child elements
            expect(item.querySelector('.account-avatar-container')).not.toBeNull();
            expect(item.querySelector('.account-info')).not.toBeNull();
            expect(item.querySelector('.account-actions')).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('createAccountItem produces idempotent structure for same account', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const item1 = SidebarRender.createAccountItem(account, { skipIPFetch: true });
            const item2 = SidebarRender.createAccountItem(account, { skipIPFetch: true });
            
            // Structure should be identical
            expect(item1.className).toBe(item2.className);
            expect(item1.dataset.accountId).toBe(item2.dataset.accountId);
            
            // Child element counts should match
            expect(item1.children.length).toBe(item2.children.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('createAccountItem sets active class correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          fc.boolean(),
          async (account, isActive) => {
            if (isActive) {
              SidebarState.setActiveAccountId(account.id);
            } else {
              SidebarState.setActiveAccountId(null);
            }
            
            const item = SidebarRender.createAccountItem(account, { skipIPFetch: true });
            
            expect(item.classList.contains('active')).toBe(isActive);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('createAccountItem sets loggedin class based on loginStatus', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const item = SidebarRender.createAccountItem(account, { skipIPFetch: true });
            
            if (account.loginStatus === true) {
              expect(item.classList.contains('loggedin')).toBe(true);
            } else {
              expect(item.classList.contains('loggedin')).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 3: User Interaction Equivalence**
   * **Validates: Requirements 4.4**
   * 
   * renderStatusDot should produce correct status classes for all status combinations.
   */
  describe('Property 3: renderStatusDot Status Class Consistency', () => {
    
    test('renderStatusDot always sets exactly one status class', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const dotElement = global.document.createElement('div');
            SidebarRender.renderStatusDot(account, dotElement);
            
            // Should always have status-dot class
            expect(dotElement.classList.contains('status-dot')).toBe(true);
            
            // Should have exactly one status class
            const statusClasses = ['online', 'offline', 'loading', 'error', 'warning'];
            const presentClasses = statusClasses.filter(cls => dotElement.classList.contains(cls));
            
            expect(presentClasses.length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('renderStatusDot is idempotent', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const dotElement1 = global.document.createElement('div');
            const dotElement2 = global.document.createElement('div');
            
            SidebarRender.renderStatusDot(account, dotElement1);
            SidebarRender.renderStatusDot(account, dotElement2);
            
            expect(dotElement1.className).toBe(dotElement2.className);
            expect(dotElement1.title).toBe(dotElement2.title);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('renderStatusDot sets warning class for needs-login state', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            // Force needs-login state
            const testAccount = {
              ...account,
              status: 'offline',
              loginStatus: false,
              hasQRCode: true
            };
            
            const dotElement = global.document.createElement('div');
            SidebarRender.renderStatusDot(testAccount, dotElement);
            
            expect(dotElement.classList.contains('warning')).toBe(true);
            expect(dotElement.title).toBe('需要登录');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('renderStatusDot sets online class for online status', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const testAccount = {
              ...account,
              status: 'online',
              loginStatus: true
            };
            
            const dotElement = global.document.createElement('div');
            SidebarRender.renderStatusDot(testAccount, dotElement);
            
            expect(dotElement.classList.contains('online')).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 3: User Interaction Equivalence**
   * **Validates: Requirements 4.4**
   * 
   * renderQuickActions should produce correct action buttons based on running status.
   */
  describe('Property 3: renderQuickActions Button Consistency', () => {
    
    test('renderQuickActions produces correct button for not_started status', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const testAccount = {
              ...account,
              runningStatus: 'not_started',
              isRunning: false
            };
            
            const actionsEl = global.document.createElement('div');
            SidebarRender.renderQuickActions(testAccount, actionsEl);
            
            const btn = actionsEl.querySelector('.action-btn');
            expect(btn).not.toBeNull();
            expect(btn.classList.contains('start')).toBe(true);
            expect(btn.innerHTML).toBe('▶');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('renderQuickActions produces spinner for loading status', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const testAccount = {
              ...account,
              runningStatus: 'loading',
              isRunning: true
            };
            
            const actionsEl = global.document.createElement('div');
            SidebarRender.renderQuickActions(testAccount, actionsEl);
            
            const spinner = actionsEl.querySelector('.mini-spinner');
            expect(spinner).not.toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('renderQuickActions produces stop button for connected status', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const testAccount = {
              ...account,
              runningStatus: 'connected',
              isRunning: true
            };
            
            const actionsEl = global.document.createElement('div');
            SidebarRender.renderQuickActions(testAccount, actionsEl);
            
            const btn = actionsEl.querySelector('.action-btn');
            expect(btn).not.toBeNull();
            expect(btn.classList.contains('stop')).toBe(true);
            expect(btn.innerHTML).toBe('⏹');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('renderQuickActions produces retry button for error status', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const testAccount = {
              ...account,
              runningStatus: 'error',
              isRunning: false
            };
            
            const actionsEl = global.document.createElement('div');
            SidebarRender.renderQuickActions(testAccount, actionsEl);
            
            const btn = actionsEl.querySelector('.action-btn');
            expect(btn).not.toBeNull();
            expect(btn.classList.contains('retry')).toBe(true);
            expect(btn.innerHTML).toBe('↻');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('renderQuickActions clears previous content', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          runningStatusArbitrary,
          runningStatusArbitrary,
          async (account, status1, status2) => {
            const actionsEl = global.document.createElement('div');
            
            // First render
            const testAccount1 = { ...account, runningStatus: status1, isRunning: status1 !== 'not_started' && status1 !== 'error' };
            SidebarRender.renderQuickActions(testAccount1, actionsEl);
            
            // Second render with different status
            const testAccount2 = { ...account, runningStatus: status2, isRunning: status2 !== 'not_started' && status2 !== 'error' };
            SidebarRender.renderQuickActions(testAccount2, actionsEl);
            
            // Should only have one child (button or spinner)
            expect(actionsEl.children.length).toBe(1);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 3: User Interaction Equivalence**
   * **Validates: Requirements 4.4**
   * 
   * renderUnreadBadge should display correct badge for unread counts.
   */
  describe('Property 3: renderUnreadBadge Display Consistency', () => {
    
    test('renderUnreadBadge shows badge for positive counts', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          fc.integer({ min: 1, max: 99 }),
          async (account, unreadCount) => {
            const testAccount = { ...account, unreadCount };
            const container = global.document.createElement('div');
            
            SidebarRender.renderUnreadBadge(testAccount, container);
            
            const badge = container.querySelector('.unread-badge');
            expect(badge).not.toBeNull();
            expect(badge.textContent).toBe(String(unreadCount));
            expect(badge.style.display).toBe('flex');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('renderUnreadBadge shows 99+ for counts over 99', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          fc.integer({ min: 100, max: 999 }),
          async (account, unreadCount) => {
            const testAccount = { ...account, unreadCount };
            const container = global.document.createElement('div');
            
            SidebarRender.renderUnreadBadge(testAccount, container);
            
            const badge = container.querySelector('.unread-badge');
            expect(badge).not.toBeNull();
            expect(badge.textContent).toBe('99+');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('renderUnreadBadge hides badge for zero count', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const testAccount = { ...account, unreadCount: 0 };
            const container = global.document.createElement('div');
            
            // First add a badge
            const badge = global.document.createElement('div');
            badge.className = 'unread-badge';
            container.appendChild(badge);
            
            SidebarRender.renderUnreadBadge(testAccount, container);
            
            const updatedBadge = container.querySelector('.unread-badge');
            expect(updatedBadge.style.display).toBe('none');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('renderUnreadBadge is idempotent', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          fc.integer({ min: 0, max: 150 }),
          async (account, unreadCount) => {
            const testAccount = { ...account, unreadCount };
            const container1 = global.document.createElement('div');
            const container2 = global.document.createElement('div');
            
            SidebarRender.renderUnreadBadge(testAccount, container1);
            SidebarRender.renderUnreadBadge(testAccount, container2);
            
            const badge1 = container1.querySelector('.unread-badge');
            const badge2 = container2.querySelector('.unread-badge');
            
            if (unreadCount > 0) {
              expect(badge1.textContent).toBe(badge2.textContent);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 3: User Interaction Equivalence**
   * **Validates: Requirements 4.4**
   * 
   * setActiveAccount should correctly update active state in DOM.
   */
  describe('Property 3: setActiveAccount State Consistency', () => {
    
    test('setActiveAccount updates state correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountIdArbitrary,
          async (accountId) => {
            SidebarRender.setActiveAccount(accountId);
            
            expect(SidebarState.getActiveAccountId()).toBe(accountId);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('setActiveAccount updates DOM active class', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountsArrayArbitrary.filter(arr => arr.length >= 2),
          fc.integer({ min: 0 }),
          async (accounts, index) => {
            // Setup accounts in state
            SidebarState.setAccounts(accounts);
            
            // Create account items in DOM
            const accountList = global.document.getElementById('account-list');
            accountList.innerHTML = '';
            accounts.forEach(acc => {
              const item = global.document.createElement('div');
              item.className = 'account-item';
              item.dataset.accountId = acc.id;
              accountList.appendChild(item);
            });
            
            // Set active account
            const targetIndex = index % accounts.length;
            const targetAccount = accounts[targetIndex];
            SidebarRender.setActiveAccount(targetAccount.id);
            
            // Check DOM
            const items = accountList.querySelectorAll('.account-item');
            items.forEach(item => {
              if (item.dataset.accountId === targetAccount.id) {
                expect(item.classList.contains('active')).toBe(true);
              } else {
                expect(item.classList.contains('active')).toBe(false);
              }
            });
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * **Feature: sidebar-modular-refactoring, Property 3: User Interaction Equivalence**
   * **Validates: Requirements 4.4**
   * 
   * applyAccountProfileToItem should update DOM elements correctly.
   */
  describe('Property 3: applyAccountProfileToItem Update Consistency', () => {
    
    test('applyAccountProfileToItem updates name element', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const item = SidebarRender.createAccountItem(account, { skipIPFetch: true });
            
            // Modify account
            const newName = 'Updated Name ' + Math.random();
            account.profileName = newName;
            
            SidebarRender.applyAccountProfileToItem(account, item);
            
            const nameEl = item.querySelector('.account-name');
            expect(nameEl.textContent).toBe(newName);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('applyAccountProfileToItem updates phone element', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          fc.string({ minLength: 5, maxLength: 15 }),
          async (account, newPhone) => {
            const item = SidebarRender.createAccountItem(account, { skipIPFetch: true });
            
            // Modify account
            account.phoneNumber = newPhone;
            
            SidebarRender.applyAccountProfileToItem(account, item);
            
            const phoneEl = item.querySelector('.account-phone');
            expect(phoneEl.textContent).toBe(newPhone);
            expect(phoneEl.style.display).not.toBe('none');
          }
        ),
        { numRuns: 30 }
      );
    });

    test('applyAccountProfileToItem hides phone when empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          accountArbitrary,
          async (account) => {
            const item = SidebarRender.createAccountItem(account, { skipIPFetch: true });
            
            // Remove phone
            account.phoneNumber = undefined;
            
            SidebarRender.applyAccountProfileToItem(account, item);
            
            const phoneEl = item.querySelector('.account-phone');
            expect(phoneEl.style.display).toBe('none');
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
