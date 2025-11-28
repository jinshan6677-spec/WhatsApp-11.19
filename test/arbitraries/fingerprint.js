/**
 * Fingerprint Arbitraries for Property-Based Testing
 * 
 * Provides fast-check arbitraries for generating fingerprint test data
 * that conforms to FingerprintProfile constraints.
 * 
 * @module test/arbitraries/fingerprint
 */

'use strict';

const fc = require('fast-check');
const { uuidArbitrary, nonEmptyString, dateArbitrary } = require('./index');

// ==================== Platform and Mode Arbitraries ====================

const platformArbitrary = fc.constantFrom('Windows', 'MacOS', 'Linux');
const webglModeArbitrary = fc.constantFrom('real', 'custom', 'random');
const canvasModeArbitrary = fc.constantFrom('real', 'random');
const audioModeArbitrary = fc.constantFrom('real', 'random');
const webrtcModeArbitrary = fc.constantFrom('disabled', 'replaced', 'real');
const timezoneModeArbitrary = fc.constantFrom('ip-based', 'real', 'custom');
const geolocationModeArbitrary = fc.constantFrom('ip-based', 'prompt', 'deny');
const languageModeArbitrary = fc.constantFrom('ip-based', 'custom');
const screenModeArbitrary = fc.constantFrom('real', 'custom');
const batteryModeArbitrary = fc.constantFrom('real', 'privacy', 'disabled');
const fontsModeArbitrary = fc.constantFrom('system', 'custom');
const pluginsModeArbitrary = fc.constantFrom('real', 'custom', 'empty');
const mediaDevicesModeArbitrary = fc.constantFrom('real', 'custom', 'disabled');
const doNotTrackArbitrary = fc.constantFrom('0', '1', null);

// ==================== User-Agent Arbitraries ====================

const browserVersionArbitrary = fc.constantFrom(
  'Chrome 108', 'Chrome 120', 'Chrome 121', 'Chrome 122',
  'Edge 108', 'Edge 120', 'Firefox 120', 'Safari 17'
);

const userAgentArbitrary = fc.tuple(platformArbitrary, browserVersionArbitrary).map(([platform, browser]) => {
  const chromeVersion = browser.split(' ')[1] || '120';
  
  if (platform === 'Windows') {
    if (browser.startsWith('Chrome')) {
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
    } else if (browser.startsWith('Edge')) {
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36 Edg/${chromeVersion}.0.0.0`;
    } else if (browser.startsWith('Firefox')) {
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${chromeVersion}.0) Gecko/20100101 Firefox/${chromeVersion}.0`;
    }
  } else if (platform === 'MacOS') {
    if (browser.startsWith('Chrome')) {
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
    } else if (browser.startsWith('Safari')) {
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${chromeVersion}.0 Safari/605.1.15`;
    } else if (browser.startsWith('Firefox')) {
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${chromeVersion}.0) Gecko/20100101 Firefox/${chromeVersion}.0`;
    }
  } else if (platform === 'Linux') {
    if (browser.startsWith('Chrome')) {
      return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`;
    } else if (browser.startsWith('Firefox')) {
      return `Mozilla/5.0 (X11; Linux x86_64; rv:${chromeVersion}.0) Gecko/20100101 Firefox/${chromeVersion}.0`;
    }
  }
  
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`;
});

// ==================== WebGL Arbitraries ====================

const webglVendorArbitrary = fc.constantFrom(
  'Google Inc. (NVIDIA)',
  'Google Inc. (Intel)',
  'Google Inc. (AMD)',
  'Apple Inc.',
  'Google Inc. (Qualcomm)'
);

const webglRendererArbitrary = fc.constantFrom(
  'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
  'Apple M1',
  'Apple M2',
  'ANGLE (Qualcomm Adreno 650 Direct3D11 vs_5_0 ps_5_0)'
);

const webglConfigArbitrary = fc.record({
  vendor: webglVendorArbitrary,
  renderer: webglRendererArbitrary,
  mode: webglModeArbitrary
});

// ==================== Canvas and Audio Arbitraries ====================

const canvasConfigArbitrary = fc.record({
  mode: canvasModeArbitrary,
  noiseLevel: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined })
});

const audioConfigArbitrary = fc.record({
  mode: audioModeArbitrary,
  noiseLevel: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined })
});

// ==================== WebRTC Arbitraries ====================

const webrtcConfigArbitrary = fc.record({
  mode: webrtcModeArbitrary,
  fakeLocalIP: fc.option(fc.ipV4(), { nil: undefined })
}).map(config => {
  // Ensure fakeLocalIP is present when mode is 'replaced'
  if (config.mode === 'replaced' && !config.fakeLocalIP) {
    return { ...config, fakeLocalIP: '192.168.1.100' };
  }
  return config;
});

// ==================== Environment Arbitraries ====================

const timezoneArbitrary = fc.constantFrom(
  'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'UTC'
);

const timezoneConfigArbitrary = fc.record({
  mode: timezoneModeArbitrary,
  value: fc.option(timezoneArbitrary, { nil: undefined })
}).map(config => {
  // Ensure value is present when mode is 'custom'
  if (config.mode === 'custom' && !config.value) {
    return { ...config, value: 'UTC' };
  }
  return config;
});

const geolocationConfigArbitrary = fc.record({
  mode: geolocationModeArbitrary,
  latitude: fc.option(fc.double({ min: -90, max: 90 }), { nil: undefined }),
  longitude: fc.option(fc.double({ min: -180, max: 180 }), { nil: undefined })
});

const languageCodeArbitrary = fc.constantFrom(
  'en-US', 'en-GB', 'zh-CN', 'zh-TW', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'ko-KR'
);

const languageConfigArbitrary = fc.record({
  mode: languageModeArbitrary,
  value: fc.option(languageCodeArbitrary, { nil: undefined })
}).map(config => {
  // Ensure value is present when mode is 'custom'
  if (config.mode === 'custom' && !config.value) {
    return { ...config, value: 'en-US' };
  }
  return config;
});

// ==================== Screen and Hardware Arbitraries ====================

const screenConfigArbitrary = fc.record({
  mode: screenModeArbitrary,
  width: fc.option(fc.integer({ min: 640, max: 7680 }), { nil: undefined }),
  height: fc.option(fc.integer({ min: 480, max: 4320 }), { nil: undefined })
}).map(config => {
  // Ensure width and height are present when mode is 'custom'
  if (config.mode === 'custom') {
    return {
      ...config,
      width: config.width || 1920,
      height: config.height || 1080
    };
  }
  return config;
});

const hardwareConfigArbitrary = fc.record({
  cpuCores: fc.integer({ min: 2, max: 32 }),
  memory: fc.integer({ min: 4, max: 64 }),
  deviceName: fc.option(nonEmptyString(5, 50), { nil: undefined }),
  macAddress: fc.option(
    fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 6, maxLength: 6 })
      .map(bytes => bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':')),
    { nil: undefined }
  )
});

// ==================== Other Arbitraries ====================

const batteryConfigArbitrary = fc.record({
  mode: batteryModeArbitrary
});

const fontsConfigArbitrary = fc.record({
  mode: fontsModeArbitrary,
  list: fc.option(
    fc.array(
      fc.constantFrom('Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Comic Sans MS'),
      { minLength: 1, maxLength: 10 }
    ),
    { nil: undefined }
  )
}).map(config => {
  // Ensure list is present when mode is 'custom'
  if (config.mode === 'custom' && !config.list) {
    return { ...config, list: ['Arial', 'Times New Roman'] };
  }
  return config;
});

const pluginInfoArbitrary = fc.record({
  name: nonEmptyString(5, 50),
  description: nonEmptyString(10, 100),
  filename: nonEmptyString(5, 50),
  mimeTypes: fc.array(
    fc.record({
      type: fc.constantFrom('application/pdf', 'application/x-shockwave-flash', 'text/plain'),
      description: nonEmptyString(5, 50),
      suffixes: fc.constantFrom('pdf', 'swf', 'txt')
    }),
    { minLength: 1, maxLength: 3 }
  )
});

const pluginsConfigArbitrary = fc.record({
  mode: pluginsModeArbitrary,
  list: fc.option(fc.array(pluginInfoArbitrary, { minLength: 1, maxLength: 5 }), { nil: undefined })
}).map(config => {
  // Ensure list is present when mode is 'custom'
  if (config.mode === 'custom' && !config.list) {
    return {
      ...config,
      list: [{
        name: 'PDF Viewer',
        description: 'Portable Document Format',
        filename: 'pdf.dll',
        mimeTypes: [{ type: 'application/pdf', description: 'PDF', suffixes: 'pdf' }]
      }]
    };
  }
  return config;
});

const mediaDeviceInfoArbitrary = fc.record({
  deviceId: uuidArbitrary,
  label: nonEmptyString(5, 50),
  kind: fc.constantFrom('audioinput', 'audiooutput', 'videoinput')
});

const mediaDevicesConfigArbitrary = fc.record({
  mode: mediaDevicesModeArbitrary,
  devices: fc.option(fc.array(mediaDeviceInfoArbitrary, { minLength: 1, maxLength: 5 }), { nil: undefined })
}).map(config => {
  // Ensure devices is present when mode is 'custom'
  if (config.mode === 'custom' && !config.devices) {
    return {
      ...config,
      devices: [{
        deviceId: 'default',
        label: 'Default Microphone',
        kind: 'audioinput'
      }]
    };
  }
  return config;
});

// ==================== Complete FingerprintProfile Arbitrary ====================

/**
 * Valid fingerprint profile arbitrary - generates profiles that pass validation
 */
const validFingerprintProfileArbitrary = fc.tuple(
  platformArbitrary,
  browserVersionArbitrary
).chain(([platform, browserVersion]) => {
  return fc.record({
    id: fc.option(uuidArbitrary, { nil: undefined }),
    accountId: fc.option(uuidArbitrary, { nil: undefined }),
    userAgent: userAgentArbitrary,
    browserVersion: fc.constant(browserVersion),
    platform: fc.constant(platform),
    webgl: webglConfigArbitrary,
    canvas: canvasConfigArbitrary,
    audio: audioConfigArbitrary,
    webrtc: webrtcConfigArbitrary,
    timezone: timezoneConfigArbitrary,
    geolocation: geolocationConfigArbitrary,
    language: languageConfigArbitrary,
    screen: screenConfigArbitrary,
    hardware: hardwareConfigArbitrary,
    doNotTrack: doNotTrackArbitrary,
    battery: batteryConfigArbitrary,
    fonts: fontsConfigArbitrary,
    plugins: pluginsConfigArbitrary,
    mediaDevices: mediaDevicesConfigArbitrary,
    createdAt: fc.option(dateArbitrary, { nil: undefined }),
    updatedAt: fc.option(dateArbitrary, { nil: undefined }),
    version: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined })
  });
});

/**
 * Fingerprint profile arbitrary (may include invalid data for testing validation)
 */
const fingerprintProfileArbitrary = fc.record({
  id: fc.option(uuidArbitrary, { nil: undefined }),
  accountId: fc.option(uuidArbitrary, { nil: undefined }),
  userAgent: fc.oneof(userAgentArbitrary, fc.constant(''), fc.constant(null)),
  browserVersion: fc.oneof(browserVersionArbitrary, fc.constant('')),
  platform: fc.oneof(platformArbitrary, fc.constant('Invalid')),
  webgl: webglConfigArbitrary,
  canvas: canvasConfigArbitrary,
  audio: audioConfigArbitrary,
  webrtc: webrtcConfigArbitrary,
  timezone: timezoneConfigArbitrary,
  geolocation: geolocationConfigArbitrary,
  language: languageConfigArbitrary,
  screen: screenConfigArbitrary,
  hardware: hardwareConfigArbitrary,
  doNotTrack: doNotTrackArbitrary,
  battery: batteryConfigArbitrary,
  fonts: fontsConfigArbitrary,
  plugins: pluginsConfigArbitrary,
  mediaDevices: mediaDevicesConfigArbitrary,
  createdAt: fc.option(dateArbitrary, { nil: undefined }),
  updatedAt: fc.option(dateArbitrary, { nil: undefined }),
  version: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined })
});

// ==================== Exports ====================

module.exports = {
  // Modes
  platformArbitrary,
  webglModeArbitrary,
  canvasModeArbitrary,
  audioModeArbitrary,
  webrtcModeArbitrary,
  timezoneModeArbitrary,
  geolocationModeArbitrary,
  languageModeArbitrary,
  screenModeArbitrary,
  batteryModeArbitrary,
  fontsModeArbitrary,
  pluginsModeArbitrary,
  mediaDevicesModeArbitrary,
  doNotTrackArbitrary,
  
  // Components
  browserVersionArbitrary,
  userAgentArbitrary,
  webglVendorArbitrary,
  webglRendererArbitrary,
  webglConfigArbitrary,
  canvasConfigArbitrary,
  audioConfigArbitrary,
  webrtcConfigArbitrary,
  timezoneArbitrary,
  timezoneConfigArbitrary,
  geolocationConfigArbitrary,
  languageCodeArbitrary,
  languageConfigArbitrary,
  screenConfigArbitrary,
  hardwareConfigArbitrary,
  batteryConfigArbitrary,
  fontsConfigArbitrary,
  pluginInfoArbitrary,
  pluginsConfigArbitrary,
  mediaDeviceInfoArbitrary,
  mediaDevicesConfigArbitrary,
  
  // Complete profiles
  validFingerprintProfileArbitrary,
  fingerprintProfileArbitrary
};
