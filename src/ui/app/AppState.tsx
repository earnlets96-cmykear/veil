/**
 * Top-Level AppState & React Context Provider for VEIL Phase 15.
 *
 * Integrates ContactManager, InvitationManager, AttachmentPipeline,
 * NotificationDispatcher, LocalSearchEngine, and AppConfig.
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
import { Contact, InvitationPayload, VerificationStatus } from '../../contacts/types.ts';
import { ContactManager } from '../../contacts/contactManager.ts';
import { InvitationManager } from '../../contacts/invitationManager.ts';
import { AttachmentPipeline } from '../../attachments/attachmentPipeline.ts';
import { NotificationDispatcher } from '../../notifications/notificationDispatcher.ts';
import { LocalSearchEngine } from '../../search/searchEngine.ts';
import { SearchResult } from '../../search/types.ts';
import { ConfigManager } from '../../config/appConfig.ts';
import { AppConfig } from '../../config/types.ts';
import { PrekeyManager } from '../../ratchet/prekeys.ts';
import { ConversationManager } from '../../messaging/conversationManager.ts';
import { SpaceMailboxBinding } from '../../network/types.ts';
import { PrekeyBundle } from '../../ratchet/types.ts';

// Singleton Backend Instances
const storageAdapter = new IndexedDBStorageAdapter();
const vault = new SpaceVaultManager();
const store = new EncryptedSpaceStore(storageAdapter);
const idMgr = new SpaceIdentityManager();
const netManager = new NetworkManager(store);
const prekeyManager = new PrekeyManager(store, idMgr);
const convManager = new ConversationManager(store, idMgr, prekeyManager);
const sessionController = new SessionController(vault, store, storageAdapter, idMgr, netManager);
const contactManager = new ContactManager(store);
const notificationDispatcher = new NotificationDispatcher('SENDER_ONLY');
const searchEngine = new LocalSearchEngine();
const appConfig = ConfigManager.getConfig();

export interface AppContextType {
  storageReady: boolean;
  storageError: string | null;
  activeSession: SpaceSession | null;
  conversations: UIConversation[];
  contacts: Contact[];
  activeChatId: string | null;
  messages: Record<string, UIMessage[]>;
  activeModal: ActiveModal;
  networkState: NetworkState;
  knownSpacesCount: number;
  searchResults: SearchResult[];
  searchQuery: string;
  config: AppConfig;

  // Actions
  unlockSpace: (passphrase: string) => Promise<void>;
  createSpace: (name: string, passphrase: string) => Promise<void>;
  lockSpace: () => void;
  panicLock: () => void;
  selectConversation: (id: string | null) => void;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  sendAttachment: (conversationId: string, file: File) => Promise<void>;
  setSearchQuery: (query: string) => void;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  addDirectContact: (doc: IdentityDocument) => Promise<void>;
  addContactFromInvitation: (invitation: InvitationPayload) => Promise<void>;
  exportMyInvitation: () => string | null;
  updateContactVerification: (identityId: string, status: VerificationStatus) => Promise<void>;
  createGroup: (name: string, description?: string) => Promise<void>;
  sessionController: SessionController;
  idMgr: SpaceIdentityManager;
  store: EncryptedSpaceStore;
  notificationDispatcher: NotificationDispatcher;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<SpaceSession | null>(null);
  const [conversations, setConversations] = useState<UIConversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, UIMessage[]>>({});
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [networkState, setNetworkState] = useState<NetworkState>('offline');
  const [knownSpacesCount, setKnownSpacesCount] = useState(0);
  const [searchQuery, setSearchQueryState] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

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
      setContacts([]);
      setMessages({});
      setActiveChatId(null);
      setActiveModal(null);
      setSearchQueryState('');
      setSearchResults([]);
      searchEngine.clear();
      AttachmentPipeline.revokeAllEphemeralBlobUrls();
      notificationDispatcher.setLocked(true);
    });
    return unsub;
  }, []);

  const loadSpaceData = useCallback(async (session: SpaceSession) => {
    notificationDispatcher.setLocked(false);

    // 1. Load active conversations
    const storedConvs = (await store.getAsync<UIConversation[]>(session, 'veil:ui:conversations')) || [];
    setConversations(storedConvs);

    // 2. Load contacts
    const storedContacts = await contactManager.listContacts(session);
    setContacts(storedContacts);

    // 3. Load message history
    const storedMsgs = (await store.getAsync<Record<string, UIMessage[]>>(session, 'veil:ui:messages')) || {};
    setMessages(storedMsgs);

    // 4. Update Search Engine Index
    searchEngine.updateIndex(storedContacts, storedConvs, storedMsgs);

    // 5. Ensure Mailbox and Prekey pool are initialized
    try {
      await netManager.getOrCreateMailbox(session);
    } catch (_e) {}
    try {
      prekeyManager.generateSignedPrekey(session);
      prekeyManager.generateOneTimePrekeys(session, 10);
    } catch (_e) {}

    // 6. Connect NetworkManager for real-time WebSocket delivery & sync
    try {
      await netManager.startListening(session, async (payload) => {
        try {
          // Attempt E2EE wire payload processing
          const result = await convManager.processInboundWirePayload(session, payload);
          const { storedMessage, senderDoc, attachment } = result;

          const incomingMsg: UIMessage = {
            id: storedMessage.messageId,
            conversationId: storedMessage.conversationId,
            senderId: storedMessage.senderIdentityId,
            text: storedMessage.text,
            isOutgoing: false,
            timestamp: storedMessage.timestamp,
            status: 'DELIVERED_TO_RECIPIENT',
            attachment,
          };

          setMessages((prev) => {
            const list = prev[incomingMsg.conversationId] || [];
            const updated = { ...prev, [incomingMsg.conversationId]: [...list, incomingMsg] };
            store.setAsync(session, 'veil:ui:messages', updated);
            searchEngine.updateIndex(storedContacts, storedConvs, updated);
            return updated;
          });

          // Ensure conversation exists in list and update last message
          setConversations((prev) => {
            const existing = prev.find((c) => c.id === incomingMsg.conversationId);
            if (existing) {
              const updated = prev.map((c) =>
                c.id === incomingMsg.conversationId
                  ? {
                      ...c,
                      lastMessage: incomingMsg.text,
                      timestamp: incomingMsg.timestamp,
                      unreadCount: (c.unreadCount || 0) + 1,
                    }
                  : c
              );
              store.setAsync(session, 'veil:ui:conversations', updated);
              return updated;
            } else {
              const newConv: UIConversation = {
                id: incomingMsg.conversationId,
                type: 'direct',
                name: senderDoc.identityId.slice(0, 10),
                avatarSeed: incomingMsg.conversationId,
                fingerprint: senderDoc.fingerprint,
                isVerified: false,
                unreadCount: 1,
                lastMessage: incomingMsg.text,
                timestamp: incomingMsg.timestamp,
                peerDoc: senderDoc,
              };
              const updated = [newConv, ...prev];
              store.setAsync(session, 'veil:ui:conversations', updated);
              return updated;
            }
          });

          // Dispatch notification
          notificationDispatcher.dispatch({
            id: incomingMsg.id,
            senderName: senderDoc.identityId.slice(0, 8),
            text: incomingMsg.text,
            timestamp: Date.now(),
          });
        } catch (_wireErr) {
          // Fallback to raw JSON if payload was legacy/unencrypted
          try {
            const parsed = JSON.parse(payload);
            if (parsed && parsed.conversationId && (parsed.text || parsed.attachment)) {
              const incomingMsg: UIMessage = {
                id: parsed.id || `msg_${Date.now()}`,
                conversationId: parsed.conversationId,
                senderId: parsed.senderId || 'peer',
                text: parsed.text || '',
                isOutgoing: false,
                timestamp: Date.now(),
                status: 'DELIVERED_TO_RECIPIENT',
                attachment: parsed.attachment,
              };

              setMessages((prev) => {
                const list = prev[parsed.conversationId] || [];
                const updated = { ...prev, [parsed.conversationId]: [...list, incomingMsg] };
                store.setAsync(session, 'veil:ui:messages', updated);
                searchEngine.updateIndex(storedContacts, storedConvs, updated);
                return updated;
              });

              notificationDispatcher.dispatch({
                id: incomingMsg.id,
                senderName: parsed.senderName || 'Peer',
                text: parsed.text,
                timestamp: Date.now(),
              });
            }
          } catch (_e) {}
        }
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

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    if (!query.trim()) {
      setSearchResults([]);
    } else {
      setSearchResults(searchEngine.search(query));
    }
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

      setMessages((prev) => {
        const list = prev[conversationId] || [];
        const updated = { ...prev, [conversationId]: [...list, newMsg] };
        store.setAsync(activeSession, 'veil:ui:messages', updated);
        searchEngine.updateIndex(contacts, conversations, updated);
        return updated;
      });

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === conversationId ? { ...c, lastMessage: text.trim(), timestamp: Date.now() } : c
        );
        store.setAsync(activeSession, 'veil:ui:conversations', updated);
        return updated;
      });

      // Resolve recipient contact for mailboxId and prekeyBundle
      const targetContact = contacts.find((c) => c.identityId === conversationId);
      const targetMailboxId = targetContact?.mailboxId || conversationId;

      try {
        let wirePayload: string;
        if (targetContact?.prekeyBundle) {
          const { wirePayloadBase64 } = await convManager.encryptAndPackWireMessage(
            activeSession,
            targetContact.prekeyBundle,
            text.trim()
          );
          wirePayload = wirePayloadBase64;
        } else {
          wirePayload = JSON.stringify({
            id: msgId,
            conversationId,
            senderId: activeSession.spaceId,
            text: text.trim(),
          });
        }

        await netManager.sendEnvelope(activeSession, targetMailboxId, wirePayload);

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
    [activeSession, contacts, conversations]
  );

  const sendAttachment = useCallback(
    async (conversationId: string, file: File) => {
      if (!activeSession) return;
      sessionController.recordUserActivity();

      const arrayBuffer = await file.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuffer);

      const key = activeSession.getStorageKey();
      const { metadata } = AttachmentPipeline.chunkAndEncrypt(fileBytes, file.name, file.type, key);


      const msgId = `att_${Date.now()}`;
      const newMsg: UIMessage = {
        id: msgId,
        conversationId,
        senderId: activeSession.spaceId,
        text: `📎 Attachment: ${file.name}`,
        isOutgoing: true,
        timestamp: Date.now(),
        status: 'SENT_TO_RELAY',
        attachment: {
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type || 'application/octet-stream',
        },
      };

      setMessages((prev) => {
        const list = prev[conversationId] || [];
        const updated = { ...prev, [conversationId]: [...list, newMsg] };
        store.setAsync(activeSession, 'veil:ui:messages', updated);
        return updated;
      });

      const payload = JSON.stringify({
        id: msgId,
        conversationId,
        senderId: activeSession.spaceId,
        text: `📎 Attachment: ${file.name}`,
        attachment: newMsg.attachment,
      });

      try {
        const targetContact = contacts.find((c) => c.identityId === conversationId);
        const targetMailboxId = targetContact?.mailboxId || conversationId;
        await netManager.sendEnvelope(activeSession, targetMailboxId, payload);
      } catch (_e) {}
    },
    [activeSession, contacts]
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

  const addContactFromInvitation = useCallback(
    async (invitation: InvitationPayload) => {
      if (!activeSession) return;
      const contact = await contactManager.addContactFromInvitation(activeSession, invitation);
      setContacts((prev) => [...prev.filter((c) => c.identityId !== contact.identityId), contact]);

      // Add conversation if missing
      const newConv: UIConversation = {
        id: contact.identityId,
        type: 'direct',
        name: contact.name,
        avatarSeed: contact.identityId,
        fingerprint: contact.fingerprint,
        isVerified: false,
        unreadCount: 0,
        peerDoc: invitation.prekeyBundle?.identityDocument,
      };

      setConversations((prev) => {
        if (prev.some((c) => c.id === contact.identityId)) {
          return prev.map((c) =>
            c.id === contact.identityId ? { ...c, name: contact.name, fingerprint: contact.fingerprint } : c
          );
        }
        const updated = [newConv, ...prev];
        store.setAsync(activeSession, 'veil:ui:conversations', updated);
        return updated;
      });

      setActiveChatId(contact.identityId);
      setActiveModal(null);
    },
    [activeSession]
  );

  const exportMyInvitation = useCallback((): string | null => {
    if (!activeSession) return null;
    const identity = idMgr.loadIdentity(activeSession, store);
    if (!identity) return null;

    let mailboxId: string | undefined;
    const binding = store.get<SpaceMailboxBinding>(activeSession, 'net_mailbox_binding');
    if (binding && binding.mailboxId) {
      mailboxId = binding.mailboxId;
    }

    let prekeyBundle: PrekeyBundle | undefined;
    try {
      prekeyBundle = prekeyManager.createPrekeyBundle(activeSession);
    } catch (_e) {}

    const invitation = InvitationManager.createInvitation(
      identity.document,
      identity.signingPrivateKey,
      activeSession.name,
      undefined,
      mailboxId,
      prekeyBundle
    );
    return InvitationManager.toShareableString(invitation);
  }, [activeSession]);

  const updateContactVerification = useCallback(
    async (identityId: string, status: VerificationStatus) => {
      if (!activeSession) return;
      const updated = await contactManager.updateVerification(activeSession, identityId, status);
      setContacts((prev) => prev.map((c) => (c.identityId === identityId ? updated : c)));
      setConversations((prev) =>
        prev.map((c) => (c.id === identityId ? { ...c, isVerified: status === 'VERIFIED' } : c))
      );
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
    contacts,
    activeChatId,
    messages,
    activeModal,
    networkState,
    knownSpacesCount,
    searchResults,
    searchQuery,
    config: appConfig,
    unlockSpace,
    createSpace,
    lockSpace,
    panicLock,
    selectConversation,
    sendMessage,
    sendAttachment,
    setSearchQuery,
    openModal,
    closeModal,
    addDirectContact,
    addContactFromInvitation,
    exportMyInvitation,
    updateContactVerification,
    createGroup,
    sessionController,
    idMgr,
    store,
    notificationDispatcher,
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
