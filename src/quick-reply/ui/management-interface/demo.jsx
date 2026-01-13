/**
 * Management Interface Demo
 * 
 * This file demonstrates how to use the Management Interface components.
 * It can be used for testing and development purposes.
 */

import React, { useState } from 'react';
import { 
  ManagementInterface, 
  ManagementInterfaceProvider 
} from './ManagementInterface';
import Button from '../common/Button';

/**
 * Demo Component
 * 
 * Shows how to integrate the Management Interface into your application.
 */
export default function ManagementInterfaceDemo() {
  const [isOpen, setIsOpen] = useState(false);

  // Mock controller (replace with actual QuickReplyController)
  const mockController = {
    templateManager: {
      getAllTemplates: async () => {
        // Return mock templates
        return [
          {
            id: 't1',
            groupId: 'g1',
            type: 'text',
            label: '早安问候',
            content: { text: '早上好！有什么可以帮助您的吗？' },
            order: 1,
            usageCount: 10,
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            id: 't2',
            groupId: 'g1',
            type: 'image',
            label: '产品图片',
            content: { mediaPath: '/path/to/image.jpg' },
            order: 2,
            usageCount: 5,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ];
      },
      createTemplate: async (groupId, type, label, content) => {
        console.log('Create template:', { groupId, type, label, content });
        return {
          id: 't' + Date.now(),
          groupId,
          type,
          label,
          content,
          order: 1,
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      },
      updateTemplate: async (templateId, updates) => {
        console.log('Update template:', templateId, updates);
      },
      deleteTemplate: async (templateId) => {
        console.log('Delete template:', templateId);
      },
      batchDeleteTemplates: async (templateIds) => {
        console.log('Batch delete templates:', templateIds);
      },
      batchMoveTemplates: async (templateIds, targetGroupId) => {
        console.log('Batch move templates:', templateIds, 'to', targetGroupId);
      }
    },
    groupManager: {
      getAllGroups: async () => {
        // Return mock groups
        return [
          {
            id: 'g1',
            name: '常用问候',
            parentId: null,
            order: 1,
            expanded: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            id: 'g2',
            name: '产品介绍',
            parentId: null,
            order: 2,
            expanded: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ];
      },
      createGroup: async (name, parentId = null) => {
        console.log('Create group:', name, parentId);
        return {
          id: 'g' + Date.now(),
          name,
          parentId,
          order: 1,
          expanded: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      },
      updateGroup: async (groupId, updates) => {
        console.log('Update group:', groupId, updates);
      },
      deleteGroup: async (groupId) => {
        console.log('Delete group:', groupId);
      },
      batchDeleteGroups: async (groupIds) => {
        console.log('Batch delete groups:', groupIds);
      }
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div style={{ padding: '40px' }}>
      <h1>管理界面演示</h1>
      <p>点击下面的按钮打开管理界面</p>
      
      <Button variant="primary" onClick={handleOpen}>
        打开管理界面
      </Button>

      {isOpen && (
        <ManagementInterfaceProvider controller={mockController}>
          <ManagementInterface onClose={handleClose} />
        </ManagementInterfaceProvider>
      )}
    </div>
  );
}

/**
 * Usage Example in Real Application
 * 
 * ```javascript
 * import { ManagementInterfaceProvider, ManagementInterface } from './management-interface';
 * import QuickReplyController from './controllers/QuickReplyController';
 * 
 * function App() {
 *   const [showManagement, setShowManagement] = useState(false);
 *   const controller = new QuickReplyController(accountId, translationService, whatsappWebInterface);
 * 
 *   return (
 *     <div>
 *       <button onClick={() => setShowManagement(true)}>
 *         管理快捷回复
 *       </button>
 * 
 *       {showManagement && (
 *         <ManagementInterfaceProvider controller={controller}>
 *           <ManagementInterface onClose={() => setShowManagement(false)} />
 *         </ManagementInterfaceProvider>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
