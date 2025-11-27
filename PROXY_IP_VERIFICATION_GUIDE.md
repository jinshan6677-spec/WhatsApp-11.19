# 代理IP验证和泄露检测指南

## 概述

本指南帮助你验证设置了代理的账号是否真的走代理IP，以及是否存在IP泄露问题。

## 🎯 验证目标

1. ✅ 确认账号使用的是代理IP而非真实IP
2. ✅ 检测WebRTC IP泄露
3. ✅ 验证IP保护脚本是否生效
4. ✅ 检测DNS泄露
5. ✅ 验证Kill-Switch机制

## 📋 验证方法

### 方法一：Node.js命令行工具（推荐用于代理测试）

#### 1. 安装依赖

```bash
npm install socks
```

#### 2. 配置代理信息

编辑 `test-proxy-ip-verification.js` 文件，修改代理配置：

```javascript
const proxyConfig = {
  protocol: 'socks5',
  host: '你的代理地址',    // 例如: '127.0.0.1'
  port: 你的代理端口,       // 例如: 1080
  username: '用户名',       // 如果需要认证
  password: '密码'          // 如果需要认证
};
```

#### 3. 运行测试

```bash
node test-proxy-ip-verification.js
```

#### 4. 查看结果

工具会输出：
- ✅ 真实IP（不走代理）
- ✅ 代理出口IP（走代理）
- ✅ IP对比结果
- ✅ WebRTC检测脚本
- ✅ IP保护验证脚本

**预期结果：**
- 真实IP ≠ 代理出口IP ✅ 代理工作正常
- 真实IP = 代理出口IP ❌ 可能存在IP泄露

---

### 方法二：浏览器内验证（推荐用于应用内检测）

#### 1. 打开应用并登录账号

确保账号已配置代理并成功连接。

#### 2. 打开开发者工具

- Windows/Linux: 按 `F12` 或 `Ctrl+Shift+I`
- macOS: 按 `Cmd+Option+I`

#### 3. 执行验证脚本

1. 打开 `browser-ip-check.js` 文件
2. 复制全部内容
3. 粘贴到浏览器控制台
4. 按 `Enter` 执行

#### 4. 查看验证报告

脚本会自动执行以下检测：

**[1/4] 检测当前出口IP**
- 通过多个IP检测服务获取当前出口IP
- 显示IP地址和地理位置

**[2/4] 检测WebRTC IP泄露**
- 检查WebRTC APIs是否被禁用
- 如果可用，尝试通过WebRTC获取本地IP
- 报告是否检测到泄露的IP

**[3/4] 验证IP保护脚本**
- 检查关键APIs是否被禁用：
  - RTCPeerConnection ✅ 应该被禁用
  - RTCDataChannel ✅ 应该被禁用
  - RTCSessionDescription ✅ 应该被禁用
  - getUserMedia ✅ 应该被禁用

**[4/4] DNS泄露检测提示**
- 提供外部DNS泄露检测服务链接

#### 5. 解读安全评分

```
评分: 100/100 ✅ 完美 - 无安全问题
评分: 80-99  ⚠️ 良好 - 有轻微问题
评分: 60-79  ⚠️ 一般 - 有明显问题
评分: <60    ❌ 危险 - 存在严重泄露
```

---

## 🔍 详细检测项目

### 1. 出口IP检测

**目的：** 验证网络请求是否通过代理

**检测方法：**
- 访问多个IP检测服务（ipinfo.io, ipify.org, ip-api.com）
- 获取当前出口IP地址

**预期结果：**
- 出口IP应该是代理服务器的IP
- 出口IP不应该是你的真实IP

**如果失败：**
- ❌ 代理未正确配置
- ❌ 代理服务器未运行
- ❌ 存在回退到直连的问题

---

### 2. WebRTC泄露检测

**目的：** 检测WebRTC是否泄露真实IP

**检测方法：**
- 检查WebRTC APIs是否被禁用
- 如果可用，创建RTCPeerConnection并收集ICE候选
- 分析候选中的IP地址

**预期结果：**
- ✅ 最佳：WebRTC APIs完全被禁用
- ✅ 良好：WebRTC可用但未检测到泄露
- ❌ 危险：检测到泄露的真实IP

**如果检测到泄露：**
1. 检查IP保护脚本是否正确注入
2. 确认 `ViewProxyIntegration.injectIPProtection()` 被调用
3. 重新加载页面并再次测试

---

### 3. IP保护脚本验证

**目的：** 确认IP保护脚本已生效

**检测项目：**

| API | 状态 | 重要性 |
|-----|------|--------|
| RTCPeerConnection | 应禁用 | 🔴 关键 |
| RTCDataChannel | 应禁用 | 🔴 关键 |
| RTCSessionDescription | 应禁用 | 🔴 关键 |
| getUserMedia | 应禁用 | 🔴 关键 |
| navigator.connection | 应禁用 | 🟡 可选 |
| navigator.getBattery | 应禁用 | 🟡 可选 |

**预期结果：**
- 所有关键APIs（🔴）必须被禁用
- 可选APIs（🟡）建议禁用但不强制

**如果未禁用：**
1. 检查 `IPProtectionInjector` 是否正常工作
2. 确认脚本在页面加载前注入
3. 查看控制台是否有注入错误

---

### 4. DNS泄露检测

**目的：** 检测DNS请求是否通过代理

**检测方法：**
访问以下外部服务进行检测：
- https://dnsleaktest.com
- https://ipleak.net
- https://browserleaks.com/dns

**预期结果：**
- DNS服务器应该是代理服务器的DNS
- 不应该显示你的ISP的DNS服务器

**如果检测到泄露：**
- 检查代理配置中的DNS设置
- 确认 `DNSLeakPrevention` 模块已启用
- 验证 `proxyDNS` 配置正确

---

## 🛡️ 安全最佳实践

### 1. 连接前验证

在创建BrowserView之前：
```javascript
// ✅ 正确：先验证代理
const result = await viewProxyIntegration.secureConfigureProxy(
  accountId, 
  session, 
  proxyConfig
);

if (!result.success) {
  // ❌ 不创建视图
  showError(result.error);
  return;
}

// ✅ 验证通过，创建视图
createBrowserView();
```

### 2. 注入IP保护

在加载任何内容之前：
```javascript
// ✅ 在页面加载前注入
await viewProxyIntegration.injectIPProtection(webContents);

// 然后加载URL
webContents.loadURL('https://web.whatsapp.com');
```

### 3. 监控连接状态

```javascript
// 订阅健康检查事件
eventBus.subscribe('proxy:health-check-failed', (event) => {
  console.warn(`代理健康检查失败: ${event.accountId}`);
});

// 订阅Kill-Switch事件
eventBus.subscribe('proxy:kill-switch-activated', (event) => {
  console.error(`Kill-Switch已激活: ${event.accountId}`);
  // 显示重连UI
});
```

### 4. 定期验证

建议每次打开账号时都进行快速验证：
```javascript
// 在开发者工具中执行
console.log('当前IP:', await fetch('https://api.ipify.org?format=json').then(r => r.json()));
```

---

## 🚨 常见问题排查

### 问题1: 出口IP与真实IP相同

**可能原因：**
- 代理未正确配置
- 代理服务器未运行
- 存在回退到直连的代码（应该已删除）

**解决方法：**
1. 检查代理配置是否正确
2. 测试代理连通性：`node test-proxy-ip-verification.js`
3. 检查 `ViewProxyIntegration` 中是否有回退逻辑
4. 查看日志中的代理配置信息

---

### 问题2: WebRTC APIs未被禁用

**可能原因：**
- IP保护脚本未注入
- 脚本注入时机错误（页面已加载）
- 脚本被CSP阻止

**解决方法：**
1. 确认 `injectIPProtection()` 被调用
2. 检查注入时机（应在 `did-start-loading` 之前）
3. 查看控制台是否有CSP错误
4. 重新加载页面并再次测试

---

### 问题3: 检测到WebRTC泄露

**可能原因：**
- IP保护脚本未生效
- WebRTC APIs未被完全禁用
- 存在其他泄露途径

**解决方法：**
1. 执行浏览器验证脚本检查API状态
2. 访问 https://browserleaks.com/webrtc 进行详细检测
3. 确认所有WebRTC相关APIs都被禁用
4. 检查是否有其他扩展或脚本启用了WebRTC

---

### 问题4: DNS泄露

**可能原因：**
- DNS请求未通过代理
- 浏览器使用了DoH（DNS over HTTPS）
- 系统DNS设置问题

**解决方法：**
1. 检查代理配置中的DNS设置
2. 确认 `DNSLeakPrevention` 模块已启用
3. 禁用浏览器的DoH功能
4. 使用代理服务器的DNS

---

## 📊 验证清单

使用此清单确保所有安全措施都已到位：

### 配置阶段
- [ ] 代理配置已验证（host, port, protocol）
- [ ] 代理认证信息正确（如需要）
- [ ] 代理连通性测试通过
- [ ] 出口IP验证通过（与真实IP不同）

### 连接阶段
- [ ] 预检测通过（testConnectivity）
- [ ] IP验证通过（getExitIP）
- [ ] Session代理配置成功
- [ ] Kill-Switch已启用
- [ ] 健康监控已启动

### 保护阶段
- [ ] IP保护脚本已注入
- [ ] WebRTC APIs已禁用
- [ ] Media APIs已禁用
- [ ] Network APIs已禁用（可选）
- [ ] 请求拦截器已设置

### 运行阶段
- [ ] 出口IP持续正确
- [ ] 无WebRTC泄露
- [ ] 无DNS泄露
- [ ] 健康检查正常
- [ ] Kill-Switch未触发

### 故障处理
- [ ] 连接失败时不回退直连
- [ ] Kill-Switch正确触发
- [ ] 重连机制正常工作
- [ ] 重连UI正确显示
- [ ] 用户可以手动干预

---

## 🔗 相关资源

### 在线检测工具
- **IP检测**: https://ipinfo.io, https://api.ipify.org
- **WebRTC泄露**: https://browserleaks.com/webrtc
- **DNS泄露**: https://dnsleaktest.com, https://ipleak.net
- **综合检测**: https://browserleaks.com, https://ipleak.net

### 代码文件
- `src/application/services/ProxyService.js` - 代理服务
- `src/infrastructure/proxy/ProxySecurityManager.js` - 安全管理
- `src/infrastructure/proxy/IPProtectionInjector.js` - IP保护注入
- `src/infrastructure/proxy/KillSwitch.js` - Kill-Switch机制
- `src/presentation/windows/view-manager/ViewProxyIntegration.js` - 视图集成

### 测试文件
- `test-proxy-ip-verification.js` - Node.js验证工具
- `browser-ip-check.js` - 浏览器验证脚本

---

## 💡 提示

1. **定期验证**: 建议每次打开账号时都快速验证一次出口IP
2. **多源验证**: 使用多个IP检测服务交叉验证
3. **完整检测**: 定期访问 browserleaks.com 进行全面检测
4. **日志监控**: 关注控制台日志中的代理相关信息
5. **事件监听**: 订阅代理事件以实时了解连接状态

---

## 📝 报告问题

如果发现IP泄露或其他安全问题，请提供以下信息：

1. 浏览器验证脚本的完整输出
2. 控制台日志（特别是代理相关的）
3. 代理配置信息（隐藏敏感信息）
4. 外部检测工具的截图
5. 复现步骤

---

**最后更新**: 2024-01-XX
**版本**: 1.0.0
