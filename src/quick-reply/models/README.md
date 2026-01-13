# Quick Reply Data Models

This directory contains the data models for the quick-reply feature.

## Models

### Template
Represents a quick reply template with support for multiple content types.

**Usage:**
```javascript
const { Template } = require('./models');
const { TEMPLATE_TYPES } = require('./constants');

// Create a text template
const template = new Template({
  groupId: 'group-id',
  type: TEMPLATE_TYPES.TEXT,
  label: '问候语',
  content: { text: '您好，有什么可以帮您？' }
});

// Validate
const result = template.validate();
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Record usage
template.recordUsage();

// Check capabilities
if (template.isTranslatable()) {
  // Can be translated
}
```

### Group
Represents a template group with support for hierarchical organization.

**Usage:**
```javascript
const { Group } = require('./models');

// Create a top-level group
const group = new Group({
  name: '常用问题'
});

// Create a child group
const childGroup = new Group({
  name: '产品介绍',
  parentId: group.id
});

// Toggle expanded state
group.toggleExpanded();

// Check if top-level
if (group.isTopLevel()) {
  // This is a root group
}
```

### Config
Represents account-level configuration for quick reply.

**Usage:**
```javascript
const { Config } = require('./models');
const { SEND_MODES } = require('./constants');

// Create default config
const config = Config.getDefault('account-123');

// Set send mode
config.setSendMode(SEND_MODES.TRANSLATED);

// Manage expanded groups
config.addExpandedGroup('group-id');
if (config.isGroupExpanded('group-id')) {
  // Group is expanded
}

// Track last selected group
config.setLastSelectedGroup('group-id');
```

## Features

### Automatic ID Generation
All models automatically generate UUIDs for new instances.

### Validation
All models provide comprehensive validation with detailed error messages:
```javascript
const result = model.validate();
// { valid: boolean, errors: string[] }
```

### JSON Serialization
All models support JSON serialization/deserialization:
```javascript
const json = model.toJSON();
const restored = Model.fromJSON(json);
```

### Timestamp Management
All models automatically track creation and update times:
```javascript
model.touch(); // Updates updatedAt timestamp
```

## Requirements Coverage

- ✅ Requirements 3.1-3.13: Template content creation
- ✅ Requirements 29.1-29.8: Default naming rules
- ✅ Requirements 2.1-2.11: Group management
- ✅ Requirements 19.1-19.7: Group hierarchy
- ✅ Requirements 11.1-11.7: Account-level configuration

## See Also

- [Constants Documentation](../constants/README.md)
- [Design Document](../../../.kiro/specs/quick-reply/design.md)
- [Requirements Document](../../../.kiro/specs/quick-reply/requirements.md)
