/**
 * FingerprintService
 * 
 * Manages fingerprint configuration creation, updates, retrieval, and persistence.
 * Provides methods for CRUD operations on fingerprint profiles and template management.
 * 
 * Validates: Requirements 12.1-12.5, 11.1-11.5, 20.1-20.5
 */

import * as fs from 'fs';
import * as path from 'path';
import { FingerprintProfile, FingerprintProfileData, Platform } from '../../domain/entities/FingerprintProfile';
import { FingerprintLibrary, FingerprintFilter } from '../../infrastructure/fingerprint/FingerprintLibrary';

export interface FingerprintStrategy {
  type: 'fixed' | 'random-on-start' | 'periodic' | 'partial-random';
  interval?: number; // days, for periodic mode
  randomFields?: string[]; // for partial-random mode
}

export interface BatchResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ accountId: string; error: string }>;
  /** List of successfully processed account IDs */
  successfulAccounts: string[];
  /** List of failed account IDs */
  failedAccounts: string[];
  /** List of skipped account IDs */
  skippedAccounts: string[];
  /** Total processing time in milliseconds */
  processingTime: number;
}

export interface BatchProgressCallback {
  (progress: BatchProgress): void;
}

export interface BatchProgress {
  /** Current account being processed */
  currentAccountId: string;
  /** Index of current account (0-based) */
  currentIndex: number;
  /** Total number of accounts to process */
  totalAccounts: number;
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Current status */
  status: 'processing' | 'success' | 'failed' | 'skipped';
}

 

export interface FingerprintTemplateInfo {
  name: string;
  platform: Platform;
  browserVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportedAccountConfig {
  accountId: string;
  fingerprint: FingerprintProfileData;
  template?: {
    name: string;
    config: FingerprintProfileData;
  };
}

export class FingerprintService {
  private sessionDataDir: string;
  private fingerprintLibrary: FingerprintLibrary;
  private libraryLoaded: boolean = false;
  
  constructor(sessionDataDir: string = 'session-data', libraryPath?: string) {
    this.sessionDataDir = sessionDataDir;
    this.fingerprintLibrary = new FingerprintLibrary(libraryPath);
  }
  
  /**
   * Ensures the fingerprint library is loaded
   * @private
   */
  private async ensureLibraryLoaded(): Promise<void> {
    if (!this.libraryLoaded) {
      await this.fingerprintLibrary.load();
      this.libraryLoaded = true;
    }
  }
  
  /**
   * Gets the fingerprint library instance
   */
  getLibrary(): FingerprintLibrary {
    return this.fingerprintLibrary;
  }
  
  /**
   * Creates a new fingerprint configuration for an account
   * Validates: Requirements 12.1
   */
  async createFingerprint(
    accountId: string,
    config: Partial<FingerprintProfileData>
  ): Promise<FingerprintProfile> {
    // Create fingerprint profile with provided config
    const profileData: FingerprintProfileData = {
      accountId,
      ...config,
      userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      browserVersion: config.browserVersion || 'Chrome 120',
      platform: config.platform || 'Windows',
      webgl: config.webgl || { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)', mode: 'real' },
      canvas: config.canvas || { mode: 'real' },
      audio: config.audio || { mode: 'real' },
      webrtc: config.webrtc || { mode: 'real' },
      timezone: config.timezone || { mode: 'real' },
      geolocation: config.geolocation || { mode: 'prompt' },
      language: config.language || { mode: 'custom', value: 'en-US' },
      screen: config.screen || { mode: 'real' },
      hardware: config.hardware || { cpuCores: 8, memory: 16 },
      doNotTrack: config.doNotTrack !== undefined ? config.doNotTrack : null,
      battery: config.battery || { mode: 'real' },
      fonts: config.fonts || { mode: 'system' },
      plugins: config.plugins || { mode: 'real' },
      mediaDevices: config.mediaDevices || { mode: 'real' }
    };
    
    const profile = new FingerprintProfile(profileData);
    
    // Validate the profile
    const validation = profile.validate();
    if (!validation.valid) {
      throw new Error(`Invalid fingerprint configuration: ${validation.errors.join(', ')}`);
    }
    
    // Save to disk
    await this.saveFingerprintToDisk(accountId, profile);
    
    return profile;
  }
  
  /**
   * Updates an existing fingerprint configuration
   * Validates: Requirements 12.1
   */
  async updateFingerprint(
    accountId: string,
    config: Partial<FingerprintProfileData>
  ): Promise<void> {
    // Load existing profile
    const existingProfile = await this.getFingerprint(accountId);
    
    if (!existingProfile) {
      throw new Error(`Fingerprint not found for account ${accountId}`);
    }
    
    // Merge with new config
    const updatedData: FingerprintProfileData = {
      ...existingProfile,
      ...config,
      accountId,
      updatedAt: new Date()
    };
    
    const updatedProfile = new FingerprintProfile(updatedData);
    
    // Validate the updated profile
    const validation = updatedProfile.validate();
    if (!validation.valid) {
      throw new Error(`Invalid fingerprint configuration: ${validation.errors.join(', ')}`);
    }
    
    // Save to disk
    await this.saveFingerprintToDisk(accountId, updatedProfile);
  }
  
  /**
   * Retrieves fingerprint configuration for an account
   * Validates: Requirements 12.2, 12.3
   */
  async getFingerprint(accountId: string): Promise<FingerprintProfile | null> {
    try {
      const fingerprintPath = this.getFingerprintPath(accountId);
      
      if (!fs.existsSync(fingerprintPath)) {
        return null;
      }
      
      const data = fs.readFileSync(fingerprintPath, 'utf-8');
      const json = JSON.parse(data);
      
      return FingerprintProfile.fromJSON(json);
    } catch (error) {
      // Log error but return null for missing/corrupted files
      console.error(`Error loading fingerprint for account ${accountId}:`, error);
      return null;
    }
  }
  
  /**
   * Generates a random fingerprint configuration from the fingerprint library
   * Ensures all parameters are consistent (User-Agent, WebGL, OS match)
   * Validates: Requirements 11.1-11.5, 20.3
   */
  async generateRandomFingerprint(strategy?: FingerprintStrategy, filter?: FingerprintFilter): Promise<FingerprintProfile> {
    await this.ensureLibraryLoaded();
    
    // Select a random fingerprint from the library
    const deviceFingerprint = await this.fingerprintLibrary.selectRandom(filter);
    
    if (deviceFingerprint) {
      // Convert library fingerprint to profile data
      const profileData = this.fingerprintLibrary.toProfileData(deviceFingerprint);
      
      // Apply strategy-specific modifications
      if (strategy) {
        this.applyStrategy(profileData, strategy);
      }
      
      return new FingerprintProfile({
        accountId: '',
        ...profileData
      } as FingerprintProfileData);
    }
    
    // Fallback to generating a basic fingerprint if library is empty
    return this.generateFallbackFingerprint(strategy);
  }
  
  /**
   * Generates a random fingerprint for a specific platform
   * Validates: Requirements 11.2, 24.1-24.4
   */
  async generateRandomFingerprintForPlatform(platform: Platform, strategy?: FingerprintStrategy): Promise<FingerprintProfile> {
    return this.generateRandomFingerprint(strategy, { platform });
  }
  
  /**
   * Applies strategy modifications to profile data
   * @private
   */
  private applyStrategy(profileData: Partial<FingerprintProfileData>, strategy: FingerprintStrategy): void {
    if (strategy.type === 'partial-random' && strategy.randomFields) {
      // Only randomize specified fields
      for (const field of strategy.randomFields) {
        switch (field) {
          case 'canvas':
            profileData.canvas = { mode: 'random', noiseLevel: Math.floor(Math.random() * 5) + 1 };
            break;
          case 'audio':
            profileData.audio = { mode: 'random', noiseLevel: Math.floor(Math.random() * 5) + 1 };
            break;
          case 'doNotTrack':
            profileData.doNotTrack = ['0', '1', null][Math.floor(Math.random() * 3)] as '0' | '1' | null;
            break;
        }
      }
    }
  }
  
  /**
   * Generates a fallback fingerprint when library is unavailable
   * @private
   */
  private generateFallbackFingerprint(strategy?: FingerprintStrategy): FingerprintProfile {
    const platforms: Array<'Windows' | 'MacOS' | 'Linux'> = ['Windows', 'MacOS', 'Linux'];
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    
    const browsers = ['Chrome 120', 'Chrome 119', 'Chrome 118'];
    const browserVersion = browsers[Math.floor(Math.random() * browsers.length)];
    const version = browserVersion.split(' ')[1];
    
    // Generate consistent user agent based on platform
    let userAgent = '';
    let webglVendor = '';
    let webglRenderer = '';
    
    if (platform === 'Windows') {
      userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
      webglVendor = 'Google Inc. (NVIDIA)';
      webglRenderer = 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)';
    } else if (platform === 'MacOS') {
      userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
      webglVendor = 'Apple Inc.';
      webglRenderer = 'Apple M1';
    } else {
      userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
      webglVendor = 'NVIDIA Corporation';
      webglRenderer = 'NVIDIA GeForce GTX 1060/PCIe/SSE2';
    }
    
    const profileData: FingerprintProfileData = {
      accountId: '',
      userAgent,
      browserVersion,
      platform,
      webgl: {
        vendor: webglVendor,
        renderer: webglRenderer,
        mode: 'custom'
      },
      canvas: {
        mode: 'random',
        noiseLevel: Math.floor(Math.random() * 5) + 1
      },
      audio: {
        mode: 'random',
        noiseLevel: Math.floor(Math.random() * 5) + 1
      },
      webrtc: {
        mode: 'disabled'
      },
      timezone: {
        mode: 'ip-based'
      },
      geolocation: {
        mode: 'ip-based'
      },
      language: {
        mode: 'ip-based'
      },
      screen: {
        mode: 'custom',
        width: 1920,
        height: 1080
      },
      hardware: {
        cpuCores: [4, 8, 16][Math.floor(Math.random() * 3)],
        memory: [8, 16, 32][Math.floor(Math.random() * 3)]
      },
      doNotTrack: ['0', '1', null][Math.floor(Math.random() * 3)] as '0' | '1' | null,
      battery: {
        mode: 'privacy'
      },
      fonts: {
        mode: 'system'
      },
      plugins: {
        mode: 'real'
      },
      mediaDevices: {
        mode: 'real'
      }
    };
    
    return new FingerprintProfile(profileData);
  }
  
  /**
   * Saves a fingerprint template for reuse
   * Validates: Requirements 25.1, 25.2
   * 
   * @param name - The name of the template (required, must be non-empty)
   * @param config - The fingerprint configuration to save as a template
   * @throws Error if name is empty or invalid
   */
  async saveFingerprintTemplate(name: string, config: FingerprintProfile): Promise<void> {
    // Validate template name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Template name is required and must be a non-empty string');
    }
    
    // Sanitize template name for filesystem
    const sanitizedName = this.sanitizeTemplateName(name);
    
    const templatesDir = this.getTemplatesDir();
    
    // Ensure templates directory exists
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }
    
    const templatePath = path.join(templatesDir, `${sanitizedName}.json`);
    
    // Create template data with metadata
    const templateData = {
      ...config.toJSON(),
      templateName: name,
      templateCreatedAt: new Date().toISOString(),
      templateUpdatedAt: new Date().toISOString()
    };
    
    const json = JSON.stringify(templateData, null, 2);
    
    fs.writeFileSync(templatePath, json, 'utf-8');
  }
  
  /**
   * Loads a fingerprint template
   * Validates: Requirements 25.3, 25.4
   * 
   * @param name - The name of the template to load
   * @returns The fingerprint profile from the template
   * @throws Error if template is not found
   */
  async loadFingerprintTemplate(name: string): Promise<FingerprintProfile> {
    const sanitizedName = this.sanitizeTemplateName(name);
    const templatesDir = this.getTemplatesDir();
    const templatePath = path.join(templatesDir, `${sanitizedName}.json`);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template "${name}" not found`);
    }
    
    const data = fs.readFileSync(templatePath, 'utf-8');
    const json = JSON.parse(data);
    
    return FingerprintProfile.fromJSON(json);
  }
  
  /**
   * Lists all available fingerprint templates
   * Validates: Requirements 25.3
   * 
   * @returns Array of template information objects
   */
  async listFingerprintTemplates(): Promise<FingerprintTemplateInfo[]> {
    const templatesDir = this.getTemplatesDir();
    
    if (!fs.existsSync(templatesDir)) {
      return [];
    }
    
    const files = fs.readdirSync(templatesDir);
    const templates: FingerprintTemplateInfo[] = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }
      
      try {
        const templatePath = path.join(templatesDir, file);
        const data = fs.readFileSync(templatePath, 'utf-8');
        const json = JSON.parse(data);
        
        templates.push({
          name: json.templateName || file.replace('.json', ''),
          platform: json.platform || 'Windows',
          browserVersion: json.browserVersion || 'Unknown',
          createdAt: json.templateCreatedAt ? new Date(json.templateCreatedAt) : new Date(json.createdAt || Date.now()),
          updatedAt: json.templateUpdatedAt ? new Date(json.templateUpdatedAt) : new Date(json.updatedAt || Date.now())
        });
      } catch (error) {
        // Skip invalid template files
        console.error(`Error reading template ${file}:`, error);
      }
    }
    
    return templates;
  }
  
  /**
   * Deletes a fingerprint template
   * Validates: Requirements 25.5
   * 
   * @param name - The name of the template to delete
   * @throws Error if template is not found
   */
  async deleteFingerprintTemplate(name: string): Promise<void> {
    const sanitizedName = this.sanitizeTemplateName(name);
    const templatesDir = this.getTemplatesDir();
    const templatePath = path.join(templatesDir, `${sanitizedName}.json`);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template "${name}" not found`);
    }
    
    fs.unlinkSync(templatePath);
  }
  
  /**
   * Checks if a template exists
   * 
   * @param name - The name of the template to check
   * @returns true if the template exists, false otherwise
   */
  async templateExists(name: string): Promise<boolean> {
    const sanitizedName = this.sanitizeTemplateName(name);
    const templatesDir = this.getTemplatesDir();
    const templatePath = path.join(templatesDir, `${sanitizedName}.json`);
    
    return fs.existsSync(templatePath);
  }
  
  /**
   * Exports account configuration with associated fingerprint template
   * Validates: Requirements 25.6
   * 
   * @param accountId - The account ID to export
   * @param templateName - Optional template name to include in export
   * @returns Exported account configuration with optional template
   */
  async exportAccountConfig(accountId: string, templateName?: string): Promise<ExportedAccountConfig> {
    const fingerprint = await this.getFingerprint(accountId);
    
    if (!fingerprint) {
      throw new Error(`Fingerprint not found for account ${accountId}`);
    }
    
    const exportData: ExportedAccountConfig = {
      accountId,
      fingerprint: fingerprint.toJSON() as FingerprintProfileData
    };
    
    // Include template if specified
    if (templateName) {
      try {
        const template = await this.loadFingerprintTemplate(templateName);
        exportData.template = {
          name: templateName,
          config: template.toJSON() as FingerprintProfileData
        };
      } catch (error) {
        // Template not found, continue without it
        console.warn(`Template "${templateName}" not found, exporting without template`);
      }
    }
    
    return exportData;
  }
  
  /**
   * Imports account configuration with optional template
   * 
   * @param exportedConfig - The exported configuration to import
   * @returns The imported fingerprint profile
   */
  async importAccountConfig(exportedConfig: ExportedAccountConfig): Promise<FingerprintProfile> {
    // Import the fingerprint
    const profile = await this.createFingerprint(
      exportedConfig.accountId,
      exportedConfig.fingerprint
    );
    
    // Import the template if present
    if (exportedConfig.template) {
      const templateProfile = FingerprintProfile.fromJSON(exportedConfig.template.config);
      await this.saveFingerprintTemplate(exportedConfig.template.name, templateProfile);
    }
    
    return profile;
  }
  
  /**
   * Gets the templates directory path
   * @private
   */
  private getTemplatesDir(): string {
    return path.join(this.sessionDataDir, 'fingerprint-templates');
  }
  
  /**
   * Sanitizes a template name for use as a filename
   * @private
   */
  private sanitizeTemplateName(name: string): string {
    // Remove or replace invalid filename characters
    return name
      .trim()
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100); // Limit length
  }
  
  /**
   * Applies a fingerprint template to multiple accounts
   * Validates: Requirements 32.1-32.7
   * 
   * @param accountIds - Array of account IDs to apply the template to
   * @param template - The fingerprint template to apply
   * @param onProgress - Optional callback for progress updates
   * @returns Batch result with success/failure counts and details
   */
  async applyFingerprintBatch(
    accountIds: string[],
    template: FingerprintProfile,
    onProgress?: BatchProgressCallback
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const result: BatchResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      successfulAccounts: [],
      failedAccounts: [],
      skippedAccounts: [],
      processingTime: 0
    };
    
    const totalAccounts = accountIds.length;
    
    for (let i = 0; i < accountIds.length; i++) {
      const accountId = accountIds[i];
      
      // Report progress - processing
      if (onProgress) {
        onProgress({
          currentAccountId: accountId,
          currentIndex: i,
          totalAccounts,
          percentComplete: Math.round((i / totalAccounts) * 100),
          status: 'processing'
        });
      }
      
      try {
        // Create a copy of the template for this account
        const profileData = {
          ...template.toJSON(),
          accountId,
          id: undefined, // Generate new ID
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await this.createFingerprint(accountId, profileData as Partial<FingerprintProfileData>);
        result.success++;
        result.successfulAccounts.push(accountId);
        
        // Report progress - success
        if (onProgress) {
          onProgress({
            currentAccountId: accountId,
            currentIndex: i,
            totalAccounts,
            percentComplete: Math.round(((i + 1) / totalAccounts) * 100),
            status: 'success'
          });
        }
      } catch (error) {
        result.failed++;
        result.failedAccounts.push(accountId);
        result.errors.push({
          accountId,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Report progress - failed
        if (onProgress) {
          onProgress({
            currentAccountId: accountId,
            currentIndex: i,
            totalAccounts,
            percentComplete: Math.round(((i + 1) / totalAccounts) * 100),
            status: 'failed'
          });
        }
      }
    }
    
    result.processingTime = Date.now() - startTime;
    return result;
  }
  
  /**
   * Applies a fingerprint template by name to multiple accounts
   * Validates: Requirements 32.2, 32.3
   * 
   * @param accountIds - Array of account IDs to apply the template to
   * @param templateName - Name of the template to apply
   * @param onProgress - Optional callback for progress updates
   * @returns Batch result with success/failure counts and details
   */
  async applyFingerprintTemplateBatch(
    accountIds: string[],
    templateName: string,
    onProgress?: BatchProgressCallback
  ): Promise<BatchResult> {
    // Load the template
    const template = await this.loadFingerprintTemplate(templateName);
    return this.applyFingerprintBatch(accountIds, template, onProgress);
  }
  
  /**
   * Generates a summary string for a batch operation result
   * Validates: Requirements 32.7
   * 
   * @param result - The batch result to summarize
   * @returns Human-readable summary string
   */
  generateBatchSummary(result: BatchResult): string {
    const parts: string[] = [];
    
    if (result.success > 0) {
      parts.push(`成功 ${result.success} 个`);
    }
    if (result.failed > 0) {
      parts.push(`失败 ${result.failed} 个`);
    }
    if (result.skipped > 0) {
      parts.push(`跳过 ${result.skipped} 个`);
    }
    
    const summary = parts.join('、');
    const timeStr = result.processingTime > 1000 
      ? `${(result.processingTime / 1000).toFixed(1)} 秒`
      : `${result.processingTime} 毫秒`;
    
    return `批量操作完成：${summary}，耗时 ${timeStr}`;
  }
  
  /**
   * Saves fingerprint configuration to disk
   * Validates: Requirements 12.1
   * @private
   */
  private async saveFingerprintToDisk(
    accountId: string,
    profile: FingerprintProfile
  ): Promise<void> {
    const accountDir = path.join(this.sessionDataDir, `account-${accountId}`);
    
    // Ensure account directory exists
    if (!fs.existsSync(accountDir)) {
      fs.mkdirSync(accountDir, { recursive: true });
    }
    
    const fingerprintPath = this.getFingerprintPath(accountId);
    const json = JSON.stringify(profile.toJSON(), null, 2);
    
    fs.writeFileSync(fingerprintPath, json, 'utf-8');
  }
  
  /**
   * Gets the file path for an account's fingerprint configuration
   * @private
   */
  private getFingerprintPath(accountId: string): string {
    return path.join(this.sessionDataDir, `account-${accountId}`, 'fingerprint.json');
  }
}
