/**
 * StatisticsManager
 * 
 * Manages usage statistics generation and reporting.
 * 
 * Requirements: 15.1-15.7
 */

const TemplateStorage = require('../storage/TemplateStorage');
const { Logger } = require('../utils/logger');
const ValidationError = require('../errors/ValidationError');

class StatisticsManager {
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
    this.logger = new Logger('StatisticsManager');
  }

  /**
   * Generate usage statistics report for all templates
   * @returns {Promise<Object>} Statistics report
   */
  async generateReport() {
    try {
      const allTemplates = await this.storage.getAll();
      
      // Calculate total usage count
      const totalUsageCount = allTemplates.reduce((sum, t) => sum + (t.usageCount || 0), 0);
      
      // Sort templates by usage count (descending)
      const sortedTemplates = allTemplates
        .map(template => ({
          id: template.id,
          groupId: template.groupId,
          type: template.type,
          label: template.label,
          usageCount: template.usageCount || 0,
          usageRate: totalUsageCount > 0 
            ? ((template.usageCount || 0) / totalUsageCount * 100).toFixed(2)
            : '0.00',
          lastUsedAt: template.lastUsedAt,
          createdAt: template.createdAt
        }))
        .sort((a, b) => b.usageCount - a.usageCount);
      
      // Calculate statistics
      const stats = {
        totalTemplates: allTemplates.length,
        totalUsageCount,
        averageUsageCount: allTemplates.length > 0 
          ? (totalUsageCount / allTemplates.length).toFixed(2)
          : '0.00',
        mostUsedTemplate: sortedTemplates.length > 0 ? sortedTemplates[0] : null,
        leastUsedTemplate: sortedTemplates.length > 0 ? sortedTemplates[sortedTemplates.length - 1] : null,
        unusedTemplates: sortedTemplates.filter(t => t.usageCount === 0).length,
        templates: sortedTemplates,
        generatedAt: Date.now()
      };
      
      this.logger.info('Statistics report generated', { 
        totalTemplates: stats.totalTemplates,
        totalUsageCount: stats.totalUsageCount
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate statistics report', error);
      throw error;
    }
  }

  /**
   * Generate usage statistics report for a specific group
   * @param {string} groupId - Group ID
   * @returns {Promise<Object>} Statistics report for the group
   */
  async generateGroupReport(groupId) {
    try {
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      const groupTemplates = await this.storage.getByGroup(groupId);
      
      // Calculate total usage count for the group
      const totalUsageCount = groupTemplates.reduce((sum, t) => sum + (t.usageCount || 0), 0);
      
      // Sort templates by usage count (descending)
      const sortedTemplates = groupTemplates
        .map(template => ({
          id: template.id,
          groupId: template.groupId,
          type: template.type,
          label: template.label,
          usageCount: template.usageCount || 0,
          usageRate: totalUsageCount > 0 
            ? ((template.usageCount || 0) / totalUsageCount * 100).toFixed(2)
            : '0.00',
          lastUsedAt: template.lastUsedAt,
          createdAt: template.createdAt
        }))
        .sort((a, b) => b.usageCount - a.usageCount);
      
      const stats = {
        groupId,
        totalTemplates: groupTemplates.length,
        totalUsageCount,
        averageUsageCount: groupTemplates.length > 0 
          ? (totalUsageCount / groupTemplates.length).toFixed(2)
          : '0.00',
        mostUsedTemplate: sortedTemplates.length > 0 ? sortedTemplates[0] : null,
        leastUsedTemplate: sortedTemplates.length > 0 ? sortedTemplates[sortedTemplates.length - 1] : null,
        unusedTemplates: sortedTemplates.filter(t => t.usageCount === 0).length,
        templates: sortedTemplates,
        generatedAt: Date.now()
      };
      
      this.logger.info('Group statistics report generated', { 
        groupId,
        totalTemplates: stats.totalTemplates,
        totalUsageCount: stats.totalUsageCount
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate group statistics report', error);
      throw error;
    }
  }

  /**
   * Get top N most used templates
   * @param {number} limit - Number of templates to return
   * @returns {Promise<Array>} Top templates
   */
  async getTopTemplates(limit = 10) {
    try {
      if (typeof limit !== 'number' || limit <= 0) {
        throw new ValidationError('Limit must be a positive number', 'limit');
      }
      
      const allTemplates = await this.storage.getAll();
      
      // Calculate total usage count
      const totalUsageCount = allTemplates.reduce((sum, t) => sum + (t.usageCount || 0), 0);
      
      // Sort and limit
      const topTemplates = allTemplates
        .map(template => ({
          id: template.id,
          groupId: template.groupId,
          type: template.type,
          label: template.label,
          usageCount: template.usageCount || 0,
          usageRate: totalUsageCount > 0 
            ? ((template.usageCount || 0) / totalUsageCount * 100).toFixed(2)
            : '0.00',
          lastUsedAt: template.lastUsedAt
        }))
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit);
      
      this.logger.debug('Top templates retrieved', { limit, count: topTemplates.length });
      
      return topTemplates;
    } catch (error) {
      this.logger.error('Failed to get top templates', error);
      throw error;
    }
  }

  /**
   * Get unused templates
   * @returns {Promise<Array>} Unused templates
   */
  async getUnusedTemplates() {
    try {
      const allTemplates = await this.storage.getAll();
      
      const unusedTemplates = allTemplates
        .filter(t => (t.usageCount || 0) === 0)
        .map(template => ({
          id: template.id,
          groupId: template.groupId,
          type: template.type,
          label: template.label,
          createdAt: template.createdAt
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      
      this.logger.debug('Unused templates retrieved', { count: unusedTemplates.length });
      
      return unusedTemplates;
    } catch (error) {
      this.logger.error('Failed to get unused templates', error);
      throw error;
    }
  }

  /**
   * Get recently used templates
   * @param {number} limit - Number of templates to return
   * @returns {Promise<Array>} Recently used templates
   */
  async getRecentlyUsedTemplates(limit = 10) {
    try {
      if (typeof limit !== 'number' || limit <= 0) {
        throw new ValidationError('Limit must be a positive number', 'limit');
      }
      
      const allTemplates = await this.storage.getAll();
      
      const recentTemplates = allTemplates
        .filter(t => t.lastUsedAt)
        .map(template => ({
          id: template.id,
          groupId: template.groupId,
          type: template.type,
          label: template.label,
          usageCount: template.usageCount || 0,
          lastUsedAt: template.lastUsedAt
        }))
        .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
        .slice(0, limit);
      
      this.logger.debug('Recently used templates retrieved', { limit, count: recentTemplates.length });
      
      return recentTemplates;
    } catch (error) {
      this.logger.error('Failed to get recently used templates', error);
      throw error;
    }
  }
}

module.exports = StatisticsManager;
