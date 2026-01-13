/**
 * Component Demo
 * 
 * This file demonstrates how to use all the common UI components together.
 * It's not meant to be run directly, but serves as a reference for developers.
 */

import React, { useState } from 'react';
import { Button, Input, Modal, Dropdown, Toast, ToastContainer } from './index';

/**
 * Demo Component
 * 
 * Shows all components in action with interactive examples.
 */
const ComponentDemo = () => {
  // State management
  const [inputValue, setInputValue] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Toast management
  const addToast = (message, type = 'info') => {
    const id = Date.now().toString();
    setToasts([...toasts, { id, message, type, duration: 3000 }]);
  };

  const removeToast = (id) => {
    setToasts(toasts.filter(t => t.id !== id));
  };

  // Dropdown items
  const dropdownItems = [
    { key: 'edit', label: 'Edit', icon: '✏️' },
    { key: 'duplicate', label: 'Duplicate', icon: '📋' },
    { type: 'divider' },
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  ];

  const handleDropdownSelect = (item) => {
    addToast(`Selected: ${item.label}`, 'info');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Quick Reply UI Components Demo</h1>

      {/* Button Examples */}
      <section style={{ marginBottom: '40px' }}>
        <h2>Buttons</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => addToast('Primary clicked!', 'success')}>
            Primary
          </Button>
          <Button variant="secondary" onClick={() => addToast('Secondary clicked!', 'info')}>
            Secondary
          </Button>
          <Button variant="danger" onClick={() => addToast('Danger clicked!', 'error')}>
            Danger
          </Button>
          <Button variant="ghost" onClick={() => addToast('Ghost clicked!', 'info')}>
            Ghost
          </Button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
          <Button size="small">Small</Button>
          <Button size="medium">Medium</Button>
          <Button size="large">Large</Button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
        </div>
      </section>

      {/* Input Examples */}
      <section style={{ marginBottom: '40px' }}>
        <h2>Inputs</h2>
        
        <Input
          label="Template Label"
          placeholder="Enter template label..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          maxLength={50}
          required
          style={{ marginBottom: '16px' }}
        />

        <Input
          placeholder="Search templates..."
          prefix="🔍"
          value=""
          onChange={() => {}}
          style={{ marginBottom: '16px' }}
        />

        <Input
          label="Email"
          type="email"
          placeholder="user@example.com"
          error="Please enter a valid email address"
          value=""
          onChange={() => {}}
        />
      </section>

      {/* Modal Example */}
      <section style={{ marginBottom: '40px' }}>
        <h2>Modal</h2>
        <Button onClick={() => setModalVisible(true)}>
          Open Modal
        </Button>

        <Modal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          title="Edit Template"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setModalVisible(false);
                  addToast('Template saved!', 'success');
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <div>
            <Input
              label="Template Name"
              placeholder="Enter template name..."
              value=""
              onChange={() => {}}
              style={{ marginBottom: '16px' }}
            />
            <Input
              label="Content"
              placeholder="Enter template content..."
              value=""
              onChange={() => {}}
            />
          </div>
        </Modal>
      </section>

      {/* Dropdown Example */}
      <section style={{ marginBottom: '40px' }}>
        <h2>Dropdown</h2>
        <Dropdown
          trigger={<Button>Actions ▼</Button>}
          items={dropdownItems}
          onSelect={handleDropdownSelect}
        />
      </section>

      {/* Toast Examples */}
      <section style={{ marginBottom: '40px' }}>
        <h2>Toasts</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button onClick={() => addToast('Success message!', 'success')}>
            Show Success
          </Button>
          <Button onClick={() => addToast('Error message!', 'error')}>
            Show Error
          </Button>
          <Button onClick={() => addToast('Warning message!', 'warning')}>
            Show Warning
          </Button>
          <Button onClick={() => addToast('Info message!', 'info')}>
            Show Info
          </Button>
        </div>
      </section>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default ComponentDemo;

/**
 * Usage Examples for Quick Reply Feature
 */

// Example 1: Template Editor Modal
export const TemplateEditorExample = () => {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');

  const handleSave = () => {
    // Save template logic
    setVisible(false);
  };

  return (
    <>
      <Button onClick={() => setVisible(true)}>
        Add Template
      </Button>

      <Modal
        visible={visible}
        onClose={() => setVisible(false)}
        title="Create Template"
        width="600px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVisible(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save Template
            </Button>
          </>
        }
      >
        <Input
          label="Template Label"
          placeholder="e.g., Greeting Message"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={50}
          required
          style={{ marginBottom: '16px' }}
        />
        <Input
          label="Content"
          placeholder="Enter your template content..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </Modal>
    </>
  );
};

// Example 2: Search Box with Dropdown Actions
export const SearchWithActionsExample = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const actionItems = [
    { key: 'import', label: 'Import Templates', icon: '📥' },
    { key: 'export', label: 'Export Templates', icon: '📤' },
    { type: 'divider' },
    { key: 'clear', label: 'Clear Cache', icon: '🗑️' },
  ];

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <Input
        placeholder="Search templates..."
        prefix="🔍"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ flex: 1 }}
      />
      <Dropdown
        trigger={<Button variant="ghost">⚙️</Button>}
        items={actionItems}
        onSelect={(item) => console.log('Action:', item.key)}
        placement="bottom-right"
      />
    </div>
  );
};

// Example 3: Confirmation Dialog
export const ConfirmationDialogExample = () => {
  const [visible, setVisible] = useState(false);
  const [toasts, setToasts] = useState([]);

  const handleDelete = () => {
    setVisible(false);
    const id = Date.now().toString();
    setToasts([...toasts, {
      id,
      message: 'Template deleted successfully',
      type: 'success',
      duration: 3000,
    }]);
  };

  return (
    <>
      <Button variant="danger" onClick={() => setVisible(true)}>
        Delete Template
      </Button>

      <Modal
        visible={visible}
        onClose={() => setVisible(false)}
        title="Confirm Delete"
        width="400px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVisible(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete this template? This action cannot be undone.</p>
      </Modal>

      <ToastContainer
        toasts={toasts}
        onRemove={(id) => setToasts(toasts.filter(t => t.id !== id))}
      />
    </>
  );
};
