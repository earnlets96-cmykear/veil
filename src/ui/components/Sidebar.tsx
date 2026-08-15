/**
 * Sidebar Component for VEIL Application Shell.
 *
 * Provides Space indicators, chat search, conversation lists, and modal triggers.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';

export const Sidebar: React.FC = () => {
  const {
    activeSession,
    conversations,
    activeChatId,
    selectConversation,
    openModal,
    lockSpace,
    panicLock,
    networkState,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group'>('all');

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'direct') return c.type === 'direct';
    if (activeTab === 'group') return c.type === 'group';
    return true;
  });

  return (
    <aside className="veil-sidebar">
      {/* Space Header */}
      <div className="veil-sidebar-header">
        <div className="veil-space-status-box">
          <div className="veil-space-avatar">
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
          >
            🔒
          </button>
          <button
            type="button"
            className="veil-btn veil-btn-panic"
            style={{ padding: '0.35rem 0.55rem', fontSize: '0.85rem' }}
            onClick={panicLock}
            title="Panic Lock: Instant Memory Wipe"
          >
            🚨
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="veil-sidebar-search">
        <input
          type="text"
          className="veil-input"
          style={{ padding: '0.45rem 0.75rem', fontSize: 'var(--veil-text-xs)' }}
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter Tabs */}
      <div className="veil-sidebar-tabs">
        <button
          className={`veil-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All ({conversations.length})
        </button>
        <button
          className={`veil-tab-btn ${activeTab === 'direct' ? 'active' : ''}`}
          onClick={() => setActiveTab('direct')}
        >
          Direct
        </button>
        <button
          className={`veil-tab-btn ${activeTab === 'group' ? 'active' : ''}`}
          onClick={() => setActiveTab('group')}
        >
          Groups
        </button>
      </div>

      {/* Conversation List */}
      <div className="veil-conversation-list">
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

        <button
          type="button"
          className="veil-btn veil-btn-secondary"
          style={{ fontSize: 'var(--veil-text-xs)', padding: '0.35rem 0.65rem' }}
          onClick={() => openModal({ type: 'settings' })}
          title="Settings & Space Management"
        >
          ⚙️ Settings
        </button>
      </div>
    </aside>
  );
};
