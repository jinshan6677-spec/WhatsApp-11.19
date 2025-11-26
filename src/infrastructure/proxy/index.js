'use strict';

/**
 * Proxy Security Infrastructure Module
 * 
 * This module provides enterprise-grade IP security protection for proxy connections.
 * It implements a zero-trust network model where all network requests must go through
 * the configured proxy, with no fallback to direct connections.
 * 
 * Components:
 * - ProxySecurityManager: Core security policy management
 * - ProxyConnectionManager: Secure connection lifecycle management (no fallback to direct)
 * - KillSwitch: Emergency network blocking mechanism
 * - ProxyReconnectionManager: Automatic reconnection with exponential backoff
 * - IPProtectionInjector: Comprehensive IP leak protection script injection
 * - WebRTCBlocker: WebRTC blocking to prevent STUN/TURN IP leaks
 * - DNSLeakPrevention: DNS leak prevention and prefetch blocking
 * - ProxyPreChecker: Pre-connection proxy verification (connectivity, latency, IP)
 * - IPLeakDetector: IP verification and leak detection
 * - ProxyHealthMonitor: Real-time proxy health monitoring
 * - ReconnectionOverlay: UI overlay for reconnection status
 * - SharedProxyManager: Multi-account proxy management
 * - ProxySwitchManager: Smooth proxy switching with rollback
 * - ProxyAuthManager: Proxy authentication lifecycle management
 * - NetworkChangeDetector: Network change detection and handling
 * - ProxyLoadBalancer: Proxy pool load balancing with multiple strategies
 * - ProxyBlacklistManager: Proxy blacklist management with auto-expiry
 * - ProxyPerformanceMonitor: Proxy performance monitoring with thresholds
 * 
 * @module infrastructure/proxy
 */

const ProxySecurityManager = require('./ProxySecurityManager');
const ProxyConnectionManager = require('./ProxyConnectionManager');
const KillSwitch = require('./KillSwitch');
const ProxyReconnectionManager = require('./ProxyReconnectionManager');
const IPProtectionInjector = require('./IPProtectionInjector');
const WebRTCBlocker = require('./WebRTCBlocker');
const DNSLeakPrevention = require('./DNSLeakPrevention');
const ProxyPreChecker = require('./ProxyPreChecker');
const IPLeakDetector = require('./IPLeakDetector');
const ProxyHealthMonitor = require('./ProxyHealthMonitor');
const ReconnectionOverlay = require('./ui/ReconnectionOverlay');
const SharedProxyManager = require('./SharedProxyManager');
const ProxySwitchManager = require('./ProxySwitchManager');
const ProxyAuthManager = require('./ProxyAuthManager');
const NetworkChangeDetector = require('./NetworkChangeDetector');
const ProxyLoadBalancer = require('./ProxyLoadBalancer');
const ProxyBlacklistManager = require('./ProxyBlacklistManager');
const ProxyPerformanceMonitor = require('./ProxyPerformanceMonitor');

module.exports = {
  ProxySecurityManager,
  ProxyConnectionManager,
  KillSwitch,
  ProxyReconnectionManager,
  IPProtectionInjector,
  WebRTCBlocker,
  DNSLeakPrevention,
  ProxyPreChecker,
  IPLeakDetector,
  ProxyHealthMonitor,
  ReconnectionOverlay,
  SharedProxyManager,
  ProxySwitchManager,
  ProxyAuthManager,
  NetworkChangeDetector,
  ProxyLoadBalancer,
  ProxyBlacklistManager,
  ProxyPerformanceMonitor
};
