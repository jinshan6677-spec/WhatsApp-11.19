/**
 * Quick Reply React Renderer
 * 
 * Handles rendering and unmounting of the Quick Reply React component
 */

const React = require('react');
const ReactDOM = require('react-dom');
const { OperationPanel } = require('../../quick-reply/ui/operation-panel/OperationPanel');

/**
 * Render quick reply panel
 * @param {HTMLElement} container - Container element
 * @param {Object} props - Component props
 * @param {string} props.accountId - Account ID
 * @param {Object} props.controller - Quick reply controller
 * @param {Function} props.onSend - Send template callback
 * @param {Function} props.onInsert - Insert template callback
 * @param {Function} props.onOpenManagement - Open management callback
 */
function renderQuickReplyPanel(container, props) {
  if (!container) {
    console.error('[QuickReply React] Container element not found');
    return;
  }

  try {
    ReactDOM.render(
      React.createElement(OperationPanel, props),
      container
    );
    console.log('[QuickReply React] Panel rendered successfully');
  } catch (error) {
    console.error('[QuickReply React] Failed to render panel:', error);
    throw error;
  }
}

/**
 * Unmount quick reply panel
 * @param {HTMLElement} container - Container element
 */
function unmountQuickReplyPanel(container) {
  if (!container) {
    console.warn('[QuickReply React] Container element not found for unmounting');
    return;
  }

  try {
    ReactDOM.unmountComponentAtNode(container);
    console.log('[QuickReply React] Panel unmounted successfully');
  } catch (error) {
    console.error('[QuickReply React] Failed to unmount panel:', error);
  }
}

module.exports = {
  renderQuickReplyPanel,
  unmountQuickReplyPanel
};
