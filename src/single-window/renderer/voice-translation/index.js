/**
 * 语音翻译模块导出
 */

const VoiceTranslationModule = require('./VoiceTranslationModule');
const AudioInterceptor = require('./AudioInterceptor');
const SilentPlaybackController = require('./SilentPlaybackController');
const AudioDownloader = require('./AudioDownloader');
const GroqSTT = require('./GroqSTT');

module.exports = {
    VoiceTranslationModule,
    AudioInterceptor,
    SilentPlaybackController,
    AudioDownloader,
    GroqSTT
};
