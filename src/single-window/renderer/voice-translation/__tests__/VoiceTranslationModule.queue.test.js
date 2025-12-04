const { JSDOM } = require('jsdom');

describe('VoiceTranslationModule queue', () => {
  let window;
  let VoiceTranslationModule;

  beforeEach(() => {
    const dom = new JSDOM('<!doctype html><html><body><div id="m1"></div><div id="m2"></div></body></html>', { url: 'http://localhost' });
    window = dom.window;
    global.window = window;
    window.AudioInterceptor = class { setup() {} };
    window.SilentPlaybackController = class { enableGlobalSilentUI(){} disableGlobalSilentUI(){} triggerSilentPlayback(){ return Promise.resolve('blob:mock'); } stopPlayback(){} };
    window.AudioDownloader = class { download(){ return new window.Blob(['audio']) } };
    window.GroqSTT = class { transcribeFromBlob(){ return Promise.resolve('text'); } isSupported(){ return true } };
    window.llmAPI = { translateWithGroq: jest.fn(async () => ({ success: true, text: '译文' })) };
    VoiceTranslationModule = require('../VoiceTranslationModule.js');
  });

  test('multiple translateVoiceMessage calls are queued not rejected', async () => {
    const mod = new window.VoiceTranslationModule({ config: { groqApiKey: 'KEY' } });
    mod.initialize();
    const m1 = window.document.getElementById('m1');
    const m2 = window.document.getElementById('m2');
    const p1 = mod.translateVoiceMessage(m1, { sourceLang: 'en', targetLang: 'zh-CN' });
    const p2 = mod.translateVoiceMessage(m2, { sourceLang: 'en', targetLang: 'zh-CN' });
    const r1 = await p1;
    const r2 = await p2;
    expect(r1.translated).toBe('译文');
    expect(r2.translated).toBe('译文');
    expect(window.llmAPI.translateWithGroq).toHaveBeenCalledTimes(2);
  });
});
