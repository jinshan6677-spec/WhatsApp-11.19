/**
 * Fingerprint Randomization Strategy Property Tests
 * 
 * Feature: professional-fingerprint-browser
 * Property 42: 固定指纹不变性
 * Property 43: 每次启动随机不可预测性
 * Property 44: 定期更换时间准确性
 * Validates: Requirements 33.1-33.3
 */

import * as fc from 'fast-check';

// Mock FingerprintService for testing strategy behavior
interface FingerprintStrategy {
  type: 'fixed' | 'random-on-start' | 'periodic' | 'partial-random';
  interval?: number;
  randomFields?: string[];
  lastUpdated?: Date;
}

interface FingerprintConfig {
  userAgent: string;
  browserVersion: string;
  platform: string;
  canvas: { mode: string; noiseLevel?: number };
  audio: { mode: string; noiseLevel?: number };
  webgl: { vendor: string; renderer: string; mode: string };
  screen: { width: number; height: number };
}

// Strategy implementation for testing
class FingerprintStrategyManager {
  private strategy: FingerprintStrategy;
  private currentFingerprint: FingerprintConfig | null = null;
  private lastGeneratedAt: Date | null = null;

  constructor(strategy: FingerprintStrategy) {
    this.strategy = strategy;
  }

  /**
   * Determines if fingerprint should be regenerated based on strategy
   */
  shouldRegenerate(): boolean {
    switch (this.strategy.type) {
      case 'fixed':
        // Fixed strategy: never regenerate after initial creation
        return this.currentFingerprint === null;
      
      case 'random-on-start':
        // Random on start: always regenerate
        return true;
      
      case 'periodic':
        // Periodic: regenerate if interval has passed
        if (!this.lastGeneratedAt || !this.strategy.interval) {
          return true;
        }
        const daysSinceLastUpdate = (Date.now() - this.lastGeneratedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastUpdate >= this.strategy.interval;
      
      case 'partial-random':
        // Partial random: always regenerate specified fields
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Gets fingerprint, potentially regenerating based on strategy
   */
  getFingerprint(generateNew: () => FingerprintConfig): FingerprintConfig {
    if (this.shouldRegenerate()) {
      if (this.strategy.type === 'partial-random' && this.currentFingerprint) {
        // Only randomize specified fields
        const newFingerprint = generateNew();
        const result = { ...this.currentFingerprint };
        
        for (const field of this.strategy.randomFields || []) {
          if (field === 'canvas') {
            result.canvas = newFingerprint.canvas;
          } else if (field === 'audio') {
            result.audio = newFingerprint.audio;
          } else if (field === 'webgl') {
            result.webgl = newFingerprint.webgl;
          } else if (field === 'screen') {
            result.screen = newFingerprint.screen;
          }
        }
        
        this.currentFingerprint = result;
      } else {
        this.currentFingerprint = generateNew();
      }
      this.lastGeneratedAt = new Date();
    }
    
    return this.currentFingerprint!;
  }

  /**
   * Sets the current fingerprint (for testing)
   */
  setFingerprint(fingerprint: FingerprintConfig): void {
    this.currentFingerprint = fingerprint;
    this.lastGeneratedAt = new Date();
  }

  /**
   * Sets the last generated time (for testing periodic strategy)
   */
  setLastGeneratedAt(date: Date): void {
    this.lastGeneratedAt = date;
  }
}

// Arbitrary for generating fingerprint configs
const fingerprintConfigArbitrary = (): fc.Arbitrary<FingerprintConfig> => {
  return fc.record({
    userAgent: fc.string({ minLength: 20, maxLength: 100 }),
    browserVersion: fc.constantFrom('Chrome 120', 'Chrome 119', 'Firefox 121'),
    platform: fc.constantFrom('Windows', 'MacOS', 'Linux'),
    canvas: fc.record({
      mode: fc.constantFrom('real', 'random'),
      noiseLevel: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined })
    }),
    audio: fc.record({
      mode: fc.constantFrom('real', 'random'),
      noiseLevel: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined })
    }),
    webgl: fc.record({
      vendor: fc.string({ minLength: 5, maxLength: 50 }),
      renderer: fc.string({ minLength: 5, maxLength: 50 }),
      mode: fc.constantFrom('real', 'custom', 'random')
    }),
    screen: fc.record({
      width: fc.integer({ min: 800, max: 3840 }),
      height: fc.integer({ min: 600, max: 2160 })
    })
  });
};

describe('Fingerprint Randomization Strategy Property Tests', () => {
  /**
   * Feature: professional-fingerprint-browser, Property 42: 固定指纹不变性
   * Validates: Requirements 33.1
   * 
   * For any fingerprint with 'fixed' strategy, multiple calls to getFingerprint
   * should always return the same configuration.
   */
  describe('Property 42: Fixed Fingerprint Invariance', () => {
    test('Fixed strategy returns same fingerprint on multiple calls', () => {
      fc.assert(
        fc.property(
          fingerprintConfigArbitrary(),
          fc.integer({ min: 2, max: 10 }),
          (initialFingerprint, numCalls) => {
            const manager = new FingerprintStrategyManager({ type: 'fixed' });
            
            // Set initial fingerprint
            manager.setFingerprint(initialFingerprint);
            
            // Multiple calls should return the same fingerprint
            const results: FingerprintConfig[] = [];
            for (let i = 0; i < numCalls; i++) {
              results.push(manager.getFingerprint(() => ({
                ...initialFingerprint,
                userAgent: `Different-${i}` // Generator would return different value
              })));
            }
            
            // All results should be identical to the initial fingerprint
            for (const result of results) {
              expect(result.userAgent).toBe(initialFingerprint.userAgent);
              expect(result.browserVersion).toBe(initialFingerprint.browserVersion);
              expect(result.platform).toBe(initialFingerprint.platform);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Fixed strategy shouldRegenerate returns false after initial creation', () => {
      fc.assert(
        fc.property(
          fingerprintConfigArbitrary(),
          (fingerprint) => {
            const manager = new FingerprintStrategyManager({ type: 'fixed' });
            
            // Before setting fingerprint, should regenerate
            expect(manager.shouldRegenerate()).toBe(true);
            
            // After setting fingerprint, should not regenerate
            manager.setFingerprint(fingerprint);
            expect(manager.shouldRegenerate()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: professional-fingerprint-browser, Property 43: 每次启动随机不可预测性
   * Validates: Requirements 33.2
   * 
   * For any fingerprint with 'random-on-start' strategy, each call to getFingerprint
   * should return a different configuration (with high probability).
   */
  describe('Property 43: Random-on-Start Unpredictability', () => {
    test('Random-on-start strategy always regenerates', () => {
      fc.assert(
        fc.property(
          fingerprintConfigArbitrary(),
          (initialFingerprint) => {
            const manager = new FingerprintStrategyManager({ type: 'random-on-start' });
            
            // Set initial fingerprint
            manager.setFingerprint(initialFingerprint);
            
            // shouldRegenerate should always return true
            expect(manager.shouldRegenerate()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Random-on-start produces different fingerprints on each call', () => {
      let callCount = 0;
      
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (numCalls) => {
            const manager = new FingerprintStrategyManager({ type: 'random-on-start' });
            
            // Generator that produces unique fingerprints
            const generator = (): FingerprintConfig => ({
              userAgent: `UA-${callCount++}`,
              browserVersion: 'Chrome 120',
              platform: 'Windows',
              canvas: { mode: 'random', noiseLevel: callCount },
              audio: { mode: 'random', noiseLevel: callCount },
              webgl: { vendor: `Vendor-${callCount}`, renderer: `Renderer-${callCount}`, mode: 'custom' },
              screen: { width: 1920 + callCount, height: 1080 + callCount }
            });
            
            const results: FingerprintConfig[] = [];
            for (let i = 0; i < numCalls; i++) {
              results.push(manager.getFingerprint(generator));
            }
            
            // Each result should be different (based on userAgent which is unique)
            const userAgents = results.map(r => r.userAgent);
            const uniqueUserAgents = new Set(userAgents);
            
            expect(uniqueUserAgents.size).toBe(numCalls);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Feature: professional-fingerprint-browser, Property 44: 定期更换时间准确性
   * Validates: Requirements 33.3
   * 
   * For any fingerprint with 'periodic' strategy, regeneration should only occur
   * when the specified interval has passed.
   */
  describe('Property 44: Periodic Update Time Accuracy', () => {
    test('Periodic strategy does not regenerate before interval', () => {
      fc.assert(
        fc.property(
          fingerprintConfigArbitrary(),
          fc.integer({ min: 1, max: 30 }), // interval in days
          fc.float({ min: 0, max: 0.99 }), // fraction of interval that has passed
          (fingerprint, intervalDays, fractionPassed) => {
            const manager = new FingerprintStrategyManager({
              type: 'periodic',
              interval: intervalDays
            });
            
            // Set fingerprint and last generated time
            manager.setFingerprint(fingerprint);
            
            // Set last generated to some time in the past (less than interval)
            const daysPassed = intervalDays * fractionPassed;
            const lastGenerated = new Date(Date.now() - daysPassed * 24 * 60 * 60 * 1000);
            manager.setLastGeneratedAt(lastGenerated);
            
            // Should not regenerate since interval hasn't passed
            expect(manager.shouldRegenerate()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Periodic strategy regenerates after interval', () => {
      fc.assert(
        fc.property(
          fingerprintConfigArbitrary(),
          fc.integer({ min: 1, max: 30 }), // interval in days
          fc.float({ min: 1.0, max: 2.0 }), // multiplier for interval (>= 1 means interval passed)
          (fingerprint, intervalDays, multiplier) => {
            const manager = new FingerprintStrategyManager({
              type: 'periodic',
              interval: intervalDays
            });
            
            // Set fingerprint and last generated time
            manager.setFingerprint(fingerprint);
            
            // Set last generated to some time in the past (more than interval)
            const daysPassed = intervalDays * multiplier;
            const lastGenerated = new Date(Date.now() - daysPassed * 24 * 60 * 60 * 1000);
            manager.setLastGeneratedAt(lastGenerated);
            
            // Should regenerate since interval has passed
            expect(manager.shouldRegenerate()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Periodic strategy regenerates exactly at interval boundary', () => {
      fc.assert(
        fc.property(
          fingerprintConfigArbitrary(),
          fc.integer({ min: 1, max: 30 }),
          (fingerprint, intervalDays) => {
            const manager = new FingerprintStrategyManager({
              type: 'periodic',
              interval: intervalDays
            });
            
            manager.setFingerprint(fingerprint);
            
            // Set last generated to exactly the interval ago
            const lastGenerated = new Date(Date.now() - intervalDays * 24 * 60 * 60 * 1000);
            manager.setLastGeneratedAt(lastGenerated);
            
            // Should regenerate at exactly the interval
            expect(manager.shouldRegenerate()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Partial random strategy only changes specified fields
   */
  describe('Partial Random Strategy', () => {
    test('Partial random only changes specified fields', () => {
      fc.assert(
        fc.property(
          fingerprintConfigArbitrary(),
          fingerprintConfigArbitrary(),
          fc.subarray(['canvas', 'audio', 'webgl', 'screen'], { minLength: 1 }),
          (initialFingerprint, newFingerprint, randomFields) => {
            const manager = new FingerprintStrategyManager({
              type: 'partial-random',
              randomFields
            });
            
            // Set initial fingerprint
            manager.setFingerprint(initialFingerprint);
            
            // Get fingerprint with generator that returns newFingerprint
            const result = manager.getFingerprint(() => newFingerprint);
            
            // Non-random fields should remain unchanged
            expect(result.userAgent).toBe(initialFingerprint.userAgent);
            expect(result.browserVersion).toBe(initialFingerprint.browserVersion);
            expect(result.platform).toBe(initialFingerprint.platform);
            
            // Random fields should be from newFingerprint
            for (const field of randomFields) {
              if (field === 'canvas') {
                expect(result.canvas).toEqual(newFingerprint.canvas);
              } else if (field === 'audio') {
                expect(result.audio).toEqual(newFingerprint.audio);
              } else if (field === 'webgl') {
                expect(result.webgl).toEqual(newFingerprint.webgl);
              } else if (field === 'screen') {
                expect(result.screen).toEqual(newFingerprint.screen);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
