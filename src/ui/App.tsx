/**
 * Root React Application Component for VEIL.
 */

import React from 'react';
import { useApp } from './app/AppState.tsx';
import { LockScreen } from './components/LockScreen.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { ConversationView } from './components/ConversationView.tsx';
import { CreateSpaceModal } from './components/CreateSpaceModal.tsx';
import { NewChatModal } from './components/NewChatModal.tsx';
import { NewGroupModal } from './components/NewGroupModal.tsx';
import { GroupDetailsModal } from './components/GroupDetailsModal.tsx';
import { ContactDetailsModal } from './components/ContactDetailsModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { RestoreAccountModal } from './components/RestoreAccountModal.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { ShieldIcon } from './components/icons/index.ts';

export const App: React.FC = () => {
  const { activeSession, activeChatId, activeModal, recoveryPasswordChangeRequired, openModal } = useApp();

  React.useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('veil:theme') || 'obsidian';
      const savedDensity = localStorage.getItem('veil:density') || 'comfortable';
      document.documentElement.setAttribute('data-theme', savedTheme);
      document.documentElement.setAttribute('data-density', savedDensity);
    } catch (_e) {}
  }, []);

  if (!activeSession || !activeSession.isActive()) {
    return (
      <>
        <LockScreen />
        {activeModal?.type === 'createSpace' && <CreateSpaceModal />}
        {activeModal?.type === 'restoreAccount' && <RestoreAccountModal />}
      </>
    );
  }

  return (
    <div className={`veil-app-layout ${activeChatId ? 'has-active-chat' : ''}`}>
      {recoveryPasswordChangeRequired && (
        <div
          className="veil-recovery-banner"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: 'var(--veil-accent-primary)',
            color: '#ffffff',
            padding: '0.6rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            fontSize: 'var(--veil-text-xs)',
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldIcon size={16} />
            <span>Account recovered — set a new password to secure this device.</span>
          </div>
          <button
            type="button"
            className="veil-button veil-button-secondary veil-button-sm"
            onClick={() => openModal({ type: 'settings' })}
            style={{
              backgroundColor: '#ffffff',
              color: 'var(--veil-accent-primary)',
              border: 'none',
              fontWeight: 600,
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--veil-radius-sm)',
              cursor: 'pointer',
            }}
          >
            Change Password
          </button>
        </div>
      )}
      <Sidebar />
      <ConversationView />

      {/* Modals */}
      {activeModal?.type === 'settings' && <SettingsModal />}
      {activeModal?.type === 'createSpace' && <CreateSpaceModal />}
      {activeModal?.type === 'restoreAccount' && <RestoreAccountModal />}
      {activeModal?.type === 'newChat' && <NewChatModal />}
      {activeModal?.type === 'newGroup' && <NewGroupModal />}
      {activeModal?.type === 'groupDetails' && (
        <GroupDetailsModal conversationId={activeModal.conversationId} />
      )}
      {activeModal?.type === 'contactDetails' && (
        <ContactDetailsModal conversationId={activeModal.conversationId} />
      )}
      {activeModal?.type === 'profile' && (
        <ProfileModal
          peerId={activeModal.peerId}
          peerUsername={activeModal.peerUsername}
          searchResult={activeModal.searchResult}
        />
      )}
    </div>
  );
};
