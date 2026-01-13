/**
 * Import Utilities
 * 
 * Provides utilities for importing quick reply data from JSON and ZIP formats.
 * Requirements: 9.5, 9.6, 9.7, 9.8
 */

const fs = require('fs').promises;
const path = require('path');
const { base64ToFile, ensureMediaDirectory } = require('./file');
const StorageError = require('../errors/StorageError');
const ImportError = require('../errors/ImportError');
const { v4: uuidv4 } = require('./uuid');

// Handle unzipper in test environment
let unzipper;
try {
  unzipper = require('unzipper');
} catch (error) {
  // Mock unzipper for testing
  unzipper = null;
}

/**
 * Validates import data structure
 * @param {Object} data - Import data to validate
 * @returns {Object} - Validation result { valid: boolean, errors: string[], warnings: string[] }
 */
function validateImportData(data) {
  const errors = [];
  const warnings = [];

  if (!data) {
    errors.push('导入数据为空');
    return { valid: false, errors, warnings };
  }

  // Check metadata
  if (!data.metadata) {
    warnings.push('缺少元数据信息');
  } else {
    if (!data.metadata.version) {
      warnings.push('缺少版本信息');
    }
  }

  // Check groups
  if (!data.groups) {
    errors.push('缺少分组数据');
  } else if (!Array.isArray(data.groups)) {
    errors.push('分组数据格式无效');
  } else {
    data.groups.forEach((group, index) => {
      if (!group.id) {
        warnings.push(`分组 ${index + 1} 缺少ID`);
      }
      if (!group.name) {
        warnings.push(`分组 ${index + 1} 缺少名称`);
      }
    });
  }

  // Check templates
  if (!data.templates) {
    errors.push('缺少模板数据');
  } else if (!Array.isArray(data.templates)) {
    errors.push('模板数据格式无效');
  } else {
    data.templates.forEach((template, index) => {
      if (!template.id) {
        warnings.push(`模板 ${index + 1} 缺少ID`);
      }
      if (!template.type) {
        warnings.push(`模板 ${index + 1} 缺少类型`);
      }
      if (!template.label) {
        warnings.push(`模板 ${index + 1} 缺少标签`);
      }
      if (!template.groupId) {
        warnings.push(`模板 ${index + 1} 缺少分组ID`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    groupCount: data.groups?.length || 0,
    templateCount: data.templates?.length || 0
  };
}

/**
 * Detects conflicts between import data and existing data
 * @param {Object} importData - Data to import
 * @param {Array} existingGroups - Existing groups
 * @param {Array} existingTemplates - Existing templates
 * @returns {Object} - Conflicts { groups: [], templates: [] }
 */
function detectConflicts(importData, existingGroups, existingTemplates) {
  const conflicts = {
    groups: [],
    templates: []
  };

  // Create lookup maps for existing data
  const existingGroupIds = new Set(existingGroups.map(g => g.id));
  const existingGroupNames = new Map(existingGroups.map(g => [g.name.toLowerCase(), g]));
  const existingTemplateIds = new Set(existingTemplates.map(t => t.id));
  const existingTemplateLabels = new Map(existingTemplates.map(t => [t.label.toLowerCase(), t]));

  // Check group conflicts
  importData.groups?.forEach(group => {
    if (existingGroupIds.has(group.id)) {
      conflicts.groups.push({
        type: 'id',
        importItem: group,
        existingItem: existingGroups.find(g => g.id === group.id),
        message: `分组ID "${group.id}" 已存在`
      });
    } else if (existingGroupNames.has(group.name.toLowerCase())) {
      conflicts.groups.push({
        type: 'name',
        importItem: group,
        existingItem: existingGroupNames.get(group.name.toLowerCase()),
        message: `分组名称 "${group.name}" 已存在`
      });
    }
  });

  // Check template conflicts
  importData.templates?.forEach(template => {
    if (existingTemplateIds.has(template.id)) {
      conflicts.templates.push({
        type: 'id',
        importItem: template,
        existingItem: existingTemplates.find(t => t.id === template.id),
        message: `模板ID "${template.id}" 已存在`
      });
    } else if (existingTemplateLabels.has(template.label.toLowerCase())) {
      conflicts.templates.push({
        type: 'label',
        importItem: template,
        existingItem: existingTemplateLabels.get(template.label.toLowerCase()),
        message: `模板标签 "${template.label}" 已存在`
      });
    }
  });

  return conflicts;
}

/**
 * Resolves conflicts based on resolution strategy
 * @param {Object} importData - Data to import
 * @param {Object} conflicts - Detected conflicts
 * @param {Object} resolutions - Resolution strategies { groupId: 'skip'|'overwrite'|'rename', ... }
 * @returns {Object} - Resolved import data
 */
function resolveConflicts(importData, conflicts, resolutions) {
  const resolvedGroups = [];
  const resolvedTemplates = [];
  const idMapping = new Map(); // Maps old IDs to new IDs for renamed items

  // Resolve group conflicts
  importData.groups?.forEach(group => {
    const conflict = conflicts.groups.find(c => c.importItem.id === group.id);
    
    if (!conflict) {
      resolvedGroups.push(group);
      return;
    }

    const resolution = resolutions[`group_${group.id}`] || 'skip';
    
    switch (resolution) {
      case 'skip':
        // Don't import this group
        break;
      case 'overwrite':
        // Use the import data (will replace existing)
        resolvedGroups.push(group);
        break;
      case 'rename':
        // Generate new ID and rename
        const newId = uuidv4();
        const newName = generateUniqueName(group.name, importData.groups.map(g => g.name));
        idMapping.set(group.id, newId);
        resolvedGroups.push({
          ...group,
          id: newId,
          name: newName
        });
        break;
    }
  });

  // Resolve template conflicts
  importData.templates?.forEach(template => {
    const conflict = conflicts.templates.find(c => c.importItem.id === template.id);
    
    // Update groupId if the group was renamed
    let groupId = template.groupId;
    if (idMapping.has(groupId)) {
      groupId = idMapping.get(groupId);
    }

    if (!conflict) {
      resolvedTemplates.push({ ...template, groupId });
      return;
    }

    const resolution = resolutions[`template_${template.id}`] || 'skip';
    
    switch (resolution) {
      case 'skip':
        // Don't import this template
        break;
      case 'overwrite':
        // Use the import data (will replace existing)
        resolvedTemplates.push({ ...template, groupId });
        break;
      case 'rename':
        // Generate new ID and rename
        const newId = uuidv4();
        const newLabel = generateUniqueName(template.label, importData.templates.map(t => t.label));
        resolvedTemplates.push({
          ...template,
          id: newId,
          label: newLabel,
          groupId
        });
        break;
    }
  });

  return {
    ...importData,
    groups: resolvedGroups,
    templates: resolvedTemplates
  };
}

/**
 * Generates a unique name by appending a number
 * @param {string} baseName - Base name
 * @param {Array} existingNames - Array of existing names
 * @returns {string} - Unique name
 */
function generateUniqueName(baseName, existingNames) {
  const lowerNames = new Set(existingNames.map(n => n.toLowerCase()));
  
  if (!lowerNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let counter = 1;
  let newName;
  do {
    newName = `${baseName} (${counter})`;
    counter++;
  } while (lowerNames.has(newName.toLowerCase()));

  return newName;
}

/**
 * Processes imported templates to restore media files
 * @param {Array} templates - Templates with embedded media
 * @param {string} accountId - Target account ID
 * @returns {Promise<Array>} - Processed templates with restored media paths
 */
async function processImportedMedia(templates, accountId) {
  const processedTemplates = [];

  for (const template of templates) {
    const processedTemplate = { ...template };

    // Restore media from Base64 if present
    if (template.content?.mediaBase64 && template.content?.mediaFileName) {
      try {
        const extension = path.extname(template.content.mediaFileName);
        const newPath = await base64ToFile(
          template.content.mediaBase64,
          accountId,
          template.id,
          extension
        );
        
        processedTemplate.content = {
          ...template.content,
          mediaPath: newPath
        };
        
        // Remove Base64 data from stored template
        delete processedTemplate.content.mediaBase64;
        delete processedTemplate.content.mediaFileName;
      } catch (err) {
        console.warn(`Warning: Could not restore media for template ${template.id}:`, err.message);
      }
    }

    processedTemplates.push(processedTemplate);
  }

  return processedTemplates;
}

/**
 * Imports data from a ZIP file
 * @param {string} zipPath - Path to ZIP file
 * @param {string} accountId - Target account ID
 * @returns {Promise<Object>} - Imported data
 */
async function importFromZIP(zipPath, accountId) {
  if (!unzipper) {
    throw new ImportError('ZIP导入功能不可用');
  }

  return new Promise(async (resolve, reject) => {
    try {
      const mediaDir = await ensureMediaDirectory(accountId);
      let jsonData = null;

      const directory = await unzipper.Open.file(zipPath);
      
      for (const entry of directory.files) {
        if (entry.path === 'data.json') {
          const content = await entry.buffer();
          jsonData = JSON.parse(content.toString());
        } else if (entry.path.startsWith('media/')) {
          // Extract media file
          const fileName = path.basename(entry.path);
          const destPath = path.join(mediaDir, fileName);
          const content = await entry.buffer();
          await fs.writeFile(destPath, content);
        }
      }

      if (!jsonData) {
        throw new ImportError('ZIP文件中未找到数据文件');
      }

      resolve(jsonData);
    } catch (error) {
      reject(new ImportError(`导入ZIP失败: ${error.message}`));
    }
  });
}

/**
 * Creates an import result report
 * @param {Object} result - Import result
 * @returns {Object} - Import report
 */
function createImportReport(result) {
  return {
    success: result.success,
    timestamp: new Date().toISOString(),
    summary: {
      groupsImported: result.groupsImported || 0,
      groupsSkipped: result.groupsSkipped || 0,
      groupsFailed: result.groupsFailed || 0,
      templatesImported: result.templatesImported || 0,
      templatesSkipped: result.templatesSkipped || 0,
      templatesFailed: result.templatesFailed || 0
    },
    errors: result.errors || [],
    warnings: result.warnings || []
  };
}

module.exports = {
  validateImportData,
  detectConflicts,
  resolveConflicts,
  generateUniqueName,
  processImportedMedia,
  importFromZIP,
  createImportReport
};
