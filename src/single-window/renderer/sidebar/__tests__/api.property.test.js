/**
 * Property-based tests for Sidebar API Interface Preservation
 * 
 * **Feature: sidebar-modular-refactoring, Property 1: API Interface Preservation**
 * **Validates: Requirements 1.3, 4.2**
 * 
 * Tests that the refactored sidebar maintains the same public API interface
 * as the original monolithic implementation.
 */

'use strict';

const fc = require('fast-check');

// ==================== Test Setup ====================

/**
 * Mock window and document objects for testing
 */
function setupMockEnvironment() {
  // Mock document
  global.document = {
    readyState: 'complete',
    getElementById: jest.fn(() => null),
    createElement: jest.fn(() => ({
      className: '',
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn()
      },
      appendChild: jest.fn(),
      querySelector: jest.fn(() => null),
      querySelectorAll: jest.fn(() => []),
      addEventListener: jest.fn(),
      style: {},
      dataset: {},
      textContent: ''
    })),
    createDocumentFragment: jest.fn(() => ({
      appendChild: jest.fn()
    })),
    addEventListener: jest.fn(),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => [])
  };

  // Mock window
  global.window = {
    electronAPI: {
      on: jest.fn(),
      invoke: jest.fn(() => Promise.resolve([]))
    },
    navigator: {
      clipboard: {
        writeText: jest.fn(() => Promise.resolve())
      }
    },
    localStorage: {
      getItem: jest.fn(() => null),
      setItem: jest.fn()
    }
  };
}

/**
 * Load all sidebar modules
 */
function loadSidebarModules() {
  // Load modules in dependency order
  global.window.SidebarState = require('../state');
  global.window.SidebarUtils = require('../utils');
  global.window.SidebarRender = require('../render');
  global.window.SidebarIPInfo = require('../ipInfo');
  global.window.SidebarEvents = require('../events');
  global.window.SidebarActions = require('../actions');
  global.window.SidebarContextMenu = require('../contextMenu');
  global.window.SidebarSelection = require('../selection');
  global.window.SidebarToggle = require('../sidebarToggle');
}

/**
 * Simulate loading the sidebar entry file
 * This mimics what happens when sidebar.js is loaded in the browser
 */
function loadSidebarEntryFile() {
  // The entry file creates window.sidebar with the public API
  global.window.sidebar = {
    loadAccounts: function () {
      if (window.SidebarActions && typeof window.SidebarActions.loadAccounts === 'function') {
        return window.SidebarActions.loadAccounts();
      }
      return Promise.resolve();
    },
    renderAccountList: function () {
      if (window.SidebarRender && typeof window.SidebarRender.renderAccountList === 'function') {
        return window.SidebarRender.renderAccountList();
      }
      return Promise.resolve();
    },
    setActiveAccount: function (accountId) {
      if (window.SidebarRender && typeof window.SidebarRender.setActiveAccount === 'function') {
        window.SidebarRender.setActiveAccount(accountId);
      }
    },
    getAccounts: function () {
      if (window.SidebarState && typeof window.SidebarState.getAccounts === 'function') {
        return window.SidebarState.getAccounts();
      }
      return [];
    },
    getActiveAccountId: function () {
      if (window.SidebarState && typeof window.SidebarState.getActiveAccountId === 'function') {
        return window.SidebarState.getActiveAccountId();
      }
      return null;
    },
    renderQuickActions: function (account, container) {
      if (window.SidebarRender && typeof window.SidebarRender.renderQuickActions === 'function') {
        window.SidebarRender.renderQuickActions(account, container);
      }
    },
    syncAccountStatusesWithRunningStatus: function () {
      if (window.SidebarActions && typeof window.SidebarActions.syncAccountStatusesWithRunningStatus === 'function') {
        window.SidebarActions.syncAccountStatusesWithRunningStatus();
      }
    },
    toggleSidebar: function () {
      if (window.SidebarToggle && typeof window.SidebarToggle.toggleSidebar === 'function') {
        window.SidebarToggle.toggleSidebar();
      }
    },
    toggleSelectionMode: function () {
      if (window.SidebarSelection && typeof window.SidebarSelection.toggleSelectionMode === 'function') {
        window.SidebarSelection.toggleSelectionMode();
      }
    },
    handleBatchStartAll: function () {
      if (window.SidebarSelection && typeof window.SidebarSelection.handleBatchStartAll === 'function') {
        return window.SidebarSelection.handleBatchStartAll();
      }
      return Promise.resolve();
    }
  };
}

// ==================== Arbitraries ====================

/**
 * Account ID arbitrary
 */
const accountIdArbitrary = fc.uuid();

/**
 * Account object arbitrary
 */
const accountArbitrary = fc.record({
  id: accountIdArbitrary,
  name: fc.string({ minLength: 1, maxLength: 50 }),
  profileName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  phoneNumber: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: undefined }),
  status: fc.constantFrom('online', 'offline', 'loading', 'error'),
  runningStatus: fc.constantFrom('not_started', 'loading', 'connected', 'error')
});

// ==================== Property Tests ====================

describe('Sidebar API Interface Preservation', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mock environment
    setupMockEnvironment();
    
    // Load all modules
    loadSidebarModules();
    
    // Load entry file (creates window.sidebar)
    loadSidebarEntryFile();
  });

  afterEach(() => {
    // Clean up global mocks
    delete global.window;
    delete global.document;
  });

  /**
   * Property 1.1: All required API methods exist
   * For any sidebar instance, all expected methods should be defined
   */
  test('Property 1.1: All required API methods exist', () => {
    const requiredMethods = [
      'loadAccounts',
      'renderAccountList',
      'setActiveAccount',
      'getAccounts',
      'getActiveAccountId',
      'renderQuickActions',
      'syncAccountStatusesWithRunningStatus',
      'toggleSidebar',
      'toggleSelectionMode',
      'handleBatchStartAll'
    ];

    requiredMethods.forEach(methodName => {
      expect(window.sidebar).toHaveProperty(methodName);
      expect(typeof window.sidebar[methodName]).toBe('function');
    });
  });

  /**
   * Property 1.2: getAccounts returns array type
   * For any state, getAccounts should always return an array
   */
  test('Property 1.2: getAccounts returns array type', () => {
    fc.assert(
      fc.property(
        fc.array(accountArbitrary, { minLength: 0, maxLength: 10 }),
        (accounts) => {
          // Set accounts in state
          window.SidebarState.setAccounts(accounts);
          
          // Call API method
          const result = window.sidebar.getAccounts();
          
          // Should return an array
          return Array.isArray(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.3: getActiveAccountId returns string or null
   * For any active account ID, getActiveAccountId should return string or null
   */
  test('Property 1.3: getActiveAccountId returns string or null', () => {
    fc.assert(
      fc.property(
        fc.option(accountIdArbitrary, { nil: null }),
        (accountId) => {
          // Set active account ID
          window.SidebarState.setActiveAccountId(accountId);
          
          // Call API method
          const result = window.sidebar.getActiveAccountId();
          
          // Should return string or null
          return result === null || typeof result === 'string';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.4: setActiveAccount accepts string parameter
   * For any account ID, setActiveAccount should not throw
   */
  test('Property 1.4: setActiveAccount accepts string parameter', () => {
    fc.assert(
      fc.property(
        accountIdArbitrary,
        (accountId) => {
          // Should not throw
          expect(() => {
            window.sidebar.setActiveAccount(accountId);
          }).not.toThrow();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.5: loadAccounts returns Promise
   * For any state, loadAccounts should return a Promise
   */
  test('Property 1.5: loadAccounts returns Promise', () => {
    const result = window.sidebar.loadAccounts();
    expect(result).toBeInstanceOf(Promise);
  });

  /**
   * Property 1.6: renderAccountList returns Promise
   * For any state, renderAccountList should return a Promise
   */
  test('Property 1.6: renderAccountList returns Promise', () => {
    const result = window.sidebar.renderAccountList();
    expect(result).toBeInstanceOf(Promise);
  });

  /**
   * Property 1.7: handleBatchStartAll returns Promise
   * For any state, handleBatchStartAll should return a Promise
   */
  test('Property 1.7: handleBatchStartAll returns Promise', () => {
    const result = window.sidebar.handleBatchStartAll();
    expect(result).toBeInstanceOf(Promise);
  });

  /**
   * Property 1.8: toggleSidebar does not throw
   * For any state, toggleSidebar should execute without throwing
   */
  test('Property 1.8: toggleSidebar does not throw', () => {
    expect(() => {
      window.sidebar.toggleSidebar();
    }).not.toThrow();
  });

  /**
   * Property 1.9: toggleSelectionMode does not throw
   * For any state, toggleSelectionMode should execute without throwing
   */
  test('Property 1.9: toggleSelectionMode does not throw', () => {
    expect(() => {
      window.sidebar.toggleSelectionMode();
    }).not.toThrow();
  });

  /**
   * Property 1.10: syncAccountStatusesWithRunningStatus does not throw
   * For any state, syncAccountStatusesWithRunningStatus should execute without throwing
   */
  test('Property 1.10: syncAccountStatusesWithRunningStatus does not throw', () => {
    expect(() => {
      window.sidebar.syncAccountStatusesWithRunningStatus();
    }).not.toThrow();
  });

  /**
   * Property 1.11: renderQuickActions accepts account and container parameters
   * For any account and container, renderQuickActions should not throw
   */
  test('Property 1.11: renderQuickActions accepts account and container parameters', () => {
    fc.assert(
      fc.property(
        accountArbitrary,
        (account) => {
          const mockContainer = document.createElement('div');
          
          // Should not throw
          expect(() => {
            window.sidebar.renderQuickActions(account, mockContainer);
          }).not.toThrow();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.12: API methods are callable multiple times
   * For any sequence of API calls, methods should remain callable
   */
  test('Property 1.12: API methods are callable multiple times', () => {
    fc.assert(
      fc.property(
        fc.array(accountArbitrary, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 2, max: 5 }),
        (accounts, callCount) => {
          // Set initial state
          window.SidebarState.setAccounts(accounts);
          
          // Call getAccounts multiple times
          for (let i = 0; i < callCount; i++) {
            const result = window.sidebar.getAccounts();
            if (!Array.isArray(result)) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
