import React from 'react';
import TemplateItem from './TemplateItem';
import './TemplateList.css';

/**
 * TemplateList component
 * Displays a list of templates within a group
 * Requirements: 4.1-4.12, 26.1-26.5, 27.1-27.6, 28.1-28.8, 1.1.8
 * 
 * @param {Array} templates - Array of template objects to display
 * @param {string} groupId - ID of the group these templates belong to
 * @param {number} startIndex - Starting index for sequence numbers (default: 0)
 *                              Used for continuous numbering across groups
 */
export default function TemplateList({ templates, groupId, startIndex = 0 }) {
  if (!templates || templates.length === 0) {
    return null;
  }

  return (
    <div className="template-list">
      {templates.map((template, index) => (
        <TemplateItem
          key={template.id}
          template={template}
          index={startIndex + index + 1} // Display 1-based index, continuous from startIndex
        />
      ))}
    </div>
  );
}
