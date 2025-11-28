/**
 * MiscFingerprintGenerator
 * 
 * Generates miscellaneous fingerprint configurations including
 * Do Not Track, Media Devices, Plugins, and Battery settings.
 * 
 * Requirements: 19.1-19.5, 21.1-21.5, 22.1-22.5, 23.1-23.5
 */

import { 
  DoNotTrackValue,
  BatteryConfig,
  BatteryMode,
  PluginsConfig,
  PluginsMode,
  PluginInfo,
  MediaDevicesConfig,
  MediaDevicesMode,
  MediaDeviceInfo
} from '../../../domain/entities/FingerprintProfile';

// Default plugin configurations
const DEFAULT_PLUGINS: PluginInfo[] = [
  {
    name: 'PDF Viewer',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      { type: 'application/pdf', description: 'Portable Document Format', suffixes: 'pdf' },
      { type: 'text/pdf', description: 'Portable Document Format', suffixes: 'pdf' }
    ]
  },
  {
    name: 'Chrome PDF Viewer',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      { type: 'application/pdf', description: 'Portable Document Format', suffixes: 'pdf' }
    ]
  },
  {
    name: 'Chromium PDF Viewer',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      { type: 'application/pdf', description: 'Portable Document Format', suffixes: 'pdf' }
    ]
  },
  {
    name: 'Microsoft Edge PDF Viewer',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      { type: 'application/pdf', description: 'Portable Document Format', suffixes: 'pdf' }
    ]
  },
  {
    name: 'WebKit built-in PDF',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      { type: 'application/pdf', description: 'Portable Document Format', suffixes: 'pdf' }
    ]
  }
];


// Default media device configurations
const DEFAULT_MEDIA_DEVICES: MediaDeviceInfo[] = [
  { deviceId: 'default', label: 'Default - Microphone', kind: 'audioinput' },
  { deviceId: 'communications', label: 'Communications - Microphone', kind: 'audioinput' },
  { deviceId: 'default', label: 'Default - Speakers', kind: 'audiooutput' },
  { deviceId: 'communications', label: 'Communications - Speakers', kind: 'audiooutput' }
];

export class MiscFingerprintGenerator {
  // ==================== Do Not Track ====================
  
  /**
   * Creates a Do Not Track value
   * Requirements: 21.1-21.3
   */
  static createDoNotTrack(mode: 'enabled' | 'disabled' | 'unspecified'): DoNotTrackValue {
    switch (mode) {
      case 'enabled':
        return '1';
      case 'disabled':
        return '0';
      case 'unspecified':
      default:
        return null;
    }
  }
  
  /**
   * Generates a random Do Not Track value
   */
  static generateRandomDoNotTrack(): DoNotTrackValue {
    const options: DoNotTrackValue[] = ['0', '1', null];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  /**
   * Generates Do Not Track override script
   * Requirements: 21.4, 21.5
   */
  static generateDoNotTrackScript(value: DoNotTrackValue): string {
    const dntValue = value === '1' ? '"1"' : value === '0' ? '"0"' : 'null';
    
    return `
(function() {
  // Do Not Track Override
  Object.defineProperty(navigator, 'doNotTrack', {
    get: function() { return ${dntValue}; },
    configurable: false,
    enumerable: true
  });
})();
`;
  }
  
  // ==================== Battery ====================
  
  /**
   * Creates a battery config
   * Requirements: 23.1-23.3
   */
  static createBatteryConfig(mode: BatteryMode): BatteryConfig {
    return { mode };
  }
  
  /**
   * Generates a random battery config
   */
  static generateRandomBatteryConfig(): BatteryConfig {
    const modes: BatteryMode[] = ['real', 'privacy', 'disabled'];
    return { mode: modes[Math.floor(Math.random() * modes.length)] };
  }
  
  /**
   * Validates battery configuration
   */
  static validateBatteryConfig(config: BatteryConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!['real', 'privacy', 'disabled'].includes(config.mode)) {
      errors.push(`Invalid battery mode: ${config.mode}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Generates battery override script
   * Requirements: 23.4, 23.5
   */
  static generateBatteryScript(config: BatteryConfig): string {
    if (config.mode === 'real') {
      return '// Battery: Real mode (no override)';
    }
    
    if (config.mode === 'disabled') {
      return `
(function() {
  // Battery API Disabled
  Object.defineProperty(navigator, 'getBattery', {
    get: function() { return undefined; },
    configurable: false,
    enumerable: true
  });
})();
`;
    }
    
    // Privacy mode - return fixed values
    return `
(function() {
  // Battery API Privacy Mode
  navigator.getBattery = function() {
    return Promise.resolve({
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1.0,
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true; },
      onchargingchange: null,
      onchargingtimechange: null,
      ondischargingtimechange: null,
      onlevelchange: null
    });
  };
})();
`;
  }
  
  // ==================== Plugins ====================
  
  /**
   * Gets default plugins
   */
  static getDefaultPlugins(): PluginInfo[] {
    return [...DEFAULT_PLUGINS];
  }
  
  /**
   * Creates a plugins config
   * Requirements: 22.1-22.3
   */
  static createPluginsConfig(mode: PluginsMode, list?: PluginInfo[]): PluginsConfig {
    if (mode === 'custom' && (!list || list.length === 0)) {
      return { mode: 'custom', list: DEFAULT_PLUGINS.slice(0, 2) };
    }
    return { mode, list };
  }
  
  /**
   * Generates a random plugins config
   */
  static generateRandomPluginsConfig(): PluginsConfig {
    const modes: PluginsMode[] = ['real', 'custom', 'empty'];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    
    if (mode === 'custom') {
      const count = Math.floor(Math.random() * 3) + 1;
      return { mode, list: DEFAULT_PLUGINS.slice(0, count) };
    }
    
    return { mode };
  }
  
  /**
   * Validates plugins configuration
   */
  static validatePluginsConfig(config: PluginsConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!['real', 'custom', 'empty'].includes(config.mode)) {
      errors.push(`Invalid plugins mode: ${config.mode}`);
    }
    
    if (config.mode === 'custom' && (!config.list || config.list.length === 0)) {
      errors.push('Plugin list is required when mode is custom');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Generates plugins override script
   * Requirements: 22.4, 22.5
   */
  static generatePluginsScript(config: PluginsConfig): string {
    if (config.mode === 'real') {
      return '// Plugins: Real mode (no override)';
    }
    
    if (config.mode === 'empty') {
      return `
(function() {
  // Plugins Empty
  Object.defineProperty(navigator, 'plugins', {
    get: function() {
      const emptyPlugins = {
        length: 0,
        item: function(index) { return null; },
        namedItem: function(name) { return null; },
        refresh: function() {},
        [Symbol.iterator]: function* () {}
      };
      return emptyPlugins;
    },
    configurable: false,
    enumerable: true
  });
  
  Object.defineProperty(navigator, 'mimeTypes', {
    get: function() {
      return {
        length: 0,
        item: function(index) { return null; },
        namedItem: function(name) { return null; },
        [Symbol.iterator]: function* () {}
      };
    },
    configurable: false,
    enumerable: true
  });
})();
`;
    }
    
    // Custom mode
    const pluginsJson = JSON.stringify(config.list || []);
    return `
(function() {
  // Plugins Custom
  const customPlugins = ${pluginsJson};
  
  const createPlugin = function(p) {
    const plugin = {
      name: p.name,
      description: p.description,
      filename: p.filename,
      length: p.mimeTypes.length
    };
    
    p.mimeTypes.forEach(function(mt, i) {
      plugin[i] = {
        type: mt.type,
        description: mt.description,
        suffixes: mt.suffixes,
        enabledPlugin: plugin
      };
    });
    
    plugin.item = function(index) { return this[index] || null; };
    plugin.namedItem = function(name) {
      for (let i = 0; i < this.length; i++) {
        if (this[i] && this[i].type === name) return this[i];
      }
      return null;
    };
    
    return plugin;
  };
  
  const pluginArray = customPlugins.map(createPlugin);
  
  Object.defineProperty(navigator, 'plugins', {
    get: function() {
      return {
        length: pluginArray.length,
        item: function(index) { return pluginArray[index] || null; },
        namedItem: function(name) {
          return pluginArray.find(function(p) { return p.name === name; }) || null;
        },
        refresh: function() {},
        [Symbol.iterator]: function* () {
          for (const p of pluginArray) yield p;
        }
      };
    },
    configurable: false,
    enumerable: true
  });
})();
`;
  }
  
  // ==================== Media Devices ====================
  
  /**
   * Gets default media devices
   */
  static getDefaultMediaDevices(): MediaDeviceInfo[] {
    return [...DEFAULT_MEDIA_DEVICES];
  }
  
  /**
   * Creates a media devices config
   * Requirements: 19.1-19.3
   */
  static createMediaDevicesConfig(mode: MediaDevicesMode, devices?: MediaDeviceInfo[]): MediaDevicesConfig {
    if (mode === 'custom' && (!devices || devices.length === 0)) {
      return { mode: 'custom', devices: DEFAULT_MEDIA_DEVICES.slice(0, 2) };
    }
    return { mode, devices };
  }
  
  /**
   * Generates a random media devices config
   */
  static generateRandomMediaDevicesConfig(): MediaDevicesConfig {
    const modes: MediaDevicesMode[] = ['real', 'custom', 'disabled'];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    
    if (mode === 'custom') {
      const count = Math.floor(Math.random() * 3) + 1;
      return { mode, devices: DEFAULT_MEDIA_DEVICES.slice(0, count) };
    }
    
    return { mode };
  }
  
  /**
   * Generates a random device ID
   */
  static generateDeviceId(): string {
    const chars = 'abcdef0123456789';
    let id = '';
    for (let i = 0; i < 64; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
  
  /**
   * Creates a custom media device
   */
  static createMediaDevice(
    kind: 'audioinput' | 'audiooutput' | 'videoinput',
    label: string,
    deviceId?: string
  ): MediaDeviceInfo {
    return {
      deviceId: deviceId || this.generateDeviceId(),
      label,
      kind
    };
  }
  
  /**
   * Validates media devices configuration
   */
  static validateMediaDevicesConfig(config: MediaDevicesConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!['real', 'custom', 'disabled'].includes(config.mode)) {
      errors.push(`Invalid media devices mode: ${config.mode}`);
    }
    
    if (config.mode === 'custom' && (!config.devices || config.devices.length === 0)) {
      errors.push('Media devices list is required when mode is custom');
    }
    
    if (config.devices) {
      for (const device of config.devices) {
        if (!['audioinput', 'audiooutput', 'videoinput'].includes(device.kind)) {
          errors.push(`Invalid device kind: ${device.kind}`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Generates media devices override script
   * Requirements: 19.4, 19.5
   */
  static generateMediaDevicesScript(config: MediaDevicesConfig): string {
    if (config.mode === 'real') {
      return '// Media Devices: Real mode (no override)';
    }
    
    if (config.mode === 'disabled') {
      return `
(function() {
  // Media Devices Disabled
  if (navigator.mediaDevices) {
    navigator.mediaDevices.enumerateDevices = function() {
      return Promise.resolve([]);
    };
  }
})();
`;
    }
    
    // Custom mode
    const devicesJson = JSON.stringify(config.devices || []);
    return `
(function() {
  // Media Devices Custom
  const customDevices = ${devicesJson};
  
  if (navigator.mediaDevices) {
    navigator.mediaDevices.enumerateDevices = function() {
      return Promise.resolve(customDevices.map(function(d) {
        return {
          deviceId: d.deviceId,
          kind: d.kind,
          label: d.label,
          groupId: 'default',
          toJSON: function() {
            return {
              deviceId: this.deviceId,
              kind: this.kind,
              label: this.label,
              groupId: this.groupId
            };
          }
        };
      }));
    };
  }
})();
`;
  }
  
  // ==================== Combined ====================
  
  /**
   * Generates combined miscellaneous fingerprint script
   */
  static generateCombinedScript(
    doNotTrack: DoNotTrackValue,
    battery: BatteryConfig,
    plugins: PluginsConfig,
    mediaDevices: MediaDevicesConfig
  ): string {
    const scripts: string[] = [];
    
    if (doNotTrack !== null) {
      scripts.push(this.generateDoNotTrackScript(doNotTrack));
    }
    
    if (battery.mode !== 'real') {
      scripts.push(this.generateBatteryScript(battery));
    }
    
    if (plugins.mode !== 'real') {
      scripts.push(this.generatePluginsScript(plugins));
    }
    
    if (mediaDevices.mode !== 'real') {
      scripts.push(this.generateMediaDevicesScript(mediaDevices));
    }
    
    return scripts.join('\n');
  }
}

export default MiscFingerprintGenerator;