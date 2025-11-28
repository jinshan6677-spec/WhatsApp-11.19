/**
 * Fingerprint History Panel
 * 
 * Provides UI for viewing and managing fingerprint configuration history:
 * - Configuration history list display
 * - Historical version details view
 * - "Restore this version" button
 * 
 * Requirements: 31.1-31.6
 */

(function () {
  'use strict';

  class FingerprintHistoryPanel {
    constructor(options = {}) {
      this.host = options.host || null;
      this.accountId = options.accountId || null;
      this.onRestore = options.onRestore || null;
      this.panel = null;
      this.history = [];
      this.selectedVersion = null;
    }

    init() {
      this.injectStyles();
      this.createPanel();
      this.bindEvents();
    }

    injectStyles() {
      if (document.getElementById('fingerprint-history-styles')) {
        return;
      }
      const style = document.createElement('style');
      style.id = 'fingerprint-history-styles';
      style.textContent = `
.fingerprint-history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.history-header {
  padding: 16px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: #fff;
}

.history-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.history-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.history-list {
  width: 200px;
  border-right: 1px solid #e5e7eb;
  overflow-y: auto;
}

.history-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background 0.2s;
}

.history-item:hover {
  background: #f9fafb;
}

.history-item.selected {
  background: #ede9fe;
  border-left: 3px solid #8b5cf6;
}

.history-item-date {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
}

.history-item-summary {
  font-size: 11px;
  color: #6b7280;
  margin-top: 4px;
}

.history-details {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.history-details-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
  font-size: 14px;
}

.history-details-content {
  display: none;
}

.history-details-content.visible {
  display: block;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.detail-label {
  color: #6b7280;
}

.detail-value {
  color: #111827;
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-footer {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.history-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-btn.primary {
  background: #8b5cf6;
  color: #fff;
  border: none;
}

.history-btn.primary:hover {
  background: #7c3aed;
}

.history-btn.primary:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.history-btn.secondary {
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
}

.history-btn.secondary:hover {
  border-color: #8b5cf6;
  color: #7c3aed;
}

.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #9ca3af;
}

.empty-history-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
`;
      document.head.appendChild(style);
    }

    createPanel() {
      if (!this.host) return;

      this.panel = document.createElement('div');
      this.panel.className = 'fingerprint-history-panel';
      this.panel.innerHTML = `
        <div class="history-header">
          <h3>📜 配置历史</h3>
        </div>
        
        <div class="history-content">
          <div class="history-list" id="historyList">
            <div class="empty-history">
              <div class="empty-history-icon">📋</div>
              <div>暂无历史记录</div>
            </div>
          </div>
          
          <div class="history-details">
            <div class="history-details-empty" id="detailsEmpty">
              选择一个版本查看详情
            </div>
            
            <div class="history-details-content" id="detailsContent">
              <div class="detail-section">
                <h4>基本信息</h4>
                <div class="detail-row">
                  <span class="detail-label">版本时间</span>
                  <span class="detail-value" id="detailTime">-</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">浏览器</span>
                  <span class="detail-value" id="detailBrowser">-</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">操作系统</span>
                  <span class="detail-value" id="detailPlatform">-</span>
                </div>
              </div>
              
              <div class="detail-section">
                <h4>指纹配置</h4>
                <div class="detail-row">
                  <span class="detail-label">WebGL 模式</span>
                  <span class="detail-value" id="detailWebGL">-</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Canvas 模式</span>
                  <span class="detail-value" id="detailCanvas">-</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Audio 模式</span>
                  <span class="detail-value" id="detailAudio">-</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">WebRTC 模式</span>
                  <span class="detail-value" id="detailWebRTC">-</span>
                </div>
              </div>
              
              <div class="detail-section">
                <h4>环境设置</h4>
                <div class="detail-row">
                  <span class="detail-label">时区</span>
                  <span class="detail-value" id="detailTimezone">-</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">语言</span>
                  <span class="detail-value" id="detailLanguage">-</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">分辨率</span>
                  <span class="detail-value" id="detailScreen">-</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="history-footer">
          <button class="history-btn secondary" id="closeHistoryBtn">关闭</button>
          <button class="history-btn primary" id="restoreVersionBtn" disabled>恢复此版本</button>
        </div>
      `;

      this.host.appendChild(this.panel);
    }

    bindEvents() {
      this.panel.querySelector('#closeHistoryBtn')?.addEventListener('click', () => {
        this.hide();
      });

      this.panel.querySelector('#restoreVersionBtn')?.addEventListener('click', () => {
        this.restoreVersion();
      });
    }

    async loadHistory() {
      if (!this.accountId || !window.fingerprintAPI) return;

      try {
        const response = await window.fingerprintAPI.getHistory(this.accountId);
        
        if (response.success) {
          this.history = response.history || [];
          this.renderHistoryList();
        }
      } catch (error) {
        console.error('[FingerprintHistoryPanel] loadHistory error:', error);
      }
    }

    renderHistoryList() {
      const listEl = this.panel.querySelector('#historyList');
      if (!listEl) return;

      if (this.history.length === 0) {
        listEl.innerHTML = `
          <div class="empty-history">
            <div class="empty-history-icon">📋</div>
            <div>暂无历史记录</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = this.history.map((version, index) => `
        <div class="history-item" data-index="${index}">
          <div class="history-item-date">${this.formatDate(version.timestamp)}</div>
          <div class="history-item-summary">${version.browserVersion} / ${version.platform}</div>
        </div>
      `).join('');

      // Add click handlers
      listEl.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
          const index = parseInt(item.dataset.index, 10);
          this.selectVersion(index);
        });
      });
    }

    selectVersion(index) {
      if (index < 0 || index >= this.history.length) return;

      this.selectedVersion = this.history[index];

      // Update selection UI
      this.panel.querySelectorAll('.history-item').forEach((item, i) => {
        item.classList.toggle('selected', i === index);
      });

      // Show details
      this.showVersionDetails(this.selectedVersion);

      // Enable restore button
      this.panel.querySelector('#restoreVersionBtn').disabled = false;
    }

    showVersionDetails(version) {
      const emptyEl = this.panel.querySelector('#detailsEmpty');
      const contentEl = this.panel.querySelector('#detailsContent');

      if (emptyEl) emptyEl.style.display = 'none';
      if (contentEl) contentEl.classList.add('visible');

      // Populate details
      this.panel.querySelector('#detailTime').textContent = this.formatDate(version.timestamp);
      this.panel.querySelector('#detailBrowser').textContent = version.browserVersion || '-';
      this.panel.querySelector('#detailPlatform').textContent = version.platform || '-';
      this.panel.querySelector('#detailWebGL').textContent = version.webgl?.mode || '-';
      this.panel.querySelector('#detailCanvas').textContent = version.canvas?.mode || '-';
      this.panel.querySelector('#detailAudio').textContent = version.audio?.mode || '-';
      this.panel.querySelector('#detailWebRTC').textContent = version.webrtc?.mode || '-';
      this.panel.querySelector('#detailTimezone').textContent = version.timezone?.value || version.timezone?.mode || '-';
      this.panel.querySelector('#detailLanguage').textContent = version.language?.value || '-';
      this.panel.querySelector('#detailScreen').textContent = 
        version.screen ? `${version.screen.width}x${version.screen.height}` : '-';
    }

    async restoreVersion() {
      if (!this.selectedVersion || !this.accountId) return;

      try {
        const response = await window.fingerprintAPI.restoreVersion(
          this.accountId,
          this.selectedVersion.id
        );

        if (response.success) {
          if (this.onRestore) {
            this.onRestore(this.selectedVersion);
          }
          this.hide();
        } else {
          alert('恢复失败：' + (response.error?.message || '未知错误'));
        }
      } catch (error) {
        console.error('[FingerprintHistoryPanel] restoreVersion error:', error);
        alert('恢复失败：' + error.message);
      }
    }

    formatDate(timestamp) {
      if (!timestamp) return '-';
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    show() {
      if (this.panel) {
        this.panel.style.display = 'flex';
        this.loadHistory();
      }
    }

    hide() {
      if (this.panel) {
        this.panel.style.display = 'none';
      }
    }

    setAccount(accountId) {
      this.accountId = accountId;
      this.selectedVersion = null;
      this.history = [];
      
      // Reset UI
      const emptyEl = this.panel?.querySelector('#detailsEmpty');
      const contentEl = this.panel?.querySelector('#detailsContent');
      if (emptyEl) emptyEl.style.display = 'flex';
      if (contentEl) contentEl.classList.remove('visible');
      
      const restoreBtn = this.panel?.querySelector('#restoreVersionBtn');
      if (restoreBtn) restoreBtn.disabled = true;
    }

    destroy() {
      if (this.panel && this.panel.parentNode) {
        this.panel.parentNode.removeChild(this.panel);
      }
    }
  }

  window.FingerprintHistoryPanel = FingerprintHistoryPanel;
})();
