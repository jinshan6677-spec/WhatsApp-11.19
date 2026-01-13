/**
 * Management Interface Components
 * 
 * This module exports all components for the Quick Reply management interface.
 * The management interface is a standalone window for creating, editing, and
 * organizing quick reply templates.
 */

export { 
  default as ManagementInterface,
  ManagementInterfaceProvider,
  useManagementInterface
} from './ManagementInterface';

export { default as Header } from './Header';
export { default as PlatformSelector } from './PlatformSelector';
export { default as GroupPanel } from './GroupPanel';
export { default as GroupListItem } from './GroupListItem';
export { default as ContentArea } from './ContentArea';
export { default as TabBar } from './TabBar';
export { default as TemplateListView } from './TemplateListView';
export { default as TemplateListItem } from './TemplateListItem';
export { default as TemplateEditor } from './TemplateEditor';
