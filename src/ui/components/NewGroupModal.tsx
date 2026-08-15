/**
 * New Group Modal Component for VEIL.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';

export const NewGroupModal: React.FC = () => {
  const { createGroup, closeModal } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createGroup(name.trim(), description.trim());
  };

  return (
    <div className="veil-modal-overlay">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>Create Encrypted Group</h2>
          <button
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }}
            onClick={closeModal}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleCreateGroup}>
          <div className="veil-modal-body">
            <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginBottom: '1rem' }}>
              Group messages use sender key ratchets with post-compromise security and forward secrecy.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--veil-text-xs)',
                  fontWeight: 600,
                  color: 'var(--veil-text-secondary)',
                  marginBottom: '0.4rem',
                }}
              >
                Group Name
              </label>
              <input
                type="text"
                className="veil-input"
                placeholder="e.g. Project Core Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--veil-text-xs)',
                  fontWeight: 600,
                  color: 'var(--veil-text-secondary)',
                  marginBottom: '0.4rem',
                }}
              >
                Description (Optional)
              </label>
              <input
                type="text"
                className="veil-input"
                placeholder="Private group for team members"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="veil-modal-footer">
            <button type="button" className="veil-btn veil-btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="veil-btn veil-btn-primary" disabled={!name.trim()}>
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
