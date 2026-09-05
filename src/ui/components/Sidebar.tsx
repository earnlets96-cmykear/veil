/**
 * Modernized Conversation Sidebar Component for VEIL Phase 33.
 *
 * Implements Telegram-inspired conversation list, active Space identity header,
 * tabbed filtering (All, Chats, Groups, Contacts), SVG snippet indicators (Photo,
 * Video, File, Voice), and unread badge counters with zero emojis.
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
  MessageStatus,
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
  ImageIcon,
  VideoIcon,
  FileIcon,
  MicIcon,
  BellOffIcon,
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
    sendContactRequest,
    exportMyInvitation,
    myProfile,
    isConversationMuted,
    messages,
    pinConversation,
    unpinConversation,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group' | 'contacts'>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [globalResults, setGlobalResults] = useState<DirectorySearchResult[]>([]);
  const [isSearchingDirectory, setIsSearchingDirectory] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const debounceTimerRef = useRef<any>(null);

  // Debounced Global Directory Search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setGlobalResults([]);
      setIsSearchingDirectory(false);
      setDirectoryError(null);
      return;
    }

    setIsSearchingDirectory(true);
    setDirectoryError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchDirectory(q);
        setGlobalResults(results);
      } catch (err: any) {
        setDirectoryError(err?.message || 'Directory search unavailable');
        setGlobalResults([]);
      } finally {
        setIsSearchingDirectory(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, searchDirectory]);

  const handleCopyInvitation = () => {
    const link = exportMyInvitation();
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const formatConversationTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = new Date(timestamp);

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderMessageSnippet = (lastMessage?: string) => {
    if (!lastMessage) return 'E2EE encrypted conversation';
    const msg = lastMessage.trim();

    if (msg === 'Photo' || msg.includes('Photo') || msg.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      return (
        <span className="veil-snippet-with-icon">
          <ImageIcon size={14} color="var(--veil-accent-primary)" />
          <span>Photo</span>
        </span>
      );
    }

    if (msg === 'Video' || msg.includes('Video') || msg.match(/\.(mp4|webm|mov|mkv)$/i)) {
      return (
        <span className="veil-snippet-with-icon">
          <VideoIcon size={14} color="var(--veil-accent-primary)" />
          <span>Video</span>
        </span>
      );
    }

    if (msg.includes('Media Files')) {
      return (
        <span className="veil-snippet-with-icon">
          <ImageIcon size={14} color="var(--veil-accent-primary)" />
          <span>{msg}</span>
        </span>
      );
    }

    if (msg.toLowerCase().includes('voice note') || msg.toLowerCase().includes('voice message')) {
      return (
        <span className="veil-snippet-with-icon">
          <MicIcon size={14} color="var(--veil-accent-primary)" />
          <span>Voice message</span>
        </span>
      );
    }

    if (msg.includes('Attachment:')) {
      const cleanName = msg.replace(/^Attachment:\s*/i, '');
      return (
        <span className="veil-snippet-with-icon">
          <FileIcon size={14} color="var(--veil-accent-primary)" />
          <span>{cleanName}</span>
        </span>
      );
    }

    return msg;
  };

  // Filter and sort conversations (pinned conversations first, then newest message)
  const filteredConversations = conversations
    .filter((c) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'direct') return c.type === 'direct';
      if (activeTab === 'group') return c.type === 'group';
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

  const pendingIncoming = contactRequests.filter((r) => r.isIncoming && r.status === 'INCOMING_PENDING');

  const localConvResults = searchResults.filter((r) => r.type === 'contact' || r.type === 'message' || (r.type as any) === 'conversation');
  const localMatchingContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return false;
    return c.name.toLowerCase().includes(q) || c.identityId.toLowerCase().includes(q);
  });

  const hasAnySearchResults = localConvResults.length > 0 || localMatchingContacts.length > 0 || globalResults.length > 0;

  return (
    <div className="veil-sidebar" role="region" aria-label="Conversation List">
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
            name={myProfile?.displayName || activeSession?.name || 'Active Space'}
            imageUrl={myProfile?.avatar}
            size="md"
            aria-label="Current Space Profile"
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
              {myProfile?.displayName || activeSession?.name || 'Active Space'}
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
            icon={<UsersIcon size={18} />}
            variant="ghost"
            onClick={() => openModal({ type: 'accountsAndSpaces' })}
            aria-label="Accounts & Spaces"
            title="Manage Accounts & Spaces"
          />
          <IconButton
            icon={<SettingsIcon size={18} />}
            variant="ghost"
            onClick={() => openModal({ type: 'settings' as any })}
            aria-label="Settings"
          />
          <IconButton
            icon={<LockIcon size={18} />}
            variant="secondary"
            onClick={lockSpace}
            aria-label="Lock Space"
          />
          <IconButton
            icon={<AlertCircleIcon size={18} />}
            variant="danger"
            onClick={panicLock}
            aria-label="Panic Lock: Instant Memory Wipe"
          />
        </div>
      </div>

      {/* Instant Search Bar */}
      <div className="veil-sidebar-search" role="search">
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          placeholder="Search chats, messages, @username..."
          aria-label="Search conversation history and directory"
        />
      </div>

      {/* Filter Tabs (Hidden during search) */}
      {!searchQuery.trim() && (
        <div className="veil-sidebar-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`veil-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'direct'}
            className={`veil-tab-btn ${activeTab === 'direct' ? 'active' : ''}`}
            onClick={() => setActiveTab('direct')}
          >
            Chats
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'group'}
            className={`veil-tab-btn ${activeTab === 'group' ? 'active' : ''}`}
            onClick={() => setActiveTab('group')}
          >
            Groups
          </button>
          <button
            type="button"
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
                    <Avatar name={contact.name} imageUrl={contact.avatar} size="sm" />
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
                const relationship = getRelationshipState(user.identityId, user.username, {
                  myIdentityId: myProfile?.identityId || activeSession?.spaceId,
                  myUsername: myProfile?.username,
                  contacts: contacts || [],
                  contactRequests: contactRequests || [],
                });
                return (
                  <UserSearchResult
                    key={user.identityId}
                    result={user}
                    relationship={relationship}
                    onOpenProfile={(res) => openModal({ type: 'profile', peerId: res.identityId, peerUsername: res.username, searchResult: res })}
                    onSendRequest={async (res) => {
                      try {
                        await sendContactRequest(res.username);
                      } catch (_e) {}
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
                      @{req.peerUsername || req.peerIdentityId.slice(0, 10)}
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
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal({
                        type: 'profile',
                        peerId: contact.identityId,
                        peerUsername: contact.accountUsername || (contact.name?.startsWith('@') ? contact.name.slice(1) : undefined),
                      });
                    }}
                    title="View Profile"
                    style={{ cursor: 'pointer' }}
                  >
                    <Avatar name={contact.name} imageUrl={contact.avatar} size="md" />
                  </div>
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
              const isMuted = typeof isConversationMuted === 'function' && isConversationMuted(conv.id);
              const convMsgs = (messages && messages[conv.id]) || [];
              const latestMsg = convMsgs.length > 0 ? convMsgs[convMsgs.length - 1] : null;
              const isOutgoing = !!latestMsg?.isOutgoing;

              return (
                <div
                  key={conv.id}
                  className={`veil-conversation-item ${isSelected ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectConversation(conv.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (conv.isPinned) {
                      unpinConversation(conv.id);
                    } else {
                      pinConversation(conv.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectConversation(conv.id);
                    }
                  }}
                >
                  <Avatar
                    name={conv.name}
                    imageUrl={conv.avatar || (contacts || []).find((c) => c.identityId === conv.id)?.avatar}
                    size="md"
                    isGroup={conv.type === 'group'}
                    aria-label={`${conv.name} avatar`}
                  />
                  <div className="veil-conversation-info">
                    <div className="veil-conversation-top">
                      <span className="veil-conversation-name">{conv.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {conv.isPinned && (
                          <span
                            title="Pinned Conversation"
                            aria-label="Pinned"
                            style={{ color: 'var(--accent-color, #14b8a6)', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="17" x2="12" y2="22" />
                              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                            </svg>
                          </span>
                        )}
                        {isMuted && <BellOffIcon size={12} color="var(--veil-text-muted)" aria-label="Muted" />}
                        {conv.timestamp && (
                          <span className="veil-conversation-time">
                            {formatConversationTime(conv.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="veil-conversation-preview" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isOutgoing && latestMsg && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                          <MessageStatus status={latestMsg.status} size={14} />
                        </span>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {renderMessageSnippet(conv.lastMessage || latestMsg?.text)}
                      </span>
                    </div>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span
                      className="veil-unread-pill"
                      style={isMuted ? { backgroundColor: 'var(--veil-text-muted)', opacity: 0.8 } : undefined}
                    >
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              );
            })
          )
        )}
      </div>

      {/* Floating / Action Footer */}
      <div className="veil-sidebar-footer">
        <Button
          variant="primary"
          onClick={() => openModal({ type: 'newChat' })}
          icon={<PlusIcon size={16} />}
          fullWidth
        >
          New Chat
        </Button>
        <Button
          variant="secondary"
          onClick={() => openModal({ type: 'newGroup' })}
          icon={<UsersIcon size={16} />}
          fullWidth
        >
          New Group
        </Button>
      </div>
    </div>
  );
};
