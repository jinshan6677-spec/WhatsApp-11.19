/**
 * Quick Reply React 入口文件
 * 
 * 将 React 组件暴露给渲染进程使用
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

// 导入操作面板组件
import OperationPanel, { OperationPanelProvider } from '../../../quick-reply/ui/operation-panel/OperationPanel';

// 导入样式
import './styles.css';

// 存储 React root 实例
let root = null;
let currentAccountId = null;

/**
 * 创建 API 适配器（连接 IPC）
 */
function createAPIAdapter() {
  const api = window.electronAPI?.quickReply;
  if (!api) {
    console.warn('[QuickReply] electronAPI.quickReply not available');
    return null;
  }

  return {
    // 加载数据
    load: async (accountId) => {
      const result = await api.load(accountId);
      return result;
    },

    // 发送模板
    sendTemplate: async (templateId, mode) => {
      return await api.sendTemplate(templateId, mode);
    },

    // 插入模板
    insertTemplate: async (templateId, mode) => {
      return await api.insertTemplate(templateId, mode);
    },

    // 搜索
    searchTemplates: async (keyword) => {
      return await api.searchTemplates(keyword);
    },

    // 创建模板
    createTemplate: async (data) => {
      return await api.createTemplate(data);
    },

    // 更新模板
    updateTemplate: async (id, updates) => {
      return await api.updateTemplate(id, updates);
    },

    // 删除模板
    deleteTemplate: async (id) => {
      return await api.deleteTemplate(id);
    },

    // 创建分组
    createGroup: async (name, parentId) => {
      return await api.createGroup(name, parentId);
    },

    // 更新分组
    updateGroup: async (id, updates) => {
      return await api.updateGroup(id, updates);
    },

    // 删除分组
    deleteGroup: async (id) => {
      return await api.deleteGroup(id);
    },

    // 打开管理界面
    openManagement: async () => {
      return await api.openManagement();
    }
  };
}

/**
 * 快捷回复面板包装组件
 */
function QuickReplyPanelWrapper({ accountId, onClose }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const api = React.useMemo(() => createAPIAdapter(), []);

  // 加载数据
  const loadData = React.useCallback(async () => {
    if (!accountId || !api) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.load(accountId);
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || '加载失败');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, api]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // 发送模板
  const handleSend = async (templateId, mode) => {
    try {
      const result = await api.sendTemplate(templateId, mode);
      if (!result.success) {
        alert('发送失败: ' + (result.error || '未知错误'));
      }
    } catch (err) {
      alert('发送失败: ' + err.message);
    }
  };

  // 插入模板
  const handleInsert = async (templateId, mode) => {
    try {
      const result = await api.insertTemplate(templateId, mode);
      if (!result.success) {
        alert('插入失败: ' + (result.error || '未知错误'));
      }
    } catch (err) {
      alert('插入失败: ' + err.message);
    }
  };

  // 打开管理界面
  const handleOpenManagement = () => {
    api?.openManagement();
  };

  if (loading) {
    return (
      <div className="qr-loading">
        <div className="qr-loading-spinner"></div>
        <div>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="qr-error">
        <div className="qr-error-icon">❌</div>
        <div className="qr-error-message">{error}</div>
        <button className="qr-btn qr-btn-primary" onClick={loadData}>
          重试
        </button>
      </div>
    );
  }

  return (
    <OperationPanelProvider
      controller={{
        templateManager: {
          getAllTemplates: async () => data?.templates || [],
          storage: { getAll: async () => data?.templates || [] }
        },
        groupManager: {
          getAllGroups: async () => data?.groups || []
        }
      }}
    >
      <OperationPanelContent
        data={data}
        onSend={handleSend}
        onInsert={handleInsert}
        onOpenManagement={handleOpenManagement}
        onRefresh={loadData}
        onClose={onClose}
      />
    </OperationPanelProvider>
  );
}

/**
 * 操作面板内容组件
 */
function OperationPanelContent({ data, onSend, onInsert, onOpenManagement, onRefresh, onClose }) {
  const [sendMode, setSendMode] = React.useState('original');
  const [searchKeyword, setSearchKeyword] = React.useState('');
  const [expandedGroups, setExpandedGroups] = React.useState(new Set());
  const [selectedGroupId, setSelectedGroupId] = React.useState(null);

  const templates = data?.templates || [];
  const groups = data?.groups || [];

  // 过滤模板
  const filteredTemplates = React.useMemo(() => {
    let result = templates;

    // 按分组过滤
    if (selectedGroupId) {
      result = result.filter(t => t.groupId === selectedGroupId);
    }

    // 按关键词过滤
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      result = result.filter(t =>
        (t.label || '').toLowerCase().includes(keyword) ||
        (t.content?.text || '').toLowerCase().includes(keyword)
      );
    }

    return result;
  }, [templates, selectedGroupId, searchKeyword]);

  // 切换分组展开
  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <div className="quick-reply-panel">
      {/* 工具栏 */}
      <div className="qr-toolbar">
        <span className="qr-toolbar-title">快捷回复</span>
        <div className="qr-toolbar-spacer"></div>
        <button className="qr-btn qr-btn-icon" onClick={onRefresh} title="刷新">🔄</button>
        <button className="qr-btn qr-btn-icon" onClick={onOpenManagement} title="编辑管理">⚙️</button>
      </div>

      {/* 发送模式 */}
      <div className="qr-send-mode-bar">
        <label>
          <input
            type="radio"
            name="send-mode"
            value="original"
            checked={sendMode === 'original'}
            onChange={() => setSendMode('original')}
          />
          <span>原文发送</span>
        </label>
        <label>
          <input
            type="radio"
            name="send-mode"
            value="translated"
            checked={sendMode === 'translated'}
            onChange={() => setSendMode('translated')}
          />
          <span>翻译后发送</span>
        </label>
      </div>

      {/* 搜索框 */}
      <div className="qr-search-box">
        <input
          type="text"
          placeholder="请输入关键词"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
        />
      </div>

      {/* 内容区域 */}
      <div className="qr-content">
        {/* 分组列表 */}
        <div className="qr-groups">
          <div className="qr-group-header">
            <span>分组</span>
          </div>
          {groups.length === 0 ? (
            <div className="qr-empty">暂无分组</div>
          ) : (
            groups.map(group => (
              <div
                key={group.id}
                className={`qr-group-item ${selectedGroupId === group.id ? 'active' : ''}`}
                onClick={() => setSelectedGroupId(selectedGroupId === group.id ? null : group.id)}
              >
                <span
                  className="qr-group-toggle"
                  onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }}
                >
                  {expandedGroups.has(group.id) ? '▼' : '▶'}
                </span>
                <span className="qr-group-name">{group.name}</span>
                <span className="qr-group-count">({group.templateCount || 0})</span>
              </div>
            ))
          )}
        </div>

        {/* 模板列表 */}
        <div className="qr-templates">
          {filteredTemplates.length === 0 ? (
            <div className="qr-empty-state">
              <div className="qr-empty-icon">📝</div>
              <div className="qr-empty-title">暂无模板</div>
            </div>
          ) : (
            filteredTemplates.map((template, index) => (
              <div key={template.id} className="qr-template-item">
                <div className="qr-template-header">
                  <span className="qr-template-seq">{index + 1}</span>
                  <span className="qr-template-label">{template.label || '未命名'}</span>
                </div>
                <div className="qr-template-preview">
                  {template.type === 'text'
                    ? (template.content?.text || '').substring(0, 50)
                    : `${template.type} 模板`}
                </div>
                <div className="qr-template-actions">
                  <button
                    className="qr-btn qr-btn-sm qr-btn-send"
                    onClick={() => onSend(template.id, sendMode)}
                  >
                    发送
                  </button>
                  <button
                    className="qr-btn qr-btn-sm qr-btn-insert"
                    onClick={() => onInsert(template.id, sendMode)}
                  >
                    输入框提示
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 状态栏 */}
      <div className="qr-status">
        <span>模板: {templates.length}</span>
        <span>分组: {groups.length}</span>
      </div>
    </div>
  );
}

/**
 * 渲染快捷回复面板
 * @param {HTMLElement} container - 容器元素
 * @param {string} accountId - 账号 ID
 */
function render(container, accountId) {
  if (!container) {
    console.error('[QuickReply] Container not found');
    return;
  }

  currentAccountId = accountId;

  if (!root) {
    root = createRoot(container);
  }

  root.render(
    <QuickReplyPanelWrapper accountId={accountId} />
  );

  console.log('[QuickReply] Panel rendered for account:', accountId);
}

/**
 * 卸载面板
 */
function unmount() {
  if (root) {
    root.unmount();
    root = null;
    currentAccountId = null;
    console.log('[QuickReply] Panel unmounted');
  }
}

/**
 * 刷新面板
 */
function refresh() {
  if (root && currentAccountId) {
    root.render(
      <QuickReplyPanelWrapper key={Date.now()} accountId={currentAccountId} />
    );
  }
}

// 导出到全局
window.QuickReplyApp = {
  render,
  unmount,
  refresh
};

export { render, unmount, refresh };
