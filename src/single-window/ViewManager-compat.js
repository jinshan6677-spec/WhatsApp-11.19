/**
 * ViewManager - Compatibility Layer
 * 
 * This file serves as a compatibility layer that re-exports the new modular ViewManager
 * from src/presentation/windows/view-manager/
 * 
 * The original ViewManager.js (4096 lines) has been refactored into smaller modules:
 * - ViewFactory: 视图创建
 * - ViewLifecycle: 生命周期管理
 * - ViewBoundsManager: 边界计算
 * - ViewResizeHandler: 窗口大小调整
 * - ViewMemoryManager: 内存管理
 * - ViewPerformanceOptimizer: 性能优化
 * - ViewProxyIntegration: 代理集成
 * - ViewTranslationIntegration: 翻译集成
 * - ViewManager: 主协调器
 * 
 * This compatibility layer ensures backward compatibility with existing code
 * that imports from 'src/single-window/ViewManager.js'
 * 
 * @module single-window/ViewManager
 */

// Re-export the new modular ViewManager
const ViewManager = require('../presentation/windows/view-manager/ViewManager');

// Also export sub-modules for advanced usage
const {
  ViewFactory,
  ViewLifecycle,
  ViewBoundsManager,
  ViewResizeHandler,
  ViewMemoryManager,
  ViewPerformanceOptimizer,
  ViewProxyIntegration,
  ViewTranslationIntegration
} = require('../presentation/windows/view-manager');

module.exports = ViewManager;

// Named exports for ES module compatibility
module.exports.ViewManager = ViewManager;
module.exports.ViewFactory = ViewFactory;
module.exports.ViewLifecycle = ViewLifecycle;
module.exports.ViewBoundsManager = ViewBoundsManager;
module.exports.ViewResizeHandler = ViewResizeHandler;
module.exports.ViewMemoryManager = ViewMemoryManager;
module.exports.ViewPerformanceOptimizer = ViewPerformanceOptimizer;
module.exports.ViewProxyIntegration = ViewProxyIntegration;
module.exports.ViewTranslationIntegration = ViewTranslationIntegration;
