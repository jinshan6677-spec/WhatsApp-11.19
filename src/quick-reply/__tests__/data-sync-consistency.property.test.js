/**
 * Property-Based Tests for Data Sync Consistency
 * 
 * Feature: enhanced-quick-reply-management, Property 3: 数据同步一致性
 * 
 * Tests the consistency of data synchronization between sidebar and management window.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Requirements: 1.2.1, 1.2.2, 1.2.3, 1.2.5
 */

const fc = require('fast-check');
const SyncManager = require('../managers/SyncManager');
const { SYNC_EVENTS } = require('../managers/SyncManager');

// Test configuration
const NUM_RUNS = 100;

/**
 * Generate a valid template/content object
 */
const contentArbitrary = () => fc.record({
  id: fc.uuid(),
  groupId: fc.uuid(),
  type: fc.constantFrom('text', 'image', 'audio', 'video', 'mixed'),
  visibility: fc.constantFrom('public', 'personal'),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.record({
    text: fc.string({ minLength: 0, maxLength: 200 })
  }),
  order: fc.nat({ max: 1000 }),
  createdAt: fc.nat(),
  updatedAt: fc.nat(),
  usageCount: fc.nat({ max: 1000 }),
  lastUsedAt: fc.option(fc.nat())
});

/**
 * Generate a valid group object
 */
const groupArbitrary = () => fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  parentId: fc.option(fc.uuid()),
  order: fc.nat({ max: 100 }),
  expanded: fc.boolean(),
  createdAt: fc.nat(),
  updatedAt: fc.nat()
});

/**
 * Generate update changes object
 */
const changesArbitrary = () => fc.record({
  label: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  name: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
});

describe('Data Sync Consistency Property-Based Tests', () => {
  let syncManager;
  
  beforeEach(() => {
    syncManager = new SyncManager('test-account-id');
  });
  
  afterEach(() => {
    if (syncManager) {
      syncManager.destroy();
    }
  });

  /**
   * Feature: enhanced-quick-reply-management, Property 3: 数据同步一致性
   * **Validates: Requirements 1.2.1, 1.2.2, 1.2.3, 1.2.5**
   * 
   * For any data modification (add, delete, edit) in the management window,
   * the corresponding data in the sidebar should be immediately updated,
   * maintaining consistency between the two interfaces.
   */
  describe('Property 3: Data Sync Consistency', () => {
    
    /**
     * Property 3a: Content addition sync
     * When content is added, all subscribers receive the add event with correct data
     * Validates: Requirement 1.2.1
     */
    test('Property 3a: Content addition triggers sync notification to all subscribers', () => {
      fc.assert(
        fc.property(
          contentArbitrary(),
          fc.integer({ min: 1, max: 5 }),
          (content, subscriberCount) => {
            const receivedEvents = [];
            const unsubscribers = [];
            
            // Create multiple subscribers
            for (let i = 0; i < subscriberCount; i++) {
              const unsubscribe = syncManager.subscribe((event, data) => {
                receivedEvents.push({ subscriberId: i, event, data });
              });
              unsubscribers.push(unsubscribe);
            }
            
            // Trigger content added sync
            syncManager.syncContentAdded(content);
            
            // Verify all subscribers received the event
            expect(receivedEvents.length).toBe(subscriberCount);
            
            // Verify each subscriber received correct data
            receivedEvents.forEach((received, index) => {
              expect(received.event).toBe(SYNC_EVENTS.CONTENT_ADDED);
              expect(received.data.data.content).toEqual(content);
              expect(received.data.data.action).toBe('add');
            });
            
            // Cleanup
            unsubscribers.forEach(unsub => unsub());
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 3b: Content deletion sync
     * When content is deleted, all subscribers receive the delete event
     * Validates: Requirement 1.2.2
     */
    test('Property 3b: Content deletion triggers sync notification to all subscribers', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 5 }),
          (contentId, groupId, subscriberCount) => {
            const receivedEvents = [];
            const unsubscribers = [];
            
            // Create multiple subscribers
            for (let i = 0; i < subscriberCount; i++) {
              const unsubscribe = syncManager.subscribe((event, data) => {
                receivedEvents.push({ subscriberId: i, event, data });
              });
              unsubscribers.push(unsubscribe);
            }
            
            // Trigger content deleted sync
            syncManager.syncContentDeleted(contentId, groupId);
            
            // Verify all subscribers received the event
            expect(receivedEvents.length).toBe(subscriberCount);
            
            // Verify each subscriber received correct data
            receivedEvents.forEach((received) => {
              expect(received.event).toBe(SYNC_EVENTS.CONTENT_DELETED);
              expect(received.data.data.contentId).toBe(contentId);
              expect(received.data.data.groupId).toBe(groupId);
              expect(received.data.data.action).toBe('delete');
            });
            
            // Cleanup
            unsubscribers.forEach(unsub => unsub());
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 3c: Group change sync
     * When group is modified, all subscribers receive the update event
     * Validates: Requirement 1.2.3
     */
    test('Property 3c: Group changes trigger sync notification to all subscribers', () => {
      fc.assert(
        fc.property(
          groupArbitrary(),
          changesArbitrary(),
          fc.integer({ min: 1, max: 5 }),
          (group, changes, subscriberCount) => {
            const receivedEvents = [];
            const unsubscribers = [];
            
            // Create multiple subscribers
            for (let i = 0; i < subscriberCount; i++) {
              const unsubscribe = syncManager.subscribe((event, data) => {
                receivedEvents.push({ subscriberId: i, event, data });
              });
              unsubscribers.push(unsubscribe);
            }
            
            // Trigger group updated sync
            syncManager.syncGroupUpdated(group, changes);
            
            // Verify all subscribers received the event
            expect(receivedEvents.length).toBe(subscriberCount);
            
            // Verify each subscriber received correct data
            receivedEvents.forEach((received) => {
              expect(received.event).toBe(SYNC_EVENTS.GROUP_UPDATED);
              expect(received.data.data.group).toEqual(group);
              expect(received.data.data.changes).toEqual(changes);
              expect(received.data.data.action).toBe('update');
            });
            
            // Cleanup
            unsubscribers.forEach(unsub => unsub());
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 3d: Content move sync
     * When content is moved to another group, all subscribers receive the move event
     * Validates: Requirement 1.2.5
     */
    test('Property 3d: Content move triggers sync notification to all subscribers', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 5 }),
          (contentId, fromGroupId, toGroupId, subscriberCount) => {
            const receivedEvents = [];
            const unsubscribers = [];
            
            // Create multiple subscribers
            for (let i = 0; i < subscriberCount; i++) {
              const unsubscribe = syncManager.subscribe((event, data) => {
                receivedEvents.push({ subscriberId: i, event, data });
              });
              unsubscribers.push(unsubscribe);
            }
            
            // Trigger content moved sync
            syncManager.syncContentMoved(contentId, fromGroupId, toGroupId);
            
            // Verify all subscribers received the event
            expect(receivedEvents.length).toBe(subscriberCount);
            
            // Verify each subscriber received correct data
            receivedEvents.forEach((received) => {
              expect(received.event).toBe(SYNC_EVENTS.CONTENT_MOVED);
              expect(received.data.data.contentId).toBe(contentId);
              expect(received.data.data.fromGroupId).toBe(fromGroupId);
              expect(received.data.data.toGroupId).toBe(toGroupId);
              expect(received.data.data.action).toBe('move');
            });
            
            // Cleanup
            unsubscribers.forEach(unsub => unsub());
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 3e: Subscriber isolation
     * Unsubscribed callbacks should not receive events
     * Validates: Requirements 1.2.1-1.2.5
     */
    test('Property 3e: Unsubscribed callbacks do not receive events', () => {
      fc.assert(
        fc.property(
          contentArbitrary(),
          fc.integer({ min: 2, max: 5 }),
          (content, subscriberCount) => {
            const receivedEvents = [];
            const unsubscribers = [];
            
            // Create multiple subscribers
            for (let i = 0; i < subscriberCount; i++) {
              const unsubscribe = syncManager.subscribe((event, data) => {
                receivedEvents.push({ subscriberId: i, event, data });
              });
              unsubscribers.push(unsubscribe);
            }
            
            // Unsubscribe the first subscriber
            unsubscribers[0]();
            
            // Trigger content added sync
            syncManager.syncContentAdded(content);
            
            // Verify only remaining subscribers received the event
            expect(receivedEvents.length).toBe(subscriberCount - 1);
            
            // Verify first subscriber did not receive the event
            const firstSubscriberEvents = receivedEvents.filter(e => e.subscriberId === 0);
            expect(firstSubscriberEvents.length).toBe(0);
            
            // Cleanup remaining subscribers
            unsubscribers.slice(1).forEach(unsub => unsub());
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 3f: Event data integrity
     * Event data should contain timestamp and accountId
     * Validates: Requirements 1.2.1-1.2.5
     */
    test('Property 3f: Event data contains required metadata', () => {
      fc.assert(
        fc.property(
          contentArbitrary(),
          (content) => {
            let receivedData = null;
            
            const unsubscribe = syncManager.subscribe((event, data) => {
              receivedData = data;
            });
            
            const beforeTime = Date.now();
            syncManager.syncContentAdded(content);
            const afterTime = Date.now();
            
            // Verify metadata
            expect(receivedData).not.toBeNull();
            expect(receivedData.timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(receivedData.timestamp).toBeLessThanOrEqual(afterTime);
            expect(receivedData.accountId).toBe('test-account-id');
            expect(receivedData.event).toBe(SYNC_EVENTS.CONTENT_ADDED);
            
            unsubscribe();
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 3g: Multiple events maintain order
     * Events should be delivered in the order they were triggered
     * Validates: Requirements 1.2.1-1.2.5
     */
    test('Property 3g: Multiple events maintain delivery order', () => {
      fc.assert(
        fc.property(
          fc.array(contentArbitrary(), { minLength: 2, maxLength: 10 }),
          (contents) => {
            const receivedEvents = [];
            
            const unsubscribe = syncManager.subscribe((event, data) => {
              receivedEvents.push(data);
            });
            
            // Trigger multiple events
            contents.forEach(content => {
              syncManager.syncContentAdded(content);
            });
            
            // Verify order is maintained
            expect(receivedEvents.length).toBe(contents.length);
            
            for (let i = 0; i < contents.length; i++) {
              expect(receivedEvents[i].data.content.id).toBe(contents[i].id);
            }
            
            // Verify timestamps are non-decreasing
            for (let i = 1; i < receivedEvents.length; i++) {
              expect(receivedEvents[i].timestamp).toBeGreaterThanOrEqual(receivedEvents[i-1].timestamp);
            }
            
            unsubscribe();
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 3h: Subscriber count tracking
     * getSubscriberCount should accurately reflect the number of active subscribers
     * Validates: Requirements 1.2.1-1.2.7
     */
    test('Property 3h: Subscriber count is accurately tracked', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 5 }),
          (addCount, removeCount) => {
            const unsubscribers = [];
            
            // Add subscribers
            for (let i = 0; i < addCount; i++) {
              const unsubscribe = syncManager.subscribe(() => {});
              unsubscribers.push(unsubscribe);
            }
            
            expect(syncManager.getSubscriberCount()).toBe(addCount);
            
            // Remove some subscribers
            const actualRemoveCount = Math.min(removeCount, addCount);
            for (let i = 0; i < actualRemoveCount; i++) {
              unsubscribers[i]();
            }
            
            expect(syncManager.getSubscriberCount()).toBe(addCount - actualRemoveCount);
            
            // Cleanup remaining
            for (let i = actualRemoveCount; i < addCount; i++) {
              unsubscribers[i]();
            }
            
            expect(syncManager.getSubscriberCount()).toBe(0);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Property 3i: Error in one subscriber doesn't affect others
     * If one subscriber throws an error, other subscribers should still receive events
     * Validates: Requirements 1.2.1-1.2.5
     */
    test('Property 3i: Error in one subscriber does not affect others', () => {
      fc.assert(
        fc.property(
          contentArbitrary(),
          fc.integer({ min: 2, max: 5 }),
          (content, subscriberCount) => {
            const receivedEvents = [];
            const unsubscribers = [];
            
            // First subscriber throws an error
            const unsub1 = syncManager.subscribe(() => {
              throw new Error('Test error');
            });
            unsubscribers.push(unsub1);
            
            // Other subscribers work normally
            for (let i = 1; i < subscriberCount; i++) {
              const unsubscribe = syncManager.subscribe((event, data) => {
                receivedEvents.push({ subscriberId: i, event, data });
              });
              unsubscribers.push(unsubscribe);
            }
            
            // Trigger event - should not throw
            expect(() => {
              syncManager.syncContentAdded(content);
            }).not.toThrow();
            
            // Verify other subscribers still received the event
            expect(receivedEvents.length).toBe(subscriberCount - 1);
            
            // Cleanup
            unsubscribers.forEach(unsub => unsub());
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

});
