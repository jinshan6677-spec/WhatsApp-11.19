/**
 * Property-Based Tests for Group Naming Rules
 * 
 * Feature: enhanced-quick-reply-management, Property 4: 分组命名规则
 * 
 * Tests the correctness property that for any new group created without a specified name,
 * the system should automatically generate a name in the format "新分组N" where N is
 * the current maximum sequence number + 1.
 * 
 * **Validates: Requirements 3.3**
 */

const fc = require('fast-check');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const GroupManager = require('../managers/GroupManager');

// Test configuration
const NUM_RUNS = 100;

// Helper to create temporary test directory
async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `quick-reply-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

// Helper to cleanup test directory
async function cleanupTempDir(tempDir) {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Generate a valid UUID-like account ID
const accountIdArbitrary = () => fc.uuid();

describe('Group Naming Property-Based Tests', () => {
  
  /**
   * Feature: enhanced-quick-reply-management, Property 4: 分组命名规则
   * **Validates: Requirements 3.3**
   * 
   * For any new group created without a specified name,
   * the system should automatically generate a name in the format "新分组N"
   * where N is the current maximum sequence number + 1.
   */
  test('Property 4: Default group name follows "新分组N" pattern with sequential numbering', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        fc.nat({ max: 5 }), // Number of groups to create (0-5)
        async (accountId, numGroups) => {
          const tempDir = await createTempDir();
          
          try {
            const manager = new GroupManager(accountId, tempDir);
            
            // Create multiple groups without specifying names
            const createdGroups = [];
            for (let i = 0; i < numGroups; i++) {
              const group = await manager.createGroup(); // No name provided
              createdGroups.push(group);
            }
            
            // Verify each group has the correct naming pattern
            for (let i = 0; i < createdGroups.length; i++) {
              const group = createdGroups[i];
              
              // Check name matches pattern "新分组N"
              const pattern = /^新分组(\d+)$/;
              const match = group.name.match(pattern);
              
              if (!match) {
                return false; // Name doesn't match expected pattern
              }
              
              const number = parseInt(match[1], 10);
              
              // The number should be i + 1 (1-indexed)
              if (number !== i + 1) {
                return false; // Number is not sequential
              }
            }
            
            return true;
          } finally {
            await cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Feature: enhanced-quick-reply-management, Property 4: 分组命名规则
   * **Validates: Requirements 3.3**
   * 
   * When creating a new group after some groups have been deleted,
   * the new group should use the next available number (max + 1),
   * not reuse deleted numbers.
   */
  test('Property 4: New group name uses max+1 even after deletions', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        fc.nat({ min: 2, max: 5 }), // Create at least 2 groups
        fc.nat({ max: 2 }), // Delete 0-2 groups
        async (accountId, numGroups, numToDelete) => {
          const tempDir = await createTempDir();
          
          try {
            const manager = new GroupManager(accountId, tempDir);
            
            // Create initial groups
            const createdGroups = [];
            for (let i = 0; i < numGroups; i++) {
              const group = await manager.createGroup();
              createdGroups.push(group);
            }
            
            // Delete some groups (but not all)
            const actualDeleteCount = Math.min(numToDelete, numGroups - 1);
            for (let i = 0; i < actualDeleteCount; i++) {
              await manager.deleteGroup(createdGroups[i].id);
            }
            
            // Create a new group
            const newGroup = await manager.createGroup();
            
            // The new group should have number = numGroups + 1
            // (not reusing deleted numbers)
            const pattern = /^新分组(\d+)$/;
            const match = newGroup.name.match(pattern);
            
            if (!match) {
              return false;
            }
            
            const number = parseInt(match[1], 10);
            
            // Should be numGroups + 1 (continuing from max, not reusing)
            return number === numGroups + 1;
          } finally {
            await cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Feature: enhanced-quick-reply-management, Property 4: 分组命名规则
   * **Validates: Requirements 3.3**
   * 
   * When a custom name is provided, the system should use that name
   * instead of generating a default name.
   */
  test('Property 4: Custom name is used when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (accountId, customName) => {
          const tempDir = await createTempDir();
          
          try {
            const manager = new GroupManager(accountId, tempDir);
            
            // Create group with custom name
            const group = await manager.createGroup(customName);
            
            // The group name should be the trimmed custom name
            return group.name === customName.trim();
          } finally {
            await cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Feature: enhanced-quick-reply-management, Property 4: 分组命名规则
   * **Validates: Requirements 3.3**
   * 
   * When empty string or whitespace-only name is provided,
   * the system should generate a default name.
   */
  test('Property 4: Empty or whitespace name triggers default name generation', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        fc.constantFrom('', ' ', '  ', '\t', '\n', '   \t\n  '),
        async (accountId, emptyName) => {
          const tempDir = await createTempDir();
          
          try {
            const manager = new GroupManager(accountId, tempDir);
            
            // Create group with empty/whitespace name
            const group = await manager.createGroup(emptyName);
            
            // Should generate default name pattern
            const pattern = /^新分组\d+$/;
            return pattern.test(group.name);
          } finally {
            await cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Feature: enhanced-quick-reply-management, Property 4: 分组命名规则
   * **Validates: Requirements 3.3**
   * 
   * All generated default names should be unique within the same account.
   */
  test('Property 4: All generated default names are unique', async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArbitrary(),
        fc.nat({ min: 1, max: 10 }), // Create 1-10 groups
        async (accountId, numGroups) => {
          const tempDir = await createTempDir();
          
          try {
            const manager = new GroupManager(accountId, tempDir);
            
            // Create multiple groups without names
            const names = new Set();
            for (let i = 0; i < numGroups; i++) {
              const group = await manager.createGroup();
              
              // Check for duplicate
              if (names.has(group.name)) {
                return false; // Duplicate name found
              }
              names.add(group.name);
            }
            
            return true;
          } finally {
            await cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
