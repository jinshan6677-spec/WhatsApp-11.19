/**
 * SessionManager Proxy Leak Prevention Tests
 * Tests WebRTC IP handling policy and proxy rules construction
 */

const SessionManager = require('../SessionManager');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

// Create mock session object
const mockSessionInstance = {
    setProxy: jest.fn().mockResolvedValue(undefined),
    clearStorageData: jest.fn().mockResolvedValue(undefined),
    clearCache: jest.fn().mockResolvedValue(undefined),
    setWebRTCIPHandlingPolicy: jest.fn(),
    webRequest: {
        onBeforeSendHeaders: jest.fn()
    }
};

// Mock Electron session
jest.mock('electron', () => {
    const mockSession = {
        fromPartition: jest.fn(() => mockSessionInstance)
    };
    return {
        session: mockSession,
        net: {
            request: jest.fn()
        }
    };
});

// Get the mocked electron module
const electron = require('electron');
const { session } = electron;

describe('SessionManager Proxy Leak Prevention', () => {
    let sessionManager;
    let tempDir;
    let mockSession;

    beforeEach(async () => {
        // Create temp directory
        tempDir = path.join(os.tmpdir(), `test-sessions-leak-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });

        // Reset mock session
        mockSession = mockSessionInstance;
        mockSession.setProxy.mockClear();
        mockSession.clearStorageData.mockClear();
        mockSession.clearCache.mockClear();
        mockSession.setWebRTCIPHandlingPolicy.mockClear();
        mockSession.webRequest.onBeforeSendHeaders.mockClear();
        session.fromPartition.mockClear();
        session.fromPartition.mockReturnValue(mockSession);

        // Create SessionManager instance
        sessionManager = new SessionManager({
            userDataPath: tempDir,
            electron: electron
        });
    });

    afterEach(async () => {
        // Cleanup temp directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Failed to cleanup temp directory:', error);
        }

        jest.clearAllMocks();
    });

    test('should set WebRTC IP handling policy to disable_non_proxied_udp when configuring proxy', async () => {
        await sessionManager.createSession('test-account');

        const proxyConfig = {
            protocol: 'http',
            host: '127.0.0.1',
            port: 8080
        };

        const result = await sessionManager.configureProxy('test-account', proxyConfig);

        expect(result.success).toBe(true);
        expect(mockSession.setWebRTCIPHandlingPolicy).toHaveBeenCalledWith('disable_non_proxied_udp');
    });

    test('should use socks5:// scheme for socks5 protocol', async () => {
        await sessionManager.createSession('test-account');

        const proxyConfig = {
            protocol: 'socks5',
            host: '127.0.0.1',
            port: 1080
        };

        const result = await sessionManager.configureProxy('test-account', proxyConfig);

        expect(result.success).toBe(true);
        expect(mockSession.setProxy).toHaveBeenCalledWith(expect.objectContaining({
            proxyRules: 'socks5://127.0.0.1:1080'
        }));
        expect(mockSession.setWebRTCIPHandlingPolicy).toHaveBeenCalledWith('disable_non_proxied_udp');
    });

    test('should handle setWebRTCIPHandlingPolicy error gracefully', async () => {
        await sessionManager.createSession('test-account');

        // Mock setWebRTCIPHandlingPolicy to throw error (e.g. older Electron version)
        mockSession.setWebRTCIPHandlingPolicy.mockImplementation(() => {
            throw new Error('Method not implemented');
        });

        const proxyConfig = {
            protocol: 'http',
            host: '127.0.0.1',
            port: 8080
        };

        // Should not throw
        const result = await sessionManager.configureProxy('test-account', proxyConfig);

        expect(result.success).toBe(true);
        expect(mockSession.setProxy).toHaveBeenCalled();
    });
});
