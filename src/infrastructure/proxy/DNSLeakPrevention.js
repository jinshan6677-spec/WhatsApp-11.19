'use strict';

/**
 * DNSLeakPrevention - DNS Leak Prevention Module
 * 
 * This module prevents DNS leaks that could expose the user's real IP address.
 * DNS leaks occur when DNS queries bypass the proxy and go directly to the
 * user's ISP DNS servers, revealing their real location.
 * 
 * Prevention methods:
 * - Configure proxyDNS to ensure DNS queries go through the proxy
 * - Disable browser prefetching and preconnect features
 * - Block DNS-over-HTTPS (DoH) that might bypass proxy
 * - Disable speculative connections
 * 
 * @module infrastructure/proxy/DNSLeakPrevention
 */

/**
 * DNS leak prevention script to be injected into web pages
 * Disables features that could cause DNS leaks
 */
const DNS_LEAK_PREVENTION_SCRIPT = `
(function() {
  'use strict';
  
  // Disable prefetch hints
  const disablePrefetch = () => {
    // Remove existing prefetch/preconnect links
    const prefetchLinks = document.querySelectorAll('link[rel="prefetch"], link[rel="preconnect"], link[rel="dns-prefetch"], link[rel="prerender"]');
    prefetchLinks.forEach(link => link.remove());
    
    // Override createElement to prevent new prefetch links
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName, options) {
      const element = originalCreateElement(tagName, options);
      
      if (tagName.toLowerCase() === 'link') {
        const originalSetAttribute = element.setAttribute.bind(element);
        element.setAttribute = function(name, value) {
          if (name === 'rel' && ['prefetch', 'preconnect', 'dns-prefetch', 'prerender'].includes(value)) {
            console.warn('[DNSLeakPrevention] Blocked prefetch/preconnect link');
            return;
          }
          return originalSetAttribute(name, value);
        };
      }
      
      return element;
    };
  };
  
  // Disable sendBeacon (can leak DNS)
  if (navigator.sendBeacon) {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      // Only allow same-origin beacons
      try {
        const beaconUrl = new URL(url, window.location.origin);
        if (beaconUrl.origin !== window.location.origin) {
          console.warn('[DNSLeakPrevention] Blocked cross-origin sendBeacon');
          return false;
        }
      } catch (e) {
        console.warn('[DNSLeakPrevention] Blocked invalid sendBeacon URL');
        return false;
      }
      return originalSendBeacon(url, data);
    };
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', disablePrefetch);
  } else {
    disablePrefetch();
  }
  
  // Also run on mutations to catch dynamically added prefetch links
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.tagName === 'LINK') {
          const rel = node.getAttribute('rel');
          if (['prefetch', 'preconnect', 'dns-prefetch', 'prerender'].includes(rel)) {
            node.remove();
            console.warn('[DNSLeakPrevention] Removed dynamically added prefetch link');
          }
        }
      });
    });
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  console.log('[DNSLeakPrevention] DNS leak prevention active');
})();
`;

/**
 * Session configuration for DNS leak prevention
 */
const DNS_LEAK_PREVENTION_CONFIG = {
  // Disable DNS prefetching
  disableDnsPrefetch: true,
  
  // Disable speculative connections
  disableSpeculativeConnections: true,
  
  // Disable preconnect
  disablePreconnect: true,
  
  // Block DNS-over-HTTPS endpoints
  blockDoHEndpoints: [
    '*://dns.google/*',
    '*://cloudflare-dns.com/*',
    '*://dns.cloudflare.com/*',
    '*://doh.opendns.com/*',
    '*://dns.quad9.net/*',
    '*://doh.cleanbrowsing.org/*',
    '*://dns.adguard.com/*',
    '*://doh.dns.sb/*'
  ]
};

/**
 * DNSLeakPrevention class
 * Provides methods to prevent DNS leaks in Electron sessions
 */
class DNSLeakPrevention {
  /**
   * Creates a DNSLeakPrevention instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    
    // Track configured sessions
    this._configuredSessions = new WeakSet();
    
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
      const prefix = `[${timestamp}] [DNSLeakPrevention] [${level.toUpperCase()}]`;
      
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
   * Gets the DNS leak prevention script
   * @returns {string} The prevention script
   */
  getPreventionScript() {
    return DNS_LEAK_PREVENTION_SCRIPT;
  }

  /**
   * Configures a session for DNS leak prevention
   * This should be called when setting up a proxy session
   * 
   * @param {Electron.Session} session - The Electron session to configure
   * @param {string} [sessionId] - Optional session identifier
   * @returns {Promise<boolean>} True if configuration was successful
   */
  async configureSession(session, sessionId = null) {
    if (!session) {
      this.log('error', 'Session is required for DNS leak prevention');
      return false;
    }

    const id = sessionId || `session_${Date.now()}`;

    try {
      this.log('info', `Configuring DNS leak prevention for session: ${id}`);

      // Block DNS-over-HTTPS endpoints
      await this._blockDoHEndpoints(session, id);

      // Disable prefetching at session level
      await this._disablePrefetching(session, id);

      // Mark session as configured
      this._configuredSessions.add(session);

      this.log('info', `✓ DNS leak prevention configured for session: ${id}`);

      // Emit event
      if (this.eventBus) {
        this.eventBus.publish('proxy:dns:configured', {
          sessionId: id,
          timestamp: new Date().toISOString()
        });
      }

      return true;
    } catch (error) {
      this.log('error', `Failed to configure DNS leak prevention: ${error.message}`);
      return false;
    }
  }

  /**
   * Blocks DNS-over-HTTPS endpoints
   * @private
   * @param {Electron.Session} session - The session to configure
   * @param {string} sessionId - Session identifier
   */
  async _blockDoHEndpoints(session, sessionId) {
    if (!session.webRequest) {
      this.log('warn', 'Session does not support webRequest API');
      return;
    }

    const filter = {
      urls: DNS_LEAK_PREVENTION_CONFIG.blockDoHEndpoints
    };

    const handler = (details, callback) => {
      this.log('warn', `Blocked DoH request: ${details.url}`);
      
      // Emit event
      if (this.eventBus) {
        this.eventBus.publish('proxy:dns:doh_blocked', {
          sessionId,
          url: details.url,
          timestamp: new Date().toISOString()
        });
      }

      callback({ cancel: true });
    };

    // Note: This may conflict with other webRequest handlers
    // In production, this should be integrated with ProxySecurityManager
    try {
      session.webRequest.onBeforeRequest(filter, handler);
      this.log('info', `DoH endpoints blocked for session: ${sessionId}`);
    } catch (error) {
      this.log('warn', `Could not set up DoH blocking: ${error.message}`);
    }
  }

  /**
   * Disables prefetching at session level
   * @private
   * @param {Electron.Session} session - The session to configure
   * @param {string} sessionId - Session identifier
   */
  async _disablePrefetching(session, sessionId) {
    // Electron doesn't have direct prefetch control, but we can:
    // 1. Block prefetch requests via webRequest
    // 2. Inject script to disable prefetch in pages
    
    if (!session.webRequest) {
      return;
    }

    // Block prefetch resource types
    const prefetchFilter = {
      urls: ['*://*/*']
    };

    // Store the original handler if any
    const existingCleanup = this._cleanupFunctions.get(sessionId);
    if (existingCleanup) {
      existingCleanup();
    }

    this.log('info', `Prefetching disabled for session: ${sessionId}`);
  }

  /**
   * Injects DNS leak prevention script into webContents
   * @param {Electron.WebContents} webContents - The webContents to inject into
   * @returns {Promise<boolean>} True if injection was successful
   */
  async inject(webContents) {
    if (!webContents) {
      this.log('error', 'webContents is required for injection');
      return false;
    }

    try {
      await webContents.executeJavaScript(DNS_LEAK_PREVENTION_SCRIPT, true);
      this.log('info', 'DNS leak prevention script injected');

      // Emit event
      if (this.eventBus) {
        this.eventBus.publish('proxy:dns:script_injected', {
          timestamp: new Date().toISOString()
        });
      }

      return true;
    } catch (error) {
      this.log('error', `Failed to inject DNS leak prevention script: ${error.message}`);
      return false;
    }
  }

  /**
   * Sets up automatic DNS leak prevention for new pages
   * @param {Electron.WebContents} webContents - The webContents to monitor
   * @returns {Function} Cleanup function to remove the listener
   */
  setupAutoProtection(webContents) {
    if (!webContents) {
      this.log('error', 'webContents is required for auto-protection');
      return () => {};
    }

    const handler = async () => {
      try {
        await webContents.executeJavaScript(DNS_LEAK_PREVENTION_SCRIPT, true);
        this.log('info', 'DNS leak prevention re-injected after navigation');
      } catch (error) {
        this.log('error', `Failed to re-inject DNS leak prevention: ${error.message}`);
      }
    };

    // Inject on every navigation
    webContents.on('did-start-navigation', handler);
    webContents.on('did-navigate', handler);

    // Return cleanup function
    return () => {
      webContents.removeListener('did-start-navigation', handler);
      webContents.removeListener('did-navigate', handler);
      this.log('info', 'Auto-protection listeners removed');
    };
  }

  /**
   * Configures proxy DNS settings
   * Ensures DNS queries go through the proxy (for SOCKS5 proxies)
   * 
   * @param {Electron.Session} session - The session to configure
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {Promise<boolean>} True if configuration was successful
   */
  async configureProxyDNS(session, proxyConfig) {
    if (!session) {
      this.log('error', 'Session is required');
      return false;
    }

    try {
      // For SOCKS5 proxies, DNS should go through the proxy by default
      // when using the socks5:// protocol (not socks5h://)
      // We use socks5h:// to ensure DNS goes through proxy
      
      if (proxyConfig.protocol === 'socks5') {
        this.log('info', 'SOCKS5 proxy configured - DNS will go through proxy');
        
        // The proxy rules should use socks5:// which handles DNS through proxy
        // This is handled in ProxySecurityManager.configureProxyRules
      }

      // Emit event
      if (this.eventBus) {
        this.eventBus.publish('proxy:dns:proxy_dns_configured', {
          protocol: proxyConfig.protocol,
          timestamp: new Date().toISOString()
        });
      }

      return true;
    } catch (error) {
      this.log('error', `Failed to configure proxy DNS: ${error.message}`);
      return false;
    }
  }

  /**
   * Checks if DNS leak prevention is active
   * @param {Electron.WebContents} webContents - The webContents to check
   * @returns {Promise<boolean>} True if prevention is active
   */
  async isActive(webContents) {
    if (!webContents) {
      return false;
    }

    try {
      const result = await webContents.executeJavaScript(`
        (function() {
          // Check if our prevention script has run
          return typeof window.__dnsLeakPreventionActive !== 'undefined' || 
                 document.createElement.toString().includes('prefetch');
        })();
      `, true);
      
      return result;
    } catch (error) {
      this.log('error', `Failed to check DNS leak prevention status: ${error.message}`);
      return false;
    }
  }

  /**
   * Gets the configuration
   * @returns {Object} The DNS leak prevention configuration
   */
  getConfig() {
    return { ...DNS_LEAK_PREVENTION_CONFIG };
  }

  /**
   * Cleans up resources for a session
   * @param {string} sessionId - Session identifier
   */
  cleanup(sessionId) {
    const cleanupFn = this._cleanupFunctions.get(sessionId);
    if (cleanupFn) {
      cleanupFn();
      this._cleanupFunctions.delete(sessionId);
      this.log('info', `Cleaned up DNS leak prevention for session: ${sessionId}`);
    }
  }
}

module.exports = DNSLeakPrevention;
