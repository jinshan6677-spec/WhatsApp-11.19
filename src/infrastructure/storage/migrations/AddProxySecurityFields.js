'use strict';

/**
 * Migration: AddProxySecurityFields
 * Version: 2.0.0
 * 
 * Adds security and statistics fields to existing proxy configurations.
 * 
 * New Security Fields:
 * - killSwitchEnabled: boolean (default: true)
 * - verifyIPBeforeConnect: boolean (default: true)
 * - healthCheckInterval: number (default: 30000ms)
 * - maxConsecutiveFailures: number (default: 3)
 * 
 * New Statistics Fields:
 * - connectionCount: number (default: 0)
 * - successCount: number (default: 0)
 * - failureCount: number (default: 0)
 * - lastConnectedAt: Date (default: null)
 * - lastVerifiedIP: string (default: null)
 */

const MIGRATION_VERSION = '2.0.0';
const MIGRATION_DESCRIPTION = 'Add proxy security and statistics fields';

/**
 * Default values for new security fields
 */
const SECURITY_DEFAULTS = {
  killSwitchEnabled: true,
  verifyIPBeforeConnect: true,
  healthCheckInterval: 30000,
  maxConsecutiveFailures: 3
};

/**
 * Default values for new statistics fields
 */
const STATISTICS_DEFAULTS = {
  connectionCount: 0,
  successCount: 0,
  failureCount: 0,
  lastConnectedAt: null,
  lastVerifiedIP: null
};

/**
 * Migrates a single proxy config to include new fields
 * @param {Object} proxyConfig - Original proxy configuration
 * @returns {Object} Migrated proxy configuration
 */
function migrateProxyConfig(proxyConfig) {
  if (!proxyConfig || typeof proxyConfig !== 'object') {
    return proxyConfig;
  }

  return {
    // Preserve all existing fields
    ...proxyConfig,
    
    // Add security fields with defaults (only if not already present)
    killSwitchEnabled: proxyConfig.killSwitchEnabled !== undefined 
      ? proxyConfig.killSwitchEnabled 
      : SECURITY_DEFAULTS.killSwitchEnabled,
    verifyIPBeforeConnect: proxyConfig.verifyIPBeforeConnect !== undefined 
      ? proxyConfig.verifyIPBeforeConnect 
      : SECURITY_DEFAULTS.verifyIPBeforeConnect,
    healthCheckInterval: proxyConfig.healthCheckInterval !== undefined 
      ? proxyConfig.healthCheckInterval 
      : SECURITY_DEFAULTS.healthCheckInterval,
    maxConsecutiveFailures: proxyConfig.maxConsecutiveFailures !== undefined 
      ? proxyConfig.maxConsecutiveFailures 
      : SECURITY_DEFAULTS.maxConsecutiveFailures,
    
    // Add statistics fields with defaults (only if not already present)
    connectionCount: proxyConfig.connectionCount !== undefined 
      ? proxyConfig.connectionCount 
      : STATISTICS_DEFAULTS.connectionCount,
    successCount: proxyConfig.successCount !== undefined 
      ? proxyConfig.successCount 
      : STATISTICS_DEFAULTS.successCount,
    failureCount: proxyConfig.failureCount !== undefined 
      ? proxyConfig.failureCount 
      : STATISTICS_DEFAULTS.failureCount,
    lastConnectedAt: proxyConfig.lastConnectedAt !== undefined 
      ? proxyConfig.lastConnectedAt 
      : STATISTICS_DEFAULTS.lastConnectedAt,
    lastVerifiedIP: proxyConfig.lastVerifiedIP !== undefined 
      ? proxyConfig.lastVerifiedIP 
      : STATISTICS_DEFAULTS.lastVerifiedIP
  };
}

/**
 * Removes the new fields from a proxy config (for rollback)
 * @param {Object} proxyConfig - Migrated proxy configuration
 * @returns {Object} Original proxy configuration without new fields
 */
function rollbackProxyConfig(proxyConfig) {
  if (!proxyConfig || typeof proxyConfig !== 'object') {
    return proxyConfig;
  }

  // Create a copy without the new fields
  const {
    killSwitchEnabled,
    verifyIPBeforeConnect,
    healthCheckInterval,
    maxConsecutiveFailures,
    connectionCount,
    successCount,
    failureCount,
    lastConnectedAt,
    lastVerifiedIP,
    ...originalFields
  } = proxyConfig;

  return originalFields;
}

/**
 * Migration object for MigrationRunner
 */
const AddProxySecurityFieldsMigration = {
  version: MIGRATION_VERSION,
  description: MIGRATION_DESCRIPTION,

  /**
   * Applies the migration
   * @param {Object} context - Migration context containing data
   * @returns {Promise<Object>} Updated context with migrated data
   */
  async up(context) {
    const result = { ...context };
    let migratedCount = 0;

    // Migrate proxy configs in accounts
    if (result.accounts && Array.isArray(result.accounts)) {
      result.accounts = result.accounts.map(account => {
        if (account.proxy) {
          account.proxy = migrateProxyConfig(account.proxy);
          migratedCount++;
        }
        return account;
      });
    }

    // Migrate standalone proxy configs (if stored separately)
    if (result.proxyConfigs && Array.isArray(result.proxyConfigs)) {
      result.proxyConfigs = result.proxyConfigs.map(config => {
        const migrated = migrateProxyConfig(config);
        migratedCount++;
        return migrated;
      });
    }

    // Migrate proxy configs stored as object/map
    if (result.proxyConfigs && typeof result.proxyConfigs === 'object' && !Array.isArray(result.proxyConfigs)) {
      const migratedConfigs = {};
      for (const [key, config] of Object.entries(result.proxyConfigs)) {
        migratedConfigs[key] = migrateProxyConfig(config);
        migratedCount++;
      }
      result.proxyConfigs = migratedConfigs;
    }

    // Add migration metadata
    result._migrationMeta = {
      ...result._migrationMeta,
      addProxySecurityFields: {
        migratedAt: new Date().toISOString(),
        migratedCount,
        version: MIGRATION_VERSION
      }
    };

    return result;
  },

  /**
   * Rolls back the migration
   * @param {Object} context - Migration context containing migrated data
   * @returns {Promise<Object>} Updated context with rolled back data
   */
  async down(context) {
    const result = { ...context };
    let rolledBackCount = 0;

    // Rollback proxy configs in accounts
    if (result.accounts && Array.isArray(result.accounts)) {
      result.accounts = result.accounts.map(account => {
        if (account.proxy) {
          account.proxy = rollbackProxyConfig(account.proxy);
          rolledBackCount++;
        }
        return account;
      });
    }

    // Rollback standalone proxy configs (if stored separately)
    if (result.proxyConfigs && Array.isArray(result.proxyConfigs)) {
      result.proxyConfigs = result.proxyConfigs.map(config => {
        const rolledBack = rollbackProxyConfig(config);
        rolledBackCount++;
        return rolledBack;
      });
    }

    // Rollback proxy configs stored as object/map
    if (result.proxyConfigs && typeof result.proxyConfigs === 'object' && !Array.isArray(result.proxyConfigs)) {
      const rolledBackConfigs = {};
      for (const [key, config] of Object.entries(result.proxyConfigs)) {
        rolledBackConfigs[key] = rollbackProxyConfig(config);
        rolledBackCount++;
      }
      result.proxyConfigs = rolledBackConfigs;
    }

    // Remove migration metadata
    if (result._migrationMeta && result._migrationMeta.addProxySecurityFields) {
      delete result._migrationMeta.addProxySecurityFields;
    }

    return result;
  }
};

// Export migration and helper functions
module.exports = AddProxySecurityFieldsMigration;
module.exports.migrateProxyConfig = migrateProxyConfig;
module.exports.rollbackProxyConfig = rollbackProxyConfig;
module.exports.SECURITY_DEFAULTS = SECURITY_DEFAULTS;
module.exports.STATISTICS_DEFAULTS = STATISTICS_DEFAULTS;
