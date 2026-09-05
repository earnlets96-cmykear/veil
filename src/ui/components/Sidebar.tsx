/**
 * Modernized Conversation Sidebar Component for VEIL Phase 33 & Showcase Redesign.
 *
 * Implements Screen 4 (Conversations) with:
 * - Hamburger menu icon (opens Accounts & Spaces)
 * - Centered bold VEIL title
 * - Search toggle button
 * - Filter chips: All, Unread, Groups, Spaces
 * - Rich conversation list with avatar, timestamp, message preview, unread count
 * - Teal Floating Action Button (+) for starting new chats
 * - Bottom navigation bar: Chats, Calls, Groups, Settings
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
  SettingsIcon,
  UserIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  MicIcon,
  BellOffIcon,
  MenuIcon,
  SearchIcon,
  PhoneIcon,
  MessageSquareIcon,
  CloseIcon,
} from './icons/index.ts';

export const Sidebar: React.FC = () => {
  const {
    activeSession,
    conversations,
    contacts,
    contactRequests,
    acceptContactRequest,
    declineContactRequest,
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
    myProfile,
    isConversationMuted,
    messages,
    pinConversation,
    unpinConversation,
  } = useApp();

  const [activeChip, setActiveChip] = useState<'all' | 'unread' | 'group'>('all');
  const [activeNavTab, setActiveNavTab] = useState<'chats' | 'calls' | 'groups' | 'settings'>('chats');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [globalResults, setGlobalResults] = useState<DirectorySearchResult[]>([]);
  const [isSearchingDirectory, setIsSearchingDirectory] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

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
        <span className="veil-snippet-with-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ImageIcon size={14} color="#14b8a6" />
          <span>Photo</span>
        </span>
      );
    }

    if (msg === 'Video' || msg.includes('Video') || msg.match(/\.(mp4|webm|mov|mkv)$/i)) {
      return (
        <span className="veil-snippet-with-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <VideoIcon size={14} color="#14b8a6" />
          <span>Video</span>
        </span>
      );
    }

    if (msg.includes('Media Files')) {
      return (
        <span className="veil-snippet-with-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ImageIcon size={14} color="#14b8a6" />
          <span>{msg}</span>
        </span>
      );
    }

    if (msg.toLowerCase().includes('voice note') || msg.toLowerCase().includes('voice message')) {
      return (
        <span className="veil-snippet-with-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <MicIcon size={14} color="#14b8a6" />
          <span>Voice message</span>
        </span>
      );
    }

    if (msg.includes('Attachment:')) {
      const cleanName = msg.replace(/^Attachment:\s*/i, '');
      return (
        <span className="veil-snippet-with-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <FileIcon size={14} color="#14b8a6" />
          <span>{cleanName}</span>
        </span>
      );
    }

    return msg;
  };

  // Filter and sort conversations (pinned conversations first, then newest message)
  const filteredConversations = conversations
    .filter((c) => {
      if (activeChip === 'unread') return (c.unreadCount || 0) > 0;
      if (activeChip === 'group') return c.type === 'group';
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
    <div
      className="veil-sidebar"
      role="region"
      aria-label="Conversation List"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        backgroundColor: '#080b11',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        userSelect: 'none',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1rem 0.5rem 1rem',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={() => openModal({ type: 'accountsAndSpaces' })}
          aria-label="Open Accounts & Spaces"
          title="Accounts & Spaces"
          style={{
            background: 'none',
            border: 'none',
            color: '#f3f4f6',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MenuIcon size={22} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: '#ffffff',
              margin: 0,
            }}
          >
            VEIL
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen((prev) => !prev);
              if (isSearchOpen) setSearchQuery('');
            }}
            aria-label="Search"
            style={{
              background: 'none',
              border: 'none',
              color: isSearchOpen ? '#14b8a6' : '#f3f4f6',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isSearchOpen ? <CloseIcon size={20} /> : <SearchIcon size={20} />}
          </button>

          {/* Quick Lock Dropdown Trigger */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowQuickMenu((prev) => !prev)}
              aria-label="Security Menu"
              title="Security & Lock Options"
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LockIcon size={18} />
            </button>

            {showQuickMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  backgroundColor: '#0f141d',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  padding: '6px',
                  zIndex: 100,
                  minWidth: '150px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickMenu(false);
                    lockSpace();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    background: 'none',
                    border: 'none',
                    color: '#f3f4f6',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    textAlign: 'left',
                  }}
                >
                  <LockIcon size={15} color="#14b8a6" />
                  <span>Lock Space</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickMenu(false);
                    panicLock();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    textAlign: 'left',
                  }}
                >
                  <AlertCircleIcon size={15} color="#ef4444" />
                  <span>Panic Lock</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Search Input */}
      {(isSearchOpen || searchQuery.trim().length > 0) && (
        <div style={{ padding: '0 1rem 0.65rem 1rem' }} role="search">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder="Search chats, messages, @username..."
            aria-label="Search conversation history and directory"
          />
        </div>
      )}

      {/* Category Chips Bar (Screen 4: All, Unread, Groups, Spaces) */}
      {!searchQuery.trim() && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.25rem 1rem 0.75rem 1rem',
            overflowX: 'auto',
          }}
          role="tablist"
        >
          <button
            type="button"
            onClick={() => setActiveChip('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: activeChip === 'all' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: activeChip === 'all' ? '#14b8a6' : '#121824',
              color: activeChip === 'all' ? '#ffffff' : '#94a3b8',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => setActiveChip('unread')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: activeChip === 'unread' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: activeChip === 'unread' ? '#14b8a6' : '#121824',
              color: activeChip === 'unread' ? '#ffffff' : '#94a3b8',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            Unread
          </button>

          <button
            type="button"
            onClick={() => setActiveChip('group')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: activeChip === 'group' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: activeChip === 'group' ? '#14b8a6' : '#121824',
              color: activeChip === 'group' ? '#ffffff' : '#94a3b8',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            Groups
          </button>

          <button
            type="button"
            onClick={() => openModal({ type: 'accountsAndSpaces' })}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#121824',
              color: '#94a3b8',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            Spaces
          </button>
        </div>
      )}

      {/* Conversation / Contacts / Unified Search List */}
      <div
        className="veil-conversation-list"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 0.5rem',
        }}
      >
        {searchQuery.trim() ? (
          <div>
            {/* 1. Local Conversations */}
            {localConvResults.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
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
                      setIsSearchOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (res.conversationId) selectConversation(res.conversationId);
                        setSearchQuery('');
                        setIsSearchOpen(false);
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
                <div style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
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
                      setIsSearchOpen(false);
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
              <div style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Global Directory Discovery</span>
                {isSearchingDirectory && <Spinner size="sm" />}
              </div>

              {directoryError && (
                <div style={{ padding: '0.5rem', color: '#ef4444', fontSize: '0.75rem' }}>
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
                      setIsSearchOpen(false);
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
        ) : (
          /* Normal Conversations List */
          <>
            {/* Pending Requests Banner */}
            {pendingIncoming.length > 0 && (
              <div style={{ padding: '0.65rem 0.85rem', background: '#131924', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px', marginBottom: '0.65rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.35rem' }}>
                  Incoming Contact Requests ({pendingIncoming.length})
                </div>
                {pendingIncoming.map((req) => (
                  <div key={req.requestId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                    <div style={{ fontSize: '0.8rem', color: '#f3f4f6' }}>
                      @{req.peerUsername || req.peerIdentityId.slice(0, 10)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => acceptContactRequest(req.requestId)}
                        style={{
                          backgroundColor: '#14b8a6',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => declineContactRequest(req.requestId)}
                        style={{
                          backgroundColor: 'transparent',
                          color: '#94a3b8',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredConversations.length === 0 ? (
              <EmptyState
                icon={<UsersIcon size={40} color="var(--veil-text-muted)" />}
                title={activeChip === 'group' ? 'No groups yet' : activeChip === 'unread' ? 'No unread chats' : 'No conversations yet'}
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      marginBottom: '4px',
                      backgroundColor: isSelected ? 'rgba(20, 184, 166, 0.12)' : 'transparent',
                      border: isSelected ? '1px solid rgba(20, 184, 166, 0.25)' : '1px solid transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <Avatar
                      name={conv.name}
                      imageUrl={conv.avatar || (contacts || []).find((c) => c.identityId === conv.id)?.avatar}
                      size="md"
                      isGroup={conv.type === 'group'}
                      aria-label={`${conv.name} avatar`}
                    />
                    <div className="veil-conversation-info" style={{ marginLeft: '0.75rem', flex: 1, minWidth: 0 }}>
                      <div className="veil-conversation-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span className="veil-conversation-name" style={{ fontWeight: 600, color: '#f3f4f6', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          {conv.isPinned && (
                            <span
                              title="Pinned Conversation"
                              aria-label="Pinned"
                              style={{ color: '#14b8a6', display: 'inline-flex', alignItems: 'center' }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="17" x2="12" y2="22" />
                                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                              </svg>
                            </span>
                          )}
                          {isMuted && <BellOffIcon size={12} color="#64748b" aria-label="Muted" />}
                          {conv.timestamp && (
                            <span className="veil-conversation-time" style={{ fontSize: '0.725rem', color: '#64748b' }}>
                              {formatConversationTime(conv.timestamp)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="veil-conversation-preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#94a3b8' }}>
                          {isOutgoing && latestMsg && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                              <MessageStatus status={latestMsg.status} size={14} />
                            </span>
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {renderMessageSnippet(conv.lastMessage || latestMsg?.text)}
                          </span>
                        </div>

                        {conv.unreadCount > 0 && (
                          <span
                            className="veil-unread-pill"
                            style={{
                              backgroundColor: isMuted ? '#475569' : '#14b8a6',
                              color: '#ffffff',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '12px',
                              marginLeft: '6px',
                              flexShrink: 0,
                            }}
                          >
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Floating Action Button (+) (Screen 4) */}
      <button
        type="button"
        onClick={() => openModal({ type: 'newChat' })}
        aria-label="New Chat"
        title="Start New Chat"
        style={{
          position: 'absolute',
          bottom: '72px',
          right: '18px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: '#14b8a6',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 6px 20px rgba(20, 184, 166, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 20,
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <PlusIcon size={24} strokeWidth={2.5} />
      </button>

      {/* Bottom Navigation Bar (Screen 4: Chats, Calls, Groups, Settings) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          height: '60px',
          backgroundColor: '#0a0e17',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '0 0.5rem',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveNavTab('chats');
            setActiveChip('all');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: activeNavTab === 'chats' ? '#14b8a6' : '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.725rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '10px',
          }}
        >
          <MessageSquareIcon size={20} />
          <span>Chats</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveNavTab('calls');
            // Inform the user about secure E2EE calls
            openModal({
              type: 'help' as any,
            });
          }}
          style={{
            background: 'none',
            border: 'none',
            color: activeNavTab === 'calls' ? '#14b8a6' : '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.725rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '10px',
          }}
        >
          <PhoneIcon size={20} />
          <span>Calls</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveNavTab('groups');
            setActiveChip('group');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: activeNavTab === 'groups' ? '#14b8a6' : '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.725rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '10px',
          }}
        >
          <UsersIcon size={20} />
          <span>Groups</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveNavTab('settings');
            openModal({ type: 'settings' as any });
          }}
          style={{
            background: 'none',
            border: 'none',
            color: activeNavTab === 'settings' ? '#14b8a6' : '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.725rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '10px',
          }}
        >
          <SettingsIcon size={20} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

