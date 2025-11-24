/**
 * 核心服务统一导出
 * 
 * 提供所有核心服务的统一导入接口
 * 避免使用复杂的相对路径引用
 */

// 引入核心服务
const ProxyDetectionService = require('../../services/ProxyDetectionService');

// 导出统一接口
module.exports = {
  // 核心服务类
  ProxyDetectionService,
  
  // 便捷创建方法
  createProxyDetectionService: () => new ProxyDetectionService(),
  
  // 服务实例（单例模式）
  getProxyDetectionService: (() => {
    let instance = null;
    return () => {
      if (!instance) {
        instance = new ProxyDetectionService();
      }
      return instance;
    };
  })()
};
