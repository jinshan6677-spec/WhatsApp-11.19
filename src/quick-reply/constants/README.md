# Quick Reply Constants

This directory contains constant definitions for the quick-reply feature.

## Constants

### Template Types

Defines the supported template content types.

**Usage:**
```javascript
const { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS } = require('./constants');

// Use template types
const type = TEMPLATE_TYPES.TEXT;  // 'text'

// Get default label for type
const label = TEMPLATE_TYPE_LABELS[TEMPLATE_TYPES.TEXT];  // '新模板'
```

**Available Types:**
- `TEXT`: Text-only templates
- `IMAGE`: Image templates
- `AUDIO`: Audio templates
- `VIDEO`: Video templates
- `MIXED`: Image + text templates
- `CONTACT`: Contact card templates

**Default Labels (Requirements 29.1-29.8):**
- TEXT → "新模板"
- IMAGE → "图片模板"
- AUDIO → "音频模板"
- VIDEO → "视频模板"
- MIXED → "图文模板"
- CONTACT → "名片模板"

### Send Modes

Defines the supported send modes for templates.

**Usage:**
```javascript
const { SEND_MODES, SEND_MODE_LABELS } = require('./constants');

// Use send modes
const mode = SEND_MODES.ORIGINAL;  // 'original'

// Get label for mode
const label = SEND_MODE_LABELS[SEND_MODES.ORIGINAL];  // '原文发送'
```

**Available Modes:**
- `ORIGINAL`: Send template content as-is
- `TRANSLATED`: Translate content before sending

**Labels:**
- ORIGINAL → "原文发送"
- TRANSLATED → "翻译后发送"

### Limits

Defines various limits for the quick reply system.

**Usage:**
```javascript
const { LIMITS } = require('./constants');

// Check label length
if (label.length > LIMITS.LABEL_MAX_LENGTH) {
  // Label too long
}

// Check file size
if (fileSize > LIMITS.IMAGE_MAX_SIZE) {
  // Image too large
}
```

**Available Limits:**

**Label Limits:**
- `LABEL_MAX_LENGTH`: 50 characters
- `LABEL_MIN_LENGTH`: 1 character

**Media File Size Limits:**
- `IMAGE_MAX_SIZE`: 16 MB (16,777,216 bytes)
- `AUDIO_MAX_SIZE`: 16 MB (16,777,216 bytes)
- `VIDEO_MAX_SIZE`: 64 MB (67,108,864 bytes)

**Group Hierarchy:**
- `MAX_GROUP_DEPTH`: 3 levels

**Text Content:**
- `TEXT_MAX_LENGTH`: 4096 characters (WhatsApp limit)

**Search:**
- `SEARCH_MIN_LENGTH`: 1 character
- `SEARCH_DEBOUNCE_MS`: 300 milliseconds

**Batch Operations:**
- `BATCH_DELETE_MAX`: 100 items
- `BATCH_MOVE_MAX`: 100 items

## Import All Constants

```javascript
const {
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  SEND_MODES,
  SEND_MODE_LABELS,
  LIMITS
} = require('./constants');
```

## Requirements Coverage

- ✅ Template types: text, image, audio, video, mixed, contact
- ✅ Send modes: original, translated
- ✅ Label length limit: 50 characters (Requirement 3.8)
- ✅ Media file size limits (Requirement 3.12)
- ✅ Default labels for all types (Requirements 29.1-29.8)

## See Also

- [Models Documentation](../models/README.md)
- [Design Document](../../../.kiro/specs/quick-reply/design.md)
- [Requirements Document](../../../.kiro/specs/quick-reply/requirements.md)
