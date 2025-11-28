/**
 * FingerprintProfile Entity
 * 
 * Represents a complete browser fingerprint configuration for an account.
 * This entity encapsulates all fingerprint parameters including browser info,
 * WebGL, Canvas, Audio, WebRTC, environment attributes, and device information.
 */

export type Platform = 'Windows' | 'MacOS' | 'Linux';
export type WebGLMode = 'real' | 'custom' | 'random';
export type CanvasMode = 'real' | 'random';
export type AudioMode = 'real' | 'random';
export type WebRTCMode = 'disabled' | 'replaced' | 'real';
export type TimezoneMode = 'ip-based' | 'real' | 'custom';
export type GeolocationMode = 'ip-based' | 'prompt' | 'deny';
export type LanguageMode = 'ip-based' | 'custom';
export type ScreenMode = 'real' | 'custom';
export type BatteryMode = 'real' | 'privacy' | 'disabled';
export type FontsMode = 'system' | 'custom';
export type PluginsMode = 'real' | 'custom' | 'empty';
export type MediaDevicesMode = 'real' | 'custom' | 'disabled';
export type DoNotTrackValue = '0' | '1' | null;

export interface WebGLConfig {
  vendor: string;
  renderer: string;
  mode: WebGLMode;
}

export interface CanvasConfig {
  mode: CanvasMode;
  noiseLevel?: number;
}

export interface AudioConfig {
  mode: AudioMode;
  noiseLevel?: number;
}

export interface WebRTCConfig {
  mode: WebRTCMode;
  fakeLocalIP?: string;
}

export interface TimezoneConfig {
  mode: TimezoneMode;
  value?: string;
}

export interface GeolocationConfig {
  mode: GeolocationMode;
  latitude?: number;
  longitude?: number;
}

export interface LanguageConfig {
  mode: LanguageMode;
  value?: string;
}

export interface ScreenConfig {
  mode: ScreenMode;
  width?: number;
  height?: number;
}

export interface HardwareConfig {
  cpuCores: number;
  memory: number; // GB
  deviceName?: string;
  macAddress?: string;
}

export interface BatteryConfig {
  mode: BatteryMode;
}

export interface FontsConfig {
  mode: FontsMode;
  list?: string[];
}

export interface PluginInfo {
  name: string;
  description: string;
  filename: string;
  mimeTypes: Array<{
    type: string;
    description: string;
    suffixes: string;
  }>;
}

export interface PluginsConfig {
  mode: PluginsMode;
  list?: PluginInfo[];
}

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

export interface MediaDevicesConfig {
  mode: MediaDevicesMode;
  devices?: MediaDeviceInfo[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FingerprintProfileData {
  id?: string;
  accountId?: string;
  
  // Browser information
  userAgent: string;
  browserVersion: string;
  platform: Platform;
  
  // Fingerprint configuration
  webgl: WebGLConfig;
  canvas: CanvasConfig;
  audio: AudioConfig;
  webrtc: WebRTCConfig;
  timezone: TimezoneConfig;
  geolocation: GeolocationConfig;
  language: LanguageConfig;
  screen: ScreenConfig;
  hardware: HardwareConfig;
  doNotTrack: DoNotTrackValue;
  battery: BatteryConfig;
  fonts: FontsConfig;
  plugins: PluginsConfig;
  mediaDevices: MediaDevicesConfig;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
}

export class FingerprintProfile {
  id: string;
  accountId: string;
  
  // Browser information
  userAgent: string;
  browserVersion: string;
  platform: Platform;
  
  // Fingerprint configuration
  webgl: WebGLConfig;
  canvas: CanvasConfig;
  audio: AudioConfig;
  webrtc: WebRTCConfig;
  timezone: TimezoneConfig;
  geolocation: GeolocationConfig;
  language: LanguageConfig;
  screen: ScreenConfig;
  hardware: HardwareConfig;
  doNotTrack: DoNotTrackValue;
  battery: BatteryConfig;
  fonts: FontsConfig;
  plugins: PluginsConfig;
  mediaDevices: MediaDevicesConfig;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: number;
  
  constructor(data: FingerprintProfileData) {
    this.id = data.id || this.generateId();
    this.accountId = data.accountId || '';
    
    // Browser information
    this.userAgent = data.userAgent;
    this.browserVersion = data.browserVersion;
    this.platform = data.platform;
    
    // Fingerprint configuration
    this.webgl = data.webgl;
    this.canvas = data.canvas;
    this.audio = data.audio;
    this.webrtc = data.webrtc;
    this.timezone = data.timezone;
    this.geolocation = data.geolocation;
    this.language = data.language;
    this.screen = data.screen;
    this.hardware = data.hardware;
    this.doNotTrack = data.doNotTrack;
    this.battery = data.battery;
    this.fonts = data.fonts;
    this.plugins = data.plugins;
    this.mediaDevices = data.mediaDevices;
    
    // Metadata
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.version = data.version || 1;
  }
  
  /**
   * Validates the fingerprint configuration for consistency and correctness
   * Validates: Requirements 24.1-24.5
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate User-Agent
    if (!this.userAgent || this.userAgent.trim().length === 0) {
      errors.push('User-Agent cannot be empty');
    }
    
    // Validate platform consistency with User-Agent
    if (this.platform === 'Windows' && this.userAgent.includes('Mac OS')) {
      warnings.push('Platform is Windows but User-Agent contains Mac OS');
    }
    if (this.platform === 'MacOS' && this.userAgent.includes('Windows')) {
      warnings.push('Platform is MacOS but User-Agent contains Windows');
    }
    
    // Validate WebGL configuration
    if (this.webgl.mode === 'custom') {
      if (!this.webgl.vendor || this.webgl.vendor.trim().length === 0) {
        errors.push('WebGL vendor is required when mode is custom');
      }
      if (!this.webgl.renderer || this.webgl.renderer.trim().length === 0) {
        errors.push('WebGL renderer is required when mode is custom');
      }
      
      // Validate WebGL consistency with platform
      if (this.platform === 'Windows' && this.webgl.vendor.includes('Apple')) {
        warnings.push('Platform is Windows but WebGL vendor is Apple');
      }
      if (this.platform === 'MacOS' && this.webgl.vendor.includes('NVIDIA') && !this.webgl.renderer.includes('Mac')) {
        warnings.push('Platform is MacOS but WebGL renderer does not indicate Mac');
      }
    }
    
    // Validate Canvas configuration
    if (this.canvas.mode === 'random' && this.canvas.noiseLevel !== undefined) {
      if (this.canvas.noiseLevel < 0 || this.canvas.noiseLevel > 10) {
        errors.push('Canvas noise level must be between 0 and 10');
      }
    }
    
    // Validate Audio configuration
    if (this.audio.mode === 'random' && this.audio.noiseLevel !== undefined) {
      if (this.audio.noiseLevel < 0 || this.audio.noiseLevel > 10) {
        errors.push('Audio noise level must be between 0 and 10');
      }
    }
    
    // Validate WebRTC configuration
    if (this.webrtc.mode === 'replaced' && !this.webrtc.fakeLocalIP) {
      errors.push('Fake local IP is required when WebRTC mode is replaced');
    }
    
    // Validate timezone configuration
    if (this.timezone.mode === 'custom' && !this.timezone.value) {
      errors.push('Timezone value is required when mode is custom');
    }
    
    // Validate geolocation configuration
    if (this.geolocation.mode === 'ip-based') {
      if (this.geolocation.latitude !== undefined && (this.geolocation.latitude < -90 || this.geolocation.latitude > 90)) {
        errors.push('Latitude must be between -90 and 90');
      }
      if (this.geolocation.longitude !== undefined && (this.geolocation.longitude < -180 || this.geolocation.longitude > 180)) {
        errors.push('Longitude must be between -180 and 180');
      }
    }
    
    // Validate language configuration
    if (this.language.mode === 'custom' && !this.language.value) {
      errors.push('Language value is required when mode is custom');
    }
    
    // Validate screen configuration
    if (this.screen.mode === 'custom') {
      if (!this.screen.width || this.screen.width <= 0) {
        errors.push('Screen width must be positive when mode is custom');
      }
      if (!this.screen.height || this.screen.height <= 0) {
        errors.push('Screen height must be positive when mode is custom');
      }
      
      // Validate screen resolution reasonableness
      if (this.screen.width && this.screen.height) {
        if (this.screen.width < 640 || this.screen.height < 480) {
          warnings.push('Screen resolution is unusually small (< 640x480)');
        }
        if (this.screen.width > 7680 || this.screen.height > 4320) {
          warnings.push('Screen resolution is unusually large (> 8K)');
        }
      }
    }
    
    // Validate hardware configuration
    if (this.hardware.cpuCores <= 0) {
      errors.push('CPU cores must be positive');
    }
    if (this.hardware.cpuCores > 128) {
      warnings.push('CPU cores is unusually high (> 128)');
    }
    
    if (this.hardware.memory <= 0) {
      errors.push('Memory must be positive');
    }
    if (this.hardware.memory > 256) {
      warnings.push('Memory is unusually high (> 256 GB)');
    }
    
    // Validate CPU and memory consistency
    if (this.hardware.cpuCores > 16 && this.hardware.memory < 8) {
      warnings.push('High CPU cores (> 16) with low memory (< 8 GB) is unusual');
    }
    
    // Validate fonts configuration
    if (this.fonts.mode === 'custom' && (!this.fonts.list || this.fonts.list.length === 0)) {
      errors.push('Font list is required when mode is custom');
    }
    
    // Validate plugins configuration
    if (this.plugins.mode === 'custom' && (!this.plugins.list || this.plugins.list.length === 0)) {
      errors.push('Plugin list is required when mode is custom');
    }
    
    // Validate media devices configuration
    if (this.mediaDevices.mode === 'custom' && (!this.mediaDevices.devices || this.mediaDevices.devices.length === 0)) {
      errors.push('Media devices list is required when mode is custom');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Converts the fingerprint profile to a JSON object
   * Validates: Requirements 12.1, 12.5
   */
  toJSON(): object {
    // Ensure dates are valid before converting to ISO string
    const createdAt = this.createdAt && !isNaN(this.createdAt.getTime()) 
      ? this.createdAt.toISOString() 
      : new Date().toISOString();
    const updatedAt = this.updatedAt && !isNaN(this.updatedAt.getTime()) 
      ? this.updatedAt.toISOString() 
      : new Date().toISOString();
    
    return {
      id: this.id,
      accountId: this.accountId,
      userAgent: this.userAgent,
      browserVersion: this.browserVersion,
      platform: this.platform,
      webgl: this.webgl,
      canvas: this.canvas,
      audio: this.audio,
      webrtc: this.webrtc,
      timezone: this.timezone,
      geolocation: this.geolocation,
      language: this.language,
      screen: this.screen,
      hardware: this.hardware,
      doNotTrack: this.doNotTrack,
      battery: this.battery,
      fonts: this.fonts,
      plugins: this.plugins,
      mediaDevices: this.mediaDevices,
      createdAt,
      updatedAt,
      version: this.version
    };
  }
  
  /**
   * Creates a FingerprintProfile instance from a JSON object
   * Validates: Requirements 12.2
   */
  static fromJSON(data: any): FingerprintProfile {
    return new FingerprintProfile({
      id: data.id,
      accountId: data.accountId,
      userAgent: data.userAgent,
      browserVersion: data.browserVersion,
      platform: data.platform,
      webgl: data.webgl,
      canvas: data.canvas,
      audio: data.audio,
      webrtc: data.webrtc,
      timezone: data.timezone,
      geolocation: data.geolocation,
      language: data.language,
      screen: data.screen,
      hardware: data.hardware,
      doNotTrack: data.doNotTrack,
      battery: data.battery,
      fonts: data.fonts,
      plugins: data.plugins,
      mediaDevices: data.mediaDevices,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
      version: data.version
    });
  }
  
  /**
   * Creates a default fingerprint profile with "real" mode for all settings
   */
  static createDefault(accountId: string): FingerprintProfile {
    return new FingerprintProfile({
      accountId,
      userAgent: navigator.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      browserVersion: 'Chrome 120',
      platform: 'Windows',
      webgl: {
        vendor: 'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
        mode: 'real'
      },
      canvas: {
        mode: 'real'
      },
      audio: {
        mode: 'real'
      },
      webrtc: {
        mode: 'real'
      },
      timezone: {
        mode: 'real'
      },
      geolocation: {
        mode: 'prompt'
      },
      language: {
        mode: 'custom',
        value: 'en-US'
      },
      screen: {
        mode: 'real'
      },
      hardware: {
        cpuCores: 8,
        memory: 16
      },
      doNotTrack: null,
      battery: {
        mode: 'real'
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
    });
  }
  
  private generateId(): string {
    return `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
