/**
 * New Group Modal Component for VEIL.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { Button, IconButton } from './ui/index.ts';
import { CloseIcon, UsersIcon } from './icons/index.ts';

export const NewGroupModal: React.FC = () => {
  const { createGroup, closeModal } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createGroup(name.trim(), description.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-group-title">
      <div className="veil-modal-card">
        <div className="veil-modal-header">
          <h2 id="create-group-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>Create Encrypted Group</h2>
          <IconButton icon={<CloseIcon size={18} />} aria-label="Close dialog" onClick={closeModal} />
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
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!name.trim()} loading={isSubmitting}>
              <UsersIcon size={16} />
              <span>Create Group</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
