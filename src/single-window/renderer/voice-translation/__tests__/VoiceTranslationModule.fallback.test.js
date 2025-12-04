const { JSDOM } = require('jsdom');

describe('VoiceTranslationModule fallback', () => {
  let window;
  let VoiceTranslationModule;

  beforeEach(() => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
    window = dom.window;
    global.window = window;
    window.AudioInterceptor = class { setup() {} };
    window.SilentPlaybackController = class { };
    window.AudioDownloader = class { };
    window.GroqSTT = class { isSupported(){ return true } };
    VoiceTranslationModule = require('../VoiceTranslationModule.js');
  });

  test('uses fallback model when primary fails', async () => {
    const calls = [];
    window.llmAPI = {
      translateWithGroq: jest.fn(async (apiKey, model, prompt) => {
        calls.push(model);
        if (calls.length === 1) {
          return { success: false, error: 'primary failed' };
        }
        return { success: true, text: 'fallback ok' };
      })
    };

    const mod = new window.VoiceTranslationModule({
      config: { groqApiKey: 'KEY', groqTextModel: 'llama-3.1-70b-versatile', groqTextModelFallback: 'llama-3.1-8b-instant' }
    });

    const res = await mod.translateText('x', 'en', 'zh-CN', 'google');
    expect(calls[0]).toBe('llama-3.1-70b-versatile');
    expect(calls[1]).toBe('llama-3.1-8b-instant');
    expect(res.translatedText).toBe('fallback ok');
  });
});

