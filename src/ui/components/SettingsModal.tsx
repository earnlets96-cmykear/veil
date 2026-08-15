/**
 * Settings & Space Management Modal Component for VEIL.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';

export const SettingsModal: React.FC = () => {
  const { activeSession, closeModal, sessionController, panicLock, idMgr, store } = useApp();
  const [autoLockVal, setAutoLockVal] = useState('5');
  const [notifLevel, setNotifLevel] = useState('sender_only');

  const loadedIdentity = activeSession ? idMgr.loadIdentity(activeSession, store) : null;
  const fingerprint = loadedIdentity?.document.fingerprint || 'E2EE-IDENTITY';

  const handleAutoLockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mins = parseInt(e.target.value, 10);
    setAutoLockVal(e.target.value);
    sessionController.setAutoLockMinutes(mins);
  };

  return (
    <div className="veil-modal-overlay">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>Settings & Space Privacy</h2>
          <button
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }}
            onClick={closeModal}
          >
            ✕
          </button>
        </div>

        <div className="veil-modal-body">
          {/* Space Identity */}
          <div className="veil-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '0.4rem' }}>
              Active Space: {activeSession?.name}
            </h3>
            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.5rem' }}>
              Space ID: <code>{activeSession?.spaceId.slice(0, 16)}...</code>
            </div>
            <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginBottom: '0.25rem' }}>
              Space Identity Fingerprint:
            </label>
            <div
              style={{
                fontFamily: 'var(--veil-font-mono)',
                fontSize: '0.75rem',
                backgroundColor: 'var(--veil-bg-base)',
                padding: '0.5rem',
                borderRadius: 'var(--veil-radius-sm)',
                border: '1px solid var(--veil-border)',
                wordBreak: 'break-all',
              }}
            >
              {fingerprint}
            </div>
          </div>

          {/* Privacy & Auto-Lock */}
          <div className="veil-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '0.6rem' }}>
              Inactivity Auto-Lock
            </h3>
            <select className="veil-input" value={autoLockVal} onChange={handleAutoLockChange}>
              <option value="1">1 Minute</option>
              <option value="5">5 Minutes (Recommended)</option>
              <option value="15">15 Minutes</option>
              <option value="60">1 Hour</option>
              <option value="0">Never</option>
            </select>
          </div>

          {/* Notification Privacy */}
          <div className="veil-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '0.6rem' }}>
              Notification Privacy
            </h3>
            <select className="veil-input" value={notifLevel} onChange={(e) => setNotifLevel(e.target.value)}>
              <option value="no_preview">No sender or preview ("New message")</option>
              <option value="sender_only">Sender only ("New message from Alice")</option>
            </select>
          </div>

          {/* Emergency Panic Lock */}
          <div className="veil-card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'var(--veil-panic-bg)' }}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, color: '#fca5a5', marginBottom: '0.4rem' }}>
              Emergency Panic Lock
            </h3>
            <p style={{ fontSize: 'var(--veil-text-xs)', color: '#fecaca', marginBottom: '0.75rem' }}>
              Instantly wipes active cryptographic session keys from memory, halts network listeners, and returns to the neutral lock screen.
            </p>
            <button
              type="button"
              className="veil-btn veil-btn-panic"
              style={{ width: '100%' }}
              onClick={panicLock}
            >
              🚨 Trigger Panic Lock Now
            </button>
          </div>
        </div>

        <div className="veil-modal-footer">
          <div style={{ flex: 1, fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
            VEIL v1.0.0-rc.1 • Relay Protocol v1
          </div>
          <button type="button" className="veil-btn veil-btn-secondary" onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
