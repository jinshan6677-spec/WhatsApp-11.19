/**
 * SyncManager
 * 
 * Manages data synchronization between sidebar and management window.
 * Implements publish-subscribe pattern for real-time data updates.
 * 
 * Requirements: 1.2.1-1.2.7
 */

const EventEmitter = require('events');
const { Logger } = require('../utils/logger');

/**
 * Event types for synchronization
 */
const SYNC_EVENTS = {
  // Content events
  CONTENT_ADDED: 'content:added',
  CONTENT_DELETED: 'content:deleted',
  CONTENT_UPDATED: 'content:updated',
  CONTENT_MOVED: 'content:moved',
  
  // Group events
  GROUP_CREATED: 'group:created',
  GROUP_DELETED: 'group:deleted',
  GROUP_UPDATED: 'group:updated',
  GROUP_MOVED: 'group:moved',
  
  // Statistics events
  USAGE_UPDATED: 'usage:updated',
  
  // General events
  DATA_REFRESHED: 'data:refreshed',
  SYNC_ERROR: 'sync:error'
};

class SyncManager extends EventEmitter {
  /**
   * @param {string} accountId - The WhatsApp account ID
   */
  constructor(accountId) {
    super();
    
    if (!accountId) {
      throw new Error('accountId is required');
    }
    
    this.accountId = accountId;
    this.logger = new Logger('SyncManager');
    this.subscribers = new Map(); // Map of subscriberId -> callback
    this.subscriberCounter = 0;
    
    // Track sync state
    this.isSyncing = false;
    this.pendingUpdates = [];
    
    this.logger.info('SyncManager initialized', { accountId });
  }

  /**
   * Subscribe to data changes
   * @param {Function} callback - Callback function (event, data) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    const subscriberId = ++this.subscriberCounter;
    this.subscribers.set(subscriberId, callback);
    
    this.logger.debug('Subscriber added', { subscriberId, totalSubscribers: this.subscribers.size });
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(subscriberId);
      this.logger.debug('Subscriber removed', { subscriberId, totalSubscribers: this.subscribers.size });
    };
  }

  /**
   * Notify all subscribers of a change
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notify(event, data) {
    const eventData = {
      event,
      data,
      timestamp: Date.now(),
      accountId: this.accountId
    };
    
    this.logger.debug('Notifying subscribers', { event, subscriberCount: this.subscribers.size });
    
    // Notify all subscribers
    this.subscribers.forEach((callback, subscriberId) => {
      try {
        callback(event, eventData);
      } catch (error) {
        this.logger.error('Subscriber callback error', { subscriberId, event, error: error.message });
      }
    });
    
    // Also emit as EventEmitter event
    this.emit(event, eventData);
  }

  // ==================== Content Sync Methods ====================

  /**
   * Sync content addition
   * Requirement: 1.2.1
   * @param {Object} content - Added content
   */
  syncContentAdded(content) {
    if (!content || !content.id) {
      this.logger.warn('Invalid content for syncContentAdded');
      return;
    }
    
    this.logger.info('Syncing content added', { contentId: content.id, groupId: content.groupId });
    
    this.notify(SYNC_EVENTS.CONTENT_ADDED, {
      content,
      action: 'add'
    });
  }

  /**
   * Sync content deletion
   * Requirement: 1.2.2
   * @param {string} contentId - Deleted content ID
   * @param {string} groupId - Group ID the content belonged to
   */
  syncContentDeleted(contentId, groupId) {
    if (!contentId) {
      this.logger.warn('Invalid contentId for syncContentDeleted');
      return;
    }
    
    this.logger.info('Syncing content deleted', { contentId, groupId });
    
    this.notify(SYNC_EVENTS.CONTENT_DELETED, {
      contentId,
      groupId,
      action: 'delete'
    });
  }

  /**
   * Sync content update
   * Requirement: 1.2.5
   * @param {Object} content - Updated content
   * @param {Object} changes - What changed
   */
  syncContentUpdated(content, changes = {}) {
    if (!content || !content.id) {
      this.logger.warn('Invalid content for syncContentUpdated');
      return;
    }
    
    this.logger.info('Syncing content updated', { contentId: content.id, changes: Object.keys(changes) });
    
    this.notify(SYNC_EVENTS.CONTENT_UPDATED, {
      content,
      changes,
      action: 'update'
    });
  }

  /**
   * Sync content move to different group
   * Requirement: 1.2.5
   * @param {string} contentId - Content ID
   * @param {string} fromGroupId - Source group ID
   * @param {string} toGroupId - Target group ID
   */
  syncContentMoved(contentId, fromGroupId, toGroupId) {
    if (!contentId || !toGroupId) {
      this.logger.warn('Invalid parameters for syncContentMoved');
      return;
    }
    
    this.logger.info('Syncing content moved', { contentId, fromGroupId, toGroupId });
    
    this.notify(SYNC_EVENTS.CONTENT_MOVED, {
      contentId,
      fromGroupId,
      toGroupId,
      action: 'move'
    });
  }

  // ==================== Group Sync Methods ====================

  /**
   * Sync group creation
   * Requirement: 1.2.3
   * @param {Object} group - Created group
   */
  syncGroupCreated(group) {
    if (!group || !group.id) {
      this.logger.warn('Invalid group for syncGroupCreated');
      return;
    }
    
    this.logger.info('Syncing group created', { groupId: group.id, name: group.name });
    
    this.notify(SYNC_EVENTS.GROUP_CREATED, {
      group,
      action: 'create'
    });
  }

  /**
   * Sync group deletion
   * Requirement: 1.2.3
   * @param {string} groupId - Deleted group ID
   * @param {string} groupName - Group name (for logging)
   */
  syncGroupDeleted(groupId, groupName = '') {
    if (!groupId) {
      this.logger.warn('Invalid groupId for syncGroupDeleted');
      return;
    }
    
    this.logger.info('Syncing group deleted', { groupId, groupName });
    
    this.notify(SYNC_EVENTS.GROUP_DELETED, {
      groupId,
      groupName,
      action: 'delete'
    });
  }

  /**
   * Sync group update (rename, etc.)
   * Requirement: 1.2.3
   * @param {Object} group - Updated group
   * @param {Object} changes - What changed
   */
  syncGroupUpdated(group, changes = {}) {
    if (!group || !group.id) {
      this.logger.warn('Invalid group for syncGroupUpdated');
      return;
    }
    
    this.logger.info('Syncing group updated', { groupId: group.id, changes: Object.keys(changes) });
    
    this.notify(SYNC_EVENTS.GROUP_UPDATED, {
      group,
      changes,
      action: 'update'
    });
  }

  /**
   * Sync group move (reorder or change parent)
   * Requirement: 1.2.3
   * @param {string} groupId - Group ID
   * @param {string|null} fromParentId - Source parent ID
   * @param {string|null} toParentId - Target parent ID
   * @param {number} newOrder - New order position
   */
  syncGroupMoved(groupId, fromParentId, toParentId, newOrder) {
    if (!groupId) {
      this.logger.warn('Invalid groupId for syncGroupMoved');
      return;
    }
    
    this.logger.info('Syncing group moved', { groupId, fromParentId, toParentId, newOrder });
    
    this.notify(SYNC_EVENTS.GROUP_MOVED, {
      groupId,
      fromParentId,
      toParentId,
      newOrder,
      action: 'move'
    });
  }

  // ==================== Statistics Sync Methods ====================

  /**
   * Sync usage statistics update
   * Requirement: 1.2.4
   * @param {string} contentId - Content ID
   * @param {number} usageCount - New usage count
   * @param {number} lastUsedAt - Last used timestamp
   */
  syncUsageUpdated(contentId, usageCount, lastUsedAt) {
    if (!contentId) {
      this.logger.warn('Invalid contentId for syncUsageUpdated');
      return;
    }
    
    this.logger.debug('Syncing usage updated', { contentId, usageCount });
    
    this.notify(SYNC_EVENTS.USAGE_UPDATED, {
      contentId,
      usageCount,
      lastUsedAt,
      action: 'usage'
    });
  }

  // ==================== General Sync Methods ====================

  /**
   * Sync full data refresh
   * Requirement: 1.2.6
   * @param {Object} data - Full data object { groups, templates }
   */
  syncDataRefreshed(data) {
    this.logger.info('Syncing full data refresh', { 
      groupsCount: data.groups?.length || 0, 
      templatesCount: data.templates?.length || 0 
    });
    
    this.notify(SYNC_EVENTS.DATA_REFRESHED, {
      groups: data.groups || [],
      templates: data.templates || [],
      action: 'refresh'
    });
  }

  /**
   * Notify sync error
   * Requirement: 1.2.6
   * @param {Error} error - Error object
   * @param {string} context - Error context
   */
  syncError(error, context = '') {
    this.logger.error('Sync error', { context, error: error.message });
    
    this.notify(SYNC_EVENTS.SYNC_ERROR, {
      error: error.message,
      context,
      action: 'error'
    });
  }

  // ==================== Utility Methods ====================

  /**
   * Get subscriber count
   * @returns {number} Number of active subscribers
   */
  getSubscriberCount() {
    return this.subscribers.size;
  }

  /**
   * Check if there are any subscribers
   * @returns {boolean} True if there are subscribers
   */
  hasSubscribers() {
    return this.subscribers.size > 0;
  }

  /**
   * Clear all subscribers
   */
  clearSubscribers() {
    this.subscribers.clear();
    this.logger.info('All subscribers cleared');
  }

  /**
   * Destroy the sync manager
   */
  destroy() {
    this.clearSubscribers();
    this.removeAllListeners();
    this.logger.info('SyncManager destroyed');
  }
}

// Export the class and event types
module.exports = SyncManager;
module.exports.SYNC_EVENTS = SYNC_EVENTS;
