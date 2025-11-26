'use strict';

const WebRTCBlocker = require('./WebRTCBlocker');
const DNSLeakPrevention = require('./DNSLeakPrevention');

/**
 * IPProtectionInjector - Comprehensive IP Protection Script Injector
 * 
 * This module provides complete IP leak protection by injecting security scripts
 * into BrowserViews/WebContents. It combines multiple protection mechanisms:
 * 
 * 1. WebRTC Blocking - Prevents IP leaks through STUN/TURN servers
 * 2. DNS Leak Prevention - Ensures DNS queries go through proxy
 * 3. Navigator API Spoofing - Hides network information
 * 4. Battery API Blocking - Prevents fingerprinting
 * 5. Connection API Blocking - Hides network type information
 * 
 * @module infrastructure/proxy/IPProtectionInjector
 */

/**
 * Comprehensive IP protection script
 * This script disables all APIs that could leak the user's real IP or network info
 */
const IP_PROTECTION_SCRIPT = `
(function() {
  'use strict';
  
  // ==================== WebRTC Blocking ====================
  
  // Create a fake RTCPeerConnection that does nothing
  function FakeRTCPeerConnection() {
    console.warn('[IPProtection] RTCPeerConnection blocked - IP leak prevention');
    
    return {
      createOffer: () => Promise.reject(new Error('WebRTC is disabled for privacy protection')),
      createAnswer: () => Promise.reject(new Error('WebRTC is disabled for privacy protection')),
      setLocalDescription: () => Promise.reject(new Error('WebRTC is disabled for privacy protection')),
      setRemoteDescription: () => Promise.reject(new Error('WebRTC is disabled for privacy protection')),
      addIceCandidate: () => Promise.reject(new Error('WebRTC is disabled for privacy protection')),
      addTrack: () => { throw new Error('WebRTC is disabled for privacy protection'); },
      addStream: () => { throw new Error('WebRTC is disabled for privacy protection'); },
      removeTrack: () => {},
      removeStream: () => {},
      close: () => {},
      getStats: () => Promise.resolve(new Map()),
      getSenders: () => [],
      getReceivers: () => [],
      getTransceivers: () => [],
      createDataChannel: () => { throw new Error('WebRTC is disabled for privacy protection'); },
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      localDescription: null,
      remoteDescription: null,
      signalingState: 'closed',
      iceGatheringState: 'complete',
      iceConnectionState: 'closed',
      connectionState: 'closed',
      canTrickleIceCandidates: null,
      onicecandidate: null,
      onicecandidateerror: null,
      onsignalingstatechange: null,
      oniceconnectionstatechange: null,
      onicegatheringstatechange: null,
      onconnectionstatechange: null,
      onnegotiationneeded: null,
      ondatachannel: null,
      ontrack: null
    };
  }
  
  FakeRTCPeerConnection.prototype = {};
  FakeRTCPeerConnection.generateCertificate = () => Promise.reject(new Error('WebRTC is disabled'));
  
  // Override all WebRTC constructors
  const webrtcProps = ['RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection'];
  webrtcProps.forEach(prop => {
    try {
      Object.defineProperty(window, prop, {
        value: FakeRTCPeerConnection,
        writable: false,
        configurable: false
      });
    } catch (e) {}
  });
  
  // Block RTCSessionDescription
  try {
    Object.defineProperty(window, 'RTCSessionDescription', {
      value: function() {
        throw new Error('WebRTC is disabled for privacy protection');
      },
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  // Block RTCIceCandidate
  try {
    Object.defineProperty(window, 'RTCIceCandidate', {
      value: function() {
        throw new Error('WebRTC is disabled for privacy protection');
      },
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  // Block RTCDataChannel
  try {
    Object.defineProperty(window, 'RTCDataChannel', {
      value: function() {
        throw new Error('WebRTC is disabled for privacy protection');
      },
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  // ==================== MediaDevices Blocking ====================
  
  // Block getUserMedia
  if (navigator.mediaDevices) {
    const fakeGetUserMedia = () => {
      console.warn('[IPProtection] getUserMedia blocked - privacy protection');
      return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    };
    
    const fakeGetDisplayMedia = () => {
      console.warn('[IPProtection] getDisplayMedia blocked - privacy protection');
      return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    };
    
    const fakeEnumerateDevices = () => {
      console.warn('[IPProtection] enumerateDevices blocked - privacy protection');
      return Promise.resolve([]);
    };
    
    try {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: fakeGetUserMedia,
        writable: false,
        configurable: false
      });
    } catch (e) {}
    
    try {
      Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
        value: fakeGetDisplayMedia,
        writable: false,
        configurable: false
      });
    } catch (e) {}
    
    try {
      Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
        value: fakeEnumerateDevices,
        writable: false,
        configurable: false
      });
    } catch (e) {}
  }
  
  // Also block legacy getUserMedia
  try {
    Object.defineProperty(navigator, 'getUserMedia', {
      value: (constraints, success, error) => {
        console.warn('[IPProtection] Legacy getUserMedia blocked');
        error(new DOMException('Permission denied', 'NotAllowedError'));
      },
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  try {
    Object.defineProperty(navigator, 'webkitGetUserMedia', {
      value: (constraints, success, error) => {
        error(new DOMException('Permission denied', 'NotAllowedError'));
      },
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  try {
    Object.defineProperty(navigator, 'mozGetUserMedia', {
      value: (constraints, success, error) => {
        error(new DOMException('Permission denied', 'NotAllowedError'));
      },
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  // ==================== Navigator.connection Blocking ====================
  
  // Override navigator.connection to return undefined
  try {
    Object.defineProperty(navigator, 'connection', {
      value: undefined,
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  try {
    Object.defineProperty(navigator, 'mozConnection', {
      value: undefined,
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  try {
    Object.defineProperty(navigator, 'webkitConnection', {
      value: undefined,
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  // ==================== Navigator.getBattery Blocking ====================
  
  // Disable getBattery API (can be used for fingerprinting)
  try {
    Object.defineProperty(navigator, 'getBattery', {
      value: () => {
        console.warn('[IPProtection] getBattery blocked - fingerprint prevention');
        return Promise.reject(new Error('Battery API is disabled for privacy protection'));
      },
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  // ==================== Additional Privacy Protections ====================
  
  // Block NetworkInformation API
  try {
    if (window.NetworkInformation) {
      Object.defineProperty(window, 'NetworkInformation', {
        value: undefined,
        writable: false,
        configurable: false
      });
    }
  } catch (e) {}
  
  // Block deviceMemory (fingerprinting)
  try {
    Object.defineProperty(navigator, 'deviceMemory', {
      value: 8, // Return a common value
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  // Block hardwareConcurrency spoofing (return common value)
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value: 4, // Return a common value
      writable: false,
      configurable: false
    });
  } catch (e) {}
  
  // ==================== DNS Leak Prevention ====================
  
  // Disable prefetch hints
  const disablePrefetch = () => {
    const prefetchLinks = document.querySelectorAll(
      'link[rel="prefetch"], link[rel="preconnect"], link[rel="dns-prefetch"], link[rel="prerender"]'
    );
    prefetchLinks.forEach(link => link.remove());
    
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName, options) {
      const element = originalCreateElement(tagName, options);
      
      if (tagName.toLowerCase() === 'link') {
        const originalSetAttribute = element.setAttribute.bind(element);
        element.setAttribute = function(name, value) {
          if (name === 'rel' && ['prefetch', 'preconnect', 'dns-prefetch', 'prerender'].includes(value)) {
            console.warn('[IPProtection] Blocked prefetch/preconnect link');
            return;
          }
          return originalSetAttribute(name, value);
        };
      }
      
      return element;
    };
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', disablePrefetch);
  } else {
    disablePrefetch();
  }
  
  // Monitor for dynamically added prefetch links
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.tagName === 'LINK') {
          const rel = node.getAttribute('rel');
          if (['prefetch', 'preconnect', 'dns-prefetch', 'prerender'].includes(rel)) {
            node.remove();
          }
        }
      });
    });
  });
  
  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  
  // Mark as protected
  window.__ipProtectionActive = true;
  
  console.log('[IPProtection] IP protection active - WebRTC, MediaDevices, Connection API, Battery API disabled');
})();
`;

/**
 * IPProtectionInjector class
 * Provides comprehensive IP leak protection for BrowserViews/WebContents
 */
class IPProtectionInjector {
  /**
   * Creates an IPProtectionInjector instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    
    // Create sub-modules
    this.webrtcBlocker = new WebRTCBlocker(options);
    this.dnsLeakPrevention = new DNSLeakPrevention(options);
    
    // Track injected webContents
    this._injectedContents = new WeakSet();
    
    // Track cleanup functions
    this._cleanupFunctions = new Map();
  }

  /**
   * Creates a default logger
   * @private
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [IPProtectionInjector] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  /**
   * Gets the comprehensive IP protection script
   * @returns {string} The protection script
   */
  getProtectionScript() {
    return IP_PROTECTION_SCRIPT;
  }

  /**
   * Injects all IP protection scripts into webContents
   * This should be called before any page loads
   * 
   * @param {Electron.WebContents} webContents - The webContents to inject into
   * @returns {Promise<boolean>} True if injection was successful
   */
  async inject(webContents) {
    if (!webContents) {
      this.log('error', 'webContents is required for injection');
      return false;
    }

    try {
      // Check if already injected
      if (this._injectedContents.has(webContents)) {
        this.log('info', 'IP protection already injected');
        return true;
      }

      // Execute the comprehensive protection script
      await webContents.executeJavaScript(IP_PROTECTION_SCRIPT, true);
      
      // Mark as injected
      this._injectedContents.add(webContents);
      
      this.log('info', '✓ IP protection scripts injected successfully');
      this.log('info', '  - WebRTC: Disabled');
      this.log('info', '  - MediaDevices: Disabled');
      this.log('info', '  - navigator.connection: Undefined');
      this.log('info', '  - navigator.getBattery: Disabled');
      this.log('info', '  - DNS Prefetch: Blocked');

      // Emit event
      if (this.eventBus) {
        this.eventBus.publish('proxy:ip_protection:injected', {
          features: [
            'webrtc_blocked',
            'media_devices_blocked',
            'connection_api_blocked',
            'battery_api_blocked',
            'dns_prefetch_blocked'
          ],
          timestamp: new Date().toISOString()
        });
      }

      return true;
    } catch (error) {
      this.log('error', `Failed to inject IP protection scripts: ${error.message}`);
      return false;
    }
  }

  /**
   * Sets up automatic IP protection for new pages
   * Injects protection scripts on every page load
   * 
   * @param {Electron.WebContents} webContents - The webContents to monitor
   * @param {string} [contentId] - Optional identifier for tracking
   * @returns {Function} Cleanup function to remove the listeners
   */
  setupAutoProtection(webContents, contentId = null) {
    if (!webContents) {
      this.log('error', 'webContents is required for auto-protection');
      return () => {};
    }

    const id = contentId || `content_${Date.now()}`;

    const handler = async () => {
      try {
        await webContents.executeJavaScript(IP_PROTECTION_SCRIPT, true);
        this.log('info', `IP protection re-injected after navigation (${id})`);
      } catch (error) {
        this.log('error', `Failed to re-inject IP protection: ${error.message}`);
      }
    };

    // Inject on every navigation
    webContents.on('did-start-navigation', handler);
    webContents.on('did-navigate', handler);
    webContents.on('did-navigate-in-page', handler);
    webContents.on('dom-ready', handler);

    // Store cleanup function
    const cleanup = () => {
      webContents.removeListener('did-start-navigation', handler);
      webContents.removeListener('did-navigate', handler);
      webContents.removeListener('did-navigate-in-page', handler);
      webContents.removeListener('dom-ready', handler);
      this._cleanupFunctions.delete(id);
      this.log('info', `Auto-protection listeners removed (${id})`);
    };

    this._cleanupFunctions.set(id, cleanup);

    this.log('info', `Auto-protection set up for webContents (${id})`);

    // Return cleanup function
    return cleanup;
  }

  /**
   * Configures session-level protections
   * @param {Electron.Session} session - The Electron session to configure
   * @param {string} [sessionId] - Optional session identifier
   * @returns {Promise<boolean>} True if configuration was successful
   */
  async configureSession(session, sessionId = null) {
    if (!session) {
      this.log('error', 'Session is required');
      return false;
    }

    const id = sessionId || `session_${Date.now()}`;

    try {
      this.log('info', `Configuring session-level IP protection: ${id}`);

      // Configure DNS leak prevention at session level
      await this.dnsLeakPrevention.configureSession(session, id);

      this.log('info', `✓ Session-level IP protection configured: ${id}`);

      return true;
    } catch (error) {
      this.log('error', `Failed to configure session: ${error.message}`);
      return false;
    }
  }

  /**
   * Checks if IP protection is active in the given webContents
   * @param {Electron.WebContents} webContents - The webContents to check
   * @returns {Promise<Object>} Protection status object
   */
  async checkProtectionStatus(webContents) {
    if (!webContents) {
      return {
        active: false,
        error: 'webContents is required'
      };
    }

    try {
      const status = await webContents.executeJavaScript(`
        (function() {
          const status = {
            ipProtectionActive: !!window.__ipProtectionActive,
            webrtcBlocked: false,
            mediaDevicesBlocked: false,
            connectionApiBlocked: false,
            batteryApiBlocked: false
          };
          
          // Check WebRTC
          try {
            new RTCPeerConnection();
            status.webrtcBlocked = false;
          } catch (e) {
            status.webrtcBlocked = e.message.includes('disabled') || e.message.includes('privacy');
          }
          
          // Check MediaDevices
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            status.mediaDevicesBlocked = navigator.mediaDevices.getUserMedia.toString().includes('blocked') ||
                                         navigator.mediaDevices.getUserMedia.toString().includes('NotAllowedError');
          } else {
            status.mediaDevicesBlocked = true;
          }
          
          // Check Connection API
          status.connectionApiBlocked = navigator.connection === undefined;
          
          // Check Battery API
          if (navigator.getBattery) {
            status.batteryApiBlocked = navigator.getBattery.toString().includes('disabled') ||
                                       navigator.getBattery.toString().includes('privacy');
          } else {
            status.batteryApiBlocked = true;
          }
          
          return status;
        })();
      `, true);
      
      return {
        active: status.ipProtectionActive,
        webrtcBlocked: status.webrtcBlocked,
        mediaDevicesBlocked: status.mediaDevicesBlocked,
        connectionApiBlocked: status.connectionApiBlocked,
        batteryApiBlocked: status.batteryApiBlocked,
        allProtected: status.webrtcBlocked && 
                      status.mediaDevicesBlocked && 
                      status.connectionApiBlocked && 
                      status.batteryApiBlocked
      };
    } catch (error) {
      this.log('error', `Failed to check protection status: ${error.message}`);
      return {
        active: false,
        error: error.message
      };
    }
  }

  /**
   * Gets the WebRTC blocker instance
   * @returns {WebRTCBlocker}
   */
  getWebRTCBlocker() {
    return this.webrtcBlocker;
  }

  /**
   * Gets the DNS leak prevention instance
   * @returns {DNSLeakPrevention}
   */
  getDNSLeakPrevention() {
    return this.dnsLeakPrevention;
  }

  /**
   * Cleans up resources for a specific content
   * @param {string} contentId - Content identifier
   */
  cleanup(contentId) {
    const cleanupFn = this._cleanupFunctions.get(contentId);
    if (cleanupFn) {
      cleanupFn();
    }
  }

  /**
   * Cleans up all resources
   */
  cleanupAll() {
    this.log('info', 'Cleaning up all IP protection resources...');
    
    for (const [id, cleanupFn] of this._cleanupFunctions) {
      try {
        cleanupFn();
      } catch (error) {
        this.log('warn', `Failed to cleanup ${id}: ${error.message}`);
      }
    }
    
    this._cleanupFunctions.clear();
    this.log('info', 'IP protection cleanup complete');
  }
}

module.exports = IPProtectionInjector;
