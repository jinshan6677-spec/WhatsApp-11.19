/**
 * Search Utilities
 * 
 * Provides search functionality for templates and groups.
 */

const { TEMPLATE_TYPES } = require('../constants/templateTypes');
const { TAB_TYPES } = require('../constants/tabTypes');
const { VISIBILITY_TYPES } = require('../constants/visibilityTypes');

/**
 * Searches templates by keyword
 * @param {string} keyword - The search keyword
 * @param {Array} templates - Array of template objects
 * @param {Array} groups - Array of group objects
 * @returns {Array} - Array of matching template IDs
 */
function searchTemplates(keyword, templates, groups) {
  if (!keyword || keyword.trim().length === 0) {
    return templates.map(t => t.id);
  }

  const lowerKeyword = keyword.toLowerCase().trim();
  const matchingTemplateIds = new Set();

  // Search template labels and content
  templates.forEach(template => {
    if (matchesTemplateContent(template, lowerKeyword)) {
      matchingTemplateIds.add(template.id);
    }
  });

  // Search group names and include all templates in matching groups
  groups.forEach(group => {
    if (matchesGroupName(group, lowerKeyword)) {
      const groupTemplates = templates.filter(t => t.groupId === group.id);
      groupTemplates.forEach(t => matchingTemplateIds.add(t.id));
    }
  });

  return Array.from(matchingTemplateIds);
}

/**
 * Checks if a template matches the search keyword
 * @param {Object} template - Template object
 * @param {string} lowerKeyword - Lowercase search keyword
 * @returns {boolean} - True if matches
 */
function matchesTemplateContent(template, lowerKeyword) {
  // Check label
  if (template.label && template.label.toLowerCase().includes(lowerKeyword)) {
    return true;
  }

  // Check text content
  if (template.content && template.content.text) {
    if (template.content.text.toLowerCase().includes(lowerKeyword)) {
      return true;
    }
  }

  // Check contact info
  if (template.type === TEMPLATE_TYPES.CONTACT && template.content.contactInfo) {
    const { name, phone, email } = template.content.contactInfo;
    if (name && name.toLowerCase().includes(lowerKeyword)) {
      return true;
    }
    if (phone && phone.toLowerCase().includes(lowerKeyword)) {
      return true;
    }
    if (email && email.toLowerCase().includes(lowerKeyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a group name matches the search keyword
 * @param {Object} group - Group object
 * @param {string} lowerKeyword - Lowercase search keyword
 * @returns {boolean} - True if matches
 */
function matchesGroupName(group, lowerKeyword) {
  return group.name && group.name.toLowerCase().includes(lowerKeyword);
}

/**
 * Filters templates by type
 * @param {Array} templates - Array of template objects
 * @param {string} type - Template type to filter by
 * @returns {Array} - Filtered templates
 */
function filterTemplatesByType(templates, type) {
  if (!type || type === 'all') {
    return templates;
  }

  return templates.filter(t => t.type === type);
}

/**
 * Filters templates by tab/visibility
 * Requirements: 1.1.2, 1.1.3, 1.1.4
 * 
 * Property 1: Tab Filter Correctness
 * - When tab is 'all', returns all templates
 * - When tab is 'public', returns only templates with visibility='public'
 * - When tab is 'personal', returns only templates with visibility='personal'
 * 
 * @param {Array} templates - Array of template objects
 * @param {string} tab - Tab type ('all' | 'public' | 'personal')
 * @returns {Array} - Filtered templates
 */
function filterTemplatesByTab(templates, tab) {
  if (!templates || !Array.isArray(templates)) {
    return [];
  }

  if (!tab || tab === TAB_TYPES.ALL) {
    return templates;
  }

  if (tab === TAB_TYPES.PUBLIC) {
    return templates.filter(t => t.visibility === VISIBILITY_TYPES.PUBLIC);
  }

  if (tab === TAB_TYPES.PERSONAL) {
    return templates.filter(t => t.visibility === VISIBILITY_TYPES.PERSONAL);
  }

  // Invalid tab type, return all templates
  return templates;
}

/**
 * Filters templates by group
 * @param {Array} templates - Array of template objects
 * @param {string} groupId - Group ID to filter by
 * @returns {Array} - Filtered templates
 */
function filterTemplatesByGroup(templates, groupId) {
  if (!groupId) {
    return templates;
  }

  return templates.filter(t => t.groupId === groupId);
}

/**
 * Gets all templates in a group and its subgroups
 * @param {string} groupId - Parent group ID
 * @param {Array} templates - Array of template objects
 * @param {Array} groups - Array of group objects
 * @returns {Array} - All templates in group hierarchy
 */
function getTemplatesInGroupHierarchy(groupId, templates, groups) {
  const result = [];
  const groupIds = new Set([groupId]);

  // Find all subgroups recursively
  const findSubgroups = (parentId) => {
    const subgroups = groups.filter(g => g.parentId === parentId);
    subgroups.forEach(subgroup => {
      groupIds.add(subgroup.id);
      findSubgroups(subgroup.id);
    });
  };

  findSubgroups(groupId);

  // Get all templates in these groups
  templates.forEach(template => {
    if (groupIds.has(template.groupId)) {
      result.push(template);
    }
  });

  return result;
}

/**
 * Sorts templates by usage count (descending)
 * @param {Array} templates - Array of template objects
 * @returns {Array} - Sorted templates
 */
function sortTemplatesByUsage(templates) {
  return [...templates].sort((a, b) => {
    const usageA = a.usageCount || 0;
    const usageB = b.usageCount || 0;
    return usageB - usageA;
  });
}

/**
 * Sorts templates by last used time (most recent first)
 * @param {Array} templates - Array of template objects
 * @returns {Array} - Sorted templates
 */
function sortTemplatesByLastUsed(templates) {
  return [...templates].sort((a, b) => {
    const timeA = a.lastUsedAt || 0;
    const timeB = b.lastUsedAt || 0;
    return timeB - timeA;
  });
}

/**
 * Sorts templates by order
 * @param {Array} templates - Array of template objects
 * @returns {Array} - Sorted templates
 */
function sortTemplatesByOrder(templates) {
  return [...templates].sort((a, b) => {
    const orderA = a.order || 0;
    const orderB = b.order || 0;
    return orderA - orderB;
  });
}

/**
 * Debounces a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Highlights search keyword in text
 * @param {string} text - Text to highlight in
 * @param {string} keyword - Keyword to highlight
 * @returns {string} - Text with highlighted keyword
 */
function highlightKeyword(text, keyword) {
  if (!text || !keyword) {
    return text;
  }

  const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Escapes special regex characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Assigns continuous sequence numbers to templates
 * Requirements: 1.1.8
 * 
 * Property 2: Sequence Number Continuity
 * - Sequence numbers start from 1
 * - Sequence numbers are continuous (no gaps or duplicates)
 * - Each template gets a unique sequence number
 * 
 * @param {Array} templates - Array of template objects
 * @returns {Array} - Array of templates with sequenceNumber property added
 */
function assignSequenceNumbers(templates) {
  if (!templates || !Array.isArray(templates)) {
    return [];
  }

  return templates.map((template, index) => ({
    ...template,
    sequenceNumber: index + 1
  }));
}

module.exports = {
  searchTemplates,
  matchesTemplateContent,
  matchesGroupName,
  filterTemplatesByType,
  filterTemplatesByTab,
  filterTemplatesByGroup,
  getTemplatesInGroupHierarchy,
  sortTemplatesByUsage,
  sortTemplatesByLastUsed,
  sortTemplatesByOrder,
  debounce,
  highlightKeyword,
  escapeRegex,
  assignSequenceNumbers
};
