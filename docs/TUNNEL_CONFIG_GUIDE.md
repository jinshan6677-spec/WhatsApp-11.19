# 隧道配置指南

## 问题诊断

如果您遇到 `ERR_CONNECTION_RESET` 错误，请按照以下步骤检查：

## 1. 检查V2RayN配置

### 确认V2RayN正在运行
- 确保V2RayN已启动
- 确保至少有一个VLESS节点被激活（显示红色"活动"标签）
- 确认延迟测试正常（绿色显示，如214ms）

### 确认本地监听端口
在V2RayN底部状态栏查看：
- **本地**: `[mixed:10808]` 或 `[socks:1080]`
  - `mixed:10808` - 同时支持HTTP和SOCKS5
  - `socks:1080` - 只支持SOCKS5
  - `http:10809` - 只支持HTTP

## 2. 在应用中配置隧道

### 方案A：使用V2RayN的mixed端口（推荐）

如果V2RayN显示 `[mixed:10808]`：

```
加密隧道设置:
✓ 启用: 开启
  类型: HTTP (不是SOCKS5!)
  地址: 127.0.0.1
  端口: 10808
```

**重要**: 使用 `mixed:10808` 时，应该选择 **HTTP** 类型，不是SOCKS5！

### 方案B：使用V2RayN的SOCKS5端口

如果V2RayN显示 `[socks:1080]`：

```
加密隧道设置:
✓ 启用: 开启
  类型: SOCKS5
  地址: 127.0.0.1
  端口: 1080
```

### 方案C：配置V2RayN的SOCKS5端口

如果V2RayN只显示mixed端口，但您想使用SOCKS5：

1. 打开V2RayN设置
2. 找到"Core: 基础设置"
3. 添加SOCKS5监听：
   ```
   socks: 127.0.0.1:1080
   ```
4. 重启V2RayN
5. 然后在应用中使用SOCKS5配置

## 3. 验证配置

### 步骤1: 测试V2RayN连接
在命令行中测试：
```bash
curl -x socks5://127.0.0.1:1080 https://www.google.com
```
或
```bash
curl -x http://127.0.0.1:10808 https://www.google.com
```

如果成功，说明V2RayN工作正常。

### 步骤2: 在应用中测试
1. 打开应用的环境设置
2. 配置隧道参数
3. 点击"测试隧道连接"按钮
4. 查看测试结果

### 步骤3: 启动账号
1. 保存配置
2. 点击"打开账号"按钮
3. 观察是否还有 `ERR_CONNECTION_RESET` 错误

## 4. 常见问题

### Q: 为什么选择HTTP而不是SOCKS5？
A: V2RayN的 `mixed:10808` 端口同时支持HTTP和SOCKS5，但在Electron中，HTTP代理更稳定。如果使用SOCKS5，可能会遇到连接重置问题。

### Q: 如何查看V2RayN的日志？
A: 在V2RayN底部有一个日志区域，可以看到连接日志。日志格式：
```
from 127.0.0.1:xxxxx accepted //domain:443 [socks -> proxy]
```

### Q: ERR_CONNECTION_RESET 还在出现？
A: 请检查：
1. V2RayN是否真的在运行
2. V2RayN的节点是否激活
3. 端口号是否正确
4. 是否有防火墙阻止连接

### Q: 可以同时使用隧道和HTTP代理吗？
A: 可以，但需要在海外网关配置代理链。如果只是想突破防火墙，只需要配置隧道即可。

## 5. 推荐配置

### 最简单的配置（推荐）
```
V2RayN设置:
- 使用默认的 mixed:10808 端口

应用设置:
- 加密隧道: 启用
- 类型: HTTP
- 地址: 127.0.0.1
- 端口: 10808
- HTTP/HTTPS代理: 禁用
```

### 高级配置（多账号独立IP）
```
V2RayN设置:
- 使用默认的 mixed:10808 端口

应用设置:
- 加密隧道: 启用
- 类型: HTTP
- 地址: 127.0.0.1
- 端口: 10808
- HTTP/HTTPS代理: 启用（每个账号配置不同的代理IP）

海外网关:
- 配置代理链，根据请求路由到不同的HTTP代理
```

## 6. 调试技巧

### 启用详细日志
在应用启动时添加 `DEBUG` 环境变量：
```bash
DEBUG=* npm start
```

### 检查网络请求
打开Chrome开发者工具（F12），查看Network标签页：
- 查看失败的请求
- 检查请求头中是否有代理信息
- 查看错误详情

### 查看Electron日志
在应用日志文件中查看：
```
./logs/app.log
./logs/error.log
```

## 7. 技术说明

### Electron对SOCKS5的支持
Electron对SOCKS5的支持有限，特别是：
- SOCKS5认证可能不稳定
- 某些SOCKS5特性不被支持
- HTTP代理通常更稳定

### V2RayN的mixed端口
V2RayN的 `mixed` 端口实际上是一个HTTP+SOCKS5混合代理：
- 可以同时处理HTTP和SOCKS5请求
- 自动识别请求类型
- 在Electron中建议使用HTTP模式

### 连接重置的原因
`ERR_CONNECTION_RESET` 通常表示：
- 代理服务器拒绝连接
- 代理服务器配置错误
- 防火墙拦截
- 网络问题

## 8. 联系支持

如果以上方法都无法解决问题，请提供：
1. V2RayN的配置截图
2. 应用的隧道配置
3. 错误日志
4. V2RayN的连接日志