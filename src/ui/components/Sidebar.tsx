/**
 * Sidebar Component for VEIL Phase 15.
 *
 * Implements instant in-memory search, conversation lists, contacts tab,
 * and invitation sharing.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';

export const Sidebar: React.FC = () => {
  const {
    activeSession,
    conversations,
    contacts,
    activeChatId,
    selectConversation,
    openModal,
    lockSpace,
    panicLock,
    networkState,
    searchQuery,
    searchResults,
    setSearchQuery,
    exportMyInvitation,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group' | 'contacts'>('all');
  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleCopyInvite = () => {
    const invite = exportMyInvitation();
    if (invite && navigator.clipboard) {
      navigator.clipboard.writeText(invite);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (activeTab === 'direct') return c.type === 'direct';
    if (activeTab === 'group') return c.type === 'group';
    return true;
  });

  return (
    <aside className="veil-sidebar" role="complementary" aria-label="Sidebar Navigation">
      {/* Space Header */}
      <div className="veil-sidebar-header">
        <div className="veil-space-status-box">
          <div className="veil-space-avatar" aria-hidden="true">
            {activeSession?.name.charAt(0).toUpperCase() || 'S'}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
              {activeSession?.name || 'Active Space'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: networkState === 'connected' ? 'var(--veil-success)' : 'var(--veil-warning)',
                  boxShadow: `0 0 6px ${networkState === 'connected' ? 'var(--veil-success)' : 'var(--veil-warning)'}`,
                }}
                aria-hidden="true"
              />
              <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
                {networkState === 'connected' ? 'Encrypted & Online' : 'Offline / Queued'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.35rem 0.55rem', fontSize: '0.85rem' }}
            onClick={lockSpace}
            title="Lock Space"
            aria-label="Lock Space"
          >
            🔒
          </button>
          <button
            type="button"
            className="veil-btn veil-btn-panic"
            style={{ padding: '0.35rem 0.55rem', fontSize: '0.85rem' }}
            onClick={panicLock}
            title="Panic Lock: Instant Memory Wipe"
            aria-label="Emergency Panic Lock"
          >
            🚨
          </button>
        </div>
      </div>

      {/* Instant Search Bar */}
      <div className="veil-sidebar-search" role="search">
        <input
          type="text"
          className="veil-input"
          style={{ padding: '0.45rem 0.75rem', fontSize: 'var(--veil-text-xs)' }}
          placeholder="Search contacts, messages & groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search conversation history"
        />
      </div>

      {/* Filter Tabs */}
      <div className="veil-sidebar-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'all'}
          className={`veil-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'direct'}
          className={`veil-tab-btn ${activeTab === 'direct' ? 'active' : ''}`}
          onClick={() => setActiveTab('direct')}
        >
          Chats
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'group'}
          className={`veil-tab-btn ${activeTab === 'group' ? 'active' : ''}`}
          onClick={() => setActiveTab('group')}
        >
          Groups
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'contacts'}
          className={`veil-tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          Contacts ({contacts.length})
        </button>
      </div>

      {/* Search Results Overlay or Normal List */}
      <div className="veil-conversation-list">
        {searchQuery.trim() ? (
          <div>
            <div style={{ padding: '0.5rem', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', fontWeight: 600 }}>
              Search Results ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--veil-text-muted)', fontSize: 'var(--veil-text-xs)' }}>
                No matches found in active Space.
              </div>
            ) : (
              searchResults.map((res) => (
                <div
                  key={res.id}
                  className="veil-conversation-item"
                  onClick={() => {
                    if (res.conversationId) selectConversation(res.conversationId);
                    setSearchQuery('');
                  }}
                >
                  <div className="veil-conversation-info">
                    <div className="veil-conversation-top">
                      <span className="veil-conversation-name">{res.title}</span>
                      <span className="veil-badge veil-badge-secure" style={{ fontSize: '0.65rem' }}>{res.type}</span>
                    </div>
                    <div className="veil-conversation-preview">{res.matchSnippet || res.subtitle}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'contacts' ? (
          <div>
            {contacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--veil-text-muted)', fontSize: 'var(--veil-text-xs)' }}>
                No contacts added yet.
                <div style={{ marginTop: '0.5rem' }}>
                  Click <strong>+ Chat</strong> to import an invitation.
                </div>
              </div>
            ) : (
              contacts.map((contact) => (
                <div
                  key={contact.identityId}
                  className="veil-conversation-item"
                  onClick={() => selectConversation(contact.identityId)}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      color: '#ffffff',
                    }}
                  >
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="veil-conversation-info">
                    <div className="veil-conversation-top">
                      <span className="veil-conversation-name">{contact.name}</span>
                      <span
                        className={`veil-badge ${contact.verificationStatus === 'VERIFIED' ? 'veil-badge-secure' : 'veil-badge-warning'}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {contact.verificationStatus === 'VERIFIED' ? '✓ Verified' : 'Unverified'}
                      </span>
                    </div>
                    <div className="veil-conversation-preview">ID: {contact.identityId.slice(0, 16)}...</div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div>
            {filteredConversations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--veil-text-muted)', fontSize: 'var(--veil-text-xs)' }}>
                No conversations found.
                <div style={{ marginTop: '0.5rem' }}>
                  Click <strong>+ Chat</strong> or <strong>+ Group</strong> below to begin.
                </div>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`veil-conversation-item ${activeChatId === conv.id ? 'active' : ''}`}
                  onClick={() => selectConversation(conv.id)}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: conv.type === 'group' ? 'var(--veil-radius-md)' : '50%',
                      background:
                        conv.type === 'group'
                          ? 'linear-gradient(135deg, #0ea5e9, #6366f1)'
                          : 'linear-gradient(135deg, #a855f7, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: '#ffffff',
                    }}
                    aria-hidden="true"
                  >
                    {conv.type === 'group' ? '👥' : conv.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="veil-conversation-info">
                    <div className="veil-conversation-top">
                      <span className="veil-conversation-name">{conv.name}</span>
                      {conv.timestamp && (
                        <span className="veil-conversation-time">
                          {new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="veil-conversation-preview">
                      {conv.lastMessage || (conv.type === 'group' ? 'Group created' : 'E2EE conversation')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Sidebar Footer Controls */}
      <div className="veil-sidebar-footer">
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            className="veil-btn veil-btn-primary"
            style={{ fontSize: 'var(--veil-text-xs)', padding: '0.35rem 0.65rem' }}
            onClick={() => openModal({ type: 'newChat' })}
          >
            + Chat
          </button>
          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ fontSize: 'var(--veil-text-xs)', padding: '0.35rem 0.65rem' }}
            onClick={() => openModal({ type: 'newGroup' })}
          >
            + Group
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ fontSize: 'var(--veil-text-xs)', padding: '0.35rem 0.55rem' }}
            onClick={handleCopyInvite}
            title="Copy Signed My Invitation"
          >
            {copiedInvite ? '✓ Link Copied!' : '🔗 Invite'}
          </button>

          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ fontSize: 'var(--veil-text-xs)', padding: '0.35rem 0.55rem' }}
            onClick={() => openModal({ type: 'settings' })}
            title="Settings & Space Management"
            aria-label="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>
    </aside>
  );
};
