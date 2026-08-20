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

export const App: React.FC = () => {
  const { activeSession, activeChatId, activeModal } = useApp();

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
      <Sidebar />
      <ConversationView />

      {/* Modals */}
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
      {activeModal?.type === 'settings' && <SettingsModal />}
    </div>
  );
};
