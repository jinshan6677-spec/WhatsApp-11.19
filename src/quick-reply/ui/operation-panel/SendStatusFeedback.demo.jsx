import React, { useState } from 'react';
import SendStatusFeedback from './SendStatusFeedback';

/**
 * Demo component for SendStatusFeedback
 * Shows all possible states
 */
export default function SendStatusFeedbackDemo() {
  const [currentStatus, setCurrentStatus] = useState('idle');
  const [error, setError] = useState('');

  const statuses = [
    { value: 'idle', label: 'Idle (Hidden)' },
    { value: 'sending', label: 'Sending' },
    { value: 'translating', label: 'Translating' },
    { value: 'translated', label: 'Translated' },
    { value: 'success', label: 'Success' },
    { value: 'error', label: 'Error' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'network_error', label: 'Network Error' },
  ];

  const handleCancel = () => {
    console.log('Cancel clicked');
    setCurrentStatus('cancelled');
  };

  const handleRetry = () => {
    console.log('Retry clicked');
    setCurrentStatus('sending');
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>SendStatusFeedback Demo</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <h2>Controls</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => setCurrentStatus(status.value)}
              style={{
                padding: '8px 16px',
                backgroundColor: currentStatus === status.value ? '#1976d2' : '#f5f5f5',
                color: currentStatus === status.value ? '#ffffff' : '#333333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {status.label}
            </button>
          ))}
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
            Custom Error Message:
          </label>
          <input
            type="text"
            value={error}
            onChange={(e) => setError(e.target.value)}
            placeholder="Enter custom error message"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2>Current Status: {currentStatus}</h2>
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f9f9f9', 
          borderRadius: '8px',
          minHeight: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <SendStatusFeedback
            status={currentStatus}
            error={error || undefined}
            onCancel={handleCancel}
            onRetry={handleRetry}
          />
        </div>
      </div>

      <div>
        <h2>All States Preview</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {statuses.filter(s => s.value !== 'idle').map((status) => (
            <div key={status.value} style={{ 
              padding: '20px', 
              backgroundColor: '#f9f9f9', 
              borderRadius: '8px',
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                {status.label}
              </h3>
              <SendStatusFeedback
                status={status.value}
                error={status.value === 'error' ? '发送失败，请重试' : undefined}
                onCancel={handleCancel}
                onRetry={handleRetry}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
