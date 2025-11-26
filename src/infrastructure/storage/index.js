'use strict';

const MigrationRunner = require('./MigrationRunner');
const migrations = require('./migrations');

module.exports = {
  MigrationRunner,
  migrations,
  
  // Re-export individual migrations for convenience
  AddProxySecurityFieldsMigration: migrations.AddProxySecurityFields
};
