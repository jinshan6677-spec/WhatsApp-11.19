/**
 * ViewFingerprintIntegration
 * 
 * Integrates fingerprint injection into the ViewManager.
 * Handles fingerprint script injection at BrowserView creation time.
 * 
 * Requirements: 13.1-13.5
 */

import { FingerprintProfile } from '../../../domain/entities/FingerprintProfile';
import { FingerprintInjector, InjectionResult, ChromiumArgs } from '../../../infrastructure/fingerprint/FingerprintInjector';
import { FingerprintService } from '../../../application/services/FingerprintService';

export interface FingerprintIntegrationOptions {
  logger?: (level: string, message: string, ...args: any[]) => void;
  notifyRenderer?: (event: string, data: any) => void;
  eventBus?: any;
  fingerprintService?: FingerprintService;
}

export interface FingerprintInjectionConfig {
  enabled: boolean;
  profile?: FingerprintProfile;
  proxyPort?: number;
}

export interface FingerprintInjectionResult {
  success: boolean;
  injectionResults?: InjectionResult[];
  chromiumArgs?: ChromiumArgs;
  error?: string;
}

export class ViewFingerprintIntegration {
  private logger: (level: string, message: string, ...args: any[]) => void;
  private notifyRenderer: (event: string, data: any) => void;
  private eventBus: any;
  private fingerprintService: FingerprintService | null;
  private injectors: Map<string, FingerprintInjector>;
  
  constructor(options: FingerprintIntegrationOptions = {}) {
    this.logger = options.logger || this._defaultLogger;
    this.notifyRenderer = options.notifyRenderer || (() => {});
    this.eventBus = options.eventBus || null;
    this.fingerprintService = options.fingerprintService || null;
    this.injectors = new Map();
  }
  
  /**
   * Gets Chromium launch arguments for fingerprint configuration
   * Should be called before creating the BrowserView
   * Requirements: 27.1
   */
  getChromiumArgs(accountId: string, config: FingerprintInjectionConfig): ChromiumArgs {
    if (!config.enabled || !config.profile) {
      return { args: [] };
    }
    
    try {
      const injector = this._getOrCreateInjector(accountId, config.profile);
      const chromiumArgs = injector.getChromiumArgs(config.proxyPort);
      
      this.logger('info', `[Fingerprint] Generated Chromium args for account ${accountId}`);
      
      return chromiumArgs;
    } catch (error) {
      this.logger('error', `[Fingerprint] Failed to generate Chromium args for account ${accountId}:`, error);
      return { args: [] };
    }
  }
  
  /**
   * Injects fingerprint scripts into a BrowserView
   * Should be called after the BrowserView is created
   * Requirements: 13.1-13.5, 27.2-27.4
   */
  async injectFingerprint(
    accountId: string,
    webContents: any,
    config: FingerprintInjectionConfig
  ): Promise<FingerprintInjectionResult> {
    if (!config.enabled) {
      this.logger('info', `[Fingerprint] Fingerprint injection disabled for account ${accountId}`);
      return { success: true };
    }
    
    if (!config.profile) {
      this.logger('warn', `[Fingerprint] No fingerprint profile provided for account ${accountId}`);
      return { success: true };
    }
    
    try {
      this.logger('info', `[Fingerprint] Injecting fingerprint for account ${accountId}`);
      
      const injector = this._getOrCreateInjector(accountId, config.profile);
      
      // Inject fingerprint scripts
      const injectionResults = await injector.injectFingerprint(webContents);
      
      // Check for failures
      const failures = injectionResults.filter(r => !r.success);
      if (failures.length > 0) {
        const errorMessages = failures.map(f => `${f.stage}: ${f.error}`).join('; ');
        this.logger('warn', `[Fingerprint] Some injections failed for account ${accountId}: ${errorMessages}`);
        
        // Notify renderer about partial failure
        this.notifyRenderer('fingerprint-injection-warning', {
          accountId,
          failures: failures.map(f => ({ stage: f.stage, error: f.error }))
        });
      }
      
      // Set up request hooks for cookie injection and port scan protection
      injector.setupRequestHooks(webContents);
      
      this.logger('info', `[Fingerprint] Fingerprint injection completed for account ${accountId}`);
      
      // Notify renderer about successful injection
      this.notifyRenderer('fingerprint-injected', {
        accountId,
        profile: {
          userAgent: config.profile.userAgent,
          platform: config.profile.platform,
          browserVersion: config.profile.browserVersion
        }
      });
      
      // Emit event if event bus is available
      if (this.eventBus) {
        this.eventBus.emit('fingerprint:injected', {
          accountId,
          profile: config.profile
        });
      }
      
      return {
        success: true,
        injectionResults
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger('error', `[Fingerprint] Failed to inject fingerprint for account ${accountId}:`, error);
      
      // Notify renderer about failure
      this.notifyRenderer('fingerprint-injection-failed', {
        accountId,
        error: errorMessage
      });
      
      // Return success with degraded mode (fingerprint injection failed but view can still work)
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Loads fingerprint profile for an account
   * Uses FingerprintService if available, otherwise returns null
   */
  async loadFingerprintProfile(accountId: string): Promise<FingerprintProfile | null> {
    if (!this.fingerprintService) {
      this.logger('debug', `[Fingerprint] No FingerprintService available, skipping profile load for account ${accountId}`);
      return null;
    }
    
    try {
      const profile = await this.fingerprintService.getFingerprint(accountId);
      
      if (profile) {
        this.logger('info', `[Fingerprint] Loaded fingerprint profile for account ${accountId}`);
      } else {
        this.logger('debug', `[Fingerprint] No fingerprint profile found for account ${accountId}`);
      }
      
      return profile;
    } catch (error) {
      this.logger('error', `[Fingerprint] Failed to load fingerprint profile for account ${accountId}:`, error);
      return null;
    }
  }
  
  /**
   * Updates the fingerprint profile for an account
   */
  updateProfile(accountId: string, profile: FingerprintProfile): void {
    const injector = this.injectors.get(accountId);
    if (injector) {
      injector.updateProfile(profile);
      this.logger('info', `[Fingerprint] Updated fingerprint profile for account ${accountId}`);
    }
  }
  
  /**
   * Removes the fingerprint injector for an account
   * Should be called when the view is destroyed
   */
  removeInjector(accountId: string): void {
    if (this.injectors.has(accountId)) {
      this.injectors.delete(accountId);
      this.logger('info', `[Fingerprint] Removed fingerprint injector for account ${accountId}`);
    }
  }
  
  /**
   * Gets the fingerprint injector for an account
   */
  getInjector(accountId: string): FingerprintInjector | null {
    return this.injectors.get(accountId) || null;
  }
  
  /**
   * Checks if fingerprint injection is enabled for an account
   */
  hasInjector(accountId: string): boolean {
    return this.injectors.has(accountId);
  }
  
  /**
   * Clears all fingerprint injectors
   */
  clearAll(): void {
    this.injectors.clear();
    this.logger('info', '[Fingerprint] Cleared all fingerprint injectors');
  }
  
  // Private methods
  
  private _getOrCreateInjector(accountId: string, profile: FingerprintProfile): FingerprintInjector {
    let injector = this.injectors.get(accountId);
    
    if (!injector) {
      injector = new FingerprintInjector(profile);
      this.injectors.set(accountId, injector);
      this.logger('debug', `[Fingerprint] Created new fingerprint injector for account ${accountId}`);
    } else {
      // Update profile if it changed
      injector.updateProfile(profile);
    }
    
    return injector;
  }
  
  private _defaultLogger(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [ViewFingerprintIntegration] [${level.toUpperCase()}] ${message}`;
    
    if (level === 'error') {
      console.error(logMessage, ...args);
    } else if (level === 'warn') {
      console.warn(logMessage, ...args);
    } else {
      console.log(logMessage, ...args);
    }
  }
}

export default ViewFingerprintIntegration;
