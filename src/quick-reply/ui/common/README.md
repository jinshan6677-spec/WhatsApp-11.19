# Common UI Components

This directory contains reusable UI components for the Quick Reply feature.

## Components

### Button

A versatile button component with multiple variants and states.

**Props:**
- `children` (node, required): Button content
- `variant` (string): Button style - 'primary', 'secondary', 'danger', 'ghost' (default: 'primary')
- `size` (string): Button size - 'small', 'medium', 'large' (default: 'medium')
- `disabled` (boolean): Disable the button (default: false)
- `loading` (boolean): Show loading spinner (default: false)
- `onClick` (function): Click handler
- `type` (string): Button type - 'button', 'submit', 'reset' (default: 'button')
- `className` (string): Additional CSS classes
- `style` (object): Inline styles

**Example:**
```jsx
import { Button } from './ui/common';

<Button variant="primary" onClick={handleClick}>
  Save
</Button>

<Button variant="danger" loading={isDeleting}>
  Delete
</Button>
```

### Input

A flexible input component with validation states and affixes.

**Props:**
- `type` (string): Input type (default: 'text')
- `value` (string): Input value
- `onChange` (function): Change handler
- `placeholder` (string): Placeholder text
- `disabled` (boolean): Disable the input (default: false)
- `readOnly` (boolean): Make input read-only (default: false)
- `error` (string): Error message to display
- `label` (string): Input label
- `required` (boolean): Mark as required (default: false)
- `maxLength` (number): Maximum character length
- `prefix` (node): Prefix icon or text
- `suffix` (node): Suffix icon or text
- `className` (string): Additional CSS classes
- `style` (object): Inline styles

**Example:**
```jsx
import { Input } from './ui/common';

<Input
  label="Template Label"
  value={label}
  onChange={(e) => setLabel(e.target.value)}
  maxLength={50}
  required
  error={errors.label}
/>

<Input
  placeholder="Search..."
  prefix={<SearchIcon />}
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
/>
```

### Modal

A modal dialog component with overlay and animations.

**Props:**
- `visible` (boolean): Control modal visibility (default: false)
- `onClose` (function): Close handler
- `title` (string): Modal title
- `children` (node): Modal content
- `footer` (node): Modal footer content
- `width` (string): Modal width (default: '520px')
- `closable` (boolean): Show close button (default: true)
- `maskClosable` (boolean): Close on overlay click (default: true)
- `className` (string): Additional CSS classes

**Example:**
```jsx
import { Modal, Button } from './ui/common';

<Modal
  visible={isOpen}
  onClose={() => setIsOpen(false)}
  title="Edit Template"
  footer={
    <>
      <Button variant="ghost" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave}>
        Save
      </Button>
    </>
  }
>
  <p>Modal content goes here</p>
</Modal>
```

### Dropdown

A dropdown menu component with customizable items.

**Props:**
- `trigger` (node, required): Element that triggers the dropdown
- `items` (array): Menu items array
  - `key` (string): Unique key
  - `label` (string): Item label
  - `icon` (node): Item icon
  - `disabled` (boolean): Disable the item
  - `danger` (boolean): Style as danger action
  - `type` (string): 'divider' for separator
- `onSelect` (function): Item select handler
- `placement` (string): Dropdown position - 'bottom-left', 'bottom-right', 'top-left', 'top-right' (default: 'bottom-left')
- `disabled` (boolean): Disable the dropdown (default: false)
- `className` (string): Additional CSS classes

**Example:**
```jsx
import { Dropdown, Button } from './ui/common';

<Dropdown
  trigger={<Button>Actions</Button>}
  items={[
    { key: 'edit', label: 'Edit', icon: <EditIcon /> },
    { key: 'delete', label: 'Delete', icon: <DeleteIcon />, danger: true },
    { type: 'divider' },
    { key: 'export', label: 'Export' },
  ]}
  onSelect={(item) => handleAction(item.key)}
/>
```

### Toast

A notification toast component with auto-dismiss.

**Props:**
- `message` (string, required): Toast message
- `type` (string): Toast type - 'success', 'error', 'warning', 'info' (default: 'info')
- `duration` (number): Auto-dismiss duration in ms (default: 3000, 0 = no auto-dismiss)
- `onClose` (function): Close handler
- `position` (string): Toast position - 'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right' (default: 'top-center')
- `closable` (boolean): Show close button (default: true)

**Example:**
```jsx
import { Toast, ToastContainer } from './ui/common';

// Single toast
<Toast
  message="Template saved successfully!"
  type="success"
  duration={3000}
/>

// Multiple toasts with container
const [toasts, setToasts] = useState([]);

const addToast = (message, type) => {
  const id = Date.now().toString();
  setToasts([...toasts, { id, message, type }]);
};

const removeToast = (id) => {
  setToasts(toasts.filter(t => t.id !== id));
};

<ToastContainer toasts={toasts} onRemove={removeToast} />
```

## Styling

All components use inline styles for maximum portability and to avoid CSS conflicts. Each component includes:

- Consistent color scheme
- Smooth transitions and animations
- Responsive sizing
- Accessibility features (ARIA labels, keyboard navigation)

## Customization

Components can be customized through:

1. **Props**: All components accept `className` and `style` props for custom styling
2. **CSS Classes**: Each component has semantic CSS classes (e.g., `qr-button`, `qr-modal`) that can be targeted
3. **Variants**: Components like Button support multiple variants for different use cases

## Best Practices

1. **Accessibility**: Always provide meaningful labels and ARIA attributes
2. **Keyboard Navigation**: Components support keyboard interactions (ESC to close modals, etc.)
3. **Loading States**: Use the `loading` prop on buttons during async operations
4. **Error Handling**: Display validation errors using the Input component's `error` prop
5. **Consistent Spacing**: Use the provided size variants for consistent UI spacing
