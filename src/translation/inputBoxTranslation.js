/**
 * 输入框翻译功能
 * 为 WhatsApp Web 输入框添加翻译功能
 */

const InputBoxTranslation = {
  translateButton: null,
  inputBox: null,
  realtimePreview: null,
  realtimeTimeout: null,

  /**
   * 初始化输入框翻译
   */
  init(config) {
    this.config = config;
    
    // 查找输入框
    this.findInputBox();
    
    if (this.inputBox) {
      // 添加翻译按钮
      this.addTranslateButton();
      
      // 如果启用实时翻译，设置监听
      if (config.advanced.realtime) {
        this.setupRealtimeTranslation();
      }
      
      // 如果启用禁发中文，设置拦截
      if (config.advanced.blockChinese) {
        this.setupChineseBlock();
      }

      this.setupSendClose();
    } else {
      console.warn('[InputBoxTranslation] Input box not found, retrying...');
      setTimeout(() => this.init(config), 2000);
    }
  },

  /**
   * 查找输入框
   */
  findInputBox() {
    // WhatsApp Web 输入框选择器
    this.inputBox = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                   document.querySelector('[contenteditable="true"][data-tab="10"]') ||
                   document.querySelector('div[contenteditable="true"][role="textbox"]');
    
    return this.inputBox;
  },

  /**
   * 添加翻译按钮
   */
  addTranslateButton() {
    if (!this.config.inputBox.enabled) {
      return;
    }

    // 查找输入框容器
    const footer = document.querySelector('[data-testid="conversation-compose-box"]') ||
                  document.querySelector('footer');
    
    if (!footer) {
      console.warn('[InputBoxTranslation] Footer not found');
      return;
    }

    // 检查按钮是否已存在
    if (document.getElementById('wa-translate-btn')) {
      return;
    }

    // 创建翻译按钮
    const button = document.createElement('button');
    button.id = 'wa-translate-btn';
    button.className = 'wa-translate-btn';
    button.innerHTML = '🌐';
    button.title = '翻译';
    button.type = 'button';
    
    button.onclick = () => this.translateInputBox();

    // 查找合适的位置插入按钮
    const attachButton = footer.querySelector('[data-testid="clip"]') ||
                        footer.querySelector('[data-icon="clip"]');
    
    if (attachButton && attachButton.parentNode) {
      attachButton.parentNode.insertBefore(button, attachButton.nextSibling);
    } else {
      footer.appendChild(button);
    }

    this.translateButton = button;
    console.log('[InputBoxTranslation] Translate button added');
  },

  /**
   * 翻译输入框内容
   */
  async translateInputBox() {
    if (!this.inputBox) {
      this.findInputBox();
      if (!this.inputBox) {
        alert('无法找到输入框');
        return;
      }
    }

    const text = this.inputBox.textContent || this.inputBox.innerText;
    
    if (!text || !text.trim()) {
      alert('请输入要翻译的内容');
      return;
    }

    // 检查禁发中文
    if (this.config.advanced.blockChinese && this.containsChinese(text)) {
      alert('检测到中文内容，请先翻译后再发送');
      return;
    }

    try {
      // 显示加载状态
      if (this.translateButton) {
        this.translateButton.innerHTML = '⏳';
        this.translateButton.disabled = true;
      }

      // 调用翻译 API
      const response = await window.translationAPI.translate({
        text: text,
        sourceLang: 'auto',
        targetLang: this.config.global.targetLang,
        engineName: this.config.global.engine,
        options: {
          style: this.config.inputBox.style
        }
      });

      if (response.success) {
        // 解码并替换输入框内容
        const decodedText = this.decodeHTMLEntitiesInBrowser(response.data.translatedText);
        this.setInputBoxText(decodedText);
      } else {
        alert('翻译失败: ' + response.error);
      }

    } catch (error) {
      console.error('[InputBoxTranslation] Translation error:', error);
      alert('翻译失败: ' + error.message);
    } finally {
      // 恢复按钮状态
      if (this.translateButton) {
        this.translateButton.innerHTML = '🌐';
        this.translateButton.disabled = false;
      }
    }
  },

  /**
   * 设置输入框文本
   */
  setInputBoxText(text) {
    if (!this.inputBox) return;

    // 清空输入框
    this.inputBox.textContent = '';
    
    // 设置新文本
    this.inputBox.textContent = text;
    
    // 触发输入事件以更新 WhatsApp 状态
    const inputEvent = new Event('input', { bubbles: true });
    this.inputBox.dispatchEvent(inputEvent);
    
    // 聚焦输入框
    this.inputBox.focus();
    
    // 将光标移到末尾
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(this.inputBox);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  },

  /**
   * 设置实时翻译
   */
  setupRealtimeTranslation() {
    if (!this.inputBox) return;

    // 创建实时翻译预览容器
    this.createRealtimePreview();

    // 监听输入事件
    this.inputBox.addEventListener('input', () => {
      clearTimeout(this.realtimeTimeout);
      
      this.realtimeTimeout = setTimeout(() => {
        this.updateRealtimeTranslation();
      }, 500); // 500ms 防抖
    });

    console.log('[InputBoxTranslation] Realtime translation enabled');
  },

  /**
   * 创建实时翻译预览
   */
  createRealtimePreview() {
    if (document.getElementById('wa-realtime-preview')) {
      return;
    }

    const preview = document.createElement('div');
    preview.id = 'wa-realtime-preview';
    preview.className = 'wa-realtime-preview';
    preview.style.display = 'none';

    const footer = document.querySelector('[data-testid="conversation-compose-box"]') ||
                  document.querySelector('footer');
    
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(preview, footer);
    }

    this.realtimePreview = preview;
  },

  /**
   * 更新实时翻译
   */
  async updateRealtimeTranslation() {
    if (!this.inputBox || !this.realtimePreview) return;

    const text = this.inputBox.textContent || this.inputBox.innerText;
    
    if (!text || !text.trim()) {
      this.realtimePreview.style.display = 'none';
      return;
    }

    try {
      this.realtimePreview.innerHTML = '<div class="translation-loading">翻译中...</div>';
      this.realtimePreview.style.display = 'block';

      const response = await window.translationAPI.translate({
        text: text,
        sourceLang: 'auto',
        targetLang: this.config.global.targetLang,
        engineName: this.config.global.engine,
        options: {
          style: this.config.inputBox.style
        }
      });

      if (response.success) {
        this.realtimePreview.innerHTML = `
          <div class="translation-header">
            <span>🌐 实时翻译预览</span>
          </div>
          <div class="translation-text"></div>
        `;
        
        // 在浏览器端解码 HTML 实体并使用 textContent 设置
        const textDiv = this.realtimePreview.querySelector('.translation-text');
        const decodedText = this.decodeHTMLEntitiesInBrowser(response.data.translatedText);
        textDiv.textContent = decodedText;
      } else {
        this.realtimePreview.style.display = 'none';
      }

    } catch (error) {
      console.error('[InputBoxTranslation] Realtime translation error:', error);
      this.realtimePreview.style.display = 'none';
    }
  },

  /**
   * 设置中文拦截
   */
  setupChineseBlock() {
    if (!this.inputBox) return;

    // 监听发送按钮点击
    const sendButton = document.querySelector('[data-testid="send"]') ||
                      document.querySelector('[data-icon="send"]');
    
    if (sendButton) {
      sendButton.addEventListener('click', (e) => {
        const text = this.inputBox.textContent || this.inputBox.innerText;
        
        if (this.containsChinese(text)) {
          e.preventDefault();
          e.stopPropagation();
          alert('检测到中文内容，请先翻译后再发送');
          return false;
        }
      }, true);

      console.log('[InputBoxTranslation] Chinese block enabled');
    }
  },

  setupSendClose() {
    const sendButton = document.querySelector('[data-testid="send"]') ||
                      document.querySelector('[data-icon="send"]');
    const closeFn = () => {
      if (this.realtimePreview) {
        this.realtimePreview.style.display = 'none';
      }
      clearTimeout(this.realtimeTimeout);
    };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        closeFn();
      }
    }, true);
    if (sendButton) {
      sendButton.addEventListener('mousedown', () => closeFn(), true);
      sendButton.addEventListener('click', () => closeFn(), true);
    }
  },

  /**
   * 检测是否包含中文
   */
  containsChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text);
  },

  /**
   * 在浏览器端解码 HTML 实体
   */
  decodeHTMLEntitiesInBrowser(text) {
    if (!text) return text;
    
    const textarea = document.createElement('textarea');
    let decoded = text;
    let prevDecoded;
    let iterations = 0;
    
    // 多次解码以处理双重编码
    do {
      prevDecoded = decoded;
      textarea.innerHTML = decoded;
      decoded = textarea.value;
      iterations++;
    } while (decoded !== prevDecoded && iterations < 3);
    
    return decoded;
  },

  /**
   * 转义 HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 清理资源
   */
  cleanup() {
    if (this.translateButton) {
      this.translateButton.remove();
      this.translateButton = null;
    }

    if (this.realtimePreview) {
      this.realtimePreview.remove();
      this.realtimePreview = null;
    }

    clearTimeout(this.realtimeTimeout);
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputBoxTranslation;
}
