/**
 * Visibility Type Constants
 * 
 * Defines the supported visibility types for templates.
 * 
 * Requirements: 1.1.2, 1.1.3, 1.1.4, 1.1.7
 */

const VISIBILITY_TYPES = {
  PUBLIC: 'public',
  PERSONAL: 'personal'
};

const VISIBILITY_TYPE_LABELS = {
  [VISIBILITY_TYPES.PUBLIC]: '公共',
  [VISIBILITY_TYPES.PERSONAL]: '个人'
};

module.exports = {
  VISIBILITY_TYPES,
  VISIBILITY_TYPE_LABELS
};
