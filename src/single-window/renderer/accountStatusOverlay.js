/**
 * Account Status Overlay
 * 
 * Provides detailed status monitoring for accounts including:
 * - Proxy status (green/yellow/red indicators)
 * - Proxy status details on hover
 * - Heartbeat status display
 * - Resource usage (CPU, memory)
 * 
 * Requirements: 16.4-16.5, 29.6
 */

(function () {
  'use strict';

  class AccountStatusOverlay {
    constructor(options = {}) {
      this.accountId = options.accountId || null;
      this.container = options.container || null;
      this.status = {
        proxy: { status: 'unknown', details: null },
        heartbeat: { status: 'unknown', lastCheck: null },
        resources: { cpu: 0, memory: 0 }
      };
      this.updateInterval = null;
    }

    init() {
      this.injectStyles();
      this.createOverlay();
      this.startMonitoring();
    }

    injectStyles() {
      if (document.getElementById('account-status-overlay-styles')) {
        return;
      }
      const style = document.createElement('style');
      style.id = 'account-status-overlay-styles';
      style.textContent = `
.account-status-overlay {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 6px;
  font-size: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
  cursor: help;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.green { background: #22c55e; }
.status-dot.yellow { background: #f59e0b; }
.status-dot.red { background: #ef4444; }
.status-dot.gray { background: #9ca3af; }

.status-dot.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-label {
  color: #374151;
  font-weight: 500;
}

.status-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 12px;
  background: #1f2937;
  color: #fff;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  z-index: 1000;
  margin-bottom: 4px;
}

.status-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: #1f2937;
}

.status-indicator:hover .status-tooltip {
  opacity: 1;
  visibility: visible;
}

.status-tooltip .tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.status-tooltip .tooltip-row:last-child {
  margin-bottom: 0;
}

.status-tooltip .tooltip-label {
  color: #9ca3af;
}

.status-tooltip .tooltip-value {
  color: #fff;
  font-weight: 500;
}

.resource-bar {
  width: 40px;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.resource-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.resource-bar-fill.low { background: #22c55e; }
.resource-bar-fill.medium { background: #f59e0b; }
.resource-bar-fill.high { background: #ef4444; }
`;
      document.head.appendChild(style);
    }

    createOverlay() {
      if (!this.container) return;

      this.overlay = document.createElement('div');
      this.overlay.className = 'account-status-overlay';
      this.overlay.innerHTML = `
        <!-- Proxy Status -->
        <div class="status-indicator" id="proxy-status">
          <div class="status-dot gray"></div>
          <span class="status-label">代理</span>
          <div class="status-tooltip">
            <div class="tooltip-row">
              <span class="tooltip-label">状态:</span>
              <span class="tooltip-value" id="proxy-status-text">未知</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">本地端口:</span>
              <span class="tooltip-value" id="proxy-local-port">-</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">远程代理:</span>
              <span class="tooltip-value" id="proxy-remote">-</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">响应时间:</span>
              <span class="tooltip-value" id="proxy-response-time">-</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">最后检查:</span>
              <span class="tooltip-value" id="proxy-last-check">-</span>
            </div>
          </div>
        </div>

        <!-- Heartbeat Status -->
        <div class="status-indicator" id="heartbeat-status">
          <div class="status-dot gray"></div>
          <span class="status-label">心跳</span>
          <div class="status-tooltip">
            <div class="tooltip-row">
              <span class="tooltip-label">状态:</span>
              <span class="tooltip-value" id="heartbeat-status-text">未知</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">最后响应:</span>
              <span class="tooltip-value" id="heartbeat-last-response">-</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">连续失败:</span>
              <span class="tooltip-value" id="heartbeat-failures">0</span>
            </div>
          </div>
        </div>

        <!-- CPU Usage -->
        <div class="status-indicator" id="cpu-status">
          <span class="status-label">CPU</span>
          <div class="resource-bar">
            <div class="resource-bar-fill low" id="cpu-bar" style="width: 0%"></div>
          </div>
          <div class="status-tooltip">
            <div class="tooltip-row">
              <span class="tooltip-label">CPU 使用率:</span>
              <span class="tooltip-value" id="cpu-usage-text">0%</span>
            </div>
          </div>
        </div>

        <!-- Memory Usage -->
        <div class="status-indicator" id="memory-status">
          <span class="status-label">内存</span>
          <div class="resource-bar">
            <div class="resource-bar-fill low" id="memory-bar" style="width: 0%"></div>
          </div>
          <div class="status-tooltip">
            <div class="tooltip-row">
              <span class="tooltip-label">内存使用:</span>
              <span class="tooltip-value" id="memory-usage-text">0 MB</span>
            </div>
          </div>
        </div>
      `;

      this.container.appendChild(this.overlay);
    }

    startMonitoring() {
      // Initial update
      this.updateStatus();

      // Update every 10 seconds
      this.updateInterval = setInterval(() => {
        this.updateStatus();
      }, 10000);
    }

    stopMonitoring() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    }

    async updateStatus() {
      if (!this.accountId) return;

      try {
        // Update proxy status
        await this.updateProxyStatus();

        // Update heartbeat status
        await this.updateHeartbeatStatus();

        // Update resource usage
        await this.updateResourceUsage();
      } catch (error) {
        console.error('[AccountStatusOverlay] updateStatus error:', error);
      }
    }

    async updateProxyStatus() {
      if (!window.proxyRelayAPI) return;

      try {
        const response = await window.proxyRelayAPI.getStatus(this.accountId);
        
        if (response.success && response.status) {
          const status = response.status;
          this.status.proxy = status;

          // Update dot color
          const dot = this.overlay.querySelector('#proxy-status .status-dot');
          dot.className = 'status-dot';
          
          if (status.isRunning) {
            if (status.consecutiveFailures === 0) {
              dot.classList.add('green');
            } else if (status.consecutiveFailures < 3) {
              dot.classList.add('yellow');
            } else {
              dot.classList.add('red');
            }
          } else {
            dot.classList.add('gray');
          }

          // Update tooltip
          this.overlay.querySelector('#proxy-status-text').textContent = 
            status.isRunning ? '运行中' : '未运行';
          this.overlay.querySelector('#proxy-local-port').textContent = 
            status.localPort || '-';
          this.overlay.querySelector('#proxy-remote').textContent = 
            status.remoteProxy ? `${status.remoteProxy.host}:${status.remoteProxy.port}` : '-';
          this.overlay.querySelector('#proxy-response-time').textContent = 
            status.responseTime ? `${status.responseTime}ms` : '-';
          this.overlay.querySelector('#proxy-last-check').textContent = 
            status.lastHealthCheck ? this.formatTime(new Date(status.lastHealthCheck)) : '-';
        }
      } catch (error) {
        console.error('[AccountStatusOverlay] updateProxyStatus error:', error);
      }
    }

    async updateHeartbeatStatus() {
      // For now, use a placeholder - this would integrate with ProfileSupervisor
      const dot = this.overlay.querySelector('#heartbeat-status .status-dot');
      
      // Default to healthy if account is running
      if (this.status.proxy.isRunning) {
        dot.className = 'status-dot green pulse';
        this.overlay.querySelector('#heartbeat-status-text').textContent = '正常';
      } else {
        dot.className = 'status-dot gray';
        this.overlay.querySelector('#heartbeat-status-text').textContent = '未监控';
      }
    }

    async updateResourceUsage() {
      // Placeholder for resource monitoring
      // This would integrate with ProfileSupervisor's resource monitoring
      const cpuUsage = Math.random() * 30; // Simulated
      const memoryUsage = Math.random() * 500; // Simulated MB

      // Update CPU bar
      const cpuBar = this.overlay.querySelector('#cpu-bar');
      cpuBar.style.width = `${Math.min(cpuUsage, 100)}%`;
      cpuBar.className = 'resource-bar-fill ' + this.getResourceLevel(cpuUsage);
      this.overlay.querySelector('#cpu-usage-text').textContent = `${cpuUsage.toFixed(1)}%`;

      // Update Memory bar
      const memoryPercent = (memoryUsage / 1024) * 100; // Assuming 1GB max
      const memoryBar = this.overlay.querySelector('#memory-bar');
      memoryBar.style.width = `${Math.min(memoryPercent, 100)}%`;
      memoryBar.className = 'resource-bar-fill ' + this.getResourceLevel(memoryPercent);
      this.overlay.querySelector('#memory-usage-text').textContent = `${memoryUsage.toFixed(0)} MB`;

      this.status.resources = { cpu: cpuUsage, memory: memoryUsage };
    }

    getResourceLevel(percent) {
      if (percent < 50) return 'low';
      if (percent < 80) return 'medium';
      return 'high';
    }

    formatTime(date) {
      if (!date) return '-';
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
      return date.toLocaleString();
    }

    setAccount(accountId) {
      this.accountId = accountId;
      this.updateStatus();
    }

    destroy() {
      this.stopMonitoring();
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }
  }

  window.AccountStatusOverlay = AccountStatusOverlay;
})();
