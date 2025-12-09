import React from 'react';
import { useManagementInterface } from './ManagementInterface';
import TemplateListItem from './TemplateListItem';
import BatchOperations from './BatchOperations';
import Button from '../common/Button';
import { useTemplateDragDrop } from './useDragDrop';
import './TemplateListView.css';
import './DragDrop.css';

/**
 * TemplateListView Component
 * 
 * Displays the list of templates with:
 * - Batch selection support
 * - Drag and drop sorting
 * - Batch operations toolbar
 * 
 * Requirements: 24.1-24.12, 21.1-21.6
 */
export default function TemplateListView() {
  const { state, dispatch, controller } = useManagementInterface();

  // Handle select all
  const handleSelectAll = () => {
    dispatch({ type: 'SELECT_ALL_TEMPLATES' });
  };

  // Handle clear selection
  const handleClearSelection = () => {
    dispatch({ type: 'CLEAR_TEMPLATE_SELECTION' });
  };

  // Batch operations are now handled by BatchOperations component

  // Handle template reorder
  const handleTemplateReorder = async (templateId, newIndex) => {
    try {
      await controller.templateManager.reorderTemplate(templateId, newIndex);
      dispatch({ type: 'SET_TEMPLATES', payload: await controller.templateManager.getAllTemplates() });
    } catch (error) {
      console.error('Failed to reorder template:', error);
      throw error;
    }
  };

  // Handle template cross-group move
  const handleTemplateMove = async (templateId, targetGroupId, newIndex) => {
    try {
      await controller.templateManager.moveTemplate(templateId, targetGroupId);
      // Optionally reorder after move
      if (newIndex !== undefined) {
        await controller.templateManager.reorderTemplate(templateId, newIndex);
      }
      dispatch({ type: 'SET_TEMPLATES', payload: await controller.templateManager.getAllTemplates() });
    } catch (error) {
      console.error('Failed to move template:', error);
      throw error;
    }
  };

  // Drag and drop handlers
  const dragDropHandlers = useTemplateDragDrop({
    templates: state.filteredTemplates,
    onReorder: handleTemplateReorder,
    onMove: handleTemplateMove
  });

  // Handle template checkbox toggle
  const handleTemplateCheckboxToggle = (templateId) => {
    dispatch({ type: 'TOGGLE_TEMPLATE_SELECTION', payload: templateId });
  };

  // Handle template edit
  const handleTemplateEdit = (template) => {
    dispatch({ type: 'SHOW_TEMPLATE_EDITOR', payload: template });
  };

  // Handle template delete
  const handleTemplateDelete = async (templateId) => {
    const confirmed = window.confirm('确定要删除这个模板吗？');
    if (!confirmed) return;

    try {
      await controller.templateManager.deleteTemplate(templateId);
      dispatch({ type: 'SET_TEMPLATES', payload: await controller.templateManager.getAllTemplates() });
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  // Handle add new template
  const handleAddTemplate = () => {
    dispatch({ 
      type: 'SHOW_TEMPLATE_EDITOR', 
      payload: { groupId: state.selectedGroupId } 
    });
  };

  return (
    <div className="template-list-view">
      {/* Batch Operations Toolbar */}
      <BatchOperations type="template" />

      <div className="template-list-header">
        <input
          type="checkbox"
          className="template-list-select-all"
          checked={
            state.filteredTemplates.length > 0 &&
            state.selectedTemplateIds.size === state.filteredTemplates.length
          }
          onChange={
            state.selectedTemplateIds.size === state.filteredTemplates.length
              ? handleClearSelection
              : handleSelectAll
          }
        />
        <span className="template-list-header-text">
          {state.filteredTemplates.length} 个模板
        </span>
        <Button
          variant="primary"
          size="small"
          onClick={handleAddTemplate}
        >
          + 添加模板
        </Button>
      </div>

      <div className="template-list-body">
        {state.filteredTemplates.length === 0 ? (
          <div className="template-list-empty">
            <div className="template-list-empty-icon">📝</div>
            <p className="template-list-empty-text">暂无模板</p>
            <Button
              variant="primary"
              size="medium"
              onClick={handleAddTemplate}
            >
              创建第一个模板
            </Button>
          </div>
        ) : (
          state.filteredTemplates.map(template => (
            <TemplateListItem
              key={template.id}
              template={template}
              isChecked={state.selectedTemplateIds.has(template.id)}
              onCheckboxToggle={handleTemplateCheckboxToggle}
              onEdit={handleTemplateEdit}
              onDelete={handleTemplateDelete}
              dragDropHandlers={dragDropHandlers}
            />
          ))
        )}
      </div>
    </div>
  );
}
