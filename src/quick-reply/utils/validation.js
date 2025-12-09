/**
 * Validation Utilities
 * 
 * Provides validation functions for template labels, media files, and input sanitization.
 */

const LIMITS = require('../constants/limits');
const { TEMPLATE_TYPES } = require('../constants/templateTypes');
const ValidationError = require('../errors/ValidationError');

/**
 * Validates a template label
 * @param {string} label - The label to validate
 * @returns {string} - The trimmed and validated label
 * @throws {ValidationError} - If validation fails
 */
function validateTemplateLabel(label) {
  if (label === null || label === undefined) {
    throw new ValidationError('模板标签不能为空');
  }

  const trimmedLabel = String(label).trim();

  if (trimmedLabel.length < LIMITS.LABEL_MIN_LENGTH) {
    throw new ValidationError('模板标签不能为空');
  }

  if (trimmedLabel.length > LIMITS.LABEL_MAX_LENGTH) {
    throw new ValidationError(`模板标签不能超过${LIMITS.LABEL_MAX_LENGTH}个字符`);
  }

  return trimmedLabel;
}

/**
 * Validates media file type and size
 * @param {Object} file - File object with type and size properties
 * @param {string} templateType - The template type (image, audio, video)
 * @returns {boolean} - True if valid
 * @throws {ValidationError} - If validation fails
 */
function validateMediaFile(file, templateType) {
  if (!file) {
    throw new ValidationError('文件不能为空');
  }

  if (!file.type || !file.size) {
    throw new ValidationError('无效的文件对象');
  }

  // Define allowed MIME types for each template type
  const allowedTypes = {
    [TEMPLATE_TYPES.IMAGE]: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    [TEMPLATE_TYPES.AUDIO]: [
      'audio/mpeg',
      'audio/mp3',
      'audio/ogg',
      'audio/wav',
      'audio/webm',
      'audio/aac'
    ],
    [TEMPLATE_TYPES.VIDEO]: [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime'
    ]
  };

  // Check if template type is valid
  if (!allowedTypes[templateType]) {
    throw new ValidationError(`不支持的模板类型: ${templateType}`);
  }

  // Check MIME type
  if (!allowedTypes[templateType].includes(file.type.toLowerCase())) {
    throw new ValidationError(`不支持的${getTypeLabel(templateType)}文件类型: ${file.type}`);
  }

  // Check file size
  const maxSizes = {
    [TEMPLATE_TYPES.IMAGE]: LIMITS.IMAGE_MAX_SIZE,
    [TEMPLATE_TYPES.AUDIO]: LIMITS.AUDIO_MAX_SIZE,
    [TEMPLATE_TYPES.VIDEO]: LIMITS.VIDEO_MAX_SIZE
  };

  if (file.size > maxSizes[templateType]) {
    const maxSizeMB = Math.floor(maxSizes[templateType] / (1024 * 1024));
    throw new ValidationError(
      `${getTypeLabel(templateType)}文件大小超过限制 (最大 ${maxSizeMB}MB)`
    );
  }

  return true;
}

/**
 * Validates text content length
 * @param {string} text - The text to validate
 * @returns {string} - The validated text
 * @throws {ValidationError} - If validation fails
 */
function validateTextContent(text) {
  if (text === null || text === undefined) {
    throw new ValidationError('文本内容不能为空');
  }

  const textStr = String(text);

  if (textStr.length > LIMITS.TEXT_MAX_LENGTH) {
    throw new ValidationError(
      `文本内容超过限制 (最大 ${LIMITS.TEXT_MAX_LENGTH} 字符)`
    );
  }

  return textStr;
}

/**
 * Validates contact information
 * @param {Object} contactInfo - Contact information object
 * @returns {Object} - The validated contact info
 * @throws {ValidationError} - If validation fails
 */
function validateContactInfo(contactInfo) {
  if (!contactInfo || typeof contactInfo !== 'object') {
    throw new ValidationError('名片信息不能为空');
  }

  if (!contactInfo.name || String(contactInfo.name).trim().length === 0) {
    throw new ValidationError('联系人姓名不能为空');
  }

  if (!contactInfo.phone || String(contactInfo.phone).trim().length === 0) {
    throw new ValidationError('联系人电话不能为空');
  }

  // Validate phone format (basic validation)
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (!phoneRegex.test(contactInfo.phone)) {
    throw new ValidationError('联系人电话格式无效');
  }

  // Validate email if provided
  if (contactInfo.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactInfo.email)) {
      throw new ValidationError('联系人邮箱格式无效');
    }
  }

  return {
    name: String(contactInfo.name).trim(),
    phone: String(contactInfo.phone).trim(),
    email: contactInfo.email ? String(contactInfo.email).trim() : undefined
  };
}

/**
 * Sanitizes HTML input to prevent XSS attacks
 * @param {string} input - The input to sanitize
 * @returns {string} - The sanitized input
 */
function sanitizeHtml(input) {
  if (!input) return '';

  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Cleans and normalizes user input
 * @param {string} input - The input to clean
 * @returns {string} - The cleaned input
 */
function cleanInput(input) {
  if (!input) return '';

  return String(input)
    .trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/[\r\n]+/g, '\n');  // Normalize line breaks
}

/**
 * Validates a file path to prevent path traversal attacks
 * @param {string} filePath - The file path to validate
 * @returns {boolean} - True if valid
 * @throws {ValidationError} - If validation fails
 */
function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new ValidationError('文件路径无效');
  }

  // Check for path traversal attempts
  if (filePath.includes('..') || filePath.includes('~')) {
    throw new ValidationError('文件路径包含非法字符');
  }

  // Check for absolute paths (should be relative)
  if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) {
    throw new ValidationError('文件路径必须是相对路径');
  }

  return true;
}

/**
 * Validates group depth to prevent excessive nesting
 * @param {number} depth - The current depth
 * @returns {boolean} - True if valid
 * @throws {ValidationError} - If validation fails
 */
function validateGroupDepth(depth) {
  if (typeof depth !== 'number' || depth < 0) {
    throw new ValidationError('分组层级无效');
  }

  if (depth >= LIMITS.MAX_GROUP_DEPTH) {
    throw new ValidationError(
      `分组层级不能超过${LIMITS.MAX_GROUP_DEPTH}层，建议简化分组结构`
    );
  }

  return true;
}

/**
 * Helper function to get type label in Chinese
 * @param {string} type - Template type
 * @returns {string} - Chinese label
 */
function getTypeLabel(type) {
  const labels = {
    [TEMPLATE_TYPES.IMAGE]: '图片',
    [TEMPLATE_TYPES.AUDIO]: '音频',
    [TEMPLATE_TYPES.VIDEO]: '视频'
  };
  return labels[type] || type;
}

module.exports = {
  validateTemplateLabel,
  validateMediaFile,
  validateTextContent,
  validateContactInfo,
  sanitizeHtml,
  cleanInput,
  validateFilePath,
  validateGroupDepth
};
