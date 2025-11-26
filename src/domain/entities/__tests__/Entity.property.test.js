'use strict';

/**
 * Property-based tests for Domain Entities
 * 
 * Tests the following property:
 * - Property 14: Data Model Round-Trip
 * 
 * **Feature: architecture-refactoring, Property 14: Data Model Round-Trip**
 * **Validates: Requirements 4.6**
 * 
 * For any data model entity (Account, ProxyConfig, TranslationConfig),
 * converting to JSON and back should produce an equivalent entity.
 */

const fc = require('fast-check');
const Account = require('../Account');
const ProxyConfig = require('../ProxyConfig');
const TranslationConfig = require('../TranslationConfig');

describe('Domain Entity Property Tests', () => {
  // ==================== Arbitraries ====================

  // Account Status arbitrary
  const accountStatusArbitrary = fc.constantFrom(
    Account.Status.Inactive,
    Account.Status.Loading,
    Account.Status.Active,
    Account.Status.Error
  );

  // Proxy Protocol arbitrary
  const proxyProtocolArbitrary = fc.constantFrom(
    ProxyConfig.Protocol.HTTP,
    ProxyConfig.Protocol.HTTPS,
    ProxyConfig.Protocol.SOCKS5
  );

  // Translation Engine arbitrary
  const translationEngineArbitrary = fc.constantFrom(
    TranslationConfig.Engine.Google,
    TranslationConfig.Engine.GPT4,
    TranslationConfig.Engine.Gemini,
    TranslationConfig.Engine.DeepSeek,
    TranslationConfig.Engine.Custom
  );

  // Translation Style arbitrary
  const translationStyleArbitrary = fc.constantFrom(
    TranslationConfig.Style.General,
    TranslationConfig.Style.Formal,
    TranslationConfig.Style.Casual,
    TranslationConfig.Style.Friendly,
    TranslationConfig.Style.Humorous,
    TranslationConfig.Style.Polite,
    TranslationConfig.Style.Firm,
    TranslationConfig.Style.Concise,
    TranslationConfig.Style.Motivational,
    TranslationConfig.Style.Neutral,
    TranslationConfig.Style.Professional
  );

  // Date arbitrary (within reasonable range, always valid)
  const dateArbitrary = fc.integer({
    min: new Date('2020-01-01').getTime(),
    max: new Date('2030-12-31').getTime()
  }).map(ts => new Date(ts));

  // Optional string arbitrary
  const optionalStringArbitrary = fc.option(
    fc.string({ minLength: 1, maxLength: 50 }),
    { nil: null }
  );

  // Account arbitrary
  const accountArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    phoneNumber: optionalStringArbitrary,
    status: accountStatusArbitrary,
    autoStart: fc.boolean(),
    createdAt: dateArbitrary,
    lastActiveAt: fc.option(dateArbitrary, { nil: null }),
    proxyId: optionalStringArbitrary,
    translationConfigId: optionalStringArbitrary,
    sessionDir: fc.string({ minLength: 1, maxLength: 100 }).map(s => `session-data/${s}`),
    profileName: optionalStringArbitrary,
    avatarUrl: optionalStringArbitrary,
    note: fc.string({ minLength: 0, maxLength: 200 }),
    order: fc.integer({ min: 0, max: 1000 })
  });

  // ProxyConfig arbitrary
  const proxyConfigArbitrary = fc.record({
    id: fc.uuid(),
    enabled: fc.boolean(),
    protocol: proxyProtocolArbitrary,
    host: fc.domain().map(d => d.substring(0, 255)),
    port: fc.integer({ min: 1, max: 65535 }),
    username: optionalStringArbitrary,
    password: optionalStringArbitrary,
    bypass: optionalStringArbitrary,
    name: fc.string({ minLength: 1, maxLength: 100 }),
    createdAt: dateArbitrary,
    lastUsedAt: fc.option(dateArbitrary, { nil: null })
  });

  // Friend settings arbitrary
  const friendSettingsArbitrary = fc.dictionary(
    fc.uuid(),
    fc.record({
      enabled: fc.boolean(),
      targetLanguage: fc.string({ minLength: 2, maxLength: 10 })
    }),
    { minKeys: 0, maxKeys: 5 }
  );

  // TranslationConfig arbitrary
  const translationConfigArbitrary = fc.record({
    id: fc.uuid(),
    enabled: fc.boolean(),
    engine: translationEngineArbitrary,
    apiKey: optionalStringArbitrary,
    targetLanguage: fc.string({ minLength: 2, maxLength: 10 }),
    sourceLanguage: fc.option(fc.string({ minLength: 2, maxLength: 10 }), { nil: null }),
    autoTranslate: fc.boolean(),
    translateInput: fc.boolean(),
    inputStyle: translationStyleArbitrary,
    friendSettings: friendSettingsArbitrary,
    createdAt: dateArbitrary,
    updatedAt: dateArbitrary
  });


  /**
   * **Feature: architecture-refactoring, Property 14: Data Model Round-Trip**
   * **Validates: Requirements 4.6**
   * 
   * For any data model entity (Account, ProxyConfig, TranslationConfig),
   * converting to JSON and back should produce an equivalent entity.
   */
  describe('Property 14: Data Model Round-Trip', () => {
    
    describe('Account Entity', () => {
      test('Account toJSON/fromJSON round-trip preserves all data', () => {
        fc.assert(
          fc.property(
            accountArbitrary,
            (accountData) => {
              // Create account from arbitrary data
              const account = new Account(accountData);
              
              // Convert to JSON
              const json = account.toJSON();
              
              // Reconstruct from JSON
              const restored = Account.fromJSON(json);
              
              // Convert restored to JSON for comparison
              const restoredJson = restored.toJSON();
              
              // Should be equivalent
              expect(restoredJson).toEqual(json);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Account double round-trip produces identical JSON', () => {
        fc.assert(
          fc.property(
            accountArbitrary,
            (accountData) => {
              const account = new Account(accountData);
              
              // First round-trip
              const json1 = account.toJSON();
              const restored1 = Account.fromJSON(json1);
              
              // Second round-trip
              const json2 = restored1.toJSON();
              const restored2 = Account.fromJSON(json2);
              const json3 = restored2.toJSON();
              
              // All JSON representations should be identical
              expect(json2).toEqual(json1);
              expect(json3).toEqual(json1);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Account JSON serialization is valid JSON string', () => {
        fc.assert(
          fc.property(
            accountArbitrary,
            (accountData) => {
              const account = new Account(accountData);
              const json = account.toJSON();
              
              // Should be serializable to JSON string
              const jsonString = JSON.stringify(json);
              expect(typeof jsonString).toBe('string');
              
              // Should be parseable back
              const parsed = JSON.parse(jsonString);
              expect(parsed).toEqual(json);
              
              // Should be reconstructable from parsed JSON
              const restored = Account.fromJSON(parsed);
              expect(restored.toJSON()).toEqual(json);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Account prettyPrint produces non-empty string', () => {
        fc.assert(
          fc.property(
            accountArbitrary,
            (accountData) => {
              const account = new Account(accountData);
              const pretty = Account.prettyPrint(account);
              
              expect(typeof pretty).toBe('string');
              expect(pretty.length).toBeGreaterThan(0);
              expect(pretty).toContain('ACCOUNT');
            }
          ),
          { numRuns: 100 }
        );
      });
    });


    describe('ProxyConfig Entity', () => {
      test('ProxyConfig toJSON/fromJSON round-trip preserves all data', () => {
        fc.assert(
          fc.property(
            proxyConfigArbitrary,
            (proxyData) => {
              // Create proxy config from arbitrary data
              const proxy = new ProxyConfig(proxyData);
              
              // Convert to JSON
              const json = proxy.toJSON();
              
              // Reconstruct from JSON
              const restored = ProxyConfig.fromJSON(json);
              
              // Convert restored to JSON for comparison
              const restoredJson = restored.toJSON();
              
              // Should be equivalent
              expect(restoredJson).toEqual(json);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('ProxyConfig double round-trip produces identical JSON', () => {
        fc.assert(
          fc.property(
            proxyConfigArbitrary,
            (proxyData) => {
              const proxy = new ProxyConfig(proxyData);
              
              // First round-trip
              const json1 = proxy.toJSON();
              const restored1 = ProxyConfig.fromJSON(json1);
              
              // Second round-trip
              const json2 = restored1.toJSON();
              const restored2 = ProxyConfig.fromJSON(json2);
              const json3 = restored2.toJSON();
              
              // All JSON representations should be identical
              expect(json2).toEqual(json1);
              expect(json3).toEqual(json1);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('ProxyConfig JSON serialization is valid JSON string', () => {
        fc.assert(
          fc.property(
            proxyConfigArbitrary,
            (proxyData) => {
              const proxy = new ProxyConfig(proxyData);
              const json = proxy.toJSON();
              
              // Should be serializable to JSON string
              const jsonString = JSON.stringify(json);
              expect(typeof jsonString).toBe('string');
              
              // Should be parseable back
              const parsed = JSON.parse(jsonString);
              expect(parsed).toEqual(json);
              
              // Should be reconstructable from parsed JSON
              const restored = ProxyConfig.fromJSON(parsed);
              expect(restored.toJSON()).toEqual(json);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('ProxyConfig prettyPrint produces non-empty string', () => {
        fc.assert(
          fc.property(
            proxyConfigArbitrary,
            (proxyData) => {
              const proxy = new ProxyConfig(proxyData);
              const pretty = ProxyConfig.prettyPrint(proxy);
              
              expect(typeof pretty).toBe('string');
              expect(pretty.length).toBeGreaterThan(0);
              expect(pretty).toContain('PROXY CONFIG');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('ProxyConfig prettyPrint masks password', () => {
        // Use unique passwords that won't appear elsewhere in the output
        // Using UUID-prefixed strings ensures uniqueness
        const uniquePassword = fc.uuid().map(id => `SECRET_${id}`);
        
        fc.assert(
          fc.property(
            proxyConfigArbitrary.chain(p => 
              uniquePassword.map(pwd => ({ ...p, password: pwd }))
            ),
            (proxyData) => {
              const proxy = new ProxyConfig(proxyData);
              const pretty = ProxyConfig.prettyPrint(proxy);
              
              // Password should be masked
              expect(pretty).not.toContain(proxyData.password);
              expect(pretty).toContain('********');
            }
          ),
          { numRuns: 100 }
        );
      });
    });


    describe('TranslationConfig Entity', () => {
      test('TranslationConfig toJSON/fromJSON round-trip preserves all data', () => {
        fc.assert(
          fc.property(
            translationConfigArbitrary,
            (translationData) => {
              // Create translation config from arbitrary data
              const translation = new TranslationConfig(translationData);
              
              // Convert to JSON
              const json = translation.toJSON();
              
              // Reconstruct from JSON
              const restored = TranslationConfig.fromJSON(json);
              
              // Convert restored to JSON for comparison
              const restoredJson = restored.toJSON();
              
              // Should be equivalent
              expect(restoredJson).toEqual(json);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('TranslationConfig double round-trip produces identical JSON', () => {
        fc.assert(
          fc.property(
            translationConfigArbitrary,
            (translationData) => {
              const translation = new TranslationConfig(translationData);
              
              // First round-trip
              const json1 = translation.toJSON();
              const restored1 = TranslationConfig.fromJSON(json1);
              
              // Second round-trip
              const json2 = restored1.toJSON();
              const restored2 = TranslationConfig.fromJSON(json2);
              const json3 = restored2.toJSON();
              
              // All JSON representations should be identical
              expect(json2).toEqual(json1);
              expect(json3).toEqual(json1);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('TranslationConfig JSON serialization is valid JSON string', () => {
        fc.assert(
          fc.property(
            translationConfigArbitrary,
            (translationData) => {
              const translation = new TranslationConfig(translationData);
              const json = translation.toJSON();
              
              // Should be serializable to JSON string
              const jsonString = JSON.stringify(json);
              expect(typeof jsonString).toBe('string');
              
              // Should be parseable back
              const parsed = JSON.parse(jsonString);
              expect(parsed).toEqual(json);
              
              // Should be reconstructable from parsed JSON
              const restored = TranslationConfig.fromJSON(parsed);
              expect(restored.toJSON()).toEqual(json);
            }
          ),
          { numRuns: 100 }
        );
      });

      test('TranslationConfig prettyPrint produces non-empty string', () => {
        fc.assert(
          fc.property(
            translationConfigArbitrary,
            (translationData) => {
              const translation = new TranslationConfig(translationData);
              const pretty = TranslationConfig.prettyPrint(translation);
              
              expect(typeof pretty).toBe('string');
              expect(pretty.length).toBeGreaterThan(0);
              expect(pretty).toContain('TRANSLATION CONFIG');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('TranslationConfig prettyPrint masks API key', () => {
        // Use unique API keys that won't appear elsewhere in the output
        // Using UUID-prefixed strings ensures uniqueness
        const uniqueApiKey = fc.uuid().map(id => `APIKEY_${id}`);
        
        fc.assert(
          fc.property(
            translationConfigArbitrary.chain(t => 
              uniqueApiKey.map(key => ({ ...t, apiKey: key }))
            ),
            (translationData) => {
              const translation = new TranslationConfig(translationData);
              const pretty = TranslationConfig.prettyPrint(translation);
              
              // API key should be masked
              expect(pretty).not.toContain(translationData.apiKey);
              expect(pretty).toContain('********');
            }
          ),
          { numRuns: 100 }
        );
      });

      test('TranslationConfig friendSettings are preserved through round-trip', () => {
        fc.assert(
          fc.property(
            translationConfigArbitrary.filter(t => Object.keys(t.friendSettings).length > 0),
            (translationData) => {
              const translation = new TranslationConfig(translationData);
              
              // Convert to JSON and back
              const json = translation.toJSON();
              const restored = TranslationConfig.fromJSON(json);
              
              // Friend settings should be preserved
              expect(restored.friendSettings).toEqual(translation.friendSettings);
              
              // Each friend config should be accessible
              for (const friendId of Object.keys(translationData.friendSettings)) {
                const friendConfig = restored.getFriendConfig(friendId);
                expect(friendConfig).toEqual(translationData.friendSettings[friendId]);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });


    describe('Cross-Entity Consistency', () => {
      test('All entities handle null/undefined optional fields consistently', () => {
        fc.assert(
          fc.property(
            fc.uuid(),
            fc.string({ minLength: 1, maxLength: 50 }),
            (id, name) => {
              // Create entities with minimal required fields
              const account = new Account({ id, name });
              const proxy = new ProxyConfig({ id, host: 'localhost', port: 8080, name });
              const translation = new TranslationConfig({ id, targetLanguage: 'en' });
              
              // All should round-trip successfully
              const accountRestored = Account.fromJSON(account.toJSON());
              const proxyRestored = ProxyConfig.fromJSON(proxy.toJSON());
              const translationRestored = TranslationConfig.fromJSON(translation.toJSON());
              
              expect(accountRestored.toJSON()).toEqual(account.toJSON());
              expect(proxyRestored.toJSON()).toEqual(proxy.toJSON());
              expect(translationRestored.toJSON()).toEqual(translation.toJSON());
            }
          ),
          { numRuns: 100 }
        );
      });

      test('All entities produce valid JSON that can be stringified', () => {
        fc.assert(
          fc.property(
            accountArbitrary,
            proxyConfigArbitrary,
            translationConfigArbitrary,
            (accountData, proxyData, translationData) => {
              const account = new Account(accountData);
              const proxy = new ProxyConfig(proxyData);
              const translation = new TranslationConfig(translationData);
              
              // All should be stringifiable
              expect(() => JSON.stringify(account.toJSON())).not.toThrow();
              expect(() => JSON.stringify(proxy.toJSON())).not.toThrow();
              expect(() => JSON.stringify(translation.toJSON())).not.toThrow();
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
