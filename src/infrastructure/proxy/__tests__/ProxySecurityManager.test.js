'use strict';

const ProxySecurityManager = require('../ProxySecurityManager');
const ProxyConfig = require('../../../domain/entities/ProxyConfig');
const ProxyError = require('../../../domain/errors/ProxyError');

/**
 * Mock Electron Session
 */
function createMockSession() {
  const handlers = {
    onBeforeRequest: null,
    onBeforeSendHeaders: null
  };
  
  return {
    setProxy: jest.fn().mockResolvedValue(undefined),
    webRequest: {
      onBeforeRequest: jest.fn((filter, handler) => {
        if (typeof filter === 'function') {
          handlers.onBeforeRequest = filter;
        } else {
          handlers.onBeforeRequest = handler;
        }
      }),
      onBeforeSendHeaders: jest.fn((handler) => {
        handlers.onBeforeSendHeaders = handler;
      })
    },
    _handlers: handlers
  };
}

describe('ProxySecurityManager', () => {
  let manager;
  let mockSession;
  let mockEventBus;

  beforeEach(() => {
    mockSession = createMockSession();
    mockEventBus = {
      publish: jest.fn()
    };
    manager = new ProxySecurityManager({
      eventBus: mockEventBus
    });
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const mgr = new ProxySecurityManager();
      expect(mgr.getPolicy()).toBe(ProxySecurityManager.SecurityPolicy.PROXY_ONLY);
    });

    it('should accept custom policy', () => {
      const mgr = new ProxySecurityManager({
        policy: ProxySecurityManager.SecurityPolicy.STRICT
      });
      expect(mgr.getPolicy()).toBe(ProxySecurityManager.SecurityPolicy.STRICT);
    });

    it('should accept custom logger', () => {
      const customLogger = jest.fn();
      const mgr = new ProxySecurityManager({ logger: customLogger });
      expect(mgr.log).toBe(customLogger);
    });
  });

  describe('enforceProxyOnly', () => {
    it('should enforce proxy-only mode for a session', async () => {
      const result = await manager.enforceProxyOnly(mockSession, 'test-session');
      
      expect(result).toBe(true);
      expect(manager.isEnforced('test-session')).toBe(true);
    });

    it('should throw error if session is null', async () => {
      await expect(manager.enforceProxyOnly(null))
        .rejects.toThrow('Session is required');
    });

    it('should set up request interceptor', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      expect(mockSession.webRequest.onBeforeRequest).toHaveBeenCalled();
    });

    it('should emit event when enforced', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'proxy:security:enforced',
        expect.objectContaining({
          sessionId: 'test-session',
          policy: ProxySecurityManager.SecurityPolicy.PROXY_ONLY
        })
      );
    });

    it('should generate session ID if not provided', async () => {
      await manager.enforceProxyOnly(mockSession);
      
      const sessions = manager.getEnforcedSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
  });

  describe('blockDirectConnections', () => {
    it('should block all direct connections', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      await manager.blockDirectConnections(mockSession, 'test-session');
      
      expect(mockSession.setProxy).toHaveBeenCalledWith({
        proxyRules: expect.stringContaining('invalid-proxy'),
        proxyBypassRules: ''
      });
      expect(manager.isBlocked('test-session')).toBe(true);
    });

    it('should throw error if session is null', async () => {
      await expect(manager.blockDirectConnections(null))
        .rejects.toThrow('Session is required');
    });

    it('should emit blocked event', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      await manager.blockDirectConnections(mockSession, 'test-session');
      
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'proxy:security:blocked',
        expect.objectContaining({
          sessionId: 'test-session',
          reason: 'direct_connections_blocked'
        })
      );
    });
  });

  describe('configureProxyRules', () => {
    it('should configure proxy rules for SOCKS5', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      const result = await manager.configureProxyRules(mockSession, config, 'test-session');
      
      expect(result.success).toBe(true);
      expect(mockSession.setProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          proxyRules: 'socks5://proxy.example.com:1080'
        })
      );
    });

    it('should configure proxy rules for HTTP with auth', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      const config = new ProxyConfig({
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        username: 'user',
        password: 'pass',
        enabled: true
      });

      await manager.configureProxyRules(mockSession, config, 'test-session');
      
      expect(mockSession.webRequest.onBeforeSendHeaders).toHaveBeenCalled();
    });

    it('should configure SOCKS5 with auth in URL', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        username: 'user',
        password: 'pass',
        enabled: true
      });

      await manager.configureProxyRules(mockSession, config, 'test-session');
      
      expect(mockSession.setProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          proxyRules: expect.stringContaining('user:pass@proxy.example.com:1080')
        })
      );
    });

    it('should throw error for invalid config', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: '', // Invalid - empty host
        port: 1080,
        enabled: true
      });

      await expect(manager.configureProxyRules(mockSession, config, 'test-session'))
        .rejects.toThrow();
    });

    it('should throw error for disabled proxy', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: false
      });

      await expect(manager.configureProxyRules(mockSession, config, 'test-session'))
        .rejects.toThrow();
    });

    it('should block connections on configuration failure', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      // Make setProxy fail
      mockSession.setProxy.mockRejectedValueOnce(new Error('Proxy error'));
      
      const config = new ProxyConfig({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      });

      await expect(manager.configureProxyRules(mockSession, config, 'test-session'))
        .rejects.toThrow();
      
      // Should have called setProxy again to block
      expect(mockSession.setProxy).toHaveBeenCalledTimes(2);
    });

    it('should accept plain object config', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      const result = await manager.configureProxyRules(mockSession, {
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        enabled: true
      }, 'test-session');
      
      expect(result.success).toBe(true);
    });
  });

  describe('setupRequestInterceptor', () => {
    it('should set up request interceptor', async () => {
      await manager.setupRequestInterceptor(mockSession, 'test-session');
      
      expect(mockSession.webRequest.onBeforeRequest).toHaveBeenCalledWith(
        { urls: ['*://*/*'] },
        expect.any(Function)
      );
    });

    it('should handle session without webRequest', async () => {
      const sessionWithoutWebRequest = { setProxy: jest.fn() };
      
      // Should not throw
      await manager.setupRequestInterceptor(sessionWithoutWebRequest, 'test-session');
    });

    it('should block WebRTC requests', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      // Get the interceptor handler
      const handler = mockSession._handlers.onBeforeRequest;
      expect(handler).toBeDefined();
      
      // Test WebRTC blocking
      const callback = jest.fn();
      handler({ url: 'stun:stun.example.com', method: 'GET' }, callback);
      
      expect(callback).toHaveBeenCalledWith({ cancel: true });
    });

    it('should allow normal requests', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      const handler = mockSession._handlers.onBeforeRequest;
      const callback = jest.fn();
      
      handler({ url: 'https://web.whatsapp.com', method: 'GET' }, callback);
      
      expect(callback).toHaveBeenCalledWith({});
    });
  });

  describe('getBlockedRequests', () => {
    it('should return blocked requests log', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      // Trigger a blocked request
      const handler = mockSession._handlers.onBeforeRequest;
      const callback = jest.fn();
      handler({ url: 'stun:stun.example.com', method: 'GET' }, callback);
      
      const blocked = manager.getBlockedRequests();
      expect(blocked.length).toBe(1);
      expect(blocked[0].url).toBe('stun:stun.example.com');
    });

    it('should respect limit parameter', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      const handler = mockSession._handlers.onBeforeRequest;
      const callback = jest.fn();
      
      // Block multiple requests
      for (let i = 0; i < 10; i++) {
        handler({ url: `stun:stun${i}.example.com`, method: 'GET' }, callback);
      }
      
      const blocked = manager.getBlockedRequests(5);
      expect(blocked.length).toBe(5);
    });
  });

  describe('clearBlockedRequests', () => {
    it('should clear blocked requests log', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      const handler = mockSession._handlers.onBeforeRequest;
      const callback = jest.fn();
      handler({ url: 'stun:stun.example.com', method: 'GET' }, callback);
      
      expect(manager.getBlockedRequests().length).toBe(1);
      
      manager.clearBlockedRequests();
      
      expect(manager.getBlockedRequests().length).toBe(0);
    });
  });

  describe('getEnforcedSessions', () => {
    it('should return all enforced sessions', async () => {
      await manager.enforceProxyOnly(mockSession, 'session-1');
      
      const mockSession2 = createMockSession();
      await manager.enforceProxyOnly(mockSession2, 'session-2');
      
      const sessions = manager.getEnforcedSessions();
      expect(sessions.length).toBe(2);
      expect(sessions.map(s => s.sessionId)).toContain('session-1');
      expect(sessions.map(s => s.sessionId)).toContain('session-2');
    });
  });

  describe('releaseEnforcement', () => {
    it('should release enforcement for a session', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      expect(manager.isEnforced('test-session')).toBe(true);
      
      const result = manager.releaseEnforcement('test-session');
      
      expect(result).toBe(true);
      expect(manager.isEnforced('test-session')).toBe(false);
    });

    it('should return false for non-existent session', () => {
      const result = manager.releaseEnforcement('non-existent');
      expect(result).toBe(false);
    });

    it('should emit released event', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      manager.releaseEnforcement('test-session');
      
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'proxy:security:released',
        expect.objectContaining({
          sessionId: 'test-session'
        })
      );
    });
  });

  describe('setPolicy', () => {
    it('should change security policy', () => {
      manager.setPolicy(ProxySecurityManager.SecurityPolicy.STRICT);
      expect(manager.getPolicy()).toBe(ProxySecurityManager.SecurityPolicy.STRICT);
    });

    it('should throw error for invalid policy', () => {
      expect(() => manager.setPolicy('invalid'))
        .toThrow('Invalid security policy');
    });
  });

  describe('cleanup', () => {
    it('should clean up all resources', async () => {
      await manager.enforceProxyOnly(mockSession, 'test-session');
      
      const handler = mockSession._handlers.onBeforeRequest;
      const callback = jest.fn();
      handler({ url: 'stun:stun.example.com', method: 'GET' }, callback);
      
      manager.cleanup();
      
      expect(manager.getEnforcedSessions().length).toBe(0);
      expect(manager.getBlockedRequests().length).toBe(0);
    });
  });
});
