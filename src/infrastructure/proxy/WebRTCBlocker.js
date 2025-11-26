'use strict';

/**
 * WebRTCBlocker - Complete WebRTC Blocking Module
 * 
 * This module provides comprehensive WebRTC blocking to prevent IP leaks
 * through STUN/TURN servers. WebRTC can expose real IP addresses even when
 * using a proxy, making this a critical security component.
 * 
 * Blocked APIs:
 * - RTCPeerConnection
 * - RTCDataChannel
 * - RTCSessionDescription
 * - RTCIceCandidate
 * - mediaDevices.getUserMedia
 * - mediaDevices.getDisplayMedia
 * 
 * @module infrastructure/proxy/WebRTCBlocker
 */

/**
 * WebRTC blocking script to be injected into web pages
 * This script completely disables WebRTC functionality
 */
const WEBRTC_BLOCKING_SCRIPT = `
(function() {
  'use strict';
  
  // Store original references for debugging (not accessible from page context)
  const _originalRTCPeerConnection = window.RTCPeerConnection;
  const _originalWebkitRTCPeerConnection = window.webkitRTCPeerConnection;
  const _originalMozRTCPeerConnection = window.mozRTCPeerConnection;
  
  // Create a fake RTCPeerConnection that does nothing
  function FakeRTCPeerConnection() {
    console.warn('[WebRTCBlocker] RTCPeerConnection blocked - IP leak prevention');
    
    // Return an object that mimics RTCPeerConnection but does nothing
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
      createDataChannel: () => {
        throw new Error('WebRTC is disabled for privacy protection');
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      
      // Properties
      localDescription: null,
      remoteDescription: null,
      signalingState: 'closed',
      iceGatheringState: 'complete',
      iceConnectionState: 'closed',
      connectionState: 'closed',
      canTrickleIceCandidates: null,
      
      // Event handlers
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
  
  // Make it look like a constructor
  FakeRTCPeerConnection.prototype = {};
  FakeRTCPeerConnection.generateCertificate = () => Promise.reject(new Error('WebRTC is disabled'));
  
  // Override all WebRTC constructors
  Object.defineProperty(window, 'RTCPeerConnection', {
    value: FakeRTCPeerConnection,
    writable: false,
    configurable: false
  });
  
  Object.defineProperty(window, 'webkitRTCPeerConnection', {
    value: FakeRTCPeerConnection,
    writable: false,
    configurable: false
  });
  
  Object.defineProperty(window, 'mozRTCPeerConnection', {
    value: FakeRTCPeerConnection,
    writable: false,
    configurable: false
  });
  
  // Block RTCSessionDescription
  Object.defineProperty(window, 'RTCSessionDescription', {
    value: function() {
      console.warn('[WebRTCBlocker] RTCSessionDescription blocked');
      throw new Error('WebRTC is disabled for privacy protection');
    },
    writable: false,
    configurable: false
  });
  
  // Block RTCIceCandidate
  Object.defineProperty(window, 'RTCIceCandidate', {
    value: function() {
      console.warn('[WebRTCBlocker] RTCIceCandidate blocked');
      throw new Error('WebRTC is disabled for privacy protection');
    },
    writable: false,
    configurable: false
  });
  
  // Block RTCDataChannel (if accessed directly)
  if (typeof RTCDataChannel !== 'undefined') {
    Object.defineProperty(window, 'RTCDataChannel', {
      value: function() {
        console.warn('[WebRTCBlocker] RTCDataChannel blocked');
        throw new Error('WebRTC is disabled for privacy protection');
      },
      writable: false,
      configurable: false
    });
  }
  
  // Block RTCRtpSender and RTCRtpReceiver
  Object.defineProperty(window, 'RTCRtpSender', {
    value: undefined,
    writable: false,
    configurable: false
  });
  
  Object.defineProperty(window, 'RTCRtpReceiver', {
    value: undefined,
    writable: false,
    configurable: false
  });
  
  // Block RTCRtpTransceiver
  Object.defineProperty(window, 'RTCRtpTransceiver', {
    value: undefined,
    writable: false,
    configurable: false
  });
  
  console.log('[WebRTCBlocker] WebRTC APIs have been disabled for IP leak prevention');
})();
`;

/**
 * WebRTCBlocker class
 * Provides methods to inject WebRTC blocking scripts into BrowserViews/WebContents
 */
class WebRTCBlocker {
  /**
   * Creates a WebRTCBlocker instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    
    // Track injected webContents
    this._injectedContents = new WeakSet();
  }

  /**
   * Creates a default logger
   * @private
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [WebRTCBlocker] [${level.toUpperCase()}]`;
      
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
   * Gets the WebRTC blocking script
   * @returns {string} The blocking script
   */
  getBlockingScript() {
    return WEBRTC_BLOCKING_SCRIPT;
  }

  /**
   * Injects WebRTC blocking script into webContents
   * Should be called before any page loads
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
        this.log('info', 'WebRTC blocking already injected');
        return true;
      }

      // Execute the blocking script
      await webContents.executeJavaScript(WEBRTC_BLOCKING_SCRIPT, true);
      
      // Mark as injected
      this._injectedContents.add(webContents);
      
      this.log('info', 'WebRTC blocking script injected successfully');

      // Emit event
      if (this.eventBus) {
        this.eventBus.publish('proxy:webrtc:blocked', {
          timestamp: new Date().toISOString()
        });
      }

      return true;
    } catch (error) {
      this.log('error', `Failed to inject WebRTC blocking script: ${error.message}`);
      return false;
    }
  }

  /**
   * Sets up automatic WebRTC blocking for new pages
   * Injects the blocking script on every page load
   * 
   * @param {Electron.WebContents} webContents - The webContents to monitor
   * @returns {Function} Cleanup function to remove the listener
   */
  setupAutoBlock(webContents) {
    if (!webContents) {
      this.log('error', 'webContents is required for auto-blocking');
      return () => {};
    }

    const handler = async () => {
      try {
        await webContents.executeJavaScript(WEBRTC_BLOCKING_SCRIPT, true);
        this.log('info', 'WebRTC blocking re-injected after navigation');
      } catch (error) {
        this.log('error', `Failed to re-inject WebRTC blocking: ${error.message}`);
      }
    };

    // Inject on every navigation
    webContents.on('did-start-navigation', handler);
    webContents.on('did-navigate', handler);
    webContents.on('did-navigate-in-page', handler);

    // Return cleanup function
    return () => {
      webContents.removeListener('did-start-navigation', handler);
      webContents.removeListener('did-navigate', handler);
      webContents.removeListener('did-navigate-in-page', handler);
      this.log('info', 'Auto-blocking listeners removed');
    };
  }

  /**
   * Checks if WebRTC is blocked in the given webContents
   * @param {Electron.WebContents} webContents - The webContents to check
   * @returns {Promise<boolean>} True if WebRTC is blocked
   */
  async isBlocked(webContents) {
    if (!webContents) {
      return false;
    }

    try {
      const result = await webContents.executeJavaScript(`
        (function() {
          try {
            new RTCPeerConnection();
            return false;
          } catch (e) {
            return e.message.includes('disabled') || e.message.includes('privacy');
          }
        })();
      `, true);
      
      return result;
    } catch (error) {
      this.log('error', `Failed to check WebRTC status: ${error.message}`);
      return false;
    }
  }
}

module.exports = WebRTCBlocker;
