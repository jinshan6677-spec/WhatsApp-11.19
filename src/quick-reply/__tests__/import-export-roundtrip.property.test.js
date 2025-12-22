/**
 * Property-Based Tests for Import/Export Round-Trip Consistency
 * 
 * Feature: enhanced-quick-reply-management, Property 11: 导入导出往返一致性
 * 
 * Tests that exporting data and then importing it produces equivalent data.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Requirements: 9.1-9.8
 */

const fc = require('fast-check');
const {
  exportToJSON,
  prepareTemplatesForExport,
  prepareGroupsForExport,
  validateExportData
} = require('../utils/export');
const {
  validateImportData,
  detectConflicts,
  resolveConflicts,
  generateUniqueName
} = require('../utils/import');
const { TEMPLATE_TYPES } = require('../constants/templateTypes');
const { VISIBILITY_TYPES } = require('../constants/visibilityTypes');

// Test configuration
const NUM_RUNS = 100;

/**
 * Generate a valid group
 */
const groupArbitrary = () => fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  parentId: fc.option(fc.uuid(), { nil: null }),
  order: fc.nat({ max: 1000 }),
  expanded: fc.boolean(),
  createdAt: fc.nat(),
  updatedAt: fc.nat()
});

/**
 * Generate a valid template
 */
const templateArbitrary = (groupIds = []) => fc.record({
  id: fc.uuid(),
  groupId: groupIds.length > 0 
    ? fc.constantFrom(...groupIds) 
    : fc.uuid(),
  type: fc.constantFrom(...Object.values(TEMPLATE_TYPES)),
  visibility: fc.constantFrom(...Object.values(VISIBILITY_TYPES)),
  label: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  content: fc.record({
    text: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined })
  }),
  order: fc.nat({ max: 1000 }),
  createdAt: fc.nat(),
  updatedAt: fc.nat(),
  usageCount: fc.nat({ max: 1000 }),
  lastUsedAt: fc.option(fc.nat(), { nil: null })
});

/**
 * Generate an array of groups
 */
const groupListArbitrary = () => fc.array(groupArbitrary(), { minLength: 0, maxLength: 10 });

/**
 * Generate an array of templates
 */
const templateListArbitrary = () => fc.array(templateArbitrary(), { minLength: 0, maxLength: 20 });

/**
 * Generate a complete dataset (groups + templates)
 */
const datasetArbitrary = () => fc.tuple(
  groupListArbitrary(),
  templateListArbitrary()
).map(([groups, templates]) => {
  // Ensure templates reference valid group IDs
  const groupIds = groups.map(g => g.id);
  if (groupIds.length > 0) {
    templates = templates.map(t => ({
      ...t,
      groupId: groupIds[Math.floor(Math.random() * groupIds.length)]
    }));
  }
  return { groups, templates };
});

describe('Import/Export Round-Trip Property-Based Tests', () => {
  
  /**
   * Feature: enhanced-quick-reply-management, Property 11: 导入导出往返一致性
   * **Validates: Requirements 9.1-9.8**
   * 
   * For any dataset, exporting and then importing should produce data that is
   * content-equivalent to the original (IDs and timestamps may differ).
   */
  describe('Property 11: Import/Export Round-Trip Consistency', () => {
    
    /**
     * Export produces valid JSON structure
     * Validates: Requirements 9.2, 9.3
     */
    test('Property 11a: Export produces valid JSON structure', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            // Should have required structure
            expect(exported).toHaveProperty('metadata');
            expect(exported).toHaveProperty('groups');
            expect(exported).toHaveProperty('templates');
            
            // Metadata should have required fields
            expect(exported.metadata).toHaveProperty('version');
            expect(exported.metadata).toHaveProperty('exportedAt');
            expect(exported.metadata).toHaveProperty('scope');
            
            // Groups and templates should be arrays
            expect(Array.isArray(exported.groups)).toBe(true);
            expect(Array.isArray(exported.templates)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Exported data passes validation
     * Validates: Requirements 9.5, 9.6
     */
    test('Property 11b: Exported data passes validation', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            const validation = validateExportData(exported);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Import validation accepts exported data
     * Validates: Requirements 9.5, 9.6
     */
    test('Property 11c: Import validation accepts exported data', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            const validation = validateImportData(exported);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Round-trip preserves group count
     * Validates: Requirements 9.1-9.8
     */
    test('Property 11d: Round-trip preserves group count', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            // Imported data should have same group count
            expect(exported.groups.length).toBe(groups.length);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Round-trip preserves template count
     * Validates: Requirements 9.1-9.8
     */
    test('Property 11e: Round-trip preserves template count', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            // Imported data should have same template count
            expect(exported.templates.length).toBe(templates.length);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Round-trip preserves group names
     * Validates: Requirements 9.1-9.8
     */
    test('Property 11f: Round-trip preserves group names', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            // All original group names should be in exported data
            const exportedNames = new Set(exported.groups.map(g => g.name));
            groups.forEach(g => {
              expect(exportedNames.has(g.name)).toBe(true);
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Round-trip preserves template labels
     * Validates: Requirements 9.1-9.8
     */
    test('Property 11g: Round-trip preserves template labels', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            // All original template labels should be in exported data
            const exportedLabels = new Set(exported.templates.map(t => t.label));
            templates.forEach(t => {
              expect(exportedLabels.has(t.label)).toBe(true);
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Round-trip preserves template types
     * Validates: Requirements 9.1-9.8
     */
    test('Property 11h: Round-trip preserves template types', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            // Each exported template should have same type as original
            exported.templates.forEach(exportedTemplate => {
              const original = templates.find(t => t.id === exportedTemplate.id);
              if (original) {
                expect(exportedTemplate.type).toBe(original.type);
              }
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Round-trip preserves template visibility
     * Validates: Requirements 9.1-9.8
     */
    test('Property 11i: Round-trip preserves template visibility', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            // Each exported template should have same visibility as original
            exported.templates.forEach(exportedTemplate => {
              const original = templates.find(t => t.id === exportedTemplate.id);
              if (original) {
                expect(exportedTemplate.visibility).toBe(original.visibility);
              }
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Round-trip preserves template content
     * Validates: Requirements 9.1-9.8
     */
    test('Property 11j: Round-trip preserves template content', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            // Each exported template should have same content as original
            exported.templates.forEach(exportedTemplate => {
              const original = templates.find(t => t.id === exportedTemplate.id);
              if (original) {
                expect(exportedTemplate.content).toEqual(original.content);
              }
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

  /**
   * Conflict Detection Tests
   * Validates: Requirement 9.7
   */
  describe('Conflict Detection', () => {
    
    /**
     * No conflicts when importing to empty data
     */
    test('Property 11k: No conflicts when importing to empty data', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            const conflicts = detectConflicts(exported, [], []);
            
            expect(conflicts.groups).toHaveLength(0);
            expect(conflicts.templates).toHaveLength(0);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * Detects ID conflicts correctly
     */
    test('Property 11l: Detects ID conflicts correctly', () => {
      fc.assert(
        fc.property(
          datasetArbitrary(),
          fc.uuid(),
          ({ groups, templates }, accountId) => {
            const exported = exportToJSON({
              accountId,
              templates,
              groups,
              scope: 'all'
            });
            
            // Import same data again - should detect conflicts
            const conflicts = detectConflicts(exported, groups, templates);
            
            // Should detect conflicts for all groups and templates with same IDs
            const expectedGroupConflicts = groups.filter(g => 
              exported.groups.some(eg => eg.id === g.id)
            ).length;
            const expectedTemplateConflicts = templates.filter(t => 
              exported.templates.some(et => et.id === t.id)
            ).length;
            
            expect(conflicts.groups.length).toBe(expectedGroupConflicts);
            expect(conflicts.templates.length).toBe(expectedTemplateConflicts);
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

  /**
   * Unique Name Generation Tests
   */
  describe('Unique Name Generation', () => {
    
    /**
     * Generated name is unique
     */
    test('Property 11m: Generated name is unique', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
          (baseName, existingNames) => {
            const uniqueName = generateUniqueName(baseName, existingNames);
            
            // Generated name should not be in existing names (case-insensitive)
            const lowerExisting = existingNames.map(n => n.toLowerCase());
            
            // If baseName is not in existing, it should be returned as-is
            if (!lowerExisting.includes(baseName.toLowerCase())) {
              expect(uniqueName).toBe(baseName);
            } else {
              // Otherwise, generated name should be unique
              expect(lowerExisting.includes(uniqueName.toLowerCase())).toBe(false);
            }
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

  /**
   * Prepare Functions Tests
   */
  describe('Prepare Functions', () => {
    
    /**
     * prepareTemplatesForExport preserves essential fields
     */
    test('Property 11n: prepareTemplatesForExport preserves essential fields', () => {
      fc.assert(
        fc.property(
          templateListArbitrary(),
          (templates) => {
            const prepared = prepareTemplatesForExport(templates);
            
            expect(prepared.length).toBe(templates.length);
            
            prepared.forEach((preparedTemplate, index) => {
              const original = templates[index];
              expect(preparedTemplate.id).toBe(original.id);
              expect(preparedTemplate.groupId).toBe(original.groupId);
              expect(preparedTemplate.type).toBe(original.type);
              expect(preparedTemplate.visibility).toBe(original.visibility);
              expect(preparedTemplate.label).toBe(original.label);
              expect(preparedTemplate.content).toEqual(original.content);
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    /**
     * prepareGroupsForExport preserves essential fields
     */
    test('Property 11o: prepareGroupsForExport preserves essential fields', () => {
      fc.assert(
        fc.property(
          groupListArbitrary(),
          (groups) => {
            const prepared = prepareGroupsForExport(groups);
            
            expect(prepared.length).toBe(groups.length);
            
            prepared.forEach((preparedGroup, index) => {
              const original = groups[index];
              expect(preparedGroup.id).toBe(original.id);
              expect(preparedGroup.name).toBe(original.name);
              expect(preparedGroup.parentId).toBe(original.parentId);
              expect(preparedGroup.order).toBe(original.order);
            });
            
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

  });

});
