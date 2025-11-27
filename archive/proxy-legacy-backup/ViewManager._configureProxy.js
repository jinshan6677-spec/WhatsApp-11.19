/**
 * ViewManager._configureProxy 方法备份 (LEGACY BACKUP)
 * 
 * 备份日期: 2025-11-27
 * 原位置: src/single-window/ViewManager.js
 * 
 * 这是旧的代理配置方法，存在以下安全问题：
 * 1. 代理失败时会回退到直连（严重安全漏洞）
 * 2. 没有注入IP保护脚本（WebRTC泄露）
 * 3. 没有预检测代理连通性
 * 4. 没有验证出口IP
 */

/**
 * Configure proxy for account session
 * @private
 * @param {string} accountId - Account ID
 * @param {Electron.Session} accountSession - Account session
 * @param {Object} proxyConfig - Proxy configuration
 */
async _configureProxy(accountId, accountSession, proxyConfig) {
  const startTime = Date.now();
  
  try {
    const { protocol, host, port, username, password, bypass } = proxyConfig;

    // 验证必需参数
    if (!host || !port) {
      throw new Error('代理主机和端口是必需的');
    }

    // 验证协议
    const validProtocols = ['http', 'https', 'socks5', 'socks4'];
    if (!validProtocols.includes(protocol)) {
      throw new Error(`不支持的代理协议: ${protocol}。支持的协议: ${validProtocols.join(', ')}`);
    }

    // 验证端口范围
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error(`无效的端口号: ${port}。端口必须在 1-65535 之间`);
    }

    // Build proxy rules
    let proxyRules;
    
    if (protocol === 'socks5' || protocol === 'socks4') {
      // SOCKS 代理
      if (username && password) {
        // SOCKS with authentication
        proxyRules = `${protocol}://${username}:${password}@${host}:${port}`;
      } else {
        // SOCKS without authentication
        proxyRules = `${protocol}://${host}:${port}`;
      }
    } else {
      // HTTP/HTTPS 代理
      proxyRules = `${protocol}://${host}:${port}`;
    }
    
    this.log('info', `[代理配置] 账户 ${accountId}:`);
    this.log('info', `  协议: ${protocol}`);
    this.log('info', `  主机: ${host}`);
    this.log('info', `  端口: ${port}`);
    this.log('info', `  规则: ${proxyRules.replace(/:([^:@]+)@/, ':***@')}`);
    this.log('info', `  认证: ${!!(username && password) ? '是' : '否'}`);
    
    // 设置代理配置（这个操作应该很快完成）
    const proxyConfig = {
      proxyRules,
      proxyBypassRules: bypass || 'localhost,127.0.0.1,<local>'
    };
    
    await accountSession.setProxy(proxyConfig);
    
    const configTime = Date.now() - startTime;
    this.log('info', `[代理配置] 配置完成，耗时 ${configTime}ms`);

    // Handle proxy authentication ONLY for HTTP/HTTPS proxies
    // SOCKS authentication is handled in the proxy URL
    if ((protocol === 'http' || protocol === 'https') && username && password) {
      this.log('info', `[代理配置] 设置 HTTP 代理认证`);
      
      // 移除之前的监听器（如果存在）
      accountSession.webRequest.onBeforeSendHeaders(null);
      
      accountSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const authHeader = Buffer.from(`${username}:${password}`).toString('base64');
        details.requestHeaders['Proxy-Authorization'] = `Basic ${authHeader}`;
        callback({ requestHeaders: details.requestHeaders });
      });
    }

    this.log('info', `✓ [代理配置] 账户 ${accountId} 配置成功`);
    
    return {
      success: true,
      configTime
    };
  } catch (error) {
    const configTime = Date.now() - startTime;
    this.log('error', `✗ [代理配置] 账户 ${accountId} 配置失败 (${configTime}ms): ${error.message}`);
    
    // 提供更详细的错误信息
    const enhancedError = new Error(`代理配置失败: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.accountId = accountId;
    enhancedError.configTime = configTime;
    
    throw enhancedError;
  }
}

/**
 * 回退直连代码（安全漏洞）- 位于 createView() 方法中
 * 
 * 问题代码1：
 * ```javascript
 * // 代理配置失败不应该阻止视图创建
 * this.log('error', `代理配置失败，将使用直连: ${proxyError.message}`);
 * 
 * // 清除代理配置，使用直连
 * try {
 *   await accountSession.setProxy({ proxyRules: '' });
 *   this.log('info', `已清除代理配置，账户 ${accountId} 将使用直连`);
 * } catch (clearError) {
 *   this.log('warn', `清除代理配置失败: ${clearError.message}`);
 * }
 * 
 * // 通知渲染进程代理失败
 * this._notifyRenderer('proxy-config-failed', {
 *   accountId,
 *   error: proxyError.message,
 *   fallbackToDirect: true  // <-- 这是安全漏洞
 * });
 * ```
 * 
 * 问题代码2（位于 _setupViewEventHandlers 中）：
 * ```javascript
 * // 如果是代理错误，尝试禁用代理并重试
 * if (viewState.config && viewState.config.proxy && viewState.config.proxy.enabled) {
 *   this.log('warn', `[代理错误] 尝试禁用代理并重新加载...`);
 *   
 *   try {
 *     // 清除代理配置
 *     await viewState.session.setProxy({ proxyRules: '' });
 *     
 *     // 标记代理已禁用
 *     viewState.config.proxy.enabled = false;
 *     viewState.proxyDisabledDueToError = true;  // <-- 这是安全漏洞
 *     
 *     // 通知渲染进程
 *     this._notifyRenderer('proxy-disabled-due-to-error', {
 *       accountId,
 *       errorCode,
 *       errorMessage: isProxyError,
 *       willRetry: true
 *     });
 *     
 *     // 重新加载页面
 *     setTimeout(() => {
 *       if (!view.webContents.isDestroyed()) {
 *         view.webContents.loadURL('https://web.whatsapp.com');
 *       }
 *     }, 1000);
 *     
 *     return; // 不继续处理错误，等待重新加载
 *   } catch (retryError) {
 *     this.log('error', `[代理错误] 禁用代理失败: ${retryError.message}`);
 *   }
 * }
 * ```
 */
