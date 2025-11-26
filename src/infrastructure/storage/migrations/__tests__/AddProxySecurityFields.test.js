'use strict';

/**
 * Unit tests for AddProxySecurityFields migration
 * 
 * Validates that the migration correctly adds security and statistics fields
 * to existing proxy configurations.
 * 
 * **Validates: Requirements 4.5, 12**
 */

const AddProxySecurityFieldsMigration = require('../AddProxySecurityFields');
const {
  migrateProxyConfig,
  rollbackProxyConfig,
  SECURITY_DEFAULTS,
  STATISTICS_DEFAULTS
} = AddProxySecurityFieldsMigration;

describe('AddProxySecurityFields Migration', () => {
  describe('migrateProxyConfig', () => {
    test('adds all security fields with defaults to legacy proxy config', () => {
      const legacyConfig = {
        id: 'proxy-1',
        enabled: true,
        protocol: 'socks5',
        host: '127.0.0.1',
        port: 1080,
        username: 'user',
        password: 'pass',
        name: 'Test Proxy'
      };

      const migrated = migrateProxyConfig(legacyConfig);

      // Verify security fields are added with defaults
      expect(migrated.killSwitchEnabled).toBe(SECURITY_DEFAULTS.killSwitchEnabled);
      expect(migrated.verifyIPBeforeConnect).toBe(SECURITY_DEFAULTS.verifyIPBeforeConnect);
      expect(migrated.healthCheckInterval).toBe(SECURITY_DEFAULTS.healthCheckInterval);
      expect(migrated.maxConsecutiveFailures).toBe(SECURITY_DEFAULTS.maxConsecutiveFailures);

      // Verify statistics fields are added with defaults
      expect(migrated.connectionCount).toBe(STATISTICS_DEFAULTS.connectionCount);
      expect(migrated.successCount).toBe(STATISTICS_DEFAULTS.successCount);
      expect(migrated.failureCount).toBe(STATISTICS_DEFAULTS.failureCount);
      expect(migrated.lastConnectedAt).toBe(STATISTICS_DEFAULTS.lastConnectedAt);
      expect(migrated.lastVerifiedIP).toBe(STATISTICS_DEFAULTS.lastVerifiedIP);

      // Verify original fields are preserved
      expect(migrated.id).toBe(legacyConfig.id);
      expect(migrated.enabled).toBe(legacyConfig.enabled);
      expect(migrated.protocol).toBe(legacyConfig.protocol);
      expect(migrated.host).toBe(legacyConfig.host);
      expect(migrated.port).toBe(legacyConfig.port);
      expect(migrated.username).toBe(legacyConfig.username);
      expect(migrated.password).toBe(legacyConfig.password);
      expect(migrated.name).toBe(legacyConfig.name);
    });

    test('preserves existing security fields if already present', () => {
      const configWithSecurity = {
        id: 'proxy-2',
        enabled: true,
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        killSwitchEnabled: false,
        verifyIPBeforeConnect: false,
        healthCheckInterval: 60000,
        maxConsecutiveFailures: 5
      };

      const migrated = migrateProxyConfig(configWithSecurity);

      // Verify existing security fields are preserved
      expect(migrated.killSwitchEnabled).toBe(false);
      expect(migrated.verifyIPBeforeConnect).toBe(false);
      expect(migrated.healthCheckInterval).toBe(60000);
      expect(migrated.maxConsecutiveFailures).toBe(5);

      // Verify statistics fields are added with defaults
      expect(migrated.connectionCount).toBe(0);
      expect(migrated.successCount).toBe(0);
      expect(migrated.failureCount).toBe(0);
    });

    test('handles null or undefined input gracefully', () => {
      expect(migrateProxyConfig(null)).toBeNull();
      expect(migrateProxyConfig(undefined)).toBeUndefined();
    });

    test('handles non-object input gracefully', () => {
      expect(migrateProxyConfig('string')).toBe('string');
      expect(migrateProxyConfig(123)).toBe(123);
    });
  });

  describe('rollbackProxyConfig', () => {
    test('removes all new fields from migrated config', () => {
      const migratedConfig = {
        id: 'proxy-1',
        enabled: true,
        protocol: 'socks5',
        host: '127.0.0.1',
        port: 1080,
        username: 'user',
        password: 'pass',
        name: 'Test Proxy',
        // Security fields
        killSwitchEnabled: true,
        verifyIPBeforeConnect: true,
        healthCheckInterval: 30000,
        maxConsecutiveFailures: 3,
        // Statistics fields
        connectionCount: 10,
        successCount: 8,
        failureCount: 2,
        lastConnectedAt: '2024-01-01T00:00:00.000Z',
        lastVerifiedIP: '1.2.3.4'
      };

      const rolledBack = rollbackProxyConfig(migratedConfig);

      // Verify new fields are removed
      expect(rolledBack.killSwitchEnabled).toBeUndefined();
      expect(rolledBack.verifyIPBeforeConnect).toBeUndefined();
      expect(rolledBack.healthCheckInterval).toBeUndefined();
      expect(rolledBack.maxConsecutiveFailures).toBeUndefined();
      expect(rolledBack.connectionCount).toBeUndefined();
      expect(rolledBack.successCount).toBeUndefined();
      expect(rolledBack.failureCount).toBeUndefined();
      expect(rolledBack.lastConnectedAt).toBeUndefined();
      expect(rolledBack.lastVerifiedIP).toBeUndefined();

      // Verify original fields are preserved
      expect(rolledBack.id).toBe(migratedConfig.id);
      expect(rolledBack.enabled).toBe(migratedConfig.enabled);
      expect(rolledBack.protocol).toBe(migratedConfig.protocol);
      expect(rolledBack.host).toBe(migratedConfig.host);
      expect(rolledBack.port).toBe(migratedConfig.port);
      expect(rolledBack.username).toBe(migratedConfig.username);
      expect(rolledBack.password).toBe(migratedConfig.password);
      expect(rolledBack.name).toBe(migratedConfig.name);
    });

    test('handles null or undefined input gracefully', () => {
      expect(rollbackProxyConfig(null)).toBeNull();
      expect(rollbackProxyConfig(undefined)).toBeUndefined();
    });
  });

  describe('Migration up()', () => {
    test('migrates proxy configs in accounts array', async () => {
      const context = {
        accounts: [
          {
            id: 'account-1',
            name: 'Account 1',
            proxy: {
              id: 'proxy-1',
              enabled: true,
              protocol: 'socks5',
              host: '127.0.0.1',
              port: 1080
            }
          },
          {
            id: 'account-2',
            name: 'Account 2',
            proxy: null
          }
        ]
      };

      const result = await AddProxySecurityFieldsMigration.up(context);

      // Verify first account's proxy is migrated
      expect(result.accounts[0].proxy.killSwitchEnabled).toBe(true);
      expect(result.accounts[0].proxy.connectionCount).toBe(0);

      // Verify second account without proxy is unchanged
      expect(result.accounts[1].proxy).toBeNull();

      // Verify migration metadata
      expect(result._migrationMeta.addProxySecurityFields).toBeDefined();
      expect(result._migrationMeta.addProxySecurityFields.migratedCount).toBe(1);
    });

    test('migrates standalone proxyConfigs array', async () => {
      const context = {
        proxyConfigs: [
          { id: 'proxy-1', host: '127.0.0.1', port: 1080, protocol: 'socks5' },
          { id: 'proxy-2', host: '192.168.1.1', port: 8080, protocol: 'http' }
        ]
      };

      const result = await AddProxySecurityFieldsMigration.up(context);

      expect(result.proxyConfigs[0].killSwitchEnabled).toBe(true);
      expect(result.proxyConfigs[0].connectionCount).toBe(0);
      expect(result.proxyConfigs[1].killSwitchEnabled).toBe(true);
      expect(result.proxyConfigs[1].connectionCount).toBe(0);
      expect(result._migrationMeta.addProxySecurityFields.migratedCount).toBe(2);
    });

    test('migrates proxyConfigs stored as object/map', async () => {
      const context = {
        proxyConfigs: {
          'proxy-1': { id: 'proxy-1', host: '127.0.0.1', port: 1080, protocol: 'socks5' },
          'proxy-2': { id: 'proxy-2', host: '192.168.1.1', port: 8080, protocol: 'http' }
        }
      };

      const result = await AddProxySecurityFieldsMigration.up(context);

      expect(result.proxyConfigs['proxy-1'].killSwitchEnabled).toBe(true);
      expect(result.proxyConfigs['proxy-2'].connectionCount).toBe(0);
      expect(result._migrationMeta.addProxySecurityFields.migratedCount).toBe(2);
    });
  });

  describe('Migration down()', () => {
    test('rolls back proxy configs in accounts array', async () => {
      const context = {
        accounts: [
          {
            id: 'account-1',
            name: 'Account 1',
            proxy: {
              id: 'proxy-1',
              enabled: true,
              protocol: 'socks5',
              host: '127.0.0.1',
              port: 1080,
              killSwitchEnabled: true,
              connectionCount: 5
            }
          }
        ],
        _migrationMeta: {
          addProxySecurityFields: {
            migratedAt: '2024-01-01T00:00:00.000Z',
            migratedCount: 1
          }
        }
      };

      const result = await AddProxySecurityFieldsMigration.down(context);

      // Verify new fields are removed
      expect(result.accounts[0].proxy.killSwitchEnabled).toBeUndefined();
      expect(result.accounts[0].proxy.connectionCount).toBeUndefined();

      // Verify original fields are preserved
      expect(result.accounts[0].proxy.id).toBe('proxy-1');
      expect(result.accounts[0].proxy.host).toBe('127.0.0.1');

      // Verify migration metadata is removed
      expect(result._migrationMeta.addProxySecurityFields).toBeUndefined();
    });
  });

  describe('Round-trip consistency', () => {
    test('up then down restores original proxy config structure', async () => {
      const originalContext = {
        accounts: [
          {
            id: 'account-1',
            name: 'Account 1',
            proxy: {
              id: 'proxy-1',
              enabled: true,
              protocol: 'socks5',
              host: '127.0.0.1',
              port: 1080,
              username: 'user',
              password: 'pass',
              bypass: 'localhost',
              name: 'Test Proxy',
              createdAt: '2024-01-01T00:00:00.000Z',
              lastUsedAt: '2024-01-02T00:00:00.000Z'
            }
          }
        ]
      };

      // Apply migration
      const migrated = await AddProxySecurityFieldsMigration.up(JSON.parse(JSON.stringify(originalContext)));
      
      // Verify migration added fields
      expect(migrated.accounts[0].proxy.killSwitchEnabled).toBe(true);
      expect(migrated.accounts[0].proxy.connectionCount).toBe(0);

      // Rollback migration
      const rolledBack = await AddProxySecurityFieldsMigration.down(migrated);

      // Verify original structure is restored
      const originalProxy = originalContext.accounts[0].proxy;
      const restoredProxy = rolledBack.accounts[0].proxy;

      expect(restoredProxy.id).toBe(originalProxy.id);
      expect(restoredProxy.enabled).toBe(originalProxy.enabled);
      expect(restoredProxy.protocol).toBe(originalProxy.protocol);
      expect(restoredProxy.host).toBe(originalProxy.host);
      expect(restoredProxy.port).toBe(originalProxy.port);
      expect(restoredProxy.username).toBe(originalProxy.username);
      expect(restoredProxy.password).toBe(originalProxy.password);
      expect(restoredProxy.bypass).toBe(originalProxy.bypass);
      expect(restoredProxy.name).toBe(originalProxy.name);
      expect(restoredProxy.createdAt).toBe(originalProxy.createdAt);
      expect(restoredProxy.lastUsedAt).toBe(originalProxy.lastUsedAt);

      // Verify new fields are removed
      expect(restoredProxy.killSwitchEnabled).toBeUndefined();
      expect(restoredProxy.verifyIPBeforeConnect).toBeUndefined();
      expect(restoredProxy.healthCheckInterval).toBeUndefined();
      expect(restoredProxy.maxConsecutiveFailures).toBeUndefined();
      expect(restoredProxy.connectionCount).toBeUndefined();
      expect(restoredProxy.successCount).toBeUndefined();
      expect(restoredProxy.failureCount).toBeUndefined();
      expect(restoredProxy.lastConnectedAt).toBeUndefined();
      expect(restoredProxy.lastVerifiedIP).toBeUndefined();
    });
  });

  describe('Default values verification', () => {
    test('SECURITY_DEFAULTS has correct values', () => {
      expect(SECURITY_DEFAULTS.killSwitchEnabled).toBe(true);
      expect(SECURITY_DEFAULTS.verifyIPBeforeConnect).toBe(true);
      expect(SECURITY_DEFAULTS.healthCheckInterval).toBe(30000);
      expect(SECURITY_DEFAULTS.maxConsecutiveFailures).toBe(3);
    });

    test('STATISTICS_DEFAULTS has correct values', () => {
      expect(STATISTICS_DEFAULTS.connectionCount).toBe(0);
      expect(STATISTICS_DEFAULTS.successCount).toBe(0);
      expect(STATISTICS_DEFAULTS.failureCount).toBe(0);
      expect(STATISTICS_DEFAULTS.lastConnectedAt).toBeNull();
      expect(STATISTICS_DEFAULTS.lastVerifiedIP).toBeNull();
    });
  });
});
