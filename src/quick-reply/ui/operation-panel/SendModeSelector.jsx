import React from 'react';
import { useOperationPanel } from './OperationPanel';
import './SendModeSelector.css';

/**
 * SendModeSelector component
 * Allows users to choose between sending original text or translated text
 * Requirements: 7.1-7.9, 8.1-8.9
 */
export default function SendModeSelector() {
  const { state, dispatch } = useOperationPanel();

  // Handle mode change
  const handleModeChange = (mode) => {
    dispatch({ type: 'SET_SEND_MODE', payload: mode });
  };

  return (
    <div className="send-mode-selector">
      <div className="send-mode-options">
        <label className="send-mode-option">
          <input
            type="radio"
            name="sendMode"
            value="original"
            checked={state.sendMode === 'original'}
            onChange={() => handleModeChange('original')}
            className="send-mode-radio"
          />
          <span className="send-mode-label">原文发送</span>
        </label>

        <label className="send-mode-option">
          <input
            type="radio"
            name="sendMode"
            value="translated"
            checked={state.sendMode === 'translated'}
            onChange={() => handleModeChange('translated')}
            className="send-mode-radio"
          />
          <span className="send-mode-label">翻译后发送</span>
        </label>
      </div>

      {state.sendMode === 'translated' && (
        <div className="send-mode-hint">
          <svg className="send-mode-hint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="send-mode-hint-text">
            将使用翻译设置中配置的翻译引擎进行翻译
          </span>
        </div>
      )}
    </div>
  );
}
