/**
 * Send Mode Constants
 * 
 * Defines the supported send modes.
 */

const SEND_MODES = {
  ORIGINAL: 'original',
  TRANSLATED: 'translated'
};

const SEND_MODE_LABELS = {
  [SEND_MODES.ORIGINAL]: '原文发送',
  [SEND_MODES.TRANSLATED]: '翻译后发送'
};

module.exports = {
  SEND_MODES,
  SEND_MODE_LABELS
};
