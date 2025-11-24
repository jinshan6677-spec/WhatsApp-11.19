/**
 * 模块别名配置
 * 
 * 提供统一的模块导入路径别名
 * 避免复杂的相对路径引用，提高代码可读性和维护性
 */

/**
 * 获取模块别名映射
 * @returns {Object} 别名映射对象
 */
function getModuleAliases() {
  return {
    // 核心模块别名
    '@app': './app',
    '@core': './core',
    '@ui': './ui',
    '@shared': './shared',
    '@features': './features',
    '@plugins': './plugins',
    
    // 核心子模块别名
    '@managers': './core/managers',
    '@models': './core/models',
    '@services': './core/services',
    
    // UI模块别名
    '@main-window': './ui/main-window',
    '@sidebar': './ui/sidebar',
    '@modals': './ui/modals',
    
    // 功能模块别名
    '@translation': './features/translation',
    '@proxy': './features/proxy',
    '@account': './features/account',
    
    // 共享模块别名
    '@utils': './shared/utils',
    '@validators': './shared/validators',
    '@decorators': './shared/decorators',
    '@constants': './shared/constants',
    
    // 插件模块别名
    '@translation-engines': './plugins/translation-engines',
    '@ui-extensions': './plugins/ui-extensions',
    
    // 常量别名
    '@app-constants': './app/constants'
  };
}

/**
 * 创建模块解析器
 * @param {string} baseDir - 基础目录
 * @returns {Function} 模块解析函数
 */
function createModuleResolver(baseDir) {
  const aliases = getModuleAliases();
  
  return function resolveModule(moduleName) {
    // 检查是否是别名
    if (aliases[moduleName]) {
      return `${baseDir}/${aliases[moduleName]}`;
    }
    
    // 直接返回原始模块名
    return moduleName;
  };
}

/**
 * 获取所有模块的导出映射
 * @returns {Object} 模块导出映射
 */
function getModuleExports() {
  return {
    // 应用核心
    app: {
      bootstrap: () => require('./app/bootstrap'),
      constants: () => require('./app/constants'),
      index: () => require('./app')
    },
    
    // 核心模块
    core: {
      managers: () => require('./core/managers'),
      models: () => require('./core/models'),
      services: () => require('./core/services'),
      index: () => require('./core')
    },
    
    // UI模块
    ui: {
      'main-window': () => require('./ui/main-window'),
      sidebar: () => require('./ui/sidebar'),
      modals: () => require('./ui/modals'),
      index: () => require('./ui')
    },
    
    // 共享模块
    shared: {
      utils: () => require('./shared/utils'),
      validators: () => require('./shared/validators'),
      decorators: () => require('./shared/decorators'),
      constants: () => require('./shared/constants'),
      index: () => require('./shared')
    },
    
    // 功能模块
    features: {
      translation: () => require('./features/translation'),
      proxy: () => require('./features/proxy'),
      account: () => require('./features/account'),
      index: () => require('./features')
    }
  };
}

module.exports = {
  getModuleAliases,
  createModuleResolver,
  getModuleExports
};
