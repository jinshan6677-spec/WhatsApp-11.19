'use strict';

const Account = require('./Account');
const TranslationConfig = require('./TranslationConfig');

// TypeScript entities (will be compiled to JS)
let FingerprintProfile;
try {
  FingerprintProfile = require('./FingerprintProfile').FingerprintProfile;
  
} catch (e) {
  // TypeScript files not yet compiled
}

  module.exports = {
    Account,
    TranslationConfig,
    FingerprintProfile,
  
  // Re-export enums for convenience
    AccountStatus: Account.Status,
    TranslationEngine: TranslationConfig.Engine,
    TranslationStyle: TranslationConfig.Style
  };
