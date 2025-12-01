/**
 * 翻译服务
 * 在主进程中初始化和管理翻译系统
 */

const {
  TranslationManager,
  ConfigManager,
  CacheManager,
  GoogleTranslateAdapter,
  AITranslationAdapter,
  CustomAPIAdapter
} = require('./index');
const StatsManager = require('./managers/StatsManager');
const { EnvironmentConfigManager, ProxyConfigStore } = require('../environment');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

class TranslationService {
  constructor() {
    this.configManager = null;
    this.cacheManager = null;
    this.statsManager = null;
    this.translationManager = null;
    this.initialized = false;
    this.environmentManager = null;
    this.proxyConfigStore = null;
  }

  /**
   * 初始化翻译服务
   */
  async initialize() {
    if (this.initialized) {
      console.log('[TranslationService] Already initialized');
      return;
    }

    try {
      console.log('[TranslationService] Initializing...');

      // 初始化管理器
      this.configManager = new ConfigManager();
      this.cacheManager = new CacheManager({
        maxSize: 1000,
        ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      this.statsManager = new StatsManager();
      this.translationManager = new TranslationManager(
        this.configManager,
        this.cacheManager
      );

      this.environmentManager = new EnvironmentConfigManager();
      this.proxyConfigStore = new ProxyConfigStore();

      // 注册翻译引擎
      this.registerEngines();

      // 监听翻译事件
      this.setupEventListeners();

      // 定期清理缓存
      this.startCleanupSchedule();

      this.initialized = true;
      console.log('[TranslationService] Initialized successfully');
      console.log('[TranslationService] Registered engines:', Array.from(this.translationManager.engines.keys()));

    } catch (error) {
      console.error('[TranslationService] Initialization failed:', error);
      console.error('[TranslationService] Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * 注册翻译引擎
   */
  registerEngines() {
    // 注册 Google 翻译
    const googleAdapter = new GoogleTranslateAdapter({
      enabled: true
    });
    this.translationManager.registerEngine('google', googleAdapter);
    console.log('[TranslationService] Registered Google Translate');

    // 注册 AI 翻译引擎
    const engineConfigs = this.configManager.getAllEngineConfigs();
    console.log('[TranslationService] Engine configs:', JSON.stringify(Object.keys(engineConfigs)));

    // GPT-4
    if (engineConfigs.gpt4 && engineConfigs.gpt4.enabled) {
      const gpt4Adapter = new AITranslationAdapter({
        name: 'GPT-4',
        type: 'openai',
        apiKey: engineConfigs.gpt4.apiKey,
        endpoint: engineConfigs.gpt4.endpoint || 'https://api.openai.com/v1/chat/completions',
        model: engineConfigs.gpt4.model || 'gpt-4',
        enabled: true
      });
      this.translationManager.registerEngine('gpt4', gpt4Adapter);
      console.log('[TranslationService] Registered GPT-4');
    }

    // Gemini
    if (engineConfigs.gemini && engineConfigs.gemini.enabled) {
      const geminiAdapter = new AITranslationAdapter({
        name: 'Gemini',
        type: 'gemini',
        apiKey: engineConfigs.gemini.apiKey,
        endpoint: engineConfigs.gemini.endpoint || 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
        model: engineConfigs.gemini.model || 'gemini-pro',
        enabled: true
      });
      this.translationManager.registerEngine('gemini', geminiAdapter);
      console.log('[TranslationService] Registered Gemini');
    }

    // DeepSeek
    if (engineConfigs.deepseek && engineConfigs.deepseek.enabled) {
      const deepseekAdapter = new AITranslationAdapter({
        name: 'DeepSeek',
        type: 'deepseek',
        apiKey: engineConfigs.deepseek.apiKey,
        endpoint: engineConfigs.deepseek.endpoint || 'https://api.deepseek.com/v1/chat/completions',
        model: engineConfigs.deepseek.model || 'deepseek-chat',
        enabled: true
      });
      this.translationManager.registerEngine('deepseek', deepseekAdapter);
      console.log('[TranslationService] Registered DeepSeek');
    }

    // 自定义 API
    if (engineConfigs.custom && engineConfigs.custom.enabled) {
      const customAdapter = new CustomAPIAdapter({
        name: engineConfigs.custom.name || 'Custom API',
        type: 'custom',
        apiKey: engineConfigs.custom.apiKey,
        endpoint: engineConfigs.custom.endpoint,
        model: engineConfigs.custom.model,
        enabled: true
      });
      this.translationManager.registerEngine('custom', customAdapter);
      console.log('[TranslationService] Registered Custom API');
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听翻译成功事件
    this.translationManager.on('translation-success', (data) => {
      this.statsManager.recordTranslation(
        data.engineName,
        true,
        data.charCount,
        data.responseTime
      );
    });

    // 监听翻译失败事件
    this.translationManager.on('translation-error', (data) => {
      this.statsManager.recordTranslation(
        data.engineName,
        false,
        data.text.length,
        0
      );
    });

    // 监听缓存命中事件
    this.translationManager.on('cache-hit', (data) => {
      console.log(`[TranslationService] Cache hit for engine: ${data.engineName}`);
    });
  }

  /**
   * 启动定期清理任务
   */
  startCleanupSchedule() {
    // 每天清理一次过期缓存
    setInterval(() => {
      console.log('[TranslationService] Running scheduled cleanup...');
      this.cacheManager.cleanup();
      this.statsManager.cleanup();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * 翻译文本
   * @param {string} text - 待翻译文本
   * @param {string} sourceLang - 源语言
   * @param {string} targetLang - 目标语言
   * @param {string} engineName - 引擎名称
   * @param {Object} options - 翻译选项
   * @returns {Promise<Object>} 翻译结果
   */
  async translate(text, sourceLang, targetLang, engineName, options = {}) {
    // 如果未初始化，尝试初始化
    if (!this.initialized) {
      console.warn('[TranslationService] Not initialized, attempting to initialize...');
      try {
        await this.initialize();
      } catch (error) {
        console.error('[TranslationService] Failed to initialize:', error);
        throw new Error('Translation service not initialized: ' + error.message);
      }
    }

    if (!this.translationManager) {
      throw new Error('Translation manager not available');
    }

    const accountId = options.accountId || null;
    const agent = this._getProxyAgentForAccount(accountId);
    const mergedOptions = agent ? { ...options, agent } : { ...options };

    return await this.translationManager.translate(
      text,
      sourceLang,
      targetLang,
      engineName,
      mergedOptions
    );
  }

  /**
   * 检测语言
   * @param {string} text - 待检测文本
   * @returns {Promise<string>} 语言代码
   */
  async detectLanguage(text) {
    if (!this.initialized) {
      throw new Error('Translation service not initialized');
    }

    return await this.translationManager.detectLanguage(text);
  }

  /**
   * 获取配置
   * @param {string} accountId - 账号ID
   * @returns {Object} 配置对象
   */
  getConfig(accountId) {
    return this.configManager.getConfig(accountId);
  }

  /**
   * 保存配置
   * @param {string} accountId - 账号ID
   * @param {Object} config - 配置对象
   */
  saveConfig(accountId, config) {
    this.configManager.saveConfig(accountId, config);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return {
      translation: this.translationManager.getStats(),
      today: this.statsManager.getTodayStats(),
      total: this.statsManager.getTotalStats()
    };
  }

  /**
   * 清理资源
   */
  async cleanup() {
    if (this.cacheManager) {
      await this.cacheManager.cleanup();
      this.cacheManager.close();
    }

    if (this.translationManager) {
      await this.translationManager.cleanup();
    }

    this.initialized = false;
    console.log('[TranslationService] Cleaned up');
  }

  /**
   * 清除翻译历史（隐私保护）
   */
  async clearTranslationHistory() {
    if (!this.initialized) {
      throw new Error('Translation service not initialized');
    }

    return await this.translationManager.clearTranslationHistory();
  }

  /**
   * 清除所有用户数据（隐私保护）
   */
  async clearAllUserData() {
    if (!this.initialized) {
      throw new Error('Translation service not initialized');
    }

    return await this.translationManager.clearAllUserData();
  }

  /**
   * 清除所有数据包括 API 密钥（完全隐私保护）
   */
  async clearAllData() {
    if (!this.initialized) {
      throw new Error('Translation service not initialized');
    }

    return await this.translationManager.clearAllData();
  }

  /**
   * 获取隐私数据报告
   */
  getPrivacyReport() {
    if (!this.initialized) {
      throw new Error('Translation service not initialized');
    }

    return this.translationManager.getPrivacyReport();
  }

  _getProxyAgentForAccount(accountId) {
    try {
      if (!accountId || !this.environmentManager) {
        return null;
      }

      const envConfig = this.environmentManager.getConfig(accountId);
      const proxy = envConfig && envConfig.proxy ? envConfig.proxy : null;
      if (!proxy || !proxy.enabled) {
        return null;
      }

      let effective = { ...proxy };
      if (proxy.configName && this.proxyConfigStore) {
        const named = this.proxyConfigStore.getProxyConfig(proxy.configName);
        if (named) {
          effective = { ...named, ...effective };
        }
      }

      const protocol = (effective.protocol || 'http').toLowerCase();
      const host = (effective.host || '').trim();
      const port = String(effective.port || '').trim();
      if (!host || !port) {
        return null;
      }

      const hasCreds = effective.username && effective.password;
      const creds = hasCreds
        ? `${encodeURIComponent(effective.username)}:${encodeURIComponent(effective.password)}@`
        : '';

      const url = `${protocol}://${creds}${host}:${port}`;

      if (protocol === 'socks5') {
        return new SocksProxyAgent(url);
      }

      return new HttpsProxyAgent(url);
    } catch (_) {
      return null;
    }
  }
}

// 导出单例
const translationService = new TranslationService();
module.exports = translationService;
