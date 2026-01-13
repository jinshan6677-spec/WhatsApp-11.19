/**
 * Tab Type Constants
 * 
 * Defines the supported tab types for filtering quick replies.
 * 
 * Requirements: 1.1.1, 1.1.2, 1.1.3, 1.1.4
 */

const TAB_TYPES = {
  ALL: 'all',
  PUBLIC: 'public',
  PERSONAL: 'personal'
};

const TAB_TYPE_LABELS = {
  [TAB_TYPES.ALL]: '全部',
  [TAB_TYPES.PUBLIC]: '公共',
  [TAB_TYPES.PERSONAL]: '个人'
};

module.exports = {
  TAB_TYPES,
  TAB_TYPE_LABELS
};
