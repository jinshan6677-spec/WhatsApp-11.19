/**
 * Export Utilities
 * 
 * Provides utilities for exporting quick reply data in JSON and ZIP formats.
 * Requirements: 9.2, 9.3, 9.4
 */

const fs = require('fs').promises;
const path = require('path');
const { fileToBase64, getFullMediaPath, mediaFileExists } = require('./file');
const StorageError = require('../errors/StorageError');

// Handle archiver in test environment
let archiver;
try {
  archiver = require('archiver');
} catch (error) {
  // Mock archiver for testing
  archiver = null;
}

/**
 * Export data format version
 */
const EXPORT_VERSION = '1.0.0';

/**
 * Creates export metadata
 * @param {string} accountId - Account ID
 * @param {string} scope - Export scope ('all' | 'group' | 'selected')
 * @returns {Object} - Export metadata
 */
function createExportMetadata(accountId, scope) {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    accountId,
    scope
  };
}

/**
 * Prepares templates for export (removes internal fields)
 * @param {Array} templates - Array of template objects
 * @returns {Array} - Cleaned templates for export
 */
function prepareTemplatesForExport(templates) {
  return templates.map(template => ({
    id: template.id,
    groupId: template.groupId,
    type: template.type,
    visibility: template.visibility,
    label: template.label,
    content: template.content,
    order: template.order,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    usageCount: template.usageCount || 0,
    lastUsedAt: template.lastUsedAt
  }));
}

/**
 * Prepares groups for export (removes internal fields)
 * @param {Array} groups - Array of group objects
 * @returns {Array} - Cleaned groups for export
 */
function prepareGroupsForExport(groups) {
  return groups.map(group => ({
    id: group.id,
    name: group.name,
    parentId: group.parentId,
    order: group.order,
    expanded: group.expanded,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  }));
}

/**
 * Exports data to JSON format
 * @param {Object} options - Export options
 * @param {string} options.accountId - Account ID
 * @param {Array} options.templates - Templates to export
 * @param {Array} options.groups - Groups to export
 * @param {string} options.scope - Export scope
 * @returns {Object} - JSON export data
 */
function exportToJSON({ accountId, templates, groups, scope }) {
  const metadata = createExportMetadata(accountId, scope);
  const exportedTemplates = prepareTemplatesForExport(templates);
  const exportedGroups = prepareGroupsForExport(groups);

  return {
    metadata,
    groups: exportedGroups,
    templates: exportedTemplates
  };
}

/**
 * Exports data to JSON string
 * @param {Object} options - Export options
 * @returns {string} - JSON string
 */
function exportToJSONString(options) {
  const data = exportToJSON(options);
  return JSON.stringify(data, null, 2);
}

/**
 * Exports data to ZIP format with media files
 * @param {Object} options - Export options
 * @param {string} options.accountId - Account ID
 * @param {Array} options.templates - Templates to export
 * @param {Array} options.groups - Groups to export
 * @param {string} options.scope - Export scope
 * @param {string} options.outputPath - Output file path
 * @returns {Promise<string>} - Output file path
 */
async function exportToZIP({ accountId, templates, groups, scope, outputPath }) {
  if (!archiver) {
    throw new StorageError('ZIP导出功能不可用');
  }

  return new Promise(async (resolve, reject) => {
    try {
      const output = require('fs').createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        resolve(outputPath);
      });

      archive.on('error', (err) => {
        reject(new StorageError(`创建ZIP文件失败: ${err.message}`));
      });

      archive.pipe(output);

      // Add JSON data
      const jsonData = exportToJSON({ accountId, templates, groups, scope });
      archive.append(JSON.stringify(jsonData, null, 2), { name: 'data.json' });

      // Add media files
      for (const template of templates) {
        if (template.content && template.content.mediaPath) {
          const mediaPath = template.content.mediaPath;
          const fullPath = getFullMediaPath(mediaPath, accountId);
          
          try {
            const exists = await mediaFileExists(mediaPath, accountId);
            if (exists) {
              archive.file(fullPath, { name: `media/${path.basename(mediaPath)}` });
            }
          } catch (err) {
            console.warn(`Warning: Could not add media file ${mediaPath}:`, err.message);
          }
        }

        // Add thumbnail if exists
        if (template.content && template.content.thumbnailPath) {
          const thumbPath = template.content.thumbnailPath;
          const fullThumbPath = getFullMediaPath(thumbPath, accountId);
          
          try {
            const exists = await mediaFileExists(thumbPath, accountId);
            if (exists) {
              archive.file(fullThumbPath, { name: `media/${path.basename(thumbPath)}` });
            }
          } catch (err) {
            console.warn(`Warning: Could not add thumbnail ${thumbPath}:`, err.message);
          }
        }
      }

      await archive.finalize();
    } catch (error) {
      reject(new StorageError(`导出ZIP失败: ${error.message}`));
    }
  });
}

/**
 * Exports data with embedded media as Base64 (for JSON export with media)
 * @param {Object} options - Export options
 * @param {string} options.accountId - Account ID
 * @param {Array} options.templates - Templates to export
 * @param {Array} options.groups - Groups to export
 * @param {string} options.scope - Export scope
 * @returns {Promise<Object>} - JSON export data with embedded media
 */
async function exportToJSONWithMedia({ accountId, templates, groups, scope }) {
  const metadata = createExportMetadata(accountId, scope);
  const exportedGroups = prepareGroupsForExport(groups);
  
  // Process templates and embed media as Base64
  const exportedTemplates = await Promise.all(
    templates.map(async (template) => {
      const exportedTemplate = {
        id: template.id,
        groupId: template.groupId,
        type: template.type,
        visibility: template.visibility,
        label: template.label,
        content: { ...template.content },
        order: template.order,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        usageCount: template.usageCount || 0,
        lastUsedAt: template.lastUsedAt
      };

      // Embed media as Base64
      if (template.content && template.content.mediaPath) {
        try {
          const exists = await mediaFileExists(template.content.mediaPath, accountId);
          if (exists) {
            const base64Data = await fileToBase64(template.content.mediaPath, accountId);
            exportedTemplate.content.mediaBase64 = base64Data;
            exportedTemplate.content.mediaFileName = path.basename(template.content.mediaPath);
          }
        } catch (err) {
          console.warn(`Warning: Could not embed media ${template.content.mediaPath}:`, err.message);
        }
      }

      return exportedTemplate;
    })
  );

  return {
    metadata,
    groups: exportedGroups,
    templates: exportedTemplates
  };
}

/**
 * Generates export filename
 * @param {string} format - Export format ('json' | 'zip')
 * @param {string} scope - Export scope
 * @returns {string} - Generated filename
 */
function generateExportFilename(format, scope) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const scopeLabel = scope === 'all' ? 'all' : scope === 'group' ? 'group' : 'selected';
  return `quick-reply-export-${scopeLabel}-${timestamp}.${format}`;
}

/**
 * Validates export data structure
 * @param {Object} data - Export data to validate
 * @returns {Object} - Validation result { valid: boolean, errors: string[] }
 */
function validateExportData(data) {
  const errors = [];

  if (!data) {
    errors.push('导出数据不能为空');
    return { valid: false, errors };
  }

  if (!data.metadata) {
    errors.push('缺少元数据');
  } else {
    if (!data.metadata.version) {
      errors.push('缺少版本信息');
    }
    if (!data.metadata.exportedAt) {
      errors.push('缺少导出时间');
    }
  }

  if (!Array.isArray(data.groups)) {
    errors.push('分组数据格式无效');
  }

  if (!Array.isArray(data.templates)) {
    errors.push('模板数据格式无效');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  EXPORT_VERSION,
  createExportMetadata,
  prepareTemplatesForExport,
  prepareGroupsForExport,
  exportToJSON,
  exportToJSONString,
  exportToZIP,
  exportToJSONWithMedia,
  generateExportFilename,
  validateExportData
};
