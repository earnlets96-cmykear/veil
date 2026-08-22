/**
 * Modernized Conversation Sidebar Component for VEIL Phase 31.
 *
 * Implements instant in-memory search, active Space identity header,
 * tabbed filtering (All, Chats, Groups, Contacts), contact request actions,
 * and invitation sharing using VEIL reusable component primitives.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  SearchInput,
  StatusIndicator,
  EmptyState,
} from './ui/index.ts';

export const Sidebar: React.FC = () => {
  const {
    activeSession,
    conversations,
    contacts,
    contactRequests,
    acceptContactRequest,
    declineContactRequest,
    blockUser,
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

  const pendingIncoming = contactRequests.filter((r) => r.status === 'INCOMING_PENDING');
  const pendingOutgoing = contactRequests.filter((r) => r.status === 'OUTGOING_PENDING');

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
        <div
          className="veil-space-status-box"
          onClick={() => openModal({ type: 'profile' })}
          style={{ cursor: 'pointer' }}
          title="View & Edit My Profile"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              openModal({ type: 'profile' });
            }
          }}
        >
          <Avatar
            name={activeSession?.name || 'Active Space'}
            size="md"
            isSquare
            aria-label="Current Space Profile"
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
              {activeSession?.name || 'Active Space'}
            </div>
            <StatusIndicator
              status={networkState === 'connected' ? 'online' : 'offline'}
              label={networkState === 'connected' ? 'Encrypted & Online' : 'Offline / Queued'}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <IconButton
            icon="🔒"
            variant="secondary"
            onClick={lockSpace}
            aria-label="Lock Space"
            title="Lock Space"
          />
          <IconButton
            icon="🚨"
            variant="danger"
            onClick={panicLock}
            aria-label="Panic Lock: Instant Memory Wipe"
            title="Panic Lock: Instant Memory Wipe"
          />
        </div>
      </div>

      {/* Instant Search Bar */}
      <div className="veil-sidebar-search" role="search">
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          placeholder="Search contacts, messages & groups..."
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
          Contacts {pendingIncoming.length > 0 && <Badge variant="warning">{pendingIncoming.length}</Badge>}
        </button>
      </div>

      {/* Conversation / Contacts / Search List */}
      <div className="veil-conversation-list">
        {searchQuery.trim() ? (
          <div>
            <div style={{ padding: '0.5rem', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', fontWeight: 600 }}>
              Search Results ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No Matches Found"
                description="No messages, contacts, or groups match your search in this Space."
              />
            ) : (
              searchResults.map((res) => (
                <div
                  key={res.id}
                  className="veil-conversation-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (res.conversationId) selectConversation(res.conversationId);
                    setSearchQuery('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (res.conversationId) selectConversation(res.conversationId);
                      setSearchQuery('');
                    }
                  }}
                >
                  <div className="veil-conversation-info">
                    <div className="veil-conversation-top">
                      <span className="veil-conversation-name">{res.title}</span>
                      <Badge variant="secure">{res.type}</Badge>
                    </div>
                    <div className="veil-conversation-preview">{res.matchSnippet || res.subtitle}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'contacts' ? (
          <div>
            {/* Incoming Requests Section */}
            {pendingIncoming.length > 0 && (
              <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'var(--veil-accent-primary-subtle)', borderRadius: 'var(--veil-radius-md)' }}>
                <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-accent-primary)', marginBottom: '0.5rem' }}>
                  Incoming Contact Requests ({pendingIncoming.length})
                </div>
                {pendingIncoming.map((req) => (
                  <div
                    key={req.requestId}
                    style={{
                      padding: '0.6rem',
                      backgroundColor: 'var(--veil-bg-surface)',
                      borderRadius: 'var(--veil-radius-sm)',
                      marginBottom: '0.4rem',
                      border: '1px solid var(--veil-border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--veil-text-xs)' }}>
                        {req.peerDisplayName} <span style={{ color: 'var(--veil-accent-primary)' }}>@{req.peerUsername}</span>
                      </span>
                    </div>
                    {req.greeting && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--veil-text-secondary)', marginBottom: '0.4rem', fontStyle: 'italic' }}>
                        "{req.greeting}"
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => acceptContactRequest(req.requestId)}
                      >
                        ✓ Accept
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => declineContactRequest(req.requestId)}
                      >
                        ✕ Decline
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => blockUser(req.peerIdentityId)}
                        title="Block User"
                      >
                        🚫
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Outgoing Requests Section */}
            {pendingOutgoing.length > 0 && (
              <div style={{ marginBottom: '0.75rem', padding: '0.5rem' }}>
                <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-muted)', marginBottom: '0.3rem' }}>
                  Sent Requests ({pendingOutgoing.length})
                </div>
                {pendingOutgoing.map((req) => (
                  <div
                    key={req.requestId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.35rem 0.5rem',
                      fontSize: 'var(--veil-text-xs)',
                      color: 'var(--veil-text-secondary)',
                    }}
                  >
                    <span>@{req.peerUsername}</span>
                    <Badge variant="warning">Pending</Badge>
                  </div>
                ))}
              </div>
            )}

            {contacts.length === 0 && pendingIncoming.length === 0 && (
              <EmptyState
                icon="👥"
                title="No Contacts Added"
                description="Add contacts by username search or import an invitation link."
                action={
                  <Button variant="primary" size="sm" onClick={() => openModal({ type: 'newChat' })}>
                    + Find Users
                  </Button>
                }
              />
            )}

            {contacts.map((contact) => (
              <div
                key={contact.identityId}
                className="veil-conversation-item"
                role="button"
                tabIndex={0}
                onClick={() => selectConversation(contact.identityId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectConversation(contact.identityId);
                  }
                }}
              >
                <Avatar name={contact.name} size="md" />
                <div className="veil-conversation-info">
                  <div className="veil-conversation-top">
                    <span className="veil-conversation-name">{contact.name}</span>
                    <Badge variant={contact.verificationStatus === 'VERIFIED' ? 'secure' : 'warning'}>
                      {contact.verificationStatus === 'VERIFIED' ? '✓ Verified' : 'Unverified'}
                    </Badge>
                  </div>
                  <div className="veil-conversation-preview">ID: {contact.identityId.slice(0, 16)}...</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {filteredConversations.length === 0 ? (
              <EmptyState
                icon="💬"
                title="No Conversations"
                description="Begin an end-to-end encrypted chat or create a secure group."
                action={
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <Button variant="primary" size="sm" onClick={() => openModal({ type: 'newChat' })}>
                      + Chat
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => openModal({ type: 'newGroup' })}>
                      + Group
                    </Button>
                  </div>
                }
              />
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`veil-conversation-item ${activeChatId === conv.id ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectConversation(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectConversation(conv.id);
                    }
                  }}
                >
                  <Avatar
                    name={conv.name}
                    isGroup={conv.type === 'group'}
                    size="md"
                  />

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
          <Button
            variant="primary"
            size="sm"
            onClick={() => openModal({ type: 'newChat' })}
          >
            + Chat
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openModal({ type: 'newGroup' })}
          >
            + Group
          </Button>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyInvite}
            title="Copy Signed My Invitation"
          >
            {copiedInvite ? '✓ Copied!' : '🔗 Invite'}
          </Button>

          <IconButton
            icon="⚙️"
            variant="secondary"
            onClick={() => openModal({ type: 'settings' })}
            aria-label="Settings and Space Management"
            title="Settings & Space Management"
          />
        </div>
      </div>
    </aside>
  );
};
