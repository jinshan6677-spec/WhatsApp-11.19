# 设计文档

## 概述

本设计文档描述了增强代理系统以支持本地代理端口的技术实现方案。核心目标是让中国用户可以通过外部代理客户端（如 Clash、V2rayN）的本地 HTTP 端口访问 WhatsApp 和翻译服务。

### 核心功能

1. **本地代理端口支持**：支持配置本地 HTTP 代理端口（如 `127.0.0.1:7890`）
2. **代理客户端预设**：提供 Clash、V2rayN、Shadowsocks 等常用客户端的默认端口
3. **链式代理支持**：支持在本地代理之后配置额外的 HTTP/HTTPS 代理
4. **翻译服务代理**：翻译服务请求通过代理路由
5. **连接健康监控**：监控代理连接状态并显示在界面

### 技术栈

- **前端**: Vanilla JavaScript（现有架构）
- **后端**: Electron Main Process (Node.js)
- **存储**: electron-store（现有存储方案）
- **网络**: axios + https-proxy-agent（现有依赖）

## 架构

### 组件结构

```
enhanced-proxy-system/
├── 前端 (Renderer Process)
│   ├── ProxySettingsPanel (增强)
│   │   ├── 本地代理配置区域
│   │   ├── 代理客户端预设选择
│   │   ├── 链式代理配置区域
│   │   └── 连接状态指示器
│   └── TranslationPanel (增强)
│       └── 代理设置选项
│
├── 后端 (Main Process)
│   ├── LocalProxyManager (新增)
│   │   ├── 端口格式验证
│   │   ├── 连接测试
│   │   └── 预设管理
│   ├── ProxyChainManager (新增)
│   │   ├── 代理链配置
│   │   └── 代理规则生成
│   ├── ProxyHealthMonitor (新增)
│   │   ├── 定期连接检查
│   │   └── 状态通知
│   └── TranslationProxyAdapter (新增)
│       └── 翻译请求代理路由
│
└── 数据模型
    ├── LocalProxyConfig
    ├── ChainedProxyConfig
    └── ProxyHealthStatus
```

### 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户配置流程                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 用户选择代理客户端预设（或自定义端口）                         │
│                    ↓                                            │
│  2. 系统验证本地代理端口格式                                      │
│                    ↓                                            │
│  3. 系统测试本地代理连通性                                        │
│                    ↓                                            │
│  4. [可选] 用户配置链式代理                                       │
│                    ↓                                            │
│  5. 系统生成代理规则并应用到 Electron Session                     │
│                    ↓                                            │
│  6. 连接健康监控器开始监控                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 组件和接口

### 1. LocalProxyManager（新增）

负责本地代理端口的配置和验证。

```javascript
/**
 * 本地代理管理器
 */
class LocalProxyManager {
  /**
   * 代理客户端预设
   */
  static PRESETS = {
    clash: { name: 'Clash', host: '127.0.0.1', port: 7890, protocol: 'http' },
    v2rayn: { name: 'V2rayN', host: '127.0.0.1', port: 10808, protocol: 'http' },
    shadowsocks: { name: 'Shadowsocks', host: '127.0.0.1', port: 1080, protocol: 'http' },
    custom: { name: '自定义', host: '127.0.0.1', port: 0, protocol: 'http' }
  };

  /**
   * 验证本地代理端口格式
   * @param {string} host - 主机地址
   * @param {number} port - 端口号
   * @returns {{valid: boolean, errors: string[]}}
   */
  static validateLocalProxy(host, port)

  /**
   * 测试本地代理连通性
   * @param {Object} config - 代理配置
   * @returns {Promise<{success: boolean, latency?: number, error?: string}>}
   */
  static async testLocalProxy(config)

  /**
   * 获取预设配置
   * @param {string} presetId - 预设ID
   * @returns {Object|null}
   */
  static getPreset(presetId)

  /**
   * 构建代理URL
   * @param {Object} config - 代理配置
   * @returns {string}
   */
  static buildProxyUrl(config)
}
```

### 2. ProxyChainManager（新增）

负责代理链的配置和管理。

```javascript
/**
 * 代理链管理器
 */
class ProxyChainManager {
  /**
   * 构建代理链规则
   * @param {Object} localProxy - 本地代理配置
   * @param {Object|null} chainedProxy - 链式代理配置（可选）
   * @returns {string} 代理规则字符串
   */
  static buildProxyChainRules(localProxy, chainedProxy)

  /**
   * 验证链式代理是否可通过本地代理访问
   * @param {Object} localProxy - 本地代理配置
   * @param {Object} chainedProxy - 链式代理配置
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async validateChainedProxy(localProxy, chainedProxy)

  /**
   * 应用代理链到 Electron Session
   * @param {Electron.Session} session - Electron session
   * @param {Object} localProxy - 本地代理配置
   * @param {Object|null} chainedProxy - 链式代理配置
   * @returns {Promise<boolean>}
   */
  static async applyProxyChain(session, localProxy, chainedProxy)

  /**
   * 诊断代理链问题
   * @param {Object} localProxy - 本地代理配置
   * @param {Object|null} chainedProxy - 链式代理配置
   * @returns {Promise<{localProxyOk: boolean, chainedProxyOk: boolean, error?: string}>}
   */
  static async diagnoseProxyChain(localProxy, chainedProxy)
}
```

### 3. ProxyHealthMonitor（新增）

负责监控代理连接健康状态。

```javascript
/**
 * 代理健康监控器
 */
class ProxyHealthMonitor {
  /**
   * 创建监控器实例
   * @param {Object} options - 配置选项
   * @param {number} options.checkInterval - 检查间隔（毫秒），默认 60000
   * @param {Function} options.onStatusChange - 状态变化回调
   */
  constructor(options)

  /**
   * 开始监控
   * @param {Object} proxyConfig - 代理配置
   */
  start(proxyConfig)

  /**
   * 停止监控
   */
  stop()

  /**
   * 手动检查连接
   * @returns {Promise<{status: string, latency?: number, error?: string}>}
   */
  async checkNow()

  /**
   * 获取当前状态
   * @returns {{status: string, lastCheck: Date, latency?: number}}
   */
  getStatus()
}
```

### 4. TranslationProxyAdapter（新增）

负责翻译服务的代理路由。

```javascript
/**
 * 翻译代理适配器
 */
class TranslationProxyAdapter {
  /**
   * 配置翻译服务使用代理
   * @param {Object} proxyConfig - 代理配置
   * @param {string} mode - 模式：'always' | 'auto' | 'never'
   */
  static configure(proxyConfig, mode)

  /**
   * 检测翻译服务是否被封锁
   * @returns {Promise<boolean>}
   */
  static async detectBlocked()

  /**
   * 通过代理发送翻译请求
   * @param {string} text - 待翻译文本
   * @param {string} targetLang - 目标语言
   * @param {Object} proxyConfig - 代理配置
   * @returns {Promise<string>}
   */
  static async translateWithProxy(text, targetLang, proxyConfig)
}
```

## 数据模型

### LocalProxyConfig

```javascript
/**
 * @typedef {Object} LocalProxyConfig
 * @property {boolean} enabled - 是否启用本地代理
 * @property {string} presetId - 预设ID（clash/v2rayn/shadowsocks/custom）
 * @property {string} host - 主机地址（默认 127.0.0.1）
 * @property {number} port - 端口号
 * @property {string} protocol - 协议（http/https）
 */
```

### ChainedProxyConfig

```javascript
/**
 * @typedef {Object} ChainedProxyConfig
 * @property {boolean} enabled - 是否启用链式代理
 * @property {string} protocol - 协议（http/https）
 * @property {string} host - 主机地址
 * @property {number} port - 端口号
 * @property {string} [username] - 用户名（可选）
 * @property {string} [password] - 密码（可选）
 */
```

### ProxyHealthStatus

```javascript
/**
 * @typedef {Object} ProxyHealthStatus
 * @property {'connected'|'connecting'|'disconnected'|'error'} status - 连接状态
 * @property {Date} lastCheck - 最后检查时间
 * @property {number} [latency] - 延迟（毫秒）
 * @property {string} [error] - 错误信息
 */
```

## 正确性属性

*正确性属性是系统在所有有效执行中都应保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性是人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: 代理端口格式验证

*For any* 代理端口配置，如果主机是 `127.0.0.1` 或 `localhost` 且端口在 1-65535 范围内，验证应返回有效；否则应返回无效并包含错误信息。

**Validates: Requirements 1.1, 1.2**

### Property 2: 预设端口自动填充

*For any* 代理客户端预设选择，选择后系统应自动填充对应的默认端口（Clash: 7890, V2rayN: 10808, Shadowsocks: 1080）。

**Validates: Requirements 1.3, 5.3**

### Property 3: 代理链路由规则生成

*For any* 本地代理配置和可选的链式代理配置，生成的代理规则应正确反映配置的路由路径：
- 仅本地代理：`http://127.0.0.1:端口`
- 本地代理+链式代理：代理链规则

**Validates: Requirements 1.4, 2.2, 2.3**

### Property 4: 多账号链式代理隔离

*For any* 两个不同的账号配置，如果它们配置了不同的链式代理，应用到各自 session 的代理规则应该不同。

**Validates: Requirements 2.4**

### Property 5: 翻译服务代理配置

*For any* 翻译服务代理模式配置（always/auto/never），翻译请求应按照配置的模式决定是否使用代理。

**Validates: Requirements 3.1, 3.4**

### Property 6: 错误来源诊断

*For any* 代理链连接失败，诊断函数应能正确区分是本地代理问题还是链式代理问题。

**Validates: Requirements 6.2**

### Property 7: 日志敏感数据脱敏

*For any* 包含密码或认证信息的代理配置，记录到日志时敏感数据应被脱敏（如 `****`）。

**Validates: Requirements 6.4**

## 错误处理

### 错误类型

1. **本地代理连接错误**
   - 代理客户端未启动
   - 端口被占用
   - 端口格式错误

2. **链式代理连接错误**
   - 链式代理服务器不可达
   - 认证失败
   - 超时

3. **翻译服务错误**
   - 翻译服务被封锁
   - 代理连接失败
   - 请求超时

### 错误消息映射

```javascript
const ERROR_MESSAGES = {
  LOCAL_PROXY_NOT_RUNNING: '请检查代理客户端是否已启动',
  LOCAL_PROXY_PORT_INVALID: '端口格式错误，请输入 1-65535 之间的数字',
  LOCAL_PROXY_CONNECTION_REFUSED: '无法连接到本地代理，请确认代理客户端正在运行',
  CHAINED_PROXY_UNREACHABLE: '链式代理服务器不可达，请检查配置',
  CHAINED_PROXY_AUTH_FAILED: '链式代理认证失败，请检查用户名和密码',
  TRANSLATION_SERVICE_BLOCKED: '翻译服务可能被封锁，建议启用代理',
  CONNECTION_TIMEOUT: '连接超时，请检查网络'
};
```

## 测试策略

### 单元测试

使用 Jest 对各个组件进行单元测试。

```javascript
describe('LocalProxyManager', () => {
  describe('validateLocalProxy', () => {
    test('应接受有效的本地代理配置', () => {
      const result = LocalProxyManager.validateLocalProxy('127.0.0.1', 7890);
      expect(result.valid).toBe(true);
    });

    test('应拒绝无效的端口号', () => {
      const result = LocalProxyManager.validateLocalProxy('127.0.0.1', 99999);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('端口范围必须在 1-65535 之间');
    });
  });

  describe('getPreset', () => {
    test('应返回正确的 Clash 预设', () => {
      const preset = LocalProxyManager.getPreset('clash');
      expect(preset.port).toBe(7890);
    });
  });
});
```

### 属性测试

使用 fast-check 进行属性测试，每个属性测试运行 100 次。

```javascript
const fc = require('fast-check');

describe('Property-Based Tests', () => {
  test('Property 1: 代理端口格式验证', () => {
    // **Feature: encrypted-tunnel-proxy, Property 1: 代理端口格式验证**
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 70000 }),
        (port) => {
          const result = LocalProxyManager.validateLocalProxy('127.0.0.1', port);
          const isValidPort = port >= 1 && port <= 65535;
          expect(result.valid).toBe(isValidPort);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: 预设端口自动填充', () => {
    // **Feature: encrypted-tunnel-proxy, Property 2: 预设端口自动填充**
    const presets = ['clash', 'v2rayn', 'shadowsocks'];
    const expectedPorts = { clash: 7890, v2rayn: 10808, shadowsocks: 1080 };
    
    fc.assert(
      fc.property(
        fc.constantFrom(...presets),
        (presetId) => {
          const preset = LocalProxyManager.getPreset(presetId);
          expect(preset.port).toBe(expectedPorts[presetId]);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3: 代理链路由规则生成', () => {
    // **Feature: encrypted-tunnel-proxy, Property 3: 代理链路由规则生成**
    fc.assert(
      fc.property(
        fc.record({
          host: fc.constant('127.0.0.1'),
          port: fc.integer({ min: 1, max: 65535 }),
          protocol: fc.constantFrom('http', 'https')
        }),
        fc.option(fc.record({
          host: fc.domain(),
          port: fc.integer({ min: 1, max: 65535 }),
          protocol: fc.constantFrom('http', 'https')
        })),
        (localProxy, chainedProxy) => {
          const rules = ProxyChainManager.buildProxyChainRules(localProxy, chainedProxy);
          
          // 规则应包含本地代理
          expect(rules).toContain(`${localProxy.protocol}://${localProxy.host}:${localProxy.port}`);
          
          // 如果有链式代理，规则应包含链式代理
          if (chainedProxy) {
            expect(rules).toContain(chainedProxy.host);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 7: 日志敏感数据脱敏', () => {
    // **Feature: encrypted-tunnel-proxy, Property 7: 日志敏感数据脱敏**
    fc.assert(
      fc.property(
        fc.record({
          host: fc.domain(),
          port: fc.integer({ min: 1, max: 65535 }),
          username: fc.string({ minLength: 1 }),
          password: fc.string({ minLength: 1 })
        }),
        (config) => {
          const sanitized = sanitizeForLogging(config);
          
          // 密码应被脱敏
          expect(sanitized.password).toBe('****');
          // 其他字段应保持不变
          expect(sanitized.host).toBe(config.host);
          expect(sanitized.port).toBe(config.port);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 集成测试

```javascript
describe('Integration Tests', () => {
  test('完整的代理配置流程', async () => {
    // 1. 选择预设
    const preset = LocalProxyManager.getPreset('clash');
    
    // 2. 验证配置
    const validation = LocalProxyManager.validateLocalProxy(preset.host, preset.port);
    expect(validation.valid).toBe(true);
    
    // 3. 测试连接（需要 mock）
    const connectionTest = await LocalProxyManager.testLocalProxy(preset);
    // 根据实际环境可能成功或失败
    
    // 4. 生成代理规则
    const rules = ProxyChainManager.buildProxyChainRules(preset, null);
    expect(rules).toBe('http://127.0.0.1:7890');
  });
});
```

## 实现说明

### 与现有代码的集成

1. **ProxyManager.js** - 扩展现有的 `applyProxyToSession` 方法，支持本地代理配置
2. **ViewFactory.js** - 修改代理应用逻辑，支持代理链
3. **ProxySettingsPanel** - 添加本地代理配置 UI
4. **TranslationService** - 添加代理支持

### 向后兼容性

- 现有的 HTTP/HTTPS 代理配置继续支持
- 新增的本地代理选项作为额外选择
- 配置迁移：旧配置自动识别为"直接代理"模式

### 性能考虑

1. **连接检查间隔**：60 秒，避免频繁检查
2. **超时设置**：连接测试超时 10 秒
3. **缓存**：预设配置在内存中缓存
