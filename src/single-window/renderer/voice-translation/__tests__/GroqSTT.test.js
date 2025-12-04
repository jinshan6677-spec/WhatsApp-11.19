const { JSDOM } = require('jsdom');

describe('GroqSTT', () => {
  let GroqSTT;
  let window;

  beforeEach(() => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
    window = dom.window;
    global.window = window;
    GroqSTT = require('../../voice-translation/GroqSTT.js');
  });

  test('transcribeFromBlob calls sttAPI.callGroq and returns text', async () => {
    const mockBlob = new window.Blob(['test audio']);
    window.sttAPI = {
      callGroq: jest.fn(async () => ({ success: true, text: ' hello ' }))
    };

    const stt = new window.GroqSTT({ apiKey: 'KEY', model: 'whisper-large-v3' });
    const text = await stt.transcribeFromBlob(mockBlob);
    expect(window.sttAPI.callGroq).toHaveBeenCalled();
    expect(text).toBe('hello');
  });

  test('transcribeFromBlob throws when API key missing', async () => {
    const mockBlob = new window.Blob(['test audio']);
    const stt = new window.GroqSTT({ apiKey: '' });
    await expect(stt.transcribeFromBlob(mockBlob)).rejects.toThrow('未配置 Groq API Key');
  });
});

