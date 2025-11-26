'use strict';

const ProxyConnectionStatus = require('../../domain/entities/ProxyConnectionStatus');
const KillSwitchActivatedEvent = require('../../domain/events/KillSwitchActivatedEvent');
const ProxyError = require('../../domain/errors/ProxyError');

/**
 * Kill-Switch State
 * @readonly
 * @enum {string}
 */
const KillSwitchState = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  PENDING_RESET: 'pending_reset'
};

/**
 * KillSwitch - Emergency Network Blocking Mechanism
 * 
 * Implements the kill-switch functionality that immediately blocks all network
 * requests when proxy connection is lost or IP leak is detected.
 * 
 * Key features:
 * - Immediate network blocking on trigger
 * - Preserves BrowserView (doesn't close the session)
 * - Requires explicit user confirmation to reset
 * - Emits events for UI notification
 * 
 * Trigger conditions:
 * - Proxy disconnected
 * - Consecutive health check failures (3 by default)
 * - IP leak detected
 * 
 * @class
 */
class KillSwitch {
  /**
   * Creates a KillSwitch instance
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.logger] - Logger function
   * @param {Object} [options.eventBus] - Event bus for publishing events
   * @param {Object} [options.securityManager] - ProxySecurityManager instance
   */
  constructor(options = {}) {
    this.options = options;
    this.log = options.logger || this._createLogger();
    this.eventBus = options.eventBus || null;
    this.securityManager = options.securityManager || null;
    
    // Track kill-switch state per account
    this._states = new Map();
    
    // Track activation history for auditing
    this._activationHistory = [];
    this._maxHistorySize = 100;
  }

  /**
   * Creates a default logger
   * @private
   * @returns {Function}
   */
  _createLogger() {
    return (level, message, ...args) => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [KillSwitch] [${level.toUpperCase()}]`;
      
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    };
  }

  // ==================== Core Methods ====================

  /**
   * Enables kill-switch monitoring for an account
   * @param {string} accountId - Account ID
   * @param {Object} [options={}] - Enable options
   * @param {string} [options.proxyId] - Associated proxy ID
   * @param {string} [options.sessionId] - Session ID for security manager
   * @returns {boolean} True if enabled successfully
   */
  enable(accountId, options = {}) {
    if (!accountId) {
      throw new Error('Account ID is required to enable kill-switch');
    }

    const existingState = this._states.get(accountId);
    if (existingState && existingState.state === KillSwitchState.ACTIVE) {
      this.log('warn', `Kill-switch already active for account: ${accountId}`);
      return false;
    }

    const state = {
      state: KillSwitchState.INACTIVE,
      accountId,
      proxyId: options.proxyId || null,
      sessionId: options.sessionId || null,
      enabledAt: new Date(),
      activatedAt: null,
      trigger: null,
      details: null,
      resetRequested: false
    };

    this._states.set(accountId, state);
    this.log('info', `Kill-switch enabled for account: ${accountId}`);

    return true;
  }

  /**
   * Triggers the kill-switch for an account
   * This blocks all network requests while preserving the BrowserView
   * 
   * @param {string} accountId - Account ID
   * @param {string} reason - Trigger reason (from KillSwitchActivatedEvent.Trigger)
   * @param {Object} [details={}] - Additional details
   * @returns {Promise<boolean>} True if triggered successfully
   */
  async trigger(accountId, reason, details = {}) {
    if (!accountId) {
      throw new Error('Account ID is required to trigger kill-switch');
    }

    const state = this._states.get(accountId);
    if (!state) {
      this.log('warn', `Kill-switch not enabled for account: ${accountId}, enabling now`);
      this.enable(accountId);
    }

    const currentState = this._states.get(accountId);
    
    // Already active - just update details
    if (currentState.state === KillSwitchState.ACTIVE) {
      this.log('info', `Kill-switch already active for account: ${accountId}`);
      return true;
    }

    try {
      this.log('warn', `🔴 TRIGGERING KILL-SWITCH for account: ${accountId}`);
      this.log('warn', `   Reason: ${reason}`);
      this.log('warn', `   Details: ${JSON.stringify(details)}`);

      // Update state
      currentState.state = KillSwitchState.ACTIVE;
      currentState.activatedAt = new Date();
      currentState.trigger = reason;
      currentState.details = details;

      // Block all network requests via security manager
      if (this.securityManager && currentState.sessionId) {
        await this._blockNetworkRequests(currentState.sessionId);
      }

      // Create and emit event
      const event = this._createActivationEvent(accountId, currentState.proxyId, reason, details);
      this._recordActivation(event);
      
      if (this.eventBus) {
        await this.eventBus.publish(KillSwitchActivatedEvent.EVENT_NAME, event.toJSON());
      }

      this.log('warn', `✓ Kill-switch activated for account: ${accountId}`);
      return true;
    } catch (error) {
      this.log('error', `Failed to trigger kill-switch: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resets the kill-switch for an account (requires user confirmation)
   * @param {string} accountId - Account ID
   * @param {boolean} [userConfirmed=false] - Whether user has confirmed the reset
   * @returns {Promise<boolean>} True if reset successfully
   */
  async reset(accountId, userConfirmed = false) {
    if (!accountId) {
      throw new Error('Account ID is required to reset kill-switch');
    }

    const state = this._states.get(accountId);
    if (!state) {
      this.log('warn', `No kill-switch state found for account: ${accountId}`);
      return false;
    }

    if (state.state !== KillSwitchState.ACTIVE) {
      this.log('info', `Kill-switch not active for account: ${accountId}`);
      return true;
    }

    // Require user confirmation for security
    if (!userConfirmed) {
      state.resetRequested = true;
      state.state = KillSwitchState.PENDING_RESET;
      this.log('info', `Kill-switch reset requested for account: ${accountId}, awaiting confirmation`);
      
      // Emit event for UI to show confirmation dialog
      if (this.eventBus) {
        await this.eventBus.publish('proxy:kill_switch_reset_requested', {
          accountId,
          proxyId: state.proxyId,
          trigger: state.trigger,
          activatedAt: state.activatedAt?.toISOString()
        });
      }
      
      return false;
    }

    try {
      this.log('info', `Resetting kill-switch for account: ${accountId}`);

      // Reset state
      state.state = KillSwitchState.INACTIVE;
      state.activatedAt = null;
      state.trigger = null;
      state.details = null;
      state.resetRequested = false;

      // Emit reset event
      if (this.eventBus) {
        await this.eventBus.publish('proxy:kill_switch_reset', {
          accountId,
          proxyId: state.proxyId,
          timestamp: new Date().toISOString()
        });
      }

      this.log('info', `✓ Kill-switch reset for account: ${accountId}`);
      return true;
    } catch (error) {
      this.log('error', `Failed to reset kill-switch: ${error.message}`);
      throw error;
    }
  }

  // ==================== Query Methods ====================

  /**
   * Checks if kill-switch is active for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isActive(accountId) {
    const state = this._states.get(accountId);
    return state?.state === KillSwitchState.ACTIVE;
  }

  /**
   * Checks if kill-switch is enabled for an account
   * @param {string} accountId - Account ID
   * @returns {boolean}
   */
  isEnabled(accountId) {
    return this._states.has(accountId);
  }

  /**
   * Gets the kill-switch state for an account
   * @param {string} accountId - Account ID
   * @returns {Object|null} State object or null
   */
  getState(accountId) {
    const state = this._states.get(accountId);
    if (!state) return null;

    return {
      accountId: state.accountId,
      proxyId: state.proxyId,
      state: state.state,
      enabledAt: state.enabledAt,
      activatedAt: state.activatedAt,
      trigger: state.trigger,
      details: state.details,
      resetRequested: state.resetRequested
    };
  }

  /**
   * Gets all active kill-switches
   * @returns {Array} Array of active kill-switch states
   */
  getActiveKillSwitches() {
    const active = [];
    for (const [accountId, state] of this._states) {
      if (state.state === KillSwitchState.ACTIVE) {
        active.push(this.getState(accountId));
      }
    }
    return active;
  }

  /**
   * Gets activation history
   * @param {number} [limit=50] - Maximum records to return
   * @returns {Array} Activation history
   */
  getActivationHistory(limit = 50) {
    return this._activationHistory.slice(-limit);
  }

  // ==================== Helper Methods ====================

  /**
   * Blocks network requests for a session
   * @private
   * @param {string} sessionId - Session ID
   */
  async _blockNetworkRequests(sessionId) {
    if (!this.securityManager) {
      this.log('warn', 'No security manager available to block requests');
      return;
    }

    try {
      // Get the session from security manager
      const sessions = this.securityManager.getEnforcedSessions();
      const sessionInfo = sessions.find(s => s.sessionId === sessionId);
      
      if (sessionInfo) {
        // Block direct connections - this will cause all requests to fail
        // The session is retrieved from the internal state
        const state = this.securityManager._enforcedSessions.get(sessionId);
        if (state && state.session) {
          await this.securityManager.blockDirectConnections(state.session, sessionId);
        }
      }
    } catch (error) {
      this.log('error', `Failed to block network requests: ${error.message}`);
    }
  }

  /**
   * Creates an activation event based on trigger reason
   * @private
   * @param {string} accountId - Account ID
   * @param {string} proxyId - Proxy ID
   * @param {string} reason - Trigger reason
   * @param {Object} details - Additional details
   * @returns {KillSwitchActivatedEvent}
   */
  _createActivationEvent(accountId, proxyId, reason, details) {
    const Trigger = KillSwitchActivatedEvent.Trigger;
    
    switch (reason) {
      case Trigger.PROXY_DISCONNECTED:
        return KillSwitchActivatedEvent.proxyDisconnected(accountId, proxyId, details.message);
      
      case Trigger.CONSECUTIVE_FAILURES:
        return KillSwitchActivatedEvent.consecutiveFailures(
          accountId, proxyId, details.failureCount, details.threshold
        );
      
      case Trigger.IP_LEAK_DETECTED:
        return KillSwitchActivatedEvent.ipLeakDetected(
          accountId, proxyId, details.expectedIP, details.detectedIP, details.leakType
        );
      
      case Trigger.IP_MISMATCH:
        return KillSwitchActivatedEvent.ipMismatch(
          accountId, proxyId, details.expectedIP, details.actualIP
        );
      
      case Trigger.WEBRTC_LEAK:
        return KillSwitchActivatedEvent.webrtcLeak(accountId, proxyId, details.leakedIP);
      
      case Trigger.DNS_LEAK:
        return KillSwitchActivatedEvent.dnsLeak(accountId, proxyId, details.leakedDNS);
      
      case Trigger.HEALTH_CHECK_FAILED:
        return KillSwitchActivatedEvent.healthCheckFailed(accountId, proxyId, details.reason);
      
      case Trigger.MANUAL:
        return KillSwitchActivatedEvent.manual(accountId, proxyId, details.reason);
      
      default:
        return new KillSwitchActivatedEvent({
          accountId,
          proxyId,
          trigger: reason,
          details: JSON.stringify(details)
        });
    }
  }

  /**
   * Records an activation in history
   * @private
   * @param {KillSwitchActivatedEvent} event - Activation event
   */
  _recordActivation(event) {
    this._activationHistory.push(event.toJSON());
    
    // Trim history if too large
    if (this._activationHistory.length > this._maxHistorySize) {
      this._activationHistory = this._activationHistory.slice(-this._maxHistorySize / 2);
    }
  }

  // ==================== Lifecycle Methods ====================

  /**
   * Disables kill-switch for an account
   * @param {string} accountId - Account ID
   * @returns {boolean} True if disabled
   */
  disable(accountId) {
    if (!this._states.has(accountId)) {
      return false;
    }

    this._states.delete(accountId);
    this.log('info', `Kill-switch disabled for account: ${accountId}`);
    return true;
  }

  /**
   * Cleans up all resources
   */
  cleanup() {
    this.log('info', 'Cleaning up KillSwitch...');
    this._states.clear();
    this._activationHistory = [];
    this.log('info', 'KillSwitch cleanup complete');
  }

  /**
   * Alias for cleanup - destroys the KillSwitch instance
   */
  destroy() {
    this.cleanup();
  }

  /**
   * Gets the status for an account (alias for getState)
   * @param {string} accountId - Account ID
   * @returns {Object|null}
   */
  getStatus(accountId) {
    const state = this.getState(accountId);
    if (!state) return null;
    
    return {
      ...state,
      active: state.state === KillSwitchState.ACTIVE
    };
  }
}

// Export class and enums
KillSwitch.State = KillSwitchState;
module.exports = KillSwitch;
