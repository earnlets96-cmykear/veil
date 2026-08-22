/**
 * Modernized Conversation Sidebar Component for VEIL Phase 33.
 *
 * Implements unified instant search (local conversations, contacts, messages,
 * and debounced global directory discovery), active Space identity header,
 * tabbed filtering (All, Chats, Groups, Contacts), contact request actions,
 * and invitation sharing using VEIL reusable component primitives.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../app/AppState.tsx';
import { getRelationshipState } from '../../contacts/relationshipHelper.ts';
import { DirectorySearchResult } from '../../server/types.ts';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  SearchInput,
  StatusIndicator,
  EmptyState,
  Spinner,
  UserSearchResult,
} from './ui/index.ts';

export const Sidebar: React.FC = () => {
  const {
    activeSession,
    conversations,
    contacts,
    contactRequests,
    acceptContactRequest,
    declineContactRequest,
    cancelContactRequest,
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
    searchDirectory,
    exportMyInvitation,
    myProfile,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group' | 'contacts'>('all');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Global Directory Search State
  const [globalResults, setGlobalResults] = useState<DirectorySearchResult[]>([]);
  const [isSearchingDirectory, setIsSearchingDirectory] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const lastQueriedRef = useRef<string>('');

  const pendingIncoming = contactRequests.filter((r) => r.status === 'INCOMING_PENDING');
  const pendingOutgoing = contactRequests.filter((r) => r.status === 'OUTGOING_PENDING');

  // Debounced Global Directory Search
  useEffect(() => {
    const raw = searchQuery.trim();
    const cleanQuery = raw.replace(/^@/, '').trim();

    if (cleanQuery.length < 2) {
      setGlobalResults([]);
      setIsSearchingDirectory(false);
      setDirectoryError(null);
      lastQueriedRef.current = '';
      return;
    }

    if (lastQueriedRef.current === cleanQuery) {
      return;
    }

    let isMounted = true;
    setIsSearchingDirectory(true);
    setDirectoryError(null);

    const timer = setTimeout(async () => {
      try {
        lastQueriedRef.current = cleanQuery;
        const results = await searchDirectory(cleanQuery);
        if (isMounted) {
          setGlobalResults(results || []);
          setIsSearchingDirectory(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setDirectoryError("Couldn't search directory right now.");
          setIsSearchingDirectory(false);
        }
      }
    }, 280);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, searchDirectory]);

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

  const queryLower = searchQuery.trim().toLowerCase().replace(/^@/, '');
  const localMatchingContacts = queryLower
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(queryLower) ||
          c.identityId.toLowerCase().includes(queryLower)
      )
    : [];

  const localConvResults = searchResults.filter((r) => r.type === 'contact' || r.type === 'group');
  const localMessageResults = searchResults.filter((r) => r.type === 'message');

  const hasAnySearchResults =
    localConvResults.length > 0 ||
    localMatchingContacts.length > 0 ||
    globalResults.length > 0 ||
    localMessageResults.length > 0;

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
              status={
                networkState === 'connected'
                  ? 'online'
                  : networkState === 'connecting' || networkState === 'reconnecting'
                  ? 'connecting'
                  : networkState === 'degraded'
                  ? 'warning'
                  : 'offline'
              }
              label={
                networkState === 'connected'
                  ? 'Encrypted & Online'
                  : networkState === 'connecting'
                  ? 'Connecting...'
                  : networkState === 'reconnecting'
                  ? 'Reconnecting...'
                  : networkState === 'degraded'
                  ? 'Degraded (Polling)'
                  : 'Offline / Queued'
              }
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
          placeholder="Search contacts, messages or @username..."
          aria-label="Search conversation history and directory"
        />
      </div>

      {/* Filter Tabs (Hidden during search) */}
      {!searchQuery.trim() && (
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
      )}

      {/* Conversation / Contacts / Unified Search List */}
      <div className="veil-conversation-list">
        {searchQuery.trim() ? (
          <div>
            {/* 1. Local Conversations */}
            {localConvResults.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.4rem 0.5rem', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', fontWeight: 600 }}>
                  Chats & Groups
                </div>
                {localConvResults.map((res) => (
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
                ))}
              </div>
            )}

            {/* 2. Local Contacts */}
            {localMatchingContacts.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.4rem 0.5rem', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', fontWeight: 600 }}>
                  Contacts
                </div>
                {localMatchingContacts.map((c) => {
                  const rel = getRelationshipState(c.identityId, c.name, {
                    myIdentityId: myProfile?.identityId,
                    myUsername: myProfile?.username,
                    contacts,
                    contactRequests,
                  });
                  return (
                    <UserSearchResult
                      key={c.identityId}
                      displayName={c.name}
                      username={c.name}
                      relationshipState={rel}
                      onClick={() => {
                        openModal({ type: 'profile', peerId: c.identityId, peerUsername: c.name });
                        setSearchQuery('');
                      }}
                    />
                  );
                })}
              </div>
            )}

            {/* 3. Global Public Directory Users */}
            {(globalResults.length > 0 || isSearchingDirectory) && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.5rem' }}>
                  <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', fontWeight: 600 }}>
                    Global People (@directory)
                  </span>
                  {isSearchingDirectory && <Spinner size="sm" />}
                </div>

                {globalResults.map((user) => {
                  const rel = getRelationshipState(user.identityId, user.username, {
                    myIdentityId: myProfile?.identityId,
                    myUsername: myProfile?.username,
                    contacts,
                    contactRequests,
                  });
                  return (
                    <UserSearchResult
                      key={user.identityId}
                      displayName={user.displayName}
                      username={user.username}
                      avatarUrl={user.avatar}
                      relationshipState={rel}
                      onClick={() => {
                        openModal({
                          type: 'profile',
                          peerId: user.identityId,
                          peerUsername: user.username,
                          searchResult: user,
                        });
                        setSearchQuery('');
                      }}
                    />
                  );
                })}
              </div>
            )}

            {/* 4. Local Decrypted Messages */}
            {localMessageResults.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.4rem 0.5rem', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', fontWeight: 600 }}>
                  Matching Messages
                </div>
                {localMessageResults.map((res) => (
                  <div
                    key={res.id}
                    className="veil-conversation-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (res.conversationId) selectConversation(res.conversationId);
                      setSearchQuery('');
                    }}
                  >
                    <div className="veil-conversation-info">
                      <div className="veil-conversation-top">
                        <span className="veil-conversation-name">{res.title}</span>
                        <Badge variant="neutral">Message</Badge>
                      </div>
                      <div className="veil-conversation-preview">{res.matchSnippet}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty Search State */}
            {!hasAnySearchResults && !isSearchingDirectory && (
              <EmptyState
                icon="🔍"
                title="No Matches Found"
                description={
                  directoryError
                    ? directoryError
                    : `No local conversations, contacts, or public users found for "${searchQuery}".`
                }
              />
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Badge variant="warning">Pending</Badge>
                      <button
                        type="button"
                        onClick={() => cancelContactRequest(req.requestId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--veil-danger)',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          padding: '2px 4px',
                        }}
                        title="Cancel Request"
                        aria-label={`Cancel request to @${req.peerUsername}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Contacts List */}
            {contacts.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No Contacts Added"
                description="Search for users by @handle above or invite friends with a cryptographic link."
              />
            ) : (
              contacts.map((contact) => (
                <div
                  key={contact.identityId}
                  className="veil-conversation-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => openModal({ type: 'profile', peerId: contact.identityId, peerUsername: contact.name })}
                >
                  <Avatar name={contact.name} size="md" />
                  <div className="veil-conversation-info">
                    <div className="veil-conversation-top">
                      <span className="veil-conversation-name">{contact.name}</span>
                      {contact.verificationStatus === 'VERIFIED' ? (
                        <Badge variant="secure">✓ Verified</Badge>
                      ) : (
                        <Badge variant="neutral">Contact</Badge>
                      )}
                    </div>
                    <div className="veil-conversation-preview" style={{ fontFamily: 'var(--veil-font-mono)', fontSize: '0.68rem' }}>
                      {contact.fingerprint ? `${contact.fingerprint.slice(0, 16)}...` : 'E2EE Contact'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Normal Conversation List */
          filteredConversations.length === 0 ? (
            <EmptyState
              icon="💬"
              title={activeTab === 'group' ? 'No Encrypted Groups' : 'No Active Chats'}
              description="Start a new conversation using the button below or search for @username."
            />
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = activeChatId === conv.id;
              return (
                <div
                  key={conv.id}
                  className={`veil-conversation-item ${isSelected ? 'active' : ''}`}
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
                    size="md"
                    isGroup={conv.type === 'group'}
                    aria-label={`${conv.name} avatar`}
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
                  {conv.unreadCount > 0 && (
                    <Badge variant="warning">{conv.unreadCount}</Badge>
                  )}
                </div>
              );
            })
          )
        )}
      </div>

      {/* Action Footer */}
      <div className="veil-sidebar-footer">
        <Button
          variant="primary"
          style={{ width: '100%' }}
          onClick={() => openModal({ type: 'newChat' })}
        >
          + New Chat
        </Button>
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
          <Button
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onClick={() => openModal({ type: 'newGroup' })}
          >
            👥 New Group
          </Button>
          <Button
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onClick={handleCopyInvite}
            title="Copy signed cryptographic invite link"
          >
            {copiedInvite ? '✓ Copied' : '🔗 Invite'}
          </Button>
        </div>
      </div>
    </aside>
  );
};
