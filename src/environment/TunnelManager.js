/**
 * Tunnel Manager
 *
 * Manages tunnel configuration (SOCKS5/HTTP) for encrypted connections.
 * Supports application-level tunneling to bypass firewall restrictions.
 *
 * @module environment/TunnelManager
 */

'use strict';

/**
 * Tunnel Manager
 */
class TunnelManager {
  /**
   * Apply tunnel configuration to an Electron session
   * @param {Object} session - Electron session object
   * @param {Object} tunnelConfig - Tunnel configuration
   * @param {boolean} tunnelConfig.enabled - Whether tunnel is enabled
   * @param {string} tunnelConfig.type - Tunnel protocol (socks5, http)
   * @param {string} tunnelConfig.host - Tunnel host
   * @param {number} tunnelConfig.port - Tunnel port
   * @param {string} [tunnelConfig.username] - Tunnel username (optional)
   * @param {string} [tunnelConfig.password] - Tunnel password (optional)
   * @returns {Promise<boolean>} Success status
   */
  static async applyTunnelToSession(session, tunnelConfig) {
      if (!tunnelConfig || !tunnelConfig.enabled) {
        // Disable tunnel - use direct connection
        try {
          await session.setProxy({ mode: 'direct' });
          console.log('[TunnelManager] Tunnel disabled for session');
          return true;
        } catch (error) {
          console.error('[TunnelManager] Failed to disable tunnel:', error);
          return false;
        }
      }
  
      // Validate tunnel configuration
      const validation = TunnelManager.validateTunnelConfig(tunnelConfig);
      if (!validation.valid) {
        throw new Error(`Invalid tunnel configuration: ${validation.errors.join(', ')}`);
      }
  
      const { type, host, port, username, password } = tunnelConfig;
  
      try {
  
            // Build tunnel rules in Electron format
  
            let tunnelRules;
  
      
  
            if (type === 'socks5') {
  
              // SOCKS5 proxy format for Electron
  
              // Note: Use 'socks5://' prefix for SOCKS5 protocol
  
              tunnelRules = `socks5://${host}:${port}`;
  
            } else if (type === 'http') {
  
              // HTTP proxy format - use full format for both http and https
  
              // Format: "http=host:port;https=host:port"
  
              tunnelRules = `http=${host}:${port};https=${host}:${port}`;
  
            } else {
  
              throw new Error(`Unsupported tunnel type: ${type}`);
  
            }
  
      
  
            console.log(`[TunnelManager] Applying tunnel configuration...`);
  
            console.log(`[TunnelManager] - Type: ${type}`);
  
            console.log(`[TunnelManager] - Host: ${host}`);
  
            console.log(`[TunnelManager] - Port: ${port}`);
  
            console.log(`[TunnelManager] - Rules: ${tunnelRules}`);
  
            console.log(`[TunnelManager] - Auth: ${username ? 'Yes' : 'No'}`);
  
      
  
            // Set proxy configuration
  
            const proxyConfig = {
  
              proxyRules: tunnelRules,
  
              proxyBypassRules: '<local>' // Bypass proxy for localhost
  
            };
  
      
  
            console.log(`[TunnelManager] Calling session.setProxy with:`, proxyConfig);
  
            await session.setProxy(proxyConfig);
  
            console.log(`[TunnelManager] ✓ session.setProxy completed successfully`);
  
      
  
            // Verify the proxy was set
  
            const proxyInfo = await session.getProxyInfo();
  
            console.log(`[TunnelManager] Current proxy info:`, proxyInfo);
  
      
  
            console.log(`[TunnelManager] ✓ Tunnel applied successfully: ${type}://${host}:${port}`);
  
      
  
            // If authentication is provided, set up auth handler
  
            if (username && password) {
  
              console.log('[TunnelManager] Tunnel authentication configured');
  
              // Note: Electron will prompt for auth credentials via 'login' event
  
              // This is handled in ViewFactory.js
  
            }
  
      
  
            return true;
  
          } catch (error) {
  
            console.error('[TunnelManager] ✗ Failed to apply tunnel:', error);
  
            console.error('[TunnelManager] Error details:', {
  
              type,
  
              host,
  
              port,
  
              error: error.message,
  
              code: error.code,
  
              stack: error.stack
  
            });
  
            return false;
  
          }    }

  /**
   * Validate tunnel configuration format
   * @param {Object} tunnelConfig - Tunnel configuration
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  static validateTunnelConfig(tunnelConfig) {
    const errors = [];

    if (!tunnelConfig || typeof tunnelConfig !== 'object') {
      errors.push('Tunnel configuration must be an object');
      return { valid: false, errors };
    }

    // Validate enabled field
    if (typeof tunnelConfig.enabled !== 'boolean') {
      errors.push('Tunnel enabled must be a boolean');
    }

    // Only validate other fields if tunnel is enabled
    if (tunnelConfig.enabled) {
      // Validate type
      if (tunnelConfig.type && !['socks5', 'http'].includes(tunnelConfig.type)) {
        errors.push('Invalid tunnel type. Must be socks5 or http');
      }

      // Validate host
      if (!tunnelConfig.host || typeof tunnelConfig.host !== 'string' || !tunnelConfig.host.trim()) {
        errors.push('Tunnel host is required');
      }

      // Validate port
      if (!tunnelConfig.port) {
        errors.push('Tunnel port is required');
      } else {
        const port = parseInt(tunnelConfig.port, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          errors.push('Tunnel port must be a number between 1 and 65535');
        }
      }

      // Validate username/password
      if (tunnelConfig.username && !tunnelConfig.password) {
        errors.push('Tunnel password is required when username is provided');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build tunnel URL from configuration
   * @param {Object} tunnelConfig - Tunnel configuration
   * @returns {string} Tunnel URL
   */
  static buildTunnelUrl(tunnelConfig) {
    if (!tunnelConfig || !tunnelConfig.host || !tunnelConfig.port) {
      return '';
    }

    const { type, host, port, username, password } = tunnelConfig;

    if (username && password) {
      return `${type}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
    } else {
      return `${type}://${host}:${port}`;
    }
  }

  /**
   * Clear tunnel from session
   * @param {Object} session - Electron session object
   * @returns {Promise<boolean>} Success status
   */
  static async clearTunnel(session) {
    try {
      await session.setProxy({ mode: 'direct' });
      console.log('[TunnelManager] Tunnel cleared from session');
      return true;
    } catch (error) {
      console.error('[TunnelManager] Failed to clear tunnel:', error);
      return false;
    }
  }

  /**
   * Test tunnel connectivity
   * @param {Object} tunnelConfig - Tunnel configuration
   * @param {number} [timeout=10000] - Timeout in milliseconds
   * @returns {Promise<Object>} Test result
   */
  static async testTunnel(tunnelConfig, timeout = 10000) {
    if (!tunnelConfig || !tunnelConfig.enabled) {
      return {
        success: false,
        error: 'Tunnel is not enabled'
      };
    }

    const validation = TunnelManager.validateTunnelConfig(tunnelConfig);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid tunnel configuration: ${validation.errors.join(', ')}`
      };
    }

    try {
      const axios = require('axios');

      const tunnelUrl = TunnelManager.buildTunnelUrl(tunnelConfig);

      // For SOCKS5, we need a different approach since we don't have socks-proxy-agent
      // For now, we'll do a basic connectivity check
      // Note: Full SOCKS5 testing would require socks-proxy-agent package

      if (tunnelConfig.type === 'socks5') {
        // Basic connectivity check for SOCKS5
        // We'll verify the config is valid but can't fully test without socks-proxy-agent
        return {
          success: true,
          message: 'Tunnel configuration is valid (SOCKS5)',
          tunnelUrl: tunnelUrl.replace(/:[^:]*@/, ':****@'),
          note: 'Full SOCKS5 connectivity test requires socks-proxy-agent package'
        };
      } else {
        // HTTP tunnel can be tested with https-proxy-agent
        const { HttpsProxyAgent } = require('https-proxy-agent');
        const agent = new HttpsProxyAgent(tunnelUrl);

        const response = await axios.get('https://www.google.com', {
          httpAgent: agent,
          httpsAgent: agent,
          timeout: timeout,
          validateStatus: () => true
        });

        if (response.status >= 200 && response.status < 400) {
          return {
            success: true,
            message: 'Tunnel connection successful',
            tunnelUrl: tunnelUrl.replace(/:[^:]*@/, ':****@'),
            responseTime: response.headers['x-response-time'] || 'N/A'
          };
        } else {
          return {
            success: false,
            error: `Tunnel returned status ${response.status}`,
            tunnelUrl: tunnelUrl.replace(/:[^:]*@/, ':****@')
          };
        }
      }
    } catch (error) {
      console.error('[TunnelManager] Tunnel test failed:', error);

      return {
        success: false,
        error: error.message || 'Tunnel connection failed',
        tunnelUrl: tunnelConfig ? TunnelManager.buildTunnelUrl(tunnelConfig).replace(/:[^:]*@/, ':****@') : 'N/A'
      };
    }
  }
}

module.exports = TunnelManager;