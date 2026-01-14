'use strict';

/**
 * Unit tests for ProxyHealthMonitor
 * 
 * Tests the health monitoring functionality including:
 * - Constructor and configuration
 * - Start/stop monitoring
 * - Periodic connection checks
 * - Status change notifications
 * 
 * **Validates: Requirements 4.1, 4.2, 4.4**
 */

const ProxyHealthMonitor = require('../../src/environment/ProxyHealthMonitor');
const LocalProxyManager = require('../../src/environment/LocalProxyManager');

describe('ProxyHealthMonitor', () => {
    let monitor;
    let originalTestLocalProxy;
    
    beforeEach(() => {
        jest.useFakeTimers();
        monitor = null;
        // Store original method
        originalTestLocalProxy = LocalProxyManager.testLocalProxy;
    });

    afterEach(() => {
        if (monitor) {
            monitor.stop();
        }
        jest.useRealTimers();
        // Restore original method
        LocalProxyManager.testLocalProxy = originalTestLocalProxy;
    });

    describe('Constructor', () => {
        test('should create instance with default options', () => {
            monitor = new ProxyHealthMonitor();
            
            expect(monitor).toBeInstanceOf(ProxyHealthMonitor);
            expect(monitor.isRunning()).toBe(false);
            expect(monitor.getStatus().status).toBe('disconnected');
        });

        test('should accept custom checkInterval', () => {
            monitor = new ProxyHealthMonitor({ checkInterval: 30000 });
            
            expect(monitor).toBeInstanceOf(ProxyHealthMonitor);
        });

        test('should accept onStatusChange callback', () => {
            const callback = jest.fn();
            monitor = new ProxyHealthMonitor({ onStatusChange: callback });
            
            expect(monitor).toBeInstanceOf(ProxyHealthMonitor);
        });

        test('should expose ConnectionStatus constants', () => {
            expect(ProxyHealthMonitor.ConnectionStatus).toBeDefined();
            expect(ProxyHealthMonitor.ConnectionStatus.CONNECTED).toBe('connected');
            expect(ProxyHealthMonitor.ConnectionStatus.CONNECTING).toBe('connecting');
            expect(ProxyHealthMonitor.ConnectionStatus.DISCONNECTED).toBe('disconnected');
            expect(ProxyHealthMonitor.ConnectionStatus.ERROR).toBe('error');
        });

        test('should expose DEFAULT_CONFIG', () => {
            expect(ProxyHealthMonitor.DEFAULT_CONFIG).toBeDefined();
            expect(ProxyHealthMonitor.DEFAULT_CONFIG.checkInterval).toBe(60000);
            expect(ProxyHealthMonitor.DEFAULT_CONFIG.timeout).toBe(10000);
        });
    });

    describe('start()', () => {
        test('should start monitoring with valid config', () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            expect(monitor.isRunning()).toBe(true);
            expect(monitor.getProxyConfig()).toEqual({ host: '127.0.0.1', port: 7890 });
        });

        test('should throw error for invalid config', () => {
            monitor = new ProxyHealthMonitor();
            
            expect(() => monitor.start(null)).toThrow('Invalid proxy configuration');
            expect(() => monitor.start({})).toThrow('Invalid proxy configuration');
            expect(() => monitor.start({ host: '127.0.0.1' })).toThrow('Invalid proxy configuration');
        });

        test('should set initial status to connecting', () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            // Initial status should be connecting before first check completes
            expect(monitor.getStatus().status).toBe('connecting');
        });

        test('should perform initial check immediately', () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            expect(LocalProxyManager.testLocalProxy).toHaveBeenCalledTimes(1);
        });

        test('should stop previous monitoring when starting new one', () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            monitor.start({ host: '127.0.0.1', port: 10808 });
            
            expect(monitor.getProxyConfig().port).toBe(10808);
        });
    });

    describe('stop()', () => {
        test('should stop monitoring', () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            monitor.stop();
            
            expect(monitor.isRunning()).toBe(false);
            expect(monitor.getProxyConfig()).toBeNull();
        });

        test('should reset status to disconnected', () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            monitor.stop();
            
            expect(monitor.getStatus().status).toBe('disconnected');
        });

        test('should be safe to call multiple times', () => {
            monitor = new ProxyHealthMonitor();
            
            expect(() => {
                monitor.stop();
                monitor.stop();
            }).not.toThrow();
        });
    });

    describe('checkNow()', () => {
        test('should return connected status on successful check', async () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            const result = await monitor.checkNow();
            
            expect(result.status).toBe('connected');
            expect(result.latency).toBe(50);
        });

        test('should return error status on failed check', async () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ 
                success: false, 
                error: 'Connection refused',
                latency: 100
            });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            const result = await monitor.checkNow();
            
            expect(result.status).toBe('error');
            expect(result.error).toBe('Connection refused');
        });

        test('should return disconnected when no config', async () => {
            monitor = new ProxyHealthMonitor();
            
            const result = await monitor.checkNow();
            
            expect(result.status).toBe('disconnected');
            expect(result.error).toBe('No proxy configuration');
        });

        test('should update internal status', async () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 75 });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            await monitor.checkNow();
            
            const status = monitor.getStatus();
            expect(status.status).toBe('connected');
            expect(status.latency).toBe(75);
            expect(status.lastCheck).toBeInstanceOf(Date);
        });
    });

    describe('Periodic checks (Requirements 4.1, 4.4)', () => {
        test('should check every 60 seconds by default', async () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            // Initial check
            expect(LocalProxyManager.testLocalProxy).toHaveBeenCalledTimes(1);
            
            // Advance 60 seconds
            jest.advanceTimersByTime(60000);
            
            expect(LocalProxyManager.testLocalProxy).toHaveBeenCalledTimes(2);
            
            // Advance another 60 seconds
            jest.advanceTimersByTime(60000);
            
            expect(LocalProxyManager.testLocalProxy).toHaveBeenCalledTimes(3);
        });

        test('should use custom check interval', async () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor({ checkInterval: 30000 });
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            // Initial check
            expect(LocalProxyManager.testLocalProxy).toHaveBeenCalledTimes(1);
            
            // Advance 30 seconds
            jest.advanceTimersByTime(30000);
            
            expect(LocalProxyManager.testLocalProxy).toHaveBeenCalledTimes(2);
        });

        test('should stop periodic checks when stopped', () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor();
            monitor.start({ host: '127.0.0.1', port: 7890 });
            monitor.stop();
            
            const callCount = LocalProxyManager.testLocalProxy.mock.calls.length;
            
            // Advance time
            jest.advanceTimersByTime(120000);
            
            // Should not have made more calls
            expect(LocalProxyManager.testLocalProxy).toHaveBeenCalledTimes(callCount);
        });
    });

    describe('getStatus()', () => {
        test('should return current status object', () => {
            monitor = new ProxyHealthMonitor();
            
            const status = monitor.getStatus();
            
            expect(status).toHaveProperty('status');
            expect(status).toHaveProperty('lastCheck');
            expect(status).toHaveProperty('latency');
            expect(status).toHaveProperty('error');
        });

        test('should return copy of status (immutable)', () => {
            monitor = new ProxyHealthMonitor();
            
            const status1 = monitor.getStatus();
            const status2 = monitor.getStatus();
            
            expect(status1).not.toBe(status2);
            expect(status1).toEqual(status2);
        });
    });

    describe('setCheckInterval()', () => {
        test('should update check interval', () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor();
            monitor.setCheckInterval(30000);
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            // Initial check
            expect(LocalProxyManager.testLocalProxy).toHaveBeenCalledTimes(1);
            
            // Advance 30 seconds (new interval)
            jest.advanceTimersByTime(30000);
            
            expect(LocalProxyManager.testLocalProxy).toHaveBeenCalledTimes(2);
        });

        test('should throw error for interval less than 1000ms', () => {
            monitor = new ProxyHealthMonitor();
            
            expect(() => monitor.setCheckInterval(500)).toThrow('Check interval must be at least 1000ms');
        });

        test('should restart monitoring with new interval if running', () => {
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor({ checkInterval: 60000 });
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            // Change interval while running
            monitor.setCheckInterval(10000);
            
            expect(monitor.isRunning()).toBe(true);
        });
    });

    describe('Status change notifications (Requirements 4.2)', () => {
        test('should call onStatusChange when status changes from connecting to connected', async () => {
            const onStatusChange = jest.fn();
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor({ onStatusChange });
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            // Wait for the check to complete
            await monitor.checkNow();
            
            expect(onStatusChange).toHaveBeenCalled();
            const call = onStatusChange.mock.calls[0][0];
            expect(call.previousStatus).toBe('connecting');
            expect(call.currentStatus).toBe('connected');
            expect(call.timestamp).toBeInstanceOf(Date);
        });

        test('should call onStatusChange when status changes from connected to error', async () => {
            const onStatusChange = jest.fn();
            const mockTestLocalProxy = jest.fn()
                .mockResolvedValueOnce({ success: true, latency: 50 })
                .mockResolvedValueOnce({ success: true, latency: 50 }) // start() calls checkNow
                .mockResolvedValueOnce({ success: false, error: 'Connection lost' });
            LocalProxyManager.testLocalProxy = mockTestLocalProxy;
            
            monitor = new ProxyHealthMonitor({ onStatusChange });
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            // First check - connected
            await monitor.checkNow();
            onStatusChange.mockClear();
            
            // Second check - error
            await monitor.checkNow();
            
            expect(onStatusChange).toHaveBeenCalled();
            const call = onStatusChange.mock.calls[0][0];
            expect(call.previousStatus).toBe('connected');
            expect(call.currentStatus).toBe('error');
            expect(call.error).toBe('Connection lost');
        });

        test('should not call onStatusChange when status remains the same', async () => {
            const onStatusChange = jest.fn();
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor({ onStatusChange });
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            // First check - connecting -> connected
            await monitor.checkNow();
            onStatusChange.mockClear();
            
            // Second check - connected -> connected (no change)
            await monitor.checkNow();
            
            expect(onStatusChange).not.toHaveBeenCalled();
        });

        test('should include latency in status change notification', async () => {
            const onStatusChange = jest.fn();
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 123 });
            
            monitor = new ProxyHealthMonitor({ onStatusChange });
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            await monitor.checkNow();
            
            expect(onStatusChange).toHaveBeenCalled();
            const call = onStatusChange.mock.calls[0][0];
            expect(call.latency).toBe(123);
        });

        test('should handle callback errors gracefully', async () => {
            const onStatusChange = jest.fn().mockImplementation(() => {
                throw new Error('Callback error');
            });
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor({ onStatusChange });
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            // Should not throw
            await expect(monitor.checkNow()).resolves.not.toThrow();
            
            // Monitor should still be running
            expect(monitor.isRunning()).toBe(true);
        });

        test('should allow updating onStatusChange callback', async () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: true, latency: 50 });
            
            monitor = new ProxyHealthMonitor({ onStatusChange: callback1 });
            monitor.start({ host: '127.0.0.1', port: 7890 });
            
            await monitor.checkNow();
            expect(callback1).toHaveBeenCalled();
            
            // Update callback
            monitor.setOnStatusChange(callback2);
            
            // Simulate status change
            LocalProxyManager.testLocalProxy = jest.fn().mockResolvedValue({ success: false, error: 'Error' });
            await monitor.checkNow();
            
            expect(callback2).toHaveBeenCalled();
        });
    });
});
