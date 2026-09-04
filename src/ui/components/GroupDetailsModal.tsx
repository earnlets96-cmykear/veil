/**
 * Group Details & Membership Management Modal for VEIL.
 *
 * Implements:
 * - Live search and add members by @username or contact name via directory lookup.
 * - Cryptographic SenderKey ratchet rotation and key distribution upon adding members.
 * - Real member roster with roles (CREATOR, ADMIN, MEMBER) and member removal.
 * - Forward secrecy status and epoch monitoring.
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../app/AppState.tsx';
import { Button, IconButton, Avatar, Spinner } from './ui/index.ts';
import { CloseIcon, UsersIcon, ShieldIcon, SearchIcon, UserPlusIcon, TrashIcon } from './icons/index.ts';
import { GroupMember } from '../../group/types.ts';

interface SearchMemberResult {
  identityId: string;
  username: string;
  displayName: string;
  avatar?: string;
  signingPublicKey?: string;
  mailboxId?: string;
}

export const GroupDetailsModal: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const {
    conversations,
    closeModal,
    contacts,
    searchDirectory,
    directoryClient,
    addGroupMember,
    removeGroupMember,
    activeSession,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMemberResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const group = (conversations || []).find((c) => c.id === conversationId);
  const groupState = group?.groupState;
  const membersList: GroupMember[] = Object.values(groupState?.members || {});

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
        const localMatches: SearchMemberResult[] = contacts
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

        let directoryMatches: SearchMemberResult[] = [];
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

        // Filter out existing members
        const existingIds = new Set(membersList.map((m: any) => m.identityId));
        const map = new Map<string, SearchMemberResult>();

        for (const m of localMatches) {
          if (!existingIds.has(m.identityId)) {
            map.set(m.identityId || m.username, m);
          }
        }
        for (const m of directoryMatches) {
          if (!existingIds.has(m.identityId) && !map.has(m.identityId) && !map.has(m.username)) {
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
  }, [searchQuery, contacts, searchDirectory, membersList]);

  const handleAddMember = async (candidate: SearchMemberResult) => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      let enriched = { ...candidate };
      if (!enriched.signingPublicKey || !enriched.mailboxId) {
        try {
          const profile = await directoryClient.getProfileByUsername(candidate.username);
          if (profile) {
            enriched.signingPublicKey = profile.prekeyBundle?.identityDocument?.signingPublicKey;
            enriched.mailboxId = profile.mailboxId;
            enriched.identityId = profile.identityId;
          }
        } catch (_pErr) {}
      }

      await addGroupMember(conversationId, enriched);
      setNotice(`@${candidate.username || candidate.displayName} added to group. Group key rotated (Epoch ${groupState?.epoch ? groupState.epoch + 1 : 2}).`);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      setError(err?.message || 'Failed to add member to group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberIdentityId: string, memberName: string) => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await removeGroupMember(conversationId, memberIdentityId);
      setNotice(`${memberName} removed. Group key rotated to advance epoch.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to remove group member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCreator = groupState?.creatorIdentityId === activeSession?.spaceId;

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="group-details-title">
      <div className="veil-modal-card" style={{ maxWidth: '480px', width: '90vw' }}>
        <div className="veil-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <UsersIcon size={20} color="var(--veil-accent-primary)" />
            <h2 id="group-details-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600, margin: 0 }}>
              Group Details & Security
            </h2>
          </div>
          <IconButton icon={<CloseIcon size={18} />} aria-label="Close dialog" onClick={closeModal} />
        </div>

        <div className="veil-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
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
            <h3 style={{ fontSize: 'var(--veil-text-base)', fontWeight: 600, margin: '0.2rem 0' }}>{group?.name}</h3>
            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginTop: '0.2rem' }}>
              Group ID: <code>{conversationId}</code>
            </div>
          </div>

          <div className="veil-card" style={{ marginBottom: '1rem', padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--veil-text-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldIcon size={16} color="var(--veil-accent-primary)" />
                <span style={{ fontWeight: 600 }}>Forward Secrecy:</span>
              </div>
              <span className="veil-badge veil-badge-secure">Epoch {groupState?.epoch ?? 1}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--veil-text-xs)', marginTop: '0.4rem', color: 'var(--veil-text-secondary)' }}>
              <span>Members:</span>
              <span style={{ fontWeight: 600, color: 'var(--veil-text-primary)' }}>{membersList.length} members</span>
            </div>
          </div>

          {notice && (
            <div
              style={{
                padding: '0.6rem',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid var(--veil-success)',
                borderRadius: 'var(--veil-radius-md)',
                color: 'var(--veil-success)',
                fontSize: 'var(--veil-text-xs)',
                textAlign: 'center',
                marginBottom: '1rem',
              }}
            >
              {notice}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '0.6rem',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--veil-danger)',
                borderRadius: 'var(--veil-radius-md)',
                color: 'var(--veil-danger)',
                fontSize: 'var(--veil-text-xs)',
                textAlign: 'center',
                marginBottom: '1rem',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Add Member by Username Section */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)', marginBottom: '0.4rem' }}>
              Add Member by @Username
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="veil-input"
                placeholder="Search @username or contact name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2rem' }}
                disabled={isSubmitting}
              />
              <SearchIcon
                size={14}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--veil-text-muted)' }}
              />
              {isSearching && (
                <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
                  <Spinner size="sm" />
                </div>
              )}
            </div>

            {/* Live Search Candidate Results */}
            {searchResults.length > 0 && (
              <div
                style={{
                  marginTop: '0.5rem',
                  borderRadius: 'var(--veil-radius-md)',
                  border: '1px solid var(--veil-border)',
                  backgroundColor: 'var(--veil-bg-surface-elevated)',
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}
              >
                {searchResults.map((r) => (
                  <div
                    key={r.identityId || r.username}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      borderBottom: '1px solid var(--veil-border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Avatar name={r.displayName || r.username} src={r.avatar} size="sm" />
                      <div>
                        <div style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600 }}>{r.displayName}</div>
                        <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)' }}>@{r.username}</div>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAddMember(r)}
                      disabled={isSubmitting}
                      style={{ padding: '0.2rem 0.6rem', fontSize: 'var(--veil-text-xs)', gap: '4px' }}
                    >
                      <UserPlusIcon size={12} />
                      <span>Add</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Members Roster */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)', marginBottom: '0.5rem' }}>
              Current Members ({membersList.length})
            </label>
            <div
              style={{
                borderRadius: 'var(--veil-radius-md)',
                border: '1px solid var(--veil-border)',
                backgroundColor: 'var(--veil-bg-surface-elevated)',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {membersList.map((m: any) => {
                const contactMatch = contacts.find((c) => c.identityId === m.identityId);
                const isMe = m.identityId === myProfile?.identityId || m.identityId === activeSession?.spaceId;
                const memberName = isMe
                  ? (myProfile?.displayName || 'You')
                  : (m.displayName || contactMatch?.name || (m.username ? m.username : 'Member'));
                const memberUsername = isMe
                  ? myProfile?.username
                  : (m.username || contactMatch?.accountUsername);
                const canRemove = isCreator && !isMe;

                return (
                  <div
                    key={m.identityId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      borderBottom: '1px solid var(--veil-border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Avatar name={memberName} src={contactMatch?.avatar} size="sm" />
                      <div>
                        <div style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 500 }}>
                          {memberName}
                          {isMe && (
                            <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginLeft: '4px' }}>(You)</span>
                          )}
                        </div>
                        {memberUsername && (
                          <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)' }}>
                            @{memberUsername.replace(/^@/, '')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        className={`veil-badge ${m.role === 'CREATOR' ? 'veil-badge-secure' : 'veil-badge-default'}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {m.role}
                      </span>
                      {canRemove && (
                        <IconButton
                          icon={<TrashIcon size={14} color="var(--veil-danger)" />}
                          aria-label={`Remove ${memberName}`}
                          onClick={() => handleRemoveMember(m.identityId, memberName)}
                          disabled={isSubmitting}
                          title="Remove member"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="veil-modal-footer" style={{ marginTop: '1rem' }}>
          <Button variant="secondary" onClick={closeModal} style={{ width: '100%' }}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
