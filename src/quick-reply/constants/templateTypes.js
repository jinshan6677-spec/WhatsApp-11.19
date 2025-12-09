/**
 * Template Type Constants
 * 
 * Defines the supported template types.
 */

const TEMPLATE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  MIXED: 'mixed',      // Image + Text
  CONTACT: 'contact'
};

const TEMPLATE_TYPE_LABELS = {
  [TEMPLATE_TYPES.TEXT]: '新模板',
  [TEMPLATE_TYPES.IMAGE]: '图片模板',
  [TEMPLATE_TYPES.AUDIO]: '音频模板',
  [TEMPLATE_TYPES.VIDEO]: '视频模板',
  [TEMPLATE_TYPES.MIXED]: '图文模板',
  [TEMPLATE_TYPES.CONTACT]: '名片模板'
};

module.exports = {
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS
};
