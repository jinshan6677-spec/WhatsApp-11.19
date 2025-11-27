/**
 * 核心服务统一导出
 * 
 * 提供所有核心服务的统一导入接口
 * 避免使用复杂的相对路径引用
 * 
 * 注意：ProxyDetectionService已被ProxyPreChecker替代
 */

// 引入新架构代理服务
const ProxyPreChecker = require('../../infrastructure/proxy/ProxyPreChecker');
const IPLeakDetector = require('../../infrastructure/proxy/IPLeakDetector');

// 导出统一接口
module.exports = {
  // 新架构代理服务类
  ProxyPreChecker,
  IPLeakDetector,
  
  // 便捷创建方法
  createProxyPreChecker: (options) => new ProxyPreChecker(options),
  createIPLeakDetector: (options) => new IPLeakDetector(options),
  
  // 服务实例（单例模式）
  getProxyPreChecker: (() => {
    let instance = null;
    return (options) => {
      if (!instance) {
        instance = new ProxyPreChecker(options);
      }
      return instance;
    };
  })(),
  
  getIPLeakDetector: (() => {
    let instance = null;
    return (options) => {
      if (!instance) {
        instance = new IPLeakDetector(options);
      }
      return instance;
    };
  })(),
  
  // 向后兼容别名（已废弃，请使用ProxyPreChecker）
  // @deprecated Use ProxyPreChecker instead
  ProxyDetectionService: ProxyPreChecker,
  createProxyDetectionService: (options) => new ProxyPreChecker(options),
  getProxyDetectionService: (() => {
    let instance = null;
    return (options) => {
      if (!instance) {
        instance = new ProxyPreChecker(options);
      }
      return instance;
    };
  })()
};
