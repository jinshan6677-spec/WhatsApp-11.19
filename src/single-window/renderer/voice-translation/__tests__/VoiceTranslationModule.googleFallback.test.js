const { JSDOM } = require('jsdom');

describe('VoiceTranslationModule Google fallback', () => {
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
    window.llmAPI = {
      translateWithGroq: jest.fn(async () => ({ success: false, error: 'fail' }))
    };
    window.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [[["谷歌译文","原文",null,null]]]
    }));
    VoiceTranslationModule = require('../VoiceTranslationModule.js');
  });

  test('falls back to Google when Groq primary and fallback fail', async () => {
    const mod = new window.VoiceTranslationModule({
      config: {
        groqApiKey: 'KEY',
        groqTextModel: 'llama-3.1-70b-versatile',
        groqTextModelFallback: 'llama-3.1-8b-instant'
      }
    });
    const res = await mod.translateText('hello', 'en', 'zh-CN', 'google');
    expect(window.llmAPI.translateWithGroq).toHaveBeenCalled();
    expect(window.fetch).toHaveBeenCalled();
    expect(res.translatedText).toBe('谷歌译文');
  });
});

