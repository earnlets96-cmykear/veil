/**
 * Redesigned New Group Modal Component for VEIL.
 *
 * Implements username-driven member selection workflow:
 * 1. Group Name & Description entry.
 * 2. Live search by @username (combining local contacts and remote directory lookup).
 * 3. Selected members preview with remove capability and member count badge.
 * 4. Resolves human usernames to cryptographic account/identity credentials.
 * 5. Prevents accidental empty group creation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../app/AppState.tsx';
import { Button, IconButton, Avatar } from './ui/index.ts';
import { CloseIcon, UsersIcon, SearchIcon, CheckIcon, UserPlusIcon } from './icons/index.ts';

interface SelectedMember {
  identityId: string;
  username: string;
  displayName: string;
  avatar?: string;
  signingPublicKey?: string;
  mailboxId?: string;
}

export const NewGroupModal: React.FC = () => {
  const { createGroup, closeModal, contacts, searchDirectory, directoryClient } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SelectedMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search by username debounced across local contacts and directory lookup
  useEffect(() => {
    const q = searchQuery.trim().replace(/^@/, '');
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let active = true;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const localMatches: SelectedMember[] = contacts
          .filter((c) => {
            const matchName = c.name?.toLowerCase().includes(q.toLowerCase());
            const matchUser = c.accountUsername?.toLowerCase().includes(q.toLowerCase());
            return matchName || matchUser;
          })
          .map((c) => ({
            identityId: c.identityId,
            username: c.accountUsername || c.name.replace(/^@/, '').trim(),
            displayName: c.name,
            avatar: c.avatar,
            signingPublicKey: c.signingPublicKey,
            mailboxId: c.mailboxId,
          }));

        let directoryMatches: SelectedMember[] = [];
        try {
          const results = await searchDirectory(q);
          directoryMatches = results.map((r) => ({
            identityId: r.identityId,
            username: r.username,
            displayName: r.displayName || r.username,
            avatar: r.avatar,
          }));
        } catch (_dErr) {}

        if (!active) return;

        // Merge and deduplicate by identityId or username
        const map = new Map<string, SelectedMember>();
        for (const m of localMatches) {
          map.set(m.identityId || m.username, m);
        }
        for (const m of directoryMatches) {
          if (!map.has(m.identityId) && !map.has(m.username)) {
            map.set(m.identityId || m.username, m);
          }
        }

        setSearchResults(Array.from(map.values()));
      } finally {
        if (active) setIsSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, contacts, searchDirectory]);

  const handleAddMember = async (member: SelectedMember) => {
    if (selectedMembers.some((m) => m.identityId === member.identityId || m.username === member.username)) {
      return;
    }

    // Resolve public key and mailboxId if not already present
    let enriched = { ...member };
    if (!enriched.signingPublicKey || !enriched.mailboxId) {
      try {
        const profile = await directoryClient.getProfileByUsername(member.username);
        if (profile) {
          enriched.signingPublicKey = profile.prekeyBundle?.identityDocument?.signingPublicKey;
          enriched.mailboxId = profile.mailboxId;
          enriched.identityId = profile.identityId;
        }
      } catch (_pErr) {}
    }

    setSelectedMembers((prev) => [...prev, enriched]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveMember = (identityOrUsername: string) => {
    setSelectedMembers((prev) =>
      prev.filter((m) => m.identityId !== identityOrUsername && m.username !== identityOrUsername)
    );
  };

  const handleClearSelection = () => {
    setSelectedMembers([]);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedMembers.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await createGroup(name.trim(), description.trim(), selectedMembers);
      closeModal();
    } catch (err: any) {
      setError(err?.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-group-title">
      <div className="veil-modal-card" style={{ maxWidth: '480px', width: '90vw' }}>
        <div className="veil-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <UsersIcon size={20} color="var(--veil-accent-primary)" />
            <h2 id="create-group-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600, margin: 0 }}>
              Create Encrypted Group
            </h2>
          </div>
          <IconButton icon={<CloseIcon size={18} />} aria-label="Close dialog" onClick={closeModal} />
        </div>

        <form onSubmit={handleCreateGroup}>
          <div className="veil-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-sm)', marginBottom: '1rem' }}>
              Group messages use Sender Key ratchets with forward secrecy and cryptographic isolation.
            </p>

            {error && (
              <div
                style={{
                  padding: '0.6rem',
                  borderRadius: 'var(--veil-radius-sm)',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--veil-danger, #ef4444)',
                  fontSize: 'var(--veil-text-xs)',
                  marginBottom: '1rem',
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Group Name */}
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
                Group Name *
              </label>
              <input
                type="text"
                className="veil-input"
                placeholder="e.g. Core Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Description (Optional) */}
            <div style={{ marginBottom: '1.25rem' }}>
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

            {/* Selected Members Section */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)' }}>
                  Selected Members ({selectedMembers.length})
                </span>
                {selectedMembers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--veil-accent-primary)',
                      fontSize: 'var(--veil-text-xs)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {selectedMembers.length === 0 ? (
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--veil-radius-sm)',
                    border: '1px dashed var(--veil-border)',
                    textAlign: 'center',
                    fontSize: 'var(--veil-text-xs)',
                    color: 'var(--veil-text-muted)',
                  }}
                >
                  No members added yet. Search by username below to add participants.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {selectedMembers.map((member) => (
                    <div
                      key={member.identityId || member.username}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px 4px 6px',
                        background: 'var(--veil-bg-surface-elevated)',
                        border: '1px solid var(--veil-border)',
                        borderRadius: 'var(--veil-radius-full, 9999px)',
                        fontSize: 'var(--veil-text-xs)',
                      }}
                    >
                      <Avatar name={member.displayName || member.username} size="xs" src={member.avatar} />
                      <span style={{ fontWeight: 500 }}>{member.displayName}</span>
                      <span style={{ color: 'var(--veil-text-muted)' }}>@{member.username}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.identityId || member.username)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--veil-text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 2px',
                        }}
                        aria-label={`Remove ${member.displayName}`}
                      >
                        <CloseIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Username Search Section */}
            <div style={{ marginBottom: '0.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--veil-text-xs)',
                  fontWeight: 600,
                  color: 'var(--veil-text-secondary)',
                  marginBottom: '0.4rem',
                }}
              >
                Add Members by Username
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="veil-input"
                  placeholder="🔍 Search @username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2rem' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '0.65rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--veil-text-muted)',
                    display: 'flex',
                  }}
                >
                  <SearchIcon size={15} />
                </span>
                {isSearching && (
                  <span
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 'var(--veil-text-xs)',
                      color: 'var(--veil-text-muted)',
                    }}
                  >
                    Searching...
                  </span>
                )}
              </div>

              {/* Search Results Dropdown / List */}
              {searchResults.length > 0 && (
                <div
                  style={{
                    marginTop: '0.4rem',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1px solid var(--veil-border)',
                    borderRadius: 'var(--veil-radius-sm)',
                    background: 'var(--veil-bg-surface-elevated)',
                  }}
                >
                  {searchResults.map((user) => {
                    const isSelected = selectedMembers.some(
                      (m) => m.identityId === user.identityId || m.username === user.username
                    );
                    return (
                      <div
                        key={user.identityId || user.username}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          borderBottom: '1px solid var(--veil-border)',
                          cursor: isSelected ? 'default' : 'pointer',
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                        }}
                        onClick={() => !isSelected && handleAddMember(user)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar name={user.displayName} size="sm" src={user.avatar} />
                          <div>
                            <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600 }}>{user.displayName}</div>
                            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
                              @{user.username}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: 'var(--veil-text-xs)',
                              color: 'var(--veil-accent-primary)',
                            }}
                          >
                            <CheckIcon size={14} /> Added
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="veil-btn veil-btn-secondary veil-btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: 'var(--veil-text-xs)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddMember(user);
                            }}
                          >
                            <UserPlusIcon size={12} />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="veil-modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--veil-text-xs)', color: selectedMembers.length === 0 ? 'var(--veil-danger)' : 'var(--veil-text-secondary)' }}>
              {selectedMembers.length === 0 ? 'Select at least 1 member' : `${selectedMembers.length} member${selectedMembers.length === 1 ? '' : 's'} selected`}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!name.trim() || selectedMembers.length === 0}
                loading={isSubmitting}
              >
                <UsersIcon size={16} />
                <span>Create Group</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
