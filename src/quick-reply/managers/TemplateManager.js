/**
 * TemplateManager
 * 
 * Manages template CRUD operations, validation, and business logic.
 * 
 * Requirements: 3.1-3.13, 5.1-5.5, 13.1-13.10, 15.1-15.7, 29.1-29.8
 */

const TemplateStorage = require('../storage/TemplateStorage');
const Template = require('../models/Template');
const ValidationError = require('../errors/ValidationError');
const { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS, LIMITS } = require('../constants');
const { validateTemplateLabel, validateMediaFile } = require('../utils/validation');
const { Logger } = require('../utils/logger');

class TemplateManager {
  /**
   * @param {string} accountId - The WhatsApp account ID
   * @param {string} [userDataPath] - Optional user data path (for testing)
   */
  constructor(accountId, userDataPath = null) {
    if (!accountId) {
      throw new Error('accountId is required');
    }
    
    this.accountId = accountId;
    this.storage = new TemplateStorage(accountId, userDataPath);
    this.logger = new Logger('TemplateManager');
  }

  /**
   * Create a new template
   * @param {string} groupId - Group ID
   * @param {string} type - Template type
   * @param {string} label - Template label (optional, will generate default if empty)
   * @param {Object} content - Template content
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(groupId, type, label, content) {
    try {
      // Validate inputs
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      if (!type || !Object.values(TEMPLATE_TYPES).includes(type)) {
        throw new ValidationError(`Invalid template type: ${type}`, 'type');
      }
      
      // Generate default label if not provided
      const finalLabel = label && label.trim() ? label.trim() : this.generateDefaultLabel(type);
      
      // Validate label
      validateTemplateLabel(finalLabel);
      
      // Validate content based on type
      this.validateTemplate(type, content);
      
      // Get existing templates in group to determine order
      const groupTemplates = await this.storage.getByGroup(groupId);
      const maxOrder = groupTemplates.length > 0 
        ? Math.max(...groupTemplates.map(t => t.order || 0))
        : 0;
      
      // Create template instance
      const template = new Template({
        groupId,
        type,
        label: finalLabel,
        content,
        order: maxOrder + 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        lastUsedAt: null
      });
      
      // Validate template
      const validation = template.validate();
      if (!validation.valid) {
        throw new ValidationError(validation.errors.join(', '));
      }
      
      // Save to storage
      const saved = await this.storage.save(template.toJSON());
      
      this.logger.info('Template created', { templateId: saved.id, groupId, type });
      
      return saved;
    } catch (error) {
      this.logger.error('Failed to create template', error);
      throw error;
    }
  }

  /**
   * Get a template by ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object|null>} Template or null if not found
   */
  async getTemplate(templateId) {
    try {
      if (!templateId) {
        throw new ValidationError('Template ID is required', 'templateId');
      }
      
      return await this.storage.get(templateId);
    } catch (error) {
      this.logger.error('Failed to get template', error);
      throw error;
    }
  }

  /**
   * Update a template
   * @param {string} templateId - Template ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object|null>} Updated template or null if not found
   */
  async updateTemplate(templateId, updates) {
    try {
      if (!templateId) {
        throw new ValidationError('Template ID is required', 'templateId');
      }
      
      // Get existing template
      const existing = await this.storage.get(templateId);
      if (!existing) {
        return null;
      }
      
      // Validate updates
      if (updates.label !== undefined) {
        validateTemplateLabel(updates.label);
      }
      
      if (updates.type !== undefined && !Object.values(TEMPLATE_TYPES).includes(updates.type)) {
        throw new ValidationError(`Invalid template type: ${updates.type}`, 'type');
      }
      
      if (updates.content !== undefined && updates.type !== undefined) {
        this.validateTemplate(updates.type, updates.content);
      } else if (updates.content !== undefined) {
        this.validateTemplate(existing.type, updates.content);
      }
      
      // Apply updates
      const updated = await this.storage.update(templateId, {
        ...updates,
        updatedAt: Date.now()
      });
      
      this.logger.info('Template updated', { templateId });
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to update template', error);
      throw error;
    }
  }

  /**
   * Delete a template
   * @param {string} templateId - Template ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteTemplate(templateId) {
    try {
      if (!templateId) {
        throw new ValidationError('Template ID is required', 'templateId');
      }
      
      const deleted = await this.storage.delete(templateId);
      
      if (deleted) {
        this.logger.info('Template deleted', { templateId });
      }
      
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete template', error);
      throw error;
    }
  }

  /**
   * Get all templates in a group
   * @param {string} groupId - Group ID
   * @returns {Promise<Array>} Templates sorted by order
   */
  async getTemplatesByGroup(groupId) {
    try {
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      const templates = await this.storage.getByGroup(groupId);
      
      // Sort by order
      return templates.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      this.logger.error('Failed to get templates by group', error);
      throw error;
    }
  }

  /**
   * Get templates by type
   * @param {string} groupId - Group ID
   * @param {string} type - Template type
   * @returns {Promise<Array>} Templates of specified type
   */
  async getTemplatesByType(groupId, type) {
    try {
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      if (!type || !Object.values(TEMPLATE_TYPES).includes(type)) {
        throw new ValidationError(`Invalid template type: ${type}`, 'type');
      }
      
      const templates = await this.storage.getByGroup(groupId);
      
      // Filter by type and sort by order
      return templates
        .filter(t => t.type === type)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      this.logger.error('Failed to get templates by type', error);
      throw error;
    }
  }

  /**
   * Move template to another group
   * @param {string} templateId - Template ID
   * @param {string} targetGroupId - Target group ID
   * @returns {Promise<Object|null>} Updated template or null if not found
   */
  async moveTemplate(templateId, targetGroupId) {
    try {
      if (!templateId) {
        throw new ValidationError('Template ID is required', 'templateId');
      }
      
      if (!targetGroupId) {
        throw new ValidationError('Target group ID is required', 'targetGroupId');
      }
      
      // Get existing template
      const existing = await this.storage.get(templateId);
      if (!existing) {
        return null;
      }
      
      // Get templates in target group to determine new order
      const targetTemplates = await this.storage.getByGroup(targetGroupId);
      const maxOrder = targetTemplates.length > 0
        ? Math.max(...targetTemplates.map(t => t.order || 0))
        : 0;
      
      // Update template
      const updated = await this.storage.update(templateId, {
        groupId: targetGroupId,
        order: maxOrder + 1,
        updatedAt: Date.now()
      });
      
      this.logger.info('Template moved', { templateId, targetGroupId });
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to move template', error);
      throw error;
    }
  }

  /**
   * Reorder template within group
   * @param {string} templateId - Template ID
   * @param {number} newIndex - New index position (0-based)
   * @returns {Promise<Object|null>} Updated template or null if not found
   */
  async reorderTemplate(templateId, newIndex) {
    try {
      if (!templateId) {
        throw new ValidationError('Template ID is required', 'templateId');
      }
      
      if (typeof newIndex !== 'number' || newIndex < 0) {
        throw new ValidationError('New index must be a non-negative number', 'newIndex');
      }
      
      // Get existing template
      const existing = await this.storage.get(templateId);
      if (!existing) {
        return null;
      }
      
      // Get all templates in the same group
      const groupTemplates = await this.storage.getByGroup(existing.groupId);
      const sortedTemplates = groupTemplates.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Find current index
      const currentIndex = sortedTemplates.findIndex(t => t.id === templateId);
      if (currentIndex < 0) {
        return null;
      }
      
      // Validate new index
      if (newIndex >= sortedTemplates.length) {
        newIndex = sortedTemplates.length - 1;
      }
      
      // If no change, return existing
      if (currentIndex === newIndex) {
        return existing;
      }
      
      // Reorder templates
      const [removed] = sortedTemplates.splice(currentIndex, 1);
      sortedTemplates.splice(newIndex, 0, removed);
      
      // Update order for all templates
      for (let i = 0; i < sortedTemplates.length; i++) {
        await this.storage.update(sortedTemplates[i].id, {
          order: i + 1,
          updatedAt: Date.now()
        });
      }
      
      // Get updated template
      const updated = await this.storage.get(templateId);
      
      this.logger.info('Template reordered', { templateId, newIndex });
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to reorder template', error);
      throw error;
    }
  }

  /**
   * Batch delete templates
   * @param {Array<string>} templateIds - Template IDs
   * @returns {Promise<number>} Number of templates deleted
   */
  async batchDeleteTemplates(templateIds) {
    try {
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        throw new ValidationError('Template IDs array is required', 'templateIds');
      }
      
      const deletedCount = await this.storage.batchDelete(templateIds);
      
      this.logger.info('Templates batch deleted', { count: deletedCount });
      
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to batch delete templates', error);
      throw error;
    }
  }

  /**
   * Batch move templates
   * @param {Array<string>} templateIds - Template IDs
   * @param {string} targetGroupId - Target group ID
   * @returns {Promise<number>} Number of templates moved
   */
  async batchMoveTemplates(templateIds, targetGroupId) {
    try {
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        throw new ValidationError('Template IDs array is required', 'templateIds');
      }
      
      if (!targetGroupId) {
        throw new ValidationError('Target group ID is required', 'targetGroupId');
      }
      
      let movedCount = 0;
      
      // Get templates in target group to determine starting order
      const targetTemplates = await this.storage.getByGroup(targetGroupId);
      let maxOrder = targetTemplates.length > 0
        ? Math.max(...targetTemplates.map(t => t.order || 0))
        : 0;
      
      // Move each template
      for (const templateId of templateIds) {
        const existing = await this.storage.get(templateId);
        if (existing) {
          await this.storage.update(templateId, {
            groupId: targetGroupId,
            order: ++maxOrder,
            updatedAt: Date.now()
          });
          movedCount++;
        }
      }
      
      this.logger.info('Templates batch moved', { count: movedCount, targetGroupId });
      
      return movedCount;
    } catch (error) {
      this.logger.error('Failed to batch move templates', error);
      throw error;
    }
  }

  /**
   * Validate template content
   * @param {string} type - Template type
   * @param {Object} content - Template content
   * @returns {boolean} Is valid (throws ValidationError if invalid)
   */
  validateTemplate(type, content) {
    if (!content || typeof content !== 'object') {
      throw new ValidationError('Template content is required', 'content');
    }
    
    switch (type) {
      case TEMPLATE_TYPES.TEXT:
        if (!content.text || typeof content.text !== 'string' || content.text.trim().length === 0) {
          throw new ValidationError('Text content is required for text templates', 'content.text');
        }
        break;
        
      case TEMPLATE_TYPES.IMAGE:
      case TEMPLATE_TYPES.AUDIO:
      case TEMPLATE_TYPES.VIDEO:
        if (!content.mediaPath || typeof content.mediaPath !== 'string') {
          throw new ValidationError(`Media path is required for ${type} templates`, 'content.mediaPath');
        }
        break;
        
      case TEMPLATE_TYPES.MIXED:
        if (!content.text || typeof content.text !== 'string' || content.text.trim().length === 0) {
          throw new ValidationError('Text content is required for mixed templates', 'content.text');
        }
        if (!content.mediaPath || typeof content.mediaPath !== 'string') {
          throw new ValidationError('Media path is required for mixed templates', 'content.mediaPath');
        }
        break;
        
      case TEMPLATE_TYPES.CONTACT:
        if (!content.contactInfo || typeof content.contactInfo !== 'object') {
          throw new ValidationError('Contact info is required for contact templates', 'content.contactInfo');
        }
        if (!content.contactInfo.name || typeof content.contactInfo.name !== 'string') {
          throw new ValidationError('Contact name is required', 'content.contactInfo.name');
        }
        if (!content.contactInfo.phone || typeof content.contactInfo.phone !== 'string') {
          throw new ValidationError('Contact phone is required', 'content.contactInfo.phone');
        }
        break;
        
      default:
        throw new ValidationError(`Unknown template type: ${type}`, 'type');
    }
    
    return true;
  }

  /**
   * Generate default label for template
   * @param {string} type - Template type
   * @returns {string} Default label
   */
  generateDefaultLabel(type) {
    const labels = {
      [TEMPLATE_TYPES.TEXT]: '新模板',
      [TEMPLATE_TYPES.IMAGE]: '图片模板',
      [TEMPLATE_TYPES.AUDIO]: '音频模板',
      [TEMPLATE_TYPES.VIDEO]: '视频模板',
      [TEMPLATE_TYPES.MIXED]: '图文模板',
      [TEMPLATE_TYPES.CONTACT]: '名片模板'
    };
    
    return labels[type] || '新模板';
  }

  /**
   * Record template usage
   * @param {string} templateId - Template ID
   * @returns {Promise<Object|null>} Updated template or null if not found
   */
  async recordUsage(templateId) {
    try {
      if (!templateId) {
        throw new ValidationError('Template ID is required', 'templateId');
      }
      
      const existing = await this.storage.get(templateId);
      if (!existing) {
        return null;
      }
      
      // Increment usage count and update last used timestamp
      const updated = await this.storage.update(templateId, {
        usageCount: (existing.usageCount || 0) + 1,
        lastUsedAt: Date.now(),
        updatedAt: Date.now()
      });
      
      this.logger.debug('Template usage recorded', { templateId });
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to record template usage', error);
      throw error;
    }
  }

  /**
   * Get template usage statistics
   * @param {string} templateId - Template ID
   * @returns {Promise<Object|null>} Usage stats or null if not found
   */
  async getUsageStats(templateId) {
    try {
      if (!templateId) {
        throw new ValidationError('Template ID is required', 'templateId');
      }
      
      const template = await this.storage.get(templateId);
      if (!template) {
        return null;
      }
      
      return {
        templateId: template.id,
        label: template.label,
        usageCount: template.usageCount || 0,
        lastUsedAt: template.lastUsedAt,
        createdAt: template.createdAt
      };
    } catch (error) {
      this.logger.error('Failed to get template usage stats', error);
      throw error;
    }
  }
}

module.exports = TemplateManager;
