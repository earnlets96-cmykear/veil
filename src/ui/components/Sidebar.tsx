/**
 * Modernized Conversation Sidebar Component for VEIL Phase 31/32.
 *
 * Implements unified instant search (local conversations, contacts, messages,
 * and debounced global directory discovery), active Space identity header,
 * tabbed filtering (All, Chats, Groups, Contacts), contact request actions,
 * and invitation sharing using 100% SVG vector iconography and reusable primitives.
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
import {
  LockIcon,
  AlertCircleIcon,
  PlusIcon,
  UsersIcon,
  ShareIcon,
  CheckIcon,
  SettingsIcon,
  UserIcon,
} from './icons/index.ts';

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
      } catch (_err: any) {
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
            icon={<SettingsIcon size={18} />}
            variant="ghost"
            onClick={() => openModal({ type: 'settings' as any })}
            aria-label="Settings"
            title="Settings"
          />
          <IconButton
            icon={<LockIcon size={18} />}
            variant="secondary"
            onClick={lockSpace}
            aria-label="Lock Space"
            title="Lock Space"
          />
          <IconButton
            icon={<AlertCircleIcon size={18} />}
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
                  My Contacts
                </div>
                {localMatchingContacts.map((contact) => (
                  <div
                    key={contact.identityId}
                    className="veil-conversation-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      selectConversation(contact.identityId);
                      setSearchQuery('');
                    }}
                  >
                    <Avatar name={contact.name} size="sm" />
                    <div className="veil-conversation-info">
                      <div className="veil-conversation-name">{contact.name}</div>
                      <div className="veil-conversation-preview">{contact.identityId.slice(0, 16)}...</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Global Directory Results */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ padding: '0.4rem 0.5rem', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Global Directory Discovery</span>
                {isSearchingDirectory && <Spinner size="sm" />}
              </div>

              {directoryError && (
                <div style={{ padding: '0.5rem', color: 'var(--veil-text-muted)', fontSize: 'var(--veil-text-xs)' }}>
                  {directoryError}
                </div>
              )}

              {globalResults.map((user) => {
                const relationship = getRelationshipState(user.peerId, user.username, contacts, contactRequests);
                return (
                  <UserSearchResult
                    key={user.peerId}
                    result={user}
                    relationship={relationship}
                    onOpenProfile={(res) => openModal({ type: 'profile', peerId: res.peerId, peerUsername: res.username, searchResult: res })}
                    onSendRequest={async (res) => {
                      await (window as any).__veil_send_request?.(res.peerId);
                    }}
                    onMessageUser={(peerId) => {
                      selectConversation(peerId);
                      setSearchQuery('');
                    }}
                  />
                );
              })}
            </div>

            {/* Empty Search State */}
            {!hasAnySearchResults && !isSearchingDirectory && (
              <EmptyState
                icon={<UserIcon size={36} color="var(--veil-text-muted)" />}
                title="No results found"
                description={`No local conversations or directory users matched "${searchQuery}"`}
              />
            )}
          </div>
        ) : activeTab === 'contacts' ? (
          /* Contacts View Tab */
          <div>
            {/* Pending Requests Banner */}
            {pendingIncoming.length > 0 && (
              <div style={{ padding: '0.5rem', background: 'var(--veil-bg-surface-elevated)', borderRadius: 'var(--veil-radius-md)', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-warning)', marginBottom: '0.25rem' }}>
                  Incoming Contact Requests ({pendingIncoming.length})
                </div>
                {pendingIncoming.map((req) => (
                  <div key={req.requestId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                    <div style={{ fontSize: 'var(--veil-text-xs)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      @{req.peerUsername || req.peerId.slice(0, 10)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <Button variant="primary" size="sm" onClick={() => acceptContactRequest(req.requestId)}>
                        Accept
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => declineContactRequest(req.requestId)}>
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contacts.length === 0 ? (
              <EmptyState
                icon={<UsersIcon size={40} color="var(--veil-text-muted)" />}
                title="No contacts yet"
                description="Search users by @username above to send contact requests."
              />
            ) : (
              contacts.map((contact) => (
                <div
                  key={contact.identityId}
                  className="veil-conversation-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => selectConversation(contact.identityId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') selectConversation(contact.identityId);
                  }}
                >
                  <Avatar name={contact.name} size="md" />
                  <div className="veil-conversation-info">
                    <div className="veil-conversation-top">
                      <span className="veil-conversation-name">{contact.name}</span>
                    </div>
                    <div className="veil-conversation-preview">
                      {contact.identityId.slice(0, 14)}...
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Normal Conversations List */
          filteredConversations.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={40} color="var(--veil-text-muted)" />}
              title={activeTab === 'group' ? 'No groups yet' : 'No conversations yet'}
              description="Start a new chat with your contacts or search by @username."
              action={
                <Button variant="primary" size="sm" onClick={() => openModal({ type: 'newChat' })}>
                  <PlusIcon size={16} />
                  <span>Start Chat</span>
                </Button>
              }
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
          <PlusIcon size={18} />
          <span>New Chat</span>
        </Button>
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
          <Button
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onClick={() => openModal({ type: 'newGroup' })}
          >
            <UsersIcon size={16} />
            <span>New Group</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onClick={handleCopyInvite}
            title="Copy signed cryptographic invite link"
          >
            {copiedInvite ? <CheckIcon size={16} color="var(--veil-success)" /> : <ShareIcon size={16} />}
            <span>{copiedInvite ? 'Copied' : 'Invite'}</span>
          </Button>
        </div>
      </div>
    </aside>
  );
};
