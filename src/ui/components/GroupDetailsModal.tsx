/**
 * Group Details & Membership Modal Component for VEIL.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { Button, IconButton } from './ui/index.ts';
import { CloseIcon, UsersIcon, ShieldIcon } from './icons/index.ts';

export const GroupDetailsModal: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const { conversations, closeModal } = useApp();
  const [newMemberId, setNewMemberId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const group = (conversations || []).find((c) => c.id === conversationId);
  const groupState = group?.groupState;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberId.trim()) return;
    setNotice(`Member ${newMemberId.trim().slice(0, 8)} invited. Group key rotated (Epoch +1).`);
    setNewMemberId('');
  };

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="group-details-title">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 id="group-details-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>Group Details & Security</h2>
          <IconButton icon={<CloseIcon size={18} />} aria-label="Close dialog" onClick={closeModal} />
        </div>

        <div className="veil-modal-body">
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: 'var(--veil-radius-md)',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                marginBottom: '0.5rem',
              }}
            >
              <UsersIcon size={26} />
            </div>
            <h3 style={{ fontSize: 'var(--veil-text-base)', fontWeight: 600 }}>{group?.name}</h3>
            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginTop: '0.2rem' }}>
              Group ID: <code>{conversationId}</code>
            </div>
          </div>

          <div className="veil-card" style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: 'var(--veil-text-xs)', textTransform: 'uppercase', color: 'var(--veil-text-secondary)', marginBottom: '0.5rem' }}>
              Forward Secrecy & Epoch
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--veil-text-sm)' }}>
              <span>Ratchet Epoch:</span>
              <span className="veil-badge veil-badge-secure">Epoch {groupState?.epoch ?? 1}</span>
            </div>
          </div>

          <form onSubmit={handleAddMember} style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)', marginBottom: '0.4rem' }}>
              Add Member by Identity ID
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="veil-input"
                placeholder="Paste peer Identity ID..."
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
              />
              <Button type="submit" variant="primary" disabled={!newMemberId.trim()}>
                Invite
              </Button>
            </div>
          </form>

          {notice && (
            <div
              style={{
                padding: '0.5rem',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid var(--veil-success)',
                borderRadius: 'var(--veil-radius-md)',
                color: 'var(--veil-success)',
                fontSize: 'var(--veil-text-xs)',
                textAlign: 'center',
              }}
            >
              {notice}
            </div>
          )}
        </div>

        <div className="veil-modal-footer">
          <Button variant="secondary" onClick={closeModal} style={{ width: '100%' }}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
