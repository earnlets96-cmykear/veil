/**
 * Top-Level AppState & React Context Provider for VEIL.
 *
 * Exposes backend subsystems, reactive conversation/message stores,
 * network connectivity listeners, and modal dialog state.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SpaceVaultManager } from '../../spaces/vault.ts';
import { EncryptedSpaceStore } from '../../storage/spaceStore.ts';
import { IndexedDBStorageAdapter } from '../../storage/indexedDbAdapter.ts';
import { SpaceIdentityManager } from '../../identity/manager.ts';
import { NetworkManager } from '../../network/networkManager.ts';
import { SessionController } from './sessionController.ts';
import { UIConversation, UIMessage, ActiveModal } from './types.ts';
import { SpaceSession } from '../../spaces/session.ts';
import { IdentityDocument } from '../../identity/document.ts';
import { NetworkState } from '../../network/types.ts';

// Singleton Backend Instances
const storageAdapter = new IndexedDBStorageAdapter();
const vault = new SpaceVaultManager();
const store = new EncryptedSpaceStore(storageAdapter);
const idMgr = new SpaceIdentityManager();
const netManager = new NetworkManager(store);
const sessionController = new SessionController(vault, store, storageAdapter, idMgr, netManager);

export interface AppContextType {
  storageReady: boolean;
  storageError: string | null;
  activeSession: SpaceSession | null;
  conversations: UIConversation[];
  activeChatId: string | null;
  messages: Record<string, UIMessage[]>;
  activeModal: ActiveModal;
  networkState: NetworkState;
  knownSpacesCount: number;

  // Actions
  unlockSpace: (passphrase: string) => Promise<void>;
  createSpace: (name: string, passphrase: string) => Promise<void>;
  lockSpace: () => void;
  panicLock: () => void;
  selectConversation: (id: string | null) => void;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  addDirectContact: (doc: IdentityDocument) => Promise<void>;
  createGroup: (name: string, description?: string) => Promise<void>;
  sessionController: SessionController;
  idMgr: SpaceIdentityManager;
  store: EncryptedSpaceStore;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<SpaceSession | null>(null);
  const [conversations, setConversations] = useState<UIConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, UIMessage[]>>({});
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [networkState, setNetworkState] = useState<NetworkState>('offline');
  const [knownSpacesCount, setKnownSpacesCount] = useState(0);

  // Initialize persistent IndexedDB storage
  useEffect(() => {
    async function initStorage() {
      try {
        await storageAdapter.init();
        await vault.loadEnvelopesFromStorage(storageAdapter);
        setKnownSpacesCount(vault.listEnvelopes().length);
        setStorageReady(true);
      } catch (err: any) {
        setStorageReady(false);
        setStorageError(err.message || 'IndexedDB failed to initialize');
      }
    }
    initStorage();
  }, []);

  // Listen for lock events
  useEffect(() => {
    const unsub = sessionController.onLock(() => {
      setActiveSession(null);
      setConversations([]);
      setMessages({});
      setActiveChatId(null);
      setActiveModal(null);
    });
    return unsub;
  }, []);

  const loadSpaceData = useCallback(async (session: SpaceSession) => {
    // 1. Load active conversations from encrypted Space store
    const storedConvs = (await store.getAsync<UIConversation[]>(session, 'veil:ui:conversations')) || [];
    setConversations(storedConvs);

    // 2. Load stored message history
    const storedMsgs = (await store.getAsync<Record<string, UIMessage[]>>(session, 'veil:ui:messages')) || {};
    setMessages(storedMsgs);

    // 3. Connect NetworkManager for real-time WebSocket delivery
    try {
      await netManager.startListening(session, async (payload) => {
        // Handle incoming envelope payload
        try {
          const parsed = JSON.parse(payload);
          if (parsed && parsed.conversationId && parsed.text) {
            const incomingMsg: UIMessage = {
              id: parsed.id || `msg_${Date.now()}`,
              conversationId: parsed.conversationId,
              senderId: parsed.senderId || 'peer',
              text: parsed.text,
              isOutgoing: false,
              timestamp: Date.now(),
              status: 'DELIVERED_TO_RECIPIENT',
            };

            setMessages((prev) => {
              const list = prev[parsed.conversationId] || [];
              const updated = { ...prev, [parsed.conversationId]: [...list, incomingMsg] };
              store.setAsync(session, 'veil:ui:messages', updated);
              return updated;
            });
          }
        } catch (_e) {}
      });
      setNetworkState('connected');
    } catch (_err) {
      setNetworkState('degraded');
    }
  }, []);

  const unlockSpace = useCallback(
    async (passphrase: string) => {
      const session = await sessionController.unlock(passphrase);
      setActiveSession(session);
      await loadSpaceData(session);
    },
    [loadSpaceData]
  );

  const createSpace = useCallback(async (name: string, passphrase: string) => {
    await sessionController.createSpace(name, passphrase);
    setKnownSpacesCount(vault.listEnvelopes().length);
  }, []);

  const lockSpace = useCallback(() => {
    sessionController.lock();
  }, []);

  const panicLock = useCallback(() => {
    sessionController.panicLock();
  }, []);

  const selectConversation = useCallback((id: string | null) => {
    setActiveChatId(id);
    sessionController.recordUserActivity();
  }, []);

  const sendMessage = useCallback(
    async (conversationId: string, text: string) => {
      if (!activeSession || !text.trim()) return;

      sessionController.recordUserActivity();
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newMsg: UIMessage = {
        id: msgId,
        conversationId,
        senderId: activeSession.spaceId,
        text: text.trim(),
        isOutgoing: true,
        timestamp: Date.now(),
        status: 'SENDING',
      };

      // 1. Update UI state immediately (optimistic UI)
      setMessages((prev) => {
        const list = prev[conversationId] || [];
        const updated = { ...prev, [conversationId]: [...list, newMsg] };
        store.setAsync(activeSession, 'veil:ui:messages', updated);
        return updated;
      });

      // 2. Update conversation preview
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === conversationId ? { ...c, lastMessage: text.trim(), timestamp: Date.now() } : c
        );
        store.setAsync(activeSession, 'veil:ui:conversations', updated);
        return updated;
      });

      // 3. Dispatch through NetworkManager to Phase 12 Relay
      try {
        const payload = JSON.stringify({
          id: msgId,
          conversationId,
          senderId: activeSession.spaceId,
          text: text.trim(),
        });
        await netManager.sendEnvelope(activeSession, conversationId, payload);

        setMessages((prev) => {
          const list = (prev[conversationId] || []).map((m) =>
            m.id === msgId ? { ...m, status: 'SENT_TO_RELAY' as const } : m
          );
          const updated = { ...prev, [conversationId]: list };
          store.setAsync(activeSession, 'veil:ui:messages', updated);
          return updated;
        });
      } catch (_err) {
        setMessages((prev) => {
          const list = (prev[conversationId] || []).map((m) =>
            m.id === msgId ? { ...m, status: 'QUEUED' as const } : m
          );
          const updated = { ...prev, [conversationId]: list };
          store.setAsync(activeSession, 'veil:ui:messages', updated);
          return updated;
        });
      }
    },
    [activeSession]
  );

  const addDirectContact = useCallback(
    async (doc: IdentityDocument) => {
      if (!activeSession) return;
      const newConv: UIConversation = {
        id: doc.identityId,
        type: 'direct',
        name: doc.identityId.substring(0, 12),
        avatarSeed: doc.identityId,
        fingerprint: doc.fingerprint,
        isVerified: false,
        unreadCount: 0,
        peerDoc: doc,
      };

      setConversations((prev) => {
        if (prev.some((c) => c.id === doc.identityId)) return prev;
        const updated = [newConv, ...prev];
        store.setAsync(activeSession, 'veil:ui:conversations', updated);
        return updated;
      });

      setActiveChatId(doc.identityId);
      setActiveModal(null);
    },
    [activeSession]
  );

  const createGroup = useCallback(
    async (name: string) => {
      if (!activeSession) return;
      const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newConv: UIConversation = {
        id: groupId,
        type: 'group',
        name,
        avatarSeed: groupId,
        unreadCount: 0,
      };

      setConversations((prev) => {
        const updated = [newConv, ...prev];
        store.setAsync(activeSession, 'veil:ui:conversations', updated);
        return updated;
      });

      setActiveChatId(groupId);
      setActiveModal(null);
    },
    [activeSession]
  );

  const openModal = useCallback((modal: ActiveModal) => {
    setActiveModal(modal);
    sessionController.recordUserActivity();
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    sessionController.recordUserActivity();
  }, []);

  const value: AppContextType = {
    storageReady,
    storageError,
    activeSession,
    conversations,
    activeChatId,
    messages,
    activeModal,
    networkState,
    knownSpacesCount,
    unlockSpace,
    createSpace,
    lockSpace,
    panicLock,
    selectConversation,
    sendMessage,
    openModal,
    closeModal,
    addDirectContact,
    createGroup,
    sessionController,
    idMgr,
    store,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
