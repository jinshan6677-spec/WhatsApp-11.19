/**
 * FingerprintInjector
 * 
 * Manages the injection of fingerprint scripts at different browser lifecycle stages.
 * Handles Chromium launch arguments, preload scripts, DOM ready scripts, and request hooks.
 * 
 * Requirements: 13.1-13.5, 27.1-27.6
 */

import { FingerprintProfile } from '../../domain/entities/FingerprintProfile';
import { FingerprintScriptGenerator, ScriptGenerationOptions } from './FingerprintScriptGenerator';

export interface ChromiumArgs {
  args: string[];
  userAgent?: string;
}

export interface InjectionResult {
  success: boolean;
  stage: 'preload' | 'dom-ready' | 'request-hook';
  error?: string;
}

export interface WebContentsLike {
  executeJavaScript(code: string, userGesture?: boolean): Promise<any>;
  session: {
    webRequest: {
      onBeforeRequest(
        filter: { urls: string[] },
        listener: (details: any, callback: (response: any) => void) => void
      ): void;
      onBeforeSendHeaders(
        filter: { urls: string[] },
        listener: (details: any, callback: (response: any) => void) => void
      ): void;
    };
    cookies: {
      set(cookie: any): Promise<void>;
    };
  };
}

export class FingerprintInjector {
  private profile: FingerprintProfile;
  private seed: number;
  
  constructor(profile: FingerprintProfile) {
    this.profile = profile;
    this.seed = this.generateSeed();
  }
  
  /**
   * Gets Chromium launch arguments for fingerprint configuration
   * Requirements: 27.1 (Before Launch stage)
   */
  getChromiumArgs(): ChromiumArgs {
    const args: string[] = [];
    
    // Disable WebRTC if configured
    if (this.profile.webrtc.mode === 'disabled') {
      args.push('--disable-webrtc');
      args.push('--disable-webrtc-hw-encoding');
      args.push('--disable-webrtc-hw-decoding');
    }
    
    // Disable features that can leak fingerprint info
    args.push('--disable-features=WebRtcHideLocalIpsWithMdns');
    
    // Disable GPU hardware acceleration fingerprinting
    if (this.profile.webgl.mode !== 'real') {
      args.push('--disable-gpu-driver-bug-workarounds');
    }
    
    // Set window size if custom screen is configured
    if (this.profile.screen.mode === 'custom' && 
        this.profile.screen.width && 
        this.profile.screen.height) {
      args.push(`--window-size=${this.profile.screen.width},${this.profile.screen.height}`);
    }
    
    // Disable automation detection
    args.push('--disable-blink-features=AutomationControlled');
    
    // Disable infobars
    args.push('--disable-infobars');
    
    // Disable extensions
    args.push('--disable-extensions');
    
    // Disable default browser check
    args.push('--no-default-browser-check');
    
    // Disable first run experience
    args.push('--no-first-run');
    
    return {
      args,
      userAgent: this.profile.userAgent
    };
  }
  
  /**
   * Injects preload script to override navigator and screen objects
   * Requirements: 27.2 (Preload stage)
   */
  async injectPreloadScript(webContents: WebContentsLike): Promise<InjectionResult> {
    try {
      // Generate preload script with basic overrides
      const preloadOptions: ScriptGenerationOptions = {
        includeUserAgent: true,
        includeLanguage: true,
        includeHardware: true,
        includeDoNotTrack: true,
        includeScreen: this.profile.screen.mode === 'custom',
        // Exclude complex overrides for preload stage
        includeWebGL: false,
        includeCanvas: false,
        includeAudio: false,
        includeWebRTC: false,
        includeTimezone: false,
        includeGeolocation: false,
        includeBattery: false,
        includePlugins: false,
        includeMediaDevices: false,
        includeClientRects: false,
        seed: this.seed
      };
      
      const script = FingerprintScriptGenerator.generate(this.profile, preloadOptions);
      
      await webContents.executeJavaScript(script, true);
      
      return {
        success: true,
        stage: 'preload'
      };
    } catch (error) {
      return {
        success: false,
        stage: 'preload',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Injects DOM ready script for WebGL, Canvas, Audio hooks
   * Requirements: 27.3 (DOM Ready stage)
   */
  async injectDOMReadyScript(webContents: WebContentsLike): Promise<InjectionResult> {
    try {
      // Generate DOM ready script with complex overrides
      const domReadyOptions: ScriptGenerationOptions = {
        // Exclude basic overrides (already done in preload)
        includeUserAgent: false,
        includeLanguage: false,
        includeHardware: false,
        includeDoNotTrack: false,
        includeScreen: false,
        // Include complex overrides
        includeWebGL: this.profile.webgl.mode !== 'real',
        includeCanvas: this.profile.canvas.mode === 'random',
        includeAudio: this.profile.audio.mode === 'random',
        includeWebRTC: this.profile.webrtc.mode !== 'real',
        includeTimezone: this.profile.timezone.mode !== 'real',
        includeGeolocation: this.profile.geolocation.mode !== 'prompt',
        includeBattery: this.profile.battery.mode !== 'real',
        includePlugins: this.profile.plugins.mode !== 'real',
        includeMediaDevices: this.profile.mediaDevices.mode !== 'real',
        includeClientRects: this.profile.canvas.mode === 'random',
        seed: this.seed
      };
      
      const script = FingerprintScriptGenerator.generate(this.profile, domReadyOptions);
      
      await webContents.executeJavaScript(script, true);
      
      return {
        success: true,
        stage: 'dom-ready'
      };
    } catch (error) {
      return {
        success: false,
        stage: 'dom-ready',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Sets up request hooks for cookie injection and port scan protection
   * Requirements: 27.4 (Request Hook stage)
   */
  setupRequestHooks(webContents: WebContentsLike, cookies?: any[]): void {
    // Set up cookie injection
    if (cookies && cookies.length > 0) {
      this.injectCookies(webContents, cookies);
    }
    
    // Set up port scan protection
    this.setupPortScanProtection(webContents);
    
    // Set up User-Agent header override
    this.setupUserAgentHeader(webContents);
  }
  
  /**
   * Injects the complete fingerprint script (all stages combined)
   * Requirements: 13.1-13.5
   */
  async injectFingerprint(webContents: WebContentsLike): Promise<InjectionResult[]> {
    const results: InjectionResult[] = [];
    
    // Stage 1: Preload
    const preloadResult = await this.injectPreloadScript(webContents);
    results.push(preloadResult);
    
    // Stage 2: DOM Ready
    const domReadyResult = await this.injectDOMReadyScript(webContents);
    results.push(domReadyResult);
    
    return results;
  }
  
  /**
   * Generates the complete fingerprint script
   */
  generateFingerprintScript(): string {
    return FingerprintScriptGenerator.generate(this.profile, { seed: this.seed });
  }
  
  /**
   * Updates the fingerprint profile
   */
  updateProfile(profile: FingerprintProfile): void {
    this.profile = profile;
  }
  
  /**
   * Gets the current fingerprint profile
   */
  getProfile(): FingerprintProfile {
    return this.profile;
  }
  
  /**
   * Regenerates the seed for randomization
   */
  regenerateSeed(): void {
    this.seed = this.generateSeed();
  }
  
  // Private methods
  
  private generateSeed(): number {
    return Math.floor(Math.random() * 2147483647);
  }
  
  private async injectCookies(webContents: WebContentsLike, cookies: any[]): Promise<void> {
    for (const cookie of cookies) {
      try {
        await webContents.session.cookies.set({
          url: cookie.url || `https://${cookie.domain}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure ?? true,
          httpOnly: cookie.httpOnly ?? false,
          expirationDate: cookie.expirationDate
        });
      } catch (error) {
        console.error(`Failed to inject cookie ${cookie.name}:`, error);
      }
    }
  }
  
  private setupPortScanProtection(webContents: WebContentsLike): void {
    // Block requests to local addresses
    const localPatterns = [
      '*://127.0.0.1:*/*',
      '*://localhost:*/*',
      '*://192.168.*:*/*',
      '*://10.*:*/*',
      '*://172.16.*:*/*',
      '*://172.17.*:*/*',
      '*://172.18.*:*/*',
      '*://172.19.*:*/*',
      '*://172.20.*:*/*',
      '*://172.21.*:*/*',
      '*://172.22.*:*/*',
      '*://172.23.*:*/*',
      '*://172.24.*:*/*',
      '*://172.25.*:*/*',
      '*://172.26.*:*/*',
      '*://172.27.*:*/*',
      '*://172.28.*:*/*',
      '*://172.29.*:*/*',
      '*://172.30.*:*/*',
      '*://172.31.*:*/*'
    ];
    
    // Sensitive ports to block
    const sensitivePorts = [22, 23, 25, 110, 143, 445, 3389, 5900, 5901, 6379, 27017];
    
    webContents.session.webRequest.onBeforeRequest(
      { urls: ['<all_urls>'] },
      (details, callback) => {
        try {
          const url = new URL(details.url);
          
          // Check for local addresses
          const isLocal = 
            url.hostname === '127.0.0.1' ||
            url.hostname === 'localhost' ||
            url.hostname.startsWith('192.168.') ||
            url.hostname.startsWith('10.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(url.hostname);
          
          // Check for sensitive ports
          const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
          const isSensitivePort = sensitivePorts.includes(port);
          
          if (isLocal || isSensitivePort) {
            callback({ cancel: true });
            return;
          }
        } catch (e) {
          // Invalid URL, allow it to fail naturally
        }
        
        callback({});
      }
    );
  }
  
  private setupUserAgentHeader(webContents: WebContentsLike): void {
    webContents.session.webRequest.onBeforeSendHeaders(
      { urls: ['<all_urls>'] },
      (details, callback) => {
        const requestHeaders = { ...details.requestHeaders };
        requestHeaders['User-Agent'] = this.profile.userAgent;
        
        // Set Accept-Language based on language config
        if (this.profile.language.value) {
          requestHeaders['Accept-Language'] = `${this.profile.language.value},${this.profile.language.value.split('-')[0]};q=0.9`;
        }
        
        callback({ requestHeaders });
      }
    );
  }
}

export default FingerprintInjector;
