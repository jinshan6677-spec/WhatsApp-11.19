'use strict';

const Account = require('./Account');
const ProxyConfig = require('./ProxyConfig');
const TranslationConfig = require('./TranslationConfig');
const ProxyConnectionStatus = require('./ProxyConnectionStatus');
const ProxyHealthStats = require('./ProxyHealthStats');

module.exports = {
  Account,
  ProxyConfig,
  TranslationConfig,
  ProxyConnectionStatus,
  ProxyHealthStats,
  
  // Re-export enums for convenience
  AccountStatus: Account.Status,
  ProxyProtocol: ProxyConfig.Protocol,
  ProxySecurityDefaults: ProxyConfig.SecurityDefaults,
  ConnectionState: ProxyConnectionStatus.State,
  HealthStatus: ProxyHealthStats.Status,
  TranslationEngine: TranslationConfig.Engine,
  TranslationStyle: TranslationConfig.Style
};
