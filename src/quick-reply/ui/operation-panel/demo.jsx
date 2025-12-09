/**
 * Demo file showing how to use the Operation Panel
 * This is for development and testing purposes only
 */

import React, { useState } from 'react';
import { OperationPanelProvider, OperationPanel } from './index';
import QuickReplyController from '../../controllers/QuickReplyController';

// Mock translation service
const mockTranslationService = {
  translate: async (text, targetLang, style) => {
    console.log('Translating:', text, 'to', targetLang, 'with style', style);
    return `[Translated: ${text}]`;
  }
};

// Mock WhatsApp Web interface
const mockWhatsappWebInterface = {
  sendMessage: async (message) => {
    console.log('Sending message:', message);
    return { success: true };
  },
  insertToInputBox: async (content) => {
    console.log('Inserting to input box:', content);
    return { success: true };
  }
};

/**
 * Demo component
 */
export default function OperationPanelDemo() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Create controller instance
  const accountId = 'demo-account-123';
  const controller = new QuickReplyController(
    accountId,
    mockTranslationService,
    mockWhatsappWebInterface
  );

  // Handle panel open
  const handleOpenPanel = () => {
    setIsPanelOpen(true);
  };

  // Handle panel close
  const handleClosePanel = () => {
    setIsPanelOpen(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Operation Panel Demo</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={handleOpenPanel}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Open Operation Panel
        </button>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h3>Instructions:</h3>
        <ol>
          <li>Click "Open Operation Panel" to display the panel</li>
          <li>The panel will appear on the right side of the screen</li>
          <li>Try the following features:
            <ul>
              <li>Switch between "原文发送" and "翻译后发送" modes</li>
              <li>Use the search box to filter templates</li>
              <li>Expand/collapse groups by clicking the arrow</li>
              <li>Click on a template to preview it</li>
              <li>Click "发送" to send a template</li>
              <li>Click "输入框提示" to insert a template</li>
              <li>Use the toolbar buttons (refresh, edit, copy, settings)</li>
            </ul>
          </li>
        </ol>
      </div>

      <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
        <h3>Note:</h3>
        <p>
          This is a demo with mock data. In production, the controller will be connected to:
        </p>
        <ul>
          <li>Real translation service</li>
          <li>Real WhatsApp Web interface</li>
          <li>Real data storage</li>
        </ul>
      </div>

      {isPanelOpen && (
        <OperationPanelProvider controller={controller}>
          <OperationPanel
            controller={controller}
            onClose={handleClosePanel}
          />
        </OperationPanelProvider>
      )}
    </div>
  );
}

/**
 * Usage in main app:
 * 
 * import OperationPanelDemo from './quick-reply/ui/operation-panel/demo';
 * 
 * function App() {
 *   return <OperationPanelDemo />;
 * }
 */
