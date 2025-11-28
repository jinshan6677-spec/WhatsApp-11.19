/**
 * Fingerprint Version Management Property Tests
 * 
 * Feature: professional-fingerprint-browser
 * Property 53: 配置历史完整性
 * Property 54: 版本恢复正确性
 * Validates: Requirements 31.1, 31.5
 */

import * as fc from 'fast-check';

// Mock version management for testing
interface FingerprintVersion {
  id: string;
  timestamp: Date;
  config: FingerprintConfig;
}

interface FingerprintConfig {
  userAgent: string;
  browserVersion: string;
  platform: string;
  webgl: { mode: string };
  canvas: { mode: string };
}

class FingerprintVersionManager {
  private versions: FingerprintVersion[] = [];
  private currentConfig: FingerprintConfig | null = null;
  private maxVersions: number = 10;

  /**
   * Saves current configuration as a new version
   */
  saveVersion(config: FingerprintConfig): FingerprintVersion {
    const version: FingerprintVersion = {
      id: `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      config: JSON.parse(JSON.stringify(config)) // Deep clone
    };

    this.versions.unshift(version);
    
    // Keep only maxVersions
    if (this.versions.length > this.maxVersions) {
      this.versions = this.versions.slice(0, this.maxVersions);
    }

    this.currentConfig = config;
    return version;
  }

  /**
   * Gets all versions
   */
  getVersions(): FingerprintVersion[] {
    return [...this.versions];
  }

  /**
   * Gets a specific version by ID
   */
  getVersion(id: string): FingerprintVersion | null {
    return this.versions.find(v => v.id === id) || null;
  }

  /**
   * Restores a version, creating a new version with the restored config
   */
  restoreVersion(id: string): FingerprintConfig | null {
    const version = this.getVersion(id);
    if (!version) return null;

    // Restoring creates a new version (to preserve current state)
    this.saveVersion(version.config);
    
    return version.config;
  }

  /**
   * Gets current configuration
   */
  getCurrentConfig(): FingerprintConfig | null {
    return this.currentConfig;
  }

  /**
   * Gets version count
   */
  getVersionCount(): number {
    return this.versions.length;
  }
}

// Arbitrary for generating fingerprint configs
const fingerprintConfigArbitrary = (): fc.Arbitrary<FingerprintConfig> => {
  return fc.record({
    userAgent: fc.string({ minLength: 20, maxLength: 100 }),
    browserVersion: fc.constantFrom('Chrome 120', 'Chrome 119', 'Firefox 121'),
    platform: fc.constantFrom('Windows', 'MacOS', 'Linux'),
    webgl: fc.record({
      mode: fc.constantFrom('real', 'custom', 'random')
    }),
    canvas: fc.record({
      mode: fc.constantFrom('real', 'random')
    })
  });
};

describe('Fingerprint Version Management Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 53: 配置历史完整性
   * Validates: Requirements 31.1
   * 
   * For any sequence of configuration saves, all saved versions should be
   * retrievable and contain the exact configuration that was saved.
   */
  describe('Property 53: Configuration History Completeness', () => {
    test('All saved versions are retrievable', () => {
      fc.assert(
        fc.property(
          fc.array(fingerprintConfigArbitrary(), { minLength: 1, maxLength: 10 }),
          (configs) => {
            const manager = new FingerprintVersionManager();
            const savedVersions: FingerprintVersion[] = [];

            // Save all configs
            for (const config of configs) {
              const version = manager.saveVersion(config);
              savedVersions.push(version);
            }

            // All versions should be retrievable
            for (const saved of savedVersions) {
              const retrieved = manager.getVersion(saved.id);
              expect(retrieved).not.toBeNull();
              expect(retrieved!.id).toBe(saved.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Saved configuration is preserved exactly', () => {
      fc.assert(
        fc.property(
          fingerprintConfigArbitrary(),
          (config) => {
            const manager = new FingerprintVersionManager();
            
            // Save config
            const version = manager.saveVersion(config);
            
            // Retrieved config should match exactly
            const retrieved = manager.getVersion(version.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.config.userAgent).toBe(config.userAgent);
            expect(retrieved!.config.browserVersion).toBe(config.browserVersion);
            expect(retrieved!.config.platform).toBe(config.platform);
            expect(retrieved!.config.webgl.mode).toBe(config.webgl.mode);
            expect(retrieved!.config.canvas.mode).toBe(config.canvas.mode);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Version count matches saved count (up to max)', () => {
      fc.assert(
        fc.property(
          fc.array(fingerprintConfigArbitrary(), { minLength: 1, maxLength: 15 }),
          (configs) => {
            const manager = new FingerprintVersionManager();

            // Save all configs
            for (const config of configs) {
              manager.saveVersion(config);
            }

            // Version count should be min(saved, maxVersions)
            const expectedCount = Math.min(configs.length, 10);
            expect(manager.getVersionCount()).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Versions are ordered by timestamp (newest first)', () => {
      fc.assert(
        fc.property(
          fc.array(fingerprintConfigArbitrary(), { minLength: 2, maxLength: 10 }),
          (configs) => {
            const manager = new FingerprintVersionManager();

            // Save all configs with small delays
            for (const config of configs) {
              manager.saveVersion(config);
            }

            // Versions should be in reverse chronological order
            const versions = manager.getVersions();
            for (let i = 1; i < versions.length; i++) {
              expect(versions[i - 1].timestamp.getTime())
                .toBeGreaterThanOrEqual(versions[i].timestamp.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: professional-fingerprint-browser, Property 54: 版本恢复正确性
   * Validates: Requirements 31.5
   * 
   * For any saved version, restoring it should result in the current
   * configuration matching the restored version exactly.
   */
  describe('Property 54: Version Restoration Correctness', () => {
    test('Restored version matches original exactly', () => {
      fc.assert(
        fc.property(
          fc.array(fingerprintConfigArbitrary(), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 9 }),
          (configs, restoreIndex) => {
            const manager = new FingerprintVersionManager();
            const savedVersions: FingerprintVersion[] = [];

            // Save all configs
            for (const config of configs) {
              const version = manager.saveVersion(config);
              savedVersions.push(version);
            }

            // Pick a valid version to restore
            const validIndex = restoreIndex % savedVersions.length;
            const versionToRestore = savedVersions[validIndex];

            // Restore the version
            const restoredConfig = manager.restoreVersion(versionToRestore.id);

            // Restored config should match the original
            expect(restoredConfig).not.toBeNull();
            expect(restoredConfig!.userAgent).toBe(versionToRestore.config.userAgent);
            expect(restoredConfig!.browserVersion).toBe(versionToRestore.config.browserVersion);
            expect(restoredConfig!.platform).toBe(versionToRestore.config.platform);
            expect(restoredConfig!.webgl.mode).toBe(versionToRestore.config.webgl.mode);
            expect(restoredConfig!.canvas.mode).toBe(versionToRestore.config.canvas.mode);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Restoration creates a new version (preserves history)', () => {
      fc.assert(
        fc.property(
          fc.array(fingerprintConfigArbitrary(), { minLength: 2, maxLength: 5 }),
          (configs) => {
            const manager = new FingerprintVersionManager();
            const savedVersions: FingerprintVersion[] = [];

            // Save all configs
            for (const config of configs) {
              const version = manager.saveVersion(config);
              savedVersions.push(version);
            }

            const countBeforeRestore = manager.getVersionCount();

            // Restore the first version
            manager.restoreVersion(savedVersions[0].id);

            // Version count should increase by 1
            expect(manager.getVersionCount()).toBe(Math.min(countBeforeRestore + 1, 10));
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Restoring non-existent version returns null', () => {
      fc.assert(
        fc.property(
          fingerprintConfigArbitrary(),
          fc.string({ minLength: 10, maxLength: 20 }),
          (config, fakeId) => {
            const manager = new FingerprintVersionManager();
            
            // Save a config
            manager.saveVersion(config);

            // Try to restore a non-existent version
            const result = manager.restoreVersion(`fake-${fakeId}`);
            
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Multiple restorations maintain data integrity', () => {
      fc.assert(
        fc.property(
          fc.array(fingerprintConfigArbitrary(), { minLength: 3, maxLength: 5 }),
          fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 3 }),
          (configs, restoreIndices) => {
            const manager = new FingerprintVersionManager();
            const savedVersions: FingerprintVersion[] = [];

            // Save all configs
            for (const config of configs) {
              const version = manager.saveVersion(config);
              savedVersions.push(version);
            }

            // Perform multiple restorations
            for (const index of restoreIndices) {
              const validIndex = index % savedVersions.length;
              const versionToRestore = savedVersions[validIndex];
              
              const restoredConfig = manager.restoreVersion(versionToRestore.id);
              
              // Each restoration should succeed and match
              if (restoredConfig) {
                expect(restoredConfig.userAgent).toBe(versionToRestore.config.userAgent);
              }
            }

            // All original versions should still be accessible
            for (const saved of savedVersions) {
              const retrieved = manager.getVersion(saved.id);
              // May be null if pushed out by max versions limit
              if (retrieved) {
                expect(retrieved.config.userAgent).toBe(saved.config.userAgent);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional property: Version IDs are unique
   */
  describe('Version ID Uniqueness', () => {
    test('All version IDs are unique', () => {
      fc.assert(
        fc.property(
          fc.array(fingerprintConfigArbitrary(), { minLength: 2, maxLength: 10 }),
          (configs) => {
            const manager = new FingerprintVersionManager();
            const ids: string[] = [];

            // Save all configs
            for (const config of configs) {
              const version = manager.saveVersion(config);
              ids.push(version.id);
            }

            // All IDs should be unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
