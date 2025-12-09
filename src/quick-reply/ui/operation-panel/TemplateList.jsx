import React from 'react';
import TemplateItem from './TemplateItem';
import './TemplateList.css';

/**
 * TemplateList component
 * Displays a list of templates within a group
 * Requirements: 4.1-4.12, 26.1-26.5, 27.1-27.6, 28.1-28.8
 */
export default function TemplateList({ templates, groupId }) {
  if (!templates || templates.length === 0) {
    return null;
  }

  return (
    <div className="template-list">
      {templates.map((template, index) => (
        <TemplateItem
          key={template.id}
          template={template}
          index={index + 1} // Display 1-based index
        />
      ))}
    </div>
  );
}
