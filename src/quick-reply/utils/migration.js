/**
 * Data Migration Utilities
 * 
 * Handles version detection and data migration for quick-reply feature.
 * Ensures backward compatibility when data format changes.
 * 
 * Task 20: Data Migration
 */

const StorageError = require('../errors/StorageError');
const { createLogger, getDefaultLogLevel } = require('./logger');

// Create logger instance for migration
const logger = createLogger('migration', getDefaultLogLevel());

// Current data version
const CURRENT_VERSION = '1.0.0';

// Legacy version (before versioning was added)
const LEGACY_VERSION = '0.0.0';

/**
 * Migration registry
 * Maps source version to migration function
 */
const MIGRATIONS = {
  // Legacy (no version) to 1.0.0
  '0.0.0': migrateFrom_0_0_0_to_1_0_0,
  
  // Future migrations can be added here
  // '1.0.0': migrateFrom_1_0_0_to_1_1_0,
  // '1.1.0': migrateFrom_1_1_0_to_2_0_0,
};

/**
 * Detect data version from data object
 * @param {Object} data - Data object to check
 * @returns {string} Version string
 */
function detectVersion(data) {
  if (!data) {
    return LEGACY_VERSION;
  }
  
  // Check if version field exists
  if (data.version) {
    return data.version;
  }
  
  // Legacy data (no version field)
  return LEGACY_VERSION;
}

/**
 * Check if migration is needed
 * @param {string} currentVersion - Current data version
 * @returns {boolean} True if migration is needed
 */
function needsMigration(currentVersion) {
  return currentVersion !== CURRENT_VERSION;
}

/**
 * Get migration path from source version to target version
 * @param {string} sourceVersion - Source version
 * @param {string} targetVersion - Target version (default: CURRENT_VERSION)
 * @returns {Array<string>} Array of versions to migrate through
 */
function getMigrationPath(sourceVersion, targetVersion = CURRENT_VERSION) {
  // For now, we only support direct migrations
  // In the future, this could support multi-step migrations
  
  if (sourceVersion === targetVersion) {
    return [];
  }
  
  // Check if direct migration exists
  if (MIGRATIONS[sourceVersion]) {
    return [sourceVersion];
  }
  
  throw new Error(`No migration path found from ${sourceVersion} to ${targetVersion}`);
}

/**
 * Migrate data from one version to another
 * @param {Object} data - Data to migrate
 * @param {string} sourceVersion - Source version
 * @param {string} targetVersion - Target version (default: CURRENT_VERSION)
 * @returns {Object} Migrated data
 */
function migrateData(data, sourceVersion, targetVersion = CURRENT_VERSION) {
  try {
    logger.info('migration', `Migrating data from ${sourceVersion} to ${targetVersion}`);
    
    if (sourceVersion === targetVersion) {
      logger.info('migration', 'No migration needed');
      return data;
    }
    
    const migrationPath = getMigrationPath(sourceVersion, targetVersion);
    let migratedData = data;
    
    for (const version of migrationPath) {
      const migrationFn = MIGRATIONS[version];
      if (!migrationFn) {
        throw new Error(`Migration function not found for version ${version}`);
      }
      
      logger.info('migration', `Applying migration from ${version}`);
      migratedData = migrationFn(migratedData);
    }
    
    // Set final version
    migratedData.version = targetVersion;
    
    logger.info('migration', 'Migration completed successfully');
    return migratedData;
  } catch (error) {
    logger.error('migration', `Migration failed: ${error.message}`, error);
    throw new StorageError(`Data migration failed: ${error.message}`);
  }
}

/**
 * Migrate templates data from legacy (0.0.0) to 1.0.0
 * @param {Object} data - Legacy data
 * @returns {Object} Migrated data
 */
function migrateFrom_0_0_0_to_1_0_0(data) {
  logger.info('migration', 'Migrating templates from 0.0.0 to 1.0.0');
  
  // Handle case where data is just an array (very old format)
  if (Array.isArray(data)) {
    return {
      version: '1.0.0',
      accountId: 'unknown',
      templates: data.map(migrateTemplate_0_0_0_to_1_0_0),
      updatedAt: Date.now()
    };
  }
  
  // Handle case where data is an object but missing version
  const migratedData = {
    version: '1.0.0',
    accountId: data.accountId || 'unknown',
    templates: [],
    updatedAt: Date.now()
  };
  
  // Migrate templates array if it exists
  if (data.templates && Array.isArray(data.templates)) {
    migratedData.templates = data.templates.map(migrateTemplate_0_0_0_to_1_0_0);
  }
  
  return migratedData;
}

/**
 * Migrate a single template from 0.0.0 to 1.0.0
 * @param {Object} template - Legacy template
 * @returns {Object} Migrated template
 */
function migrateTemplate_0_0_0_to_1_0_0(template) {
  const migrated = { ...template };
  
  // Add missing fields with defaults
  if (!migrated.usageCount) {
    migrated.usageCount = 0;
  }
  
  if (!migrated.lastUsedAt) {
    migrated.lastUsedAt = null;
  }
  
  if (!migrated.createdAt) {
    migrated.createdAt = Date.now();
  }
  
  if (!migrated.updatedAt) {
    migrated.updatedAt = Date.now();
  }
  
  if (!migrated.order && migrated.order !== 0) {
    migrated.order = 0;
  }
  
  return migrated;
}

/**
 * Migrate groups data from legacy (0.0.0) to 1.0.0
 * @param {Object} data - Legacy data
 * @returns {Object} Migrated data
 */
function migrateGroupsFrom_0_0_0_to_1_0_0(data) {
  logger.info('migration', 'Migrating groups from 0.0.0 to 1.0.0');
  
  // Handle case where data is just an array (very old format)
  if (Array.isArray(data)) {
    return {
      version: '1.0.0',
      accountId: 'unknown',
      groups: data.map(migrateGroup_0_0_0_to_1_0_0),
      updatedAt: Date.now()
    };
  }
  
  // Handle case where data is an object but missing version
  const migratedData = {
    version: '1.0.0',
    accountId: data.accountId || 'unknown',
    groups: [],
    updatedAt: Date.now()
  };
  
  // Migrate groups array if it exists
  if (data.groups && Array.isArray(data.groups)) {
    migratedData.groups = data.groups.map(migrateGroup_0_0_0_to_1_0_0);
  }
  
  return migratedData;
}

/**
 * Migrate a single group from 0.0.0 to 1.0.0
 * @param {Object} group - Legacy group
 * @returns {Object} Migrated group
 */
function migrateGroup_0_0_0_to_1_0_0(group) {
  const migrated = { ...group };
  
  // Add missing fields with defaults
  if (!migrated.createdAt) {
    migrated.createdAt = Date.now();
  }
  
  if (!migrated.updatedAt) {
    migrated.updatedAt = Date.now();
  }
  
  if (!migrated.order && migrated.order !== 0) {
    migrated.order = 0;
  }
  
  if (migrated.expanded === undefined) {
    migrated.expanded = true;
  }
  
  return migrated;
}

/**
 * Migrate config data from legacy (0.0.0) to 1.0.0
 * @param {Object} data - Legacy data
 * @returns {Object} Migrated data
 */
function migrateConfigFrom_0_0_0_to_1_0_0(data) {
  logger.info('migration', 'Migrating config from 0.0.0 to 1.0.0');
  
  // Handle case where data is just a config object (very old format)
  if (!data.version && !data.config) {
    return {
      version: '1.0.0',
      accountId: data.accountId || 'unknown',
      config: migrateConfigObject_0_0_0_to_1_0_0(data),
      updatedAt: Date.now()
    };
  }
  
  // Handle case where data has config property but no version
  const migratedData = {
    version: '1.0.0',
    accountId: data.accountId || 'unknown',
    config: {},
    updatedAt: Date.now()
  };
  
  // Migrate config object if it exists
  if (data.config) {
    migratedData.config = migrateConfigObject_0_0_0_to_1_0_0(data.config);
  }
  
  return migratedData;
}

/**
 * Migrate a config object from 0.0.0 to 1.0.0
 * @param {Object} config - Legacy config
 * @returns {Object} Migrated config
 */
function migrateConfigObject_0_0_0_to_1_0_0(config) {
  const migrated = { ...config };
  
  // Add missing fields with defaults
  if (!migrated.sendMode) {
    migrated.sendMode = 'original';
  }
  
  if (!migrated.expandedGroups) {
    migrated.expandedGroups = [];
  }
  
  if (!migrated.lastSelectedGroupId) {
    migrated.lastSelectedGroupId = null;
  }
  
  if (!migrated.createdAt) {
    migrated.createdAt = Date.now();
  }
  
  if (!migrated.updatedAt) {
    migrated.updatedAt = Date.now();
  }
  
  return migrated;
}

/**
 * Validate migrated data structure
 * @param {Object} data - Migrated data
 * @param {string} type - Data type ('templates', 'groups', or 'config')
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
function validateMigratedData(data, type) {
  if (!data) {
    throw new Error('Migrated data is null or undefined');
  }
  
  if (!data.version) {
    throw new Error('Migrated data missing version field');
  }
  
  if (!data.accountId) {
    throw new Error('Migrated data missing accountId field');
  }
  
  switch (type) {
    case 'templates':
      if (!Array.isArray(data.templates)) {
        throw new Error('Migrated templates data must have templates array');
      }
      break;
      
    case 'groups':
      if (!Array.isArray(data.groups)) {
        throw new Error('Migrated groups data must have groups array');
      }
      break;
      
    case 'config':
      if (!data.config || typeof data.config !== 'object') {
        throw new Error('Migrated config data must have config object');
      }
      break;
      
    default:
      throw new Error(`Unknown data type: ${type}`);
  }
  
  return true;
}

/**
 * Create a backup of data before migration
 * @param {Object} data - Data to backup
 * @param {string} storagePath - Original storage path
 * @returns {Promise<string>} Backup file path
 */
async function createBackup(data, storagePath) {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${storagePath}.backup-${timestamp}`;
    
    await fs.writeFile(backupPath, JSON.stringify(data, null, 2), 'utf8');
    
    logger.info('migration', `Backup created at ${backupPath}`);
    return backupPath;
  } catch (error) {
    logger.error('migration', `Failed to create backup: ${error.message}`, error);
    throw new StorageError(`Failed to create backup: ${error.message}`);
  }
}

module.exports = {
  CURRENT_VERSION,
  LEGACY_VERSION,
  detectVersion,
  needsMigration,
  getMigrationPath,
  migrateData,
  migrateFrom_0_0_0_to_1_0_0,
  migrateGroupsFrom_0_0_0_to_1_0_0,
  migrateConfigFrom_0_0_0_to_1_0_0,
  validateMigratedData,
  createBackup
};
