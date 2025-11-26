'use strict';

const AddProxySecurityFields = require('./AddProxySecurityFields');

/**
 * All available migrations in order
 * @type {Array<Object>}
 */
const migrations = [
  AddProxySecurityFields
];

/**
 * Registers all migrations with a MigrationRunner
 * @param {MigrationRunner} runner - The migration runner instance
 */
function registerAllMigrations(runner) {
  for (const migration of migrations) {
    runner.register(migration);
  }
}

module.exports = {
  migrations,
  registerAllMigrations,
  
  // Export individual migrations
  AddProxySecurityFields
};
