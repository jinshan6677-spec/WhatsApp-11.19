import React from 'react';
import { useManagementInterface } from './ManagementInterface';
import TabBar from './TabBar';
import TemplateListView from './TemplateListView';
import TemplateEditor from './TemplateEditor';
import './ContentArea.css';

/**
 * ContentArea Component
 * 
 * Displays the content editing area with:
 * - Tab bar for filtering by content type
 * - Template list view
 * - Template editor (when editing)
 * 
 * Requirements: 25.1-25.8
 */
export default function ContentArea() {
  const { state } = useManagementInterface();

  return (
    <div className="content-area">
      <TabBar />
      
      <div className="content-area-body">
        {state.selectedGroupId ? (
          <TemplateListView />
        ) : (
          <div className="content-area-empty">
            <div className="content-area-empty-icon">📁</div>
            <p className="content-area-empty-text">请选择一个分组查看模板</p>
          </div>
        )}
      </div>

      {state.showTemplateEditor && <TemplateEditor />}
    </div>
  );
}
