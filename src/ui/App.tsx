/**
 * Root React Application Component for VEIL.
 */

import React, { useState, useEffect } from 'react';
import { useApp } from './app/AppState.tsx';
import { LockScreen } from './components/LockScreen.tsx';
import { PinLockScreen } from './components/PinLockScreen.tsx';
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
import { AppLockSetupModal } from './components/AppLockSetupModal.tsx';
import { AccountsAndSpacesModal } from './components/AccountsAndSpacesModal.tsx';
import { ShieldIcon, CloseIcon } from './components/icons/index.ts';
import { spacePinManager } from '../privacy/pinManager.ts';
import { themeManager } from './utils/themeManager.ts';

export const App: React.FC = () => {
  const {
    activeSession,
    activeChatId,
    activeModal,
    recoveryPasswordChangeRequired,
    openModal,
    closeModal,
    isAppLocked,
  } = useApp();

  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [pendingPinSetup, setPendingPinSetup] = useState<{
    spaceId: string;
    username: string;
    spaceName: string;
    password?: string;
  } | null>(null);

  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('veil:recovery_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissBanner = () => {
    setIsBannerDismissed(true);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('veil:recovery_banner_dismissed', 'true');
      }
    } catch {}
  };

  useEffect(() => {
    themeManager.applyTheme();
  }, []);

  const hasRegisteredPins = spacePinManager.hasRegisteredPins() && spacePinManager.isAppLockEnabled();

  if (!activeSession || !activeSession.isActive() || isAppLocked) {
    if (hasRegisteredPins && !showPasswordLogin) {
      return (
        <>
          <PinLockScreen onFallbackPassword={() => setShowPasswordLogin(true)} />
          {activeModal?.type === 'createSpace' && <CreateSpaceModal />}
          {activeModal?.type === 'restoreAccount' && <RestoreAccountModal />}
        </>
      );
    }

    return (
      <>
        <LockScreen
          showCancel={hasRegisteredPins}
          onCancelPasswordFallback={hasRegisteredPins ? () => setShowPasswordLogin(false) : undefined}
          onSuccessAuth={(params) => {
            const targetId = params.spaceId || params.username;
            if (!spacePinManager.isOnboardingCompleted(targetId) && !spacePinManager.hasPinForSpace(targetId)) {
              setPendingPinSetup(params);
            }
          }}
        />
        {activeModal?.type === 'createSpace' && <CreateSpaceModal />}
        {activeModal?.type === 'restoreAccount' && <RestoreAccountModal />}
      </>
    );
  }

  return (
    <div className={`veil-app-layout ${activeChatId ? 'has-active-chat' : ''}`}>
      {recoveryPasswordChangeRequired && !isBannerDismissed && (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="veil-button veil-button-secondary veil-button-sm"
              onClick={() => openModal({ type: 'settings', initialCategory: 'privacy' })}
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
            <button
              type="button"
              onClick={handleDismissBanner}
              title="Dismiss notice"
              aria-label="Dismiss notice"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--veil-radius-sm)',
                opacity: 0.8,
              }}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>
      )}
      <Sidebar />
      <ConversationView />

      {/* Modals */}
      {activeModal?.type === 'settings' && (
        <SettingsModal initialCategory={activeModal.initialCategory} />
      )}
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
      {activeModal?.type === 'accountsAndSpaces' && <AccountsAndSpacesModal />}
      {(activeModal?.type === 'appLockSetup' || pendingPinSetup) && (
        <AppLockSetupModal
          spaceId={pendingPinSetup?.spaceId || activeSession?.spaceId || ''}
          username={pendingPinSetup?.username || (activeSession as any)?.username || ''}
          spaceName={pendingPinSetup?.spaceName || activeSession?.name || ''}
          password={pendingPinSetup?.password}
          onComplete={() => {
            setPendingPinSetup(null);
            closeModal();
          }}
        />
      )}
    </div>
  );
};
