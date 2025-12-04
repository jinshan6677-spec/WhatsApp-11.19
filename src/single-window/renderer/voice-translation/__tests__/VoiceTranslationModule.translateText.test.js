const { JSDOM } = require('jsdom');

describe('VoiceTranslationModule.translateText', () => {
  let window;
  let VoiceTranslationModule;

  beforeEach(() => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
    window = dom.window;
    global.window = window;
    window.AudioInterceptor = class { setup() {} cleanup() {} };
    window.SilentPlaybackController = class { enableGlobalSilentUI(){} disableGlobalSilentUI(){} triggerSilentPlayback(){ return Promise.resolve('blob:mock'); } stopPlayback(){} };
    window.AudioDownloader = class { download(){ return new window.Blob(['audio']) } getCacheSize(){ return 0 } clearCache(){} };
    window.GroqSTT = class { constructor(){ } isSupported(){ return true } updateConfig(){} transcribeFromBlob(){ return Promise.resolve('recognized'); } };
    VoiceTranslationModule = require('../VoiceTranslationModule.js');
    window.llmAPI = {
      translateWithGroq: jest.fn(async () => ({ success: true, text: '你好世界' }))
    };
  });

  test('returns translated text from llmAPI', async () => {
    const mod = new window.VoiceTranslationModule({
      config: { groqApiKey: 'KEY', groqTextModel: 'llama-3.1-70b-versatile' }
    });
    const res = await mod.translateText('Hello World', 'en', 'zh-CN', 'google');
    expect(window.llmAPI.translateWithGroq).toHaveBeenCalled();
    expect(res.translatedText).toBe('你好世界');
  });
});
