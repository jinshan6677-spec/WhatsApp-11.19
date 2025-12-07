/**
 * State Management Module for Sidebar
 * Manages all sidebar state including accounts, active account, selection mode, etc.
 * 
 * @module sidebar/state
 */

'use strict';

// ============================================================================
// State Variables
// ============================================================================

/** @type {Array<Object>} List of all accounts */
let accounts = [];

/** @type {string|null} Currently active account ID */
let activeAccountId = null;

/** @type {string} Current search/filter query */
let filterQuery = '';

/** @type {number} Render version for preventing race conditions */
let renderVersion = 0;

/** @type {boolean} Whether selection mode is active */
let selectionMode = false;

/** @type {Set<string>} Set of selected account IDs */
let selectedAccountIds = new Set();

// ============================================================================
// State Accessors (Getters)
// ============================================================================

/**
 * Get all accounts
 * @returns {Array<Object>} Copy of accounts array
 */
function getAccounts() {
  return accounts;
}

/**
 * Get the active account ID
 * @returns {string|null} Active account ID or null
 */
function getActiveAccountId() {
  return activeAccountId;
}

/**
 * Get the current filter query
 * @returns {string} Current filter query
 */
function getFilterQuery() {
  return filterQuery;
}

/**
 * Get the current render version
 * @returns {number} Current render version
 */
function getRenderVersion() {
  return renderVersion;
}

/**
 * Check if selection mode is active
 * @returns {boolean} Whether selection mode is active
 */
function isSelectionMode() {
  return selectionMode;
}

/**
 * Get the set of selected account IDs
 * @returns {Set<string>} Set of selected account IDs
 */
function getSelectedAccountIds() {
  return selectedAccountIds;
}

// ============================================================================
// State Mutators (Setters)
// ============================================================================

/**
 * Set the accounts array
 * @param {Array<Object>} newAccounts - New accounts array
 */
function setAccounts(newAccounts) {
  accounts = newAccounts || [];
}

/**
 * Set the active account ID
 * @param {string|null} id - Account ID to set as active
 */
function setActiveAccountId(id) {
  activeAccountId = id;
}

/**
 * Set the filter query
 * @param {string} query - New filter query
 */
function setFilterQuery(query) {
  filterQuery = query || '';
}

/**
 * Increment the render version (for race condition prevention)
 * @returns {number} The new render version
 */
function incrementRenderVersion() {
  return ++renderVersion;
}

/**
 * Toggle selection mode on/off
 * @returns {boolean} New selection mode state
 */
function toggleSelectionModeState() {
  selectionMode = !selectionMode;
  return selectionMode;
}

/**
 * Set selection mode directly
 * @param {boolean} mode - New selection mode state
 */
function setSelectionMode(mode) {
  selectionMode = !!mode;
}

/**
 * Clear all selected accounts
 */
function clearSelectedAccounts() {
  selectedAccountIds.clear();
}

/**
 * Add an account to the selection
 * @param {string} id - Account ID to add
 */
function addSelectedAccount(id) {
  if (id) {
    selectedAccountIds.add(id);
  }
}

/**
 * Remove an account from the selection
 * @param {string} id - Account ID to remove
 */
function removeSelectedAccount(id) {
  selectedAccountIds.delete(id);
}

/**
 * Check if an account is selected
 * @param {string} id - Account ID to check
 * @returns {boolean} Whether the account is selected
 */
function isAccountSelected(id) {
  return selectedAccountIds.has(id);
}

/**
 * Select all accounts
 */
function selectAllAccounts() {
  accounts.forEach(account => {
    selectedAccountIds.add(account.id);
  });
}

// ============================================================================
// Account Operations
// ============================================================================

/**
 * Get an account by ID
 * @param {string} id - Account ID
 * @returns {Object|undefined} Account object or undefined
 */
function getAccountById(id) {
  return accounts.find(acc => acc.id === id);
}

/**
 * Update an account's properties
 * @param {string} id - Account ID
 * @param {Object} updates - Properties to update
 * @returns {Object|null} Updated account or null if not found
 */
function updateAccount(id, updates) {
  const account = accounts.find(acc => acc.id === id);
  if (account && updates) {
    Object.assign(account, updates);
    return account;
  }
  return null;
}

/**
 * Get account name by ID
 * @param {string} accountId - Account ID
 * @returns {string} Account name or '未知账号'
 */
function getAccountName(accountId) {
  const account = accounts.find(acc => acc.id === accountId);
  return account ? (account.name || account.profileName || '未命名') : '未知账号';
}

// ============================================================================
// Exports
// ============================================================================

const stateExports = {
  // Getters
  getAccounts,
  getActiveAccountId,
  getFilterQuery,
  getRenderVersion,
  isSelectionMode,
  getSelectedAccountIds,
  // Setters
  setAccounts,
  setActiveAccountId,
  setFilterQuery,
  incrementRenderVersion,
  toggleSelectionModeState,
  setSelectionMode,
  clearSelectedAccounts,
  addSelectedAccount,
  removeSelectedAccount,
  isAccountSelected,
  selectAllAccounts,
  // Account operations
  getAccountById,
  updateAccount,
  getAccountName
};

// Export for CommonJS (Node.js/testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = stateExports;
}

// Export for browser global (IIFE pattern)
if (typeof window !== 'undefined') {
  window.SidebarState = stateExports;
}
