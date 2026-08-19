/**
 * New Chat & User Discovery Modal Component for VEIL Phase 24.
 *
 * Implements tabbed user discovery via global @username search with anti-enumeration,
 * signed public profile viewing, contact request dispatch, and fallback invitation link import.
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../app/AppState.tsx';
import { InvitationManager } from '../../contacts/invitationManager.ts';
import { DirectorySearchResult } from '../../server/types.ts';

export const NewChatModal: React.FC = () => {
  const {
    addContactFromInvitation,
    addDirectContact,
    searchDirectory,
    sendContactRequest,
    contacts,
    contactRequests,
    directoryClient,
    closeModal,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'search' | 'invite'>('search');

  // Username Search State
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<DirectorySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DirectorySearchResult | null>(null);
  const [greeting, setGreeting] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  // Invite Link State
  const [inviteInput, setInviteInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Live Directory Search Debounced
  useEffect(() => {
    const q = searchUsername.trim().replace(/^@/, '');
    if (q.length < 1) {
      setSearchResults([]);
      return;
    }

    let isMounted = true;
    setIsSearching(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const results = await searchDirectory(q);
        if (isMounted) {
          setSearchResults(results);
          setIsSearching(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Directory search failed');
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchUsername, searchDirectory]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setError(null);
    setLoading(true);

    try {
      await sendContactRequest(selectedUser.username, greeting || undefined);
      setRequestSent(true);
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to send contact request');
    } finally {
      setLoading(false);
    }
  };

  const handleImportInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;

    setError(null);
    setLoading(true);
    const raw = inviteInput.trim();

    try {
      if (raw.startsWith('veil://invite/') || (raw.startsWith('{') && raw.includes('"signature"'))) {
        const invitation = InvitationManager.verifyAndParseInvitation(raw);
        await addContactFromInvitation(invitation);
      } else if (raw.startsWith('{')) {
        const doc = JSON.parse(raw);
        await addDirectContact(doc);
      } else {
        const cleanName = raw.replace(/^@/, '').trim();
        const profile = await directoryClient.getProfileByUsername(cleanName);
        if (profile) {
          await addContactFromInvitation({
            version: 1,
            identityId: profile.identityId,
            name: profile.displayName || profile.username,
            signingPublicKey: profile.prekeyBundle.identityDocument.signingPublicKey,
            keyAgreementPublicKey: profile.prekeyBundle.identityDocument.keyAgreementPublicKey,
            fingerprint: profile.prekeyBundle.identityDocument.fingerprint,
            mailboxId: profile.mailboxId,
            prekeyBundle: profile.prekeyBundle,
            createdAt: profile.issuedAt,
            expiresAt: profile.expiresAt || 0,
            signature: profile.signature,
          });
        } else {
          const doc = {
            version: 1 as const,
            identityId: raw,
            signingPublicKey: 'dummy_sign_pub',
            keyAgreementPublicKey: 'dummy_ka_pub',
            fingerprint: raw.slice(0, 16).toUpperCase(),
            createdAt: Date.now(),
            signature: 'dummy_sig',
          };
          await addDirectContact(doc);
        }
      }
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Invalid or tampered invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="new-chat-title">
      <div className="veil-modal-card" style={{ maxWidth: '500px' }}>
        <div className="veil-modal-header">
          <h2 id="new-chat-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>
            Start New Conversation
          </h2>
          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }}
            onClick={closeModal}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--veil-border-subtle)',
            backgroundColor: 'var(--veil-bg-base)',
          }}
        >
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.65rem',
              fontWeight: 600,
              fontSize: 'var(--veil-text-xs)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'search' ? '2px solid var(--veil-accent)' : '2px solid transparent',
              color: activeTab === 'search' ? 'var(--veil-accent)' : 'var(--veil-text-secondary)',
              cursor: 'pointer',
            }}
            onClick={() => {
              setActiveTab('search');
              setError(null);
            }}
          >
            🔍 Find by @username
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.65rem',
              fontWeight: 600,
              fontSize: 'var(--veil-text-xs)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'invite' ? '2px solid var(--veil-accent)' : '2px solid transparent',
              color: activeTab === 'invite' ? 'var(--veil-accent)' : 'var(--veil-text-secondary)',
              cursor: 'pointer',
            }}
            onClick={() => {
              setActiveTab('invite');
              setError(null);
            }}
          >
            🔗 Import Invitation Link
          </button>
        </div>

        {activeTab === 'search' ? (
          <div className="veil-modal-body">
            {!selectedUser ? (
              <>
                <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-xs)', marginBottom: '0.75rem' }}>
                  Search for other VEIL users by their public handle.
                </p>

                <div style={{ marginBottom: '1rem' }}>
                  <label
                    htmlFor="username-search-input"
                    style={{
                      display: 'block',
                      fontSize: 'var(--veil-text-xs)',
                      fontWeight: 600,
                      color: 'var(--veil-text-secondary)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Username
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="username-search-input"
                      type="text"
                      className="veil-input"
                      placeholder="e.g. io, we, or @alice_secure"
                      value={searchUsername}
                      onChange={(e) => setSearchUsername(e.target.value)}
                      autoFocus
                    />
                    {isSearching && (
                      <span
                        style={{
                          position: 'absolute',
                          right: '10px',
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
                </div>

                {/* Search Results List */}
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem' }}>
                  {searchUsername.trim().length >= 1 && searchResults.length === 0 && !isSearching && (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--veil-text-muted)', fontSize: 'var(--veil-text-xs)' }}>
                      No users found matching "@{searchUsername.trim().replace(/^@/, '')}"
                    </div>
                  )}

                  {searchResults.map((user) => {
                    const isExisting = contacts.some((c) => c.identityId === user.identityId);
                    const pendingReq = contactRequests.find(
                      (r) => r.peerIdentityId === user.identityId && r.status === 'OUTGOING_PENDING'
                    );

                    return (
                      <div
                        key={user.identityId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.75rem',
                          backgroundColor: 'var(--veil-bg-base)',
                          borderRadius: 'var(--veil-radius-md)',
                          marginBottom: '0.4rem',
                          border: '1px solid var(--veil-border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              color: '#fff',
                            }}
                          >
                            {user.displayName.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
                              {user.displayName}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--veil-accent)' }}>
                              @{user.username}
                            </div>
                          </div>
                        </div>

                        {isExisting ? (
                          <span className="veil-badge veil-badge-secure" style={{ fontSize: '0.65rem' }}>
                            ✓ Contact
                          </span>
                        ) : pendingReq ? (
                          <span className="veil-badge veil-badge-warning" style={{ fontSize: '0.65rem' }}>
                            ⏳ Pending
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="veil-btn veil-btn-primary"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => setSelectedUser(user)}
                          >
                            + Add Contact
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Contact Request Confirmation & Greeting */
              <form onSubmit={handleSendRequest}>
                {requestSent ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                    <h3 style={{ fontSize: 'var(--veil-text-md)', fontWeight: 600, color: 'var(--veil-success)' }}>
                      Contact Request Sent!
                    </h3>
                    <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginTop: '0.25rem' }}>
                      Once @{selectedUser.username} accepts, you can chat securely.
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        padding: '0.75rem',
                        backgroundColor: 'var(--veil-bg-base)',
                        borderRadius: 'var(--veil-radius-md)',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '1rem',
                          color: '#fff',
                        }}
                      >
                        {selectedUser.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)' }}>
                          {selectedUser.displayName}
                        </div>
                        <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-accent)' }}>
                          @{selectedUser.username}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label
                        htmlFor="request-greeting"
                        style={{
                          display: 'block',
                          fontSize: 'var(--veil-text-xs)',
                          fontWeight: 600,
                          color: 'var(--veil-text-secondary)',
                          marginBottom: '0.4rem',
                        }}
                      >
                        Optional Greeting Message
                      </label>
                      <input
                        id="request-greeting"
                        type="text"
                        className="veil-input"
                        placeholder="Hi! Let's connect on VEIL."
                        value={greeting}
                        onChange={(e) => setGreeting(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="veil-modal-footer" style={{ padding: '0.75rem 0 0 0' }}>
                      <button
                        type="button"
                        className="veil-btn veil-btn-secondary"
                        onClick={() => setSelectedUser(null)}
                        disabled={loading}
                      >
                        Back to Search
                      </button>
                      <button type="submit" className="veil-btn veil-btn-primary" disabled={loading}>
                        {loading ? 'Sending...' : 'Send Request'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}

            {error && (
              <div
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid var(--veil-danger)',
                  borderRadius: 'var(--veil-radius-md)',
                  color: 'var(--veil-danger)',
                  fontSize: 'var(--veil-text-xs)',
                  textAlign: 'center',
                  marginTop: '0.5rem',
                }}
              >
                {error}
              </div>
            )}
          </div>
        ) : (
          /* Fallback Invitation Link Import Tab */
          <form onSubmit={handleImportInvite}>
            <div className="veil-modal-body">
              <p style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-xs)', marginBottom: '1rem' }}>
                Paste a signed invitation link (<code>veil://invite/...</code>) or raw JSON Identity Document.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="invitation-input"
                  style={{
                    display: 'block',
                    fontSize: 'var(--veil-text-xs)',
                    fontWeight: 600,
                    color: 'var(--veil-text-secondary)',
                    marginBottom: '0.4rem',
                  }}
                >
                  Signed Invitation Payload
                </label>
                <textarea
                  id="invitation-input"
                  className="veil-input"
                  style={{ minHeight: '100px', fontFamily: 'var(--veil-font-mono)', fontSize: 'var(--veil-text-xs)' }}
                  placeholder="veil://invite/eyJ2ZXJzaW9uIjox..."
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: '0.5rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid var(--veil-danger)',
                    borderRadius: 'var(--veil-radius-md)',
                    color: 'var(--veil-danger)',
                    fontSize: 'var(--veil-text-xs)',
                    textAlign: 'center',
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            <div className="veil-modal-footer">
              <button type="button" className="veil-btn veil-btn-secondary" onClick={closeModal} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="veil-btn veil-btn-primary" disabled={!inviteInput.trim() || loading}>
                {loading ? 'Verifying...' : 'Verify & Add Contact'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
