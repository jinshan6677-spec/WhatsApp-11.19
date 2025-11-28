/**
 * FingerprintScriptGenerator
 * 
 * Generates JavaScript injection scripts for browser fingerprint spoofing.
 * Creates scripts that override navigator, screen, WebGL, Canvas, Audio, and WebRTC APIs.
 * 
 * Requirements: 3.6, 4.6, 5.1-5.5, 6.6
 */

import { FingerprintProfile } from '../../domain/entities/FingerprintProfile';
import { CanvasGenerator } from './generators/CanvasGenerator';

export interface ScriptGenerationOptions {
  includeUserAgent?: boolean;
  includeWebGL?: boolean;
  includeCanvas?: boolean;
  includeAudio?: boolean;
  includeWebRTC?: boolean;
  includeTimezone?: boolean;
  includeGeolocation?: boolean;
  includeLanguage?: boolean;
  includeScreen?: boolean;
  includeHardware?: boolean;
  includeDoNotTrack?: boolean;
  includeBattery?: boolean;
  includePlugins?: boolean;
  includeMediaDevices?: boolean;
  includeClientRects?: boolean;
  seed?: number;
}

const DEFAULT_OPTIONS: ScriptGenerationOptions = {
  includeUserAgent: true,
  includeWebGL: true,
  includeCanvas: true,
  includeAudio: true,
  includeWebRTC: true,
  includeTimezone: true,
  includeGeolocation: true,
  includeLanguage: true,
  includeScreen: true,
  includeHardware: true,
  includeDoNotTrack: true,
  includeBattery: true,
  includePlugins: true,
  includeMediaDevices: true,
  includeClientRects: true
};

export class FingerprintScriptGenerator {
  /**
   * Generates a complete fingerprint injection script
   */
  static generate(profile: FingerprintProfile, options: ScriptGenerationOptions = {}): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const scripts: string[] = [];
    
    // Add IIFE wrapper start
    scripts.push('(function() {');
    scripts.push('  "use strict";');
    scripts.push('');
    
    // Generate individual override scripts
    if (opts.includeUserAgent) {
      scripts.push(this.generateUserAgentScript(profile));
    }
    
    if (opts.includeWebGL && profile.webgl.mode !== 'real') {
      scripts.push(this.generateWebGLScript(profile));
    }
    
    if (opts.includeCanvas && profile.canvas.mode === 'random') {
      scripts.push(this.generateCanvasScript(profile, opts.seed));
    }
    
    if (opts.includeAudio && profile.audio.mode === 'random') {
      scripts.push(this.generateAudioScript(profile, opts.seed));
    }
    
    if (opts.includeWebRTC && profile.webrtc.mode !== 'real') {
      scripts.push(this.generateWebRTCScript(profile));
    }
    
    if (opts.includeTimezone && profile.timezone.mode !== 'real') {
      scripts.push(this.generateTimezoneScript(profile));
    }
    
    if (opts.includeGeolocation && profile.geolocation.mode !== 'prompt') {
      scripts.push(this.generateGeolocationScript(profile));
    }
    
    if (opts.includeLanguage && profile.language.mode !== 'ip-based') {
      scripts.push(this.generateLanguageScript(profile));
    }
    
    if (opts.includeScreen && profile.screen.mode === 'custom') {
      scripts.push(this.generateScreenScript(profile));
    }
    
    if (opts.includeHardware) {
      scripts.push(this.generateHardwareScript(profile));
    }
    
    if (opts.includeDoNotTrack && profile.doNotTrack !== null) {
      scripts.push(this.generateDoNotTrackScript(profile));
    }
    
    if (opts.includeBattery && profile.battery.mode !== 'real') {
      scripts.push(this.generateBatteryScript(profile));
    }
    
    if (opts.includePlugins && profile.plugins.mode !== 'real') {
      scripts.push(this.generatePluginsScript(profile));
    }
    
    if (opts.includeMediaDevices && profile.mediaDevices.mode !== 'real') {
      scripts.push(this.generateMediaDevicesScript(profile));
    }
    
    if (opts.includeClientRects && profile.canvas.mode === 'random') {
      scripts.push(this.generateClientRectsScript(opts.seed));
    }
    
    // Add IIFE wrapper end
    scripts.push('})();');
    
    return scripts.join('\n');
  }
  
  /**
   * Generates User-Agent override script
   * Requirements: 3.6
   */
  static generateUserAgentScript(profile: FingerprintProfile): string {
    const userAgent = this.escapeString(profile.userAgent);
    const platform = profile.platform === 'MacOS' ? 'MacIntel' : 
                     profile.platform === 'Windows' ? 'Win32' : 'Linux x86_64';
    
    return `
  // User-Agent Override
  Object.defineProperty(navigator, 'userAgent', {
    get: function() { return '${userAgent}'; },
    configurable: false
  });
  
  Object.defineProperty(navigator, 'appVersion', {
    get: function() { return '${userAgent.replace('Mozilla/', '')}'; },
    configurable: false
  });
  
  Object.defineProperty(navigator, 'platform', {
    get: function() { return '${platform}'; },
    configurable: false
  });
`;
  }
  
  /**
   * Generates WebGL override script
   * Requirements: 4.6
   */
  static generateWebGLScript(profile: FingerprintProfile): string {
    const vendor = this.escapeString(profile.webgl.vendor);
    const renderer = this.escapeString(profile.webgl.renderer);
    
    return `
  // WebGL Override
  (function() {
    const VENDOR = '${vendor}';
    const RENDERER = '${renderer}';
    
    // WebGL1
    const getParameterWebGL1 = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      if (param === 0x1F00) return VENDOR;  // VENDOR
      if (param === 0x1F01) return RENDERER; // RENDERER
      if (param === 0x9245) return VENDOR;  // UNMASKED_VENDOR_WEBGL
      if (param === 0x9246) return RENDERER; // UNMASKED_RENDERER_WEBGL
      return getParameterWebGL1.call(this, param);
    };
    
    // WebGL2
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParameterWebGL2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 0x1F00) return VENDOR;
        if (param === 0x1F01) return RENDERER;
        if (param === 0x9245) return VENDOR;
        if (param === 0x9246) return RENDERER;
        return getParameterWebGL2.call(this, param);
      };
    }
    
    // Override getExtension for debug info
    const originalGetExtension = WebGLRenderingContext.prototype.getExtension;
    WebGLRenderingContext.prototype.getExtension = function(name) {
      const ext = originalGetExtension.call(this, name);
      if (name === 'WEBGL_debug_renderer_info' && ext) {
        return {
          UNMASKED_VENDOR_WEBGL: 0x9245,
          UNMASKED_RENDERER_WEBGL: 0x9246
        };
      }
      return ext;
    };
  })();
`;
  }
  
  /**
   * Generates Canvas noise injection script
   * Requirements: 6.6
   */
  static generateCanvasScript(profile: FingerprintProfile, seed?: number): string {
    const noiseConfig = CanvasGenerator.toCanvasNoiseConfig(profile.canvas, seed);
    return CanvasGenerator.generateCanvasNoiseScript(noiseConfig);
  }
  
  /**
   * Generates Audio noise injection script
   * Requirements: 6.6
   */
  static generateAudioScript(profile: FingerprintProfile, seed?: number): string {
    const noiseConfig = CanvasGenerator.toAudioNoiseConfig(profile.audio, seed);
    return CanvasGenerator.generateAudioNoiseScript(noiseConfig);
  }
  
  /**
   * Generates WebRTC override script
   * Requirements: 5.1-5.5
   */
  static generateWebRTCScript(profile: FingerprintProfile): string {
    if (profile.webrtc.mode === 'disabled') {
      return `
  // WebRTC Disabled
  (function() {
    // Remove RTCPeerConnection
    delete window.RTCPeerConnection;
    delete window.webkitRTCPeerConnection;
    delete window.mozRTCPeerConnection;
    
    // Remove related APIs
    delete window.RTCDataChannel;
    delete window.RTCSessionDescription;
    delete window.RTCIceCandidate;
    
    // Override navigator.mediaDevices.getUserMedia
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = function() {
        return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      };
    }
    
    // Override legacy getUserMedia
    navigator.getUserMedia = undefined;
    navigator.webkitGetUserMedia = undefined;
    navigator.mozGetUserMedia = undefined;
  })();
`;
    }
    
    if (profile.webrtc.mode === 'replaced') {
      const fakeIP = profile.webrtc.fakeLocalIP || '192.168.1.100';
      return `
  // WebRTC IP Replacement
  (function() {
    const FAKE_IP = '${fakeIP}';
    
    const OriginalRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    
    if (OriginalRTCPeerConnection) {
      window.RTCPeerConnection = function(config) {
        const pc = new OriginalRTCPeerConnection(config);
        
        // Override onicecandidate to replace IP addresses
        const originalSetLocalDescription = pc.setLocalDescription.bind(pc);
        pc.setLocalDescription = function(desc) {
          if (desc && desc.sdp) {
            // Replace IP addresses in SDP
            desc.sdp = desc.sdp.replace(/([0-9]{1,3}(\\.[0-9]{1,3}){3})/g, FAKE_IP);
          }
          return originalSetLocalDescription(desc);
        };
        
        return pc;
      };
      
      window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
      window.webkitRTCPeerConnection = window.RTCPeerConnection;
    }
  })();
`;
    }
    
    return '// WebRTC: Real mode (no override)';
  }
  
  /**
   * Generates timezone override script
   */
  static generateTimezoneScript(profile: FingerprintProfile): string {
    if (profile.timezone.mode === 'real') {
      return '// Timezone: Real mode (no override)';
    }
    
    const timezone = profile.timezone.value || 'UTC';
    
    return `
  // Timezone Override
  (function() {
    const TIMEZONE = '${timezone}';
    
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function(locales, options) {
      const opts = options || {};
      opts.timeZone = TIMEZONE;
      return new OriginalDateTimeFormat(locales, opts);
    };
    Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
    Intl.DateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;
    
    // Override Date.prototype.getTimezoneOffset
    const timezoneOffsets = {
      'UTC': 0,
      'America/New_York': 300,
      'America/Los_Angeles': 480,
      'Europe/London': 0,
      'Europe/Paris': -60,
      'Asia/Tokyo': -540,
      'Asia/Shanghai': -480,
      'Australia/Sydney': -660
    };
    
    const offset = timezoneOffsets[TIMEZONE] || 0;
    Date.prototype.getTimezoneOffset = function() {
      return offset;
    };
  })();
`;
  }
  
  /**
   * Generates geolocation override script
   */
  static generateGeolocationScript(profile: FingerprintProfile): string {
    if (profile.geolocation.mode === 'deny') {
      return `
  // Geolocation Denied
  (function() {
    navigator.geolocation.getCurrentPosition = function(success, error) {
      if (error) {
        error({ code: 1, message: 'User denied Geolocation' });
      }
    };
    navigator.geolocation.watchPosition = function(success, error) {
      if (error) {
        error({ code: 1, message: 'User denied Geolocation' });
      }
      return 0;
    };
  })();
`;
    }
    
    if (profile.geolocation.mode === 'ip-based' && 
        profile.geolocation.latitude !== undefined && 
        profile.geolocation.longitude !== undefined) {
      return `
  // Geolocation Override (IP-based)
  (function() {
    const LATITUDE = ${profile.geolocation.latitude};
    const LONGITUDE = ${profile.geolocation.longitude};
    
    navigator.geolocation.getCurrentPosition = function(success, error, options) {
      success({
        coords: {
          latitude: LATITUDE,
          longitude: LONGITUDE,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      });
    };
    
    navigator.geolocation.watchPosition = function(success, error, options) {
      success({
        coords: {
          latitude: LATITUDE,
          longitude: LONGITUDE,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      });
      return 1;
    };
  })();
`;
    }
    
    return '// Geolocation: Prompt mode (no override)';
  }
  
  /**
   * Generates language override script
   */
  static generateLanguageScript(profile: FingerprintProfile): string {
    const language = profile.language.value || 'en-US';
    const languages = [language, language.split('-')[0]];
    
    return `
  // Language Override
  Object.defineProperty(navigator, 'language', {
    get: function() { return '${language}'; },
    configurable: false
  });
  
  Object.defineProperty(navigator, 'languages', {
    get: function() { return ${JSON.stringify(languages)}; },
    configurable: false
  });
`;
  }
  
  /**
   * Generates screen override script
   */
  static generateScreenScript(profile: FingerprintProfile): string {
    const width = profile.screen.width || 1920;
    const height = profile.screen.height || 1080;
    
    return `
  // Screen Override
  (function() {
    const WIDTH = ${width};
    const HEIGHT = ${height};
    
    Object.defineProperty(screen, 'width', { get: () => WIDTH });
    Object.defineProperty(screen, 'height', { get: () => HEIGHT });
    Object.defineProperty(screen, 'availWidth', { get: () => WIDTH });
    Object.defineProperty(screen, 'availHeight', { get: () => HEIGHT - 40 }); // Account for taskbar
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
    
    // Override window dimensions
    Object.defineProperty(window, 'innerWidth', { get: () => WIDTH });
    Object.defineProperty(window, 'innerHeight', { get: () => HEIGHT - 100 }); // Account for browser chrome
    Object.defineProperty(window, 'outerWidth', { get: () => WIDTH });
    Object.defineProperty(window, 'outerHeight', { get: () => HEIGHT });
  })();
`;
  }
  
  /**
   * Generates hardware override script
   */
  static generateHardwareScript(profile: FingerprintProfile): string {
    return `
  // Hardware Override
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: function() { return ${profile.hardware.cpuCores}; },
    configurable: false
  });
  
  Object.defineProperty(navigator, 'deviceMemory', {
    get: function() { return ${profile.hardware.memory}; },
    configurable: false
  });
`;
  }
  
  /**
   * Generates Do Not Track override script
   */
  static generateDoNotTrackScript(profile: FingerprintProfile): string {
    const dntValue = profile.doNotTrack === '1' ? '"1"' : 
                     profile.doNotTrack === '0' ? '"0"' : 'null';
    
    return `
  // Do Not Track Override
  Object.defineProperty(navigator, 'doNotTrack', {
    get: function() { return ${dntValue}; },
    configurable: false
  });
`;
  }
  
  /**
   * Generates battery override script
   */
  static generateBatteryScript(profile: FingerprintProfile): string {
    if (profile.battery.mode === 'disabled') {
      return `
  // Battery API Disabled
  navigator.getBattery = undefined;
`;
    }
    
    if (profile.battery.mode === 'privacy') {
      return `
  // Battery API Privacy Mode
  navigator.getBattery = function() {
    return Promise.resolve({
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1.0,
      addEventListener: function() {},
      removeEventListener: function() {}
    });
  };
`;
    }
    
    return '// Battery: Real mode (no override)';
  }
  
  /**
   * Generates plugins override script
   */
  static generatePluginsScript(profile: FingerprintProfile): string {
    if (profile.plugins.mode === 'empty') {
      return `
  // Plugins Empty
  Object.defineProperty(navigator, 'plugins', {
    get: function() {
      return {
        length: 0,
        item: function() { return null; },
        namedItem: function() { return null; },
        refresh: function() {},
        [Symbol.iterator]: function* () {}
      };
    },
    configurable: false
  });
  
  Object.defineProperty(navigator, 'mimeTypes', {
    get: function() {
      return {
        length: 0,
        item: function() { return null; },
        namedItem: function() { return null; },
        [Symbol.iterator]: function* () {}
      };
    },
    configurable: false
  });
`;
    }
    
    if (profile.plugins.mode === 'custom' && profile.plugins.list) {
      const pluginsJson = JSON.stringify(profile.plugins.list);
      return `
  // Plugins Custom
  (function() {
    const customPlugins = ${pluginsJson};
    
    const pluginArray = customPlugins.map(p => ({
      name: p.name,
      description: p.description,
      filename: p.filename,
      length: p.mimeTypes.length,
      item: function(i) { return this[i]; },
      namedItem: function(name) {
        return p.mimeTypes.find(m => m.type === name) || null;
      }
    }));
    
    Object.defineProperty(navigator, 'plugins', {
      get: function() {
        return {
          length: pluginArray.length,
          item: function(i) { return pluginArray[i]; },
          namedItem: function(name) {
            return pluginArray.find(p => p.name === name) || null;
          },
          refresh: function() {},
          [Symbol.iterator]: function* () {
            for (const p of pluginArray) yield p;
          }
        };
      },
      configurable: false
    });
  })();
`;
    }
    
    return '// Plugins: Real mode (no override)';
  }
  
  /**
   * Generates media devices override script
   */
  static generateMediaDevicesScript(profile: FingerprintProfile): string {
    if (profile.mediaDevices.mode === 'disabled') {
      return `
  // Media Devices Disabled
  if (navigator.mediaDevices) {
    navigator.mediaDevices.enumerateDevices = function() {
      return Promise.resolve([]);
    };
  }
`;
    }
    
    if (profile.mediaDevices.mode === 'custom' && profile.mediaDevices.devices) {
      const devicesJson = JSON.stringify(profile.mediaDevices.devices);
      return `
  // Media Devices Custom
  if (navigator.mediaDevices) {
    const customDevices = ${devicesJson};
    navigator.mediaDevices.enumerateDevices = function() {
      return Promise.resolve(customDevices.map(d => ({
        deviceId: d.deviceId,
        kind: d.kind,
        label: d.label,
        groupId: 'default'
      })));
    };
  }
`;
    }
    
    return '// Media Devices: Real mode (no override)';
  }
  
  /**
   * Generates ClientRects offset script
   */
  static generateClientRectsScript(seed?: number): string {
    const config = {
      enabled: true,
      offsetRange: 0.3,
      seed: seed || Math.floor(Math.random() * 2147483647)
    };
    return CanvasGenerator.generateClientRectsScript(config);
  }
  
  /**
   * Escapes a string for use in JavaScript
   */
  private static escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}

export default FingerprintScriptGenerator;
