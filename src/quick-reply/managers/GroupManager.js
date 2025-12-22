/**
 * GroupManager
 * 
 * Manages group CRUD operations and hierarchical structure.
 * 
 * Requirements: 2.1-2.11, 19.1-19.7, 23.1-23.9
 */

const GroupStorage = require('../storage/GroupStorage');
const TemplateStorage = require('../storage/TemplateStorage');
const Group = require('../models/Group');
const ValidationError = require('../errors/ValidationError');
const { Logger } = require('../utils/logger');

class GroupManager {
  /**
   * @param {string} accountId - The WhatsApp account ID
   * @param {string} [userDataPath] - Optional user data path (for testing)
   */
  constructor(accountId, userDataPath = null) {
    if (!accountId) {
      throw new Error('accountId is required');
    }
    
    this.accountId = accountId;
    this.storage = new GroupStorage(accountId, userDataPath);
    this.templateStorage = new TemplateStorage(accountId, userDataPath);
    this.logger = new Logger('GroupManager');
  }

  /**
   * Generate default group name "新分组N" where N is the next available number
   * @returns {Promise<string>} Generated default name
   */
  async generateDefaultGroupName() {
    try {
      const allGroups = await this.storage.getAll();
      
      // Find all existing "新分组N" names and extract the numbers
      const pattern = /^新分组(\d+)$/;
      const existingNumbers = allGroups
        .map(g => {
          const match = g.name.match(pattern);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => n > 0);
      
      // Find the maximum number used
      const maxNumber = existingNumbers.length > 0 
        ? Math.max(...existingNumbers) 
        : 0;
      
      // Return the next number
      return `新分组${maxNumber + 1}`;
    } catch (error) {
      this.logger.error('Failed to generate default group name', error);
      // Fallback to timestamp-based name
      return `新分组${Date.now()}`;
    }
  }

  /**
   * Create a new group
   * @param {string} [name] - Group name (optional, will generate default if not provided)
   * @param {string|null} parentId - Parent group ID (null for top-level)
   * @returns {Promise<Object>} Created group
   */
  async createGroup(name, parentId = null) {
    try {
      let finalName;
      
      // If no name provided or empty, generate default name
      if (!name || name.trim().length === 0) {
        finalName = await this.generateDefaultGroupName();
      } else {
        finalName = name.trim();
      }
      
      if (finalName.length > 100) {
        throw new ValidationError('Group name exceeds maximum length of 100 characters', 'name');
      }
      
      // Validate parent exists if provided
      if (parentId) {
        const parent = await this.storage.get(parentId);
        if (!parent) {
          throw new ValidationError('Parent group not found', 'parentId');
        }
      }
      
      // Get siblings to determine order
      const siblings = await this.storage.getChildren(parentId);
      const maxOrder = siblings.length > 0
        ? Math.max(...siblings.map(g => g.order || 0))
        : 0;
      
      // Create group instance
      const group = new Group({
        name: finalName,
        parentId,
        order: maxOrder + 1,
        expanded: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      // Validate group
      const validation = group.validate();
      if (!validation.valid) {
        throw new ValidationError(validation.errors.join(', '));
      }
      
      // Save to storage
      const saved = await this.storage.save(group.toJSON());
      
      this.logger.info('Group created', { groupId: saved.id, name: finalName, parentId });
      
      return saved;
    } catch (error) {
      this.logger.error('Failed to create group', error);
      throw error;
    }
  }

  /**
   * Get a group by ID
   * @param {string} groupId - Group ID
   * @returns {Promise<Object|null>} Group or null if not found
   */
  async getGroup(groupId) {
    try {
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      return await this.storage.get(groupId);
    } catch (error) {
      this.logger.error('Failed to get group', error);
      throw error;
    }
  }

  /**
   * Update a group
   * @param {string} groupId - Group ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object|null>} Updated group or null if not found
   */
  async updateGroup(groupId, updates) {
    try {
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      // Get existing group
      const existing = await this.storage.get(groupId);
      if (!existing) {
        return null;
      }
      
      // Validate updates
      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim().length === 0) {
          throw new ValidationError('Group name cannot be empty', 'name');
        }
        if (updates.name.length > 100) {
          throw new ValidationError('Group name exceeds maximum length of 100 characters', 'name');
        }
      }
      
      if (updates.parentId !== undefined && updates.parentId !== null) {
        // Check parent exists
        const parent = await this.storage.get(updates.parentId);
        if (!parent) {
          throw new ValidationError('Parent group not found', 'parentId');
        }
        
        // Prevent circular reference
        if (updates.parentId === groupId) {
          throw new ValidationError('Group cannot be its own parent', 'parentId');
        }
        
        // Check if new parent is a descendant
        const descendants = await this.storage.getDescendants(groupId);
        if (descendants.some(d => d.id === updates.parentId)) {
          throw new ValidationError('Cannot move group to its own descendant', 'parentId');
        }
      }
      
      // Apply updates
      const updated = await this.storage.update(groupId, {
        ...updates,
        updatedAt: Date.now()
      });
      
      this.logger.info('Group updated', { groupId });
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to update group', error);
      throw error;
    }
  }

  /**
   * Delete a group (also deletes all templates in the group)
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteGroup(groupId) {
    try {
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      // Get all descendants
      const descendants = await this.storage.getDescendants(groupId);
      const allGroupIds = [groupId, ...descendants.map(d => d.id)];
      
      // Delete all templates in these groups
      for (const gid of allGroupIds) {
        const templates = await this.templateStorage.getByGroup(gid);
        const templateIds = templates.map(t => t.id);
        if (templateIds.length > 0) {
          await this.templateStorage.batchDelete(templateIds);
        }
      }
      
      // Delete the group (which will also delete child groups)
      const deleted = await this.storage.delete(groupId);
      
      if (deleted) {
        this.logger.info('Group deleted', { groupId, descendantsCount: descendants.length });
      }
      
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete group', error);
      throw error;
    }
  }

  /**
   * Get all groups
   * @returns {Promise<Array>} All groups sorted by order
   */
  async getAllGroups() {
    try {
      const groups = await this.storage.getAll();
      
      // Sort by order
      return groups.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      this.logger.error('Failed to get all groups', error);
      throw error;
    }
  }

  /**
   * Get child groups
   * @param {string|null} parentId - Parent group ID (null for top-level groups)
   * @returns {Promise<Array>} Child groups sorted by order
   */
  async getChildGroups(parentId) {
    try {
      const children = await this.storage.getChildren(parentId);
      
      // Sort by order
      return children.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      this.logger.error('Failed to get child groups', error);
      throw error;
    }
  }

  /**
   * Move group to new parent
   * @param {string} groupId - Group ID
   * @param {string|null} newParentId - New parent group ID (null for top-level)
   * @returns {Promise<Object|null>} Updated group or null if not found
   */
  async moveGroup(groupId, newParentId) {
    try {
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      // Get existing group
      const existing = await this.storage.get(groupId);
      if (!existing) {
        return null;
      }
      
      // Validate new parent
      if (newParentId !== null) {
        // Check parent exists
        const parent = await this.storage.get(newParentId);
        if (!parent) {
          throw new ValidationError('Parent group not found', 'newParentId');
        }
        
        // Prevent circular reference
        if (newParentId === groupId) {
          throw new ValidationError('Group cannot be its own parent', 'newParentId');
        }
        
        // Check if new parent is a descendant
        const descendants = await this.storage.getDescendants(groupId);
        if (descendants.some(d => d.id === newParentId)) {
          throw new ValidationError('Cannot move group to its own descendant', 'newParentId');
        }
      }
      
      // Get siblings in new parent to determine order
      const siblings = await this.storage.getChildren(newParentId);
      const maxOrder = siblings.length > 0
        ? Math.max(...siblings.map(g => g.order || 0))
        : 0;
      
      // Update group
      const updated = await this.storage.update(groupId, {
        parentId: newParentId,
        order: maxOrder + 1,
        updatedAt: Date.now()
      });
      
      this.logger.info('Group moved', { groupId, newParentId });
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to move group', error);
      throw error;
    }
  }

  /**
   * Reorder group within same level
   * @param {string} groupId - Group ID
   * @param {number} newIndex - New index position (0-based)
   * @returns {Promise<Object|null>} Updated group or null if not found
   */
  async reorderGroup(groupId, newIndex) {
    try {
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      if (typeof newIndex !== 'number' || newIndex < 0) {
        throw new ValidationError('New index must be a non-negative number', 'newIndex');
      }
      
      // Get existing group
      const existing = await this.storage.get(groupId);
      if (!existing) {
        return null;
      }
      
      // Get all siblings (groups with same parent)
      const siblings = await this.storage.getChildren(existing.parentId);
      const sortedSiblings = siblings.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Find current index
      const currentIndex = sortedSiblings.findIndex(g => g.id === groupId);
      if (currentIndex < 0) {
        return null;
      }
      
      // Validate new index
      if (newIndex >= sortedSiblings.length) {
        newIndex = sortedSiblings.length - 1;
      }
      
      // If no change, return existing
      if (currentIndex === newIndex) {
        return existing;
      }
      
      // Reorder groups
      const [removed] = sortedSiblings.splice(currentIndex, 1);
      sortedSiblings.splice(newIndex, 0, removed);
      
      // Update order for all siblings
      for (let i = 0; i < sortedSiblings.length; i++) {
        await this.storage.update(sortedSiblings[i].id, {
          order: i + 1,
          updatedAt: Date.now()
        });
      }
      
      // Get updated group
      const updated = await this.storage.get(groupId);
      
      this.logger.info('Group reordered', { groupId, newIndex });
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to reorder group', error);
      throw error;
    }
  }

  /**
   * Toggle group expanded state
   * @param {string} groupId - Group ID
   * @returns {Promise<Object|null>} Updated group or null if not found
   */
  async toggleExpanded(groupId) {
    try {
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      const existing = await this.storage.get(groupId);
      if (!existing) {
        return null;
      }
      
      const updated = await this.storage.update(groupId, {
        expanded: !existing.expanded,
        updatedAt: Date.now()
      });
      
      this.logger.debug('Group expanded state toggled', { groupId, expanded: updated.expanded });
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to toggle group expanded state', error);
      throw error;
    }
  }

  /**
   * Get group expanded state
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean|null>} Is expanded or null if not found
   */
  async getExpandedState(groupId) {
    try {
      if (!groupId) {
        throw new ValidationError('Group ID is required', 'groupId');
      }
      
      const group = await this.storage.get(groupId);
      if (!group) {
        return null;
      }
      
      return group.expanded !== undefined ? group.expanded : true;
    } catch (error) {
      this.logger.error('Failed to get group expanded state', error);
      throw error;
    }
  }

  /**
   * Batch delete groups (also deletes all templates in the groups)
   * @param {Array<string>} groupIds - Group IDs
   * @returns {Promise<number>} Number of groups deleted
   */
  async batchDeleteGroups(groupIds) {
    try {
      if (!Array.isArray(groupIds) || groupIds.length === 0) {
        throw new ValidationError('Group IDs array is required', 'groupIds');
      }
      
      let deletedCount = 0;
      
      // Delete each group (which will also delete templates and child groups)
      for (const groupId of groupIds) {
        const deleted = await this.deleteGroup(groupId);
        if (deleted) {
          deletedCount++;
        }
      }
      
      this.logger.info('Groups batch deleted', { count: deletedCount });
      
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to batch delete groups', error);
      throw error;
    }
  }
}

module.exports = GroupManager;
