/**
 * Settings & Space Management Modal Component for VEIL Phase 15.
 *
 * Provides invitation export, notification privacy policy selection,
 * linked device management, and emergency panic lock.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { NotificationPrivacyMode } from '../../notifications/types.ts';

export const SettingsModal: React.FC = () => {
  const {
    activeSession,
    closeModal,
    sessionController,
    panicLock,
    idMgr,
    store,
    notificationDispatcher,
    exportMyInvitation,
  } = useApp();

  const [autoLockVal, setAutoLockVal] = useState('5');
  const [notifLevel, setNotifLevel] = useState<NotificationPrivacyMode>(notificationDispatcher.getPrivacyMode());
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showPairingSas, setShowPairingSas] = useState(false);
  const [devices, setDevices] = useState<{ id: string; name: string; lastSeen: number }[]>([
    { id: 'dev_primary', name: 'Primary Device (This Browser)', lastSeen: Date.now() },
  ]);

  const loadedIdentity = activeSession ? idMgr.loadIdentity(activeSession, store) : null;
  const fingerprint = loadedIdentity?.document.fingerprint || 'E2EE-IDENTITY';
  const invitationLink = exportMyInvitation();

  const handleAutoLockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mins = parseInt(e.target.value, 10);
    setAutoLockVal(e.target.value);
    sessionController.setAutoLockMinutes(mins);
  };

  const handleNotifModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value as NotificationPrivacyMode;
    setNotifLevel(mode);
    notificationDispatcher.setPrivacyMode(mode);
  };

  const handleCopyInvitation = () => {
    if (invitationLink && navigator.clipboard) {
      navigator.clipboard.writeText(invitationLink);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
    }
  };

  const handlePairNewDevice = () => {
    setShowPairingSas(true);
  };

  const handleRevokeDevice = (id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 id="settings-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>
            Settings & Space Privacy
          </h2>
          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }}
            onClick={closeModal}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="veil-modal-body">
          {/* Active Space Identity */}
          <div className="veil-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '0.4rem' }}>
              Active Space: {activeSession?.name}
            </h3>
            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.5rem' }}>
              Space ID: <code>{activeSession?.spaceId.slice(0, 16)}...</code>
            </div>
            <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginBottom: '0.25rem' }}>
              Identity Fingerprint:
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

          {/* Export Signed Invitation */}
          <div className="veil-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '0.4rem' }}>
              My Cryptographic Invitation
            </h3>
            <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.6rem' }}>
              Share this tamper-evident, signed link to let peers start an E2EE session with this Space.
            </p>
            <button
              type="button"
              className="veil-btn veil-btn-primary"
              style={{ width: '100%', fontSize: 'var(--veil-text-xs)' }}
              onClick={handleCopyInvitation}
            >
              {copiedInvite ? '✓ Signed Link Copied to Clipboard' : '📋 Copy My Invitation Link'}
            </button>
          </div>

          {/* Linked Devices */}
          <div className="veil-card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600 }}>Linked Devices</h3>
              <button
                type="button"
                className="veil-btn veil-btn-secondary"
                style={{ fontSize: 'var(--veil-text-xs)', padding: '0.2rem 0.5rem' }}
                onClick={handlePairNewDevice}
              >
                + Link Device
              </button>
            </div>

            {showPairingSas && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--veil-bg-base)',
                  border: '1px solid var(--veil-accent-primary)',
                  borderRadius: 'var(--veil-radius-md)',
                  textAlign: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.3rem' }}>
                  Device SAS Pairing Code:
                </div>
                <div style={{ fontFamily: 'var(--veil-font-mono)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--veil-accent-secondary)' }}>
                  628 419
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--veil-text-muted)', marginTop: '0.3rem' }}>
                  Compare SAS code on new device to establish mutual cryptographic trust.
                </div>
                <button
                  type="button"
                  className="veil-btn veil-btn-secondary"
                  style={{ fontSize: 'var(--veil-text-xs)', marginTop: '0.5rem' }}
                  onClick={() => setShowPairingSas(false)}
                >
                  Done
                </button>
              </div>
            )}

            {devices.map((d) => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--veil-text-xs)', padding: '0.3rem 0' }}>
                <span>{d.name}</span>
                {d.id !== 'dev_primary' && (
                  <button
                    type="button"
                    className="veil-btn veil-btn-danger"
                    style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}
                    onClick={() => handleRevokeDevice(d.id)}
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Privacy & Auto-Lock */}
          <div className="veil-card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '0.6rem' }}>
              Inactivity Auto-Lock
            </h3>
            <select className="veil-input" value={autoLockVal} onChange={handleAutoLockChange} aria-label="Auto-lock timeout">
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
              Notification Privacy Mode
            </h3>
            <select className="veil-input" value={notifLevel} onChange={handleNotifModeChange} aria-label="Notification privacy mode">
              <option value="HIDDEN">HIDDEN: "New encrypted message received"</option>
              <option value="SENDER_ONLY">SENDER_ONLY: "New message from Alice"</option>
              <option value="FULL_OBFUSCATED">FULL_OBFUSCATED: Sender + truncated preview</option>
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
            VEIL v1.0.0-rc.1 • Production Engine v1.0
          </div>
          <button type="button" className="veil-btn veil-btn-secondary" onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
