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
import { UIConversation, UIMessage, ActiveModal, UserPrivacySettings } from './types.ts';
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
import { DirectoryClient } from '../../network/directoryClient.ts';
import { ContactRequestManager, ContactRequest } from '../../contacts/contactRequestManager.ts';
import { SignedProfileDocument, createSignedProfile, verifySignedProfile } from '../../identity/profile.ts';
import { DirectorySearchResult } from '../../server/types.ts';
import { CloudClient } from '../../network/cloudClient.ts';
import { AccountManager } from '../../account/accountManager.ts';
import { SyncEngine } from '../../sync/syncEngine.ts';
import { VoiceRecorder } from '../../attachments/voiceRecorder.ts';
import { randomBytes, bytesToBase64, bytesToHex } from '../../crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { processAvatarImage } from '../utils/avatarProcessor.ts';

// Singleton Backend Instances
const storageAdapter = new IndexedDBStorageAdapter();
const vault = new SpaceVaultManager();
const store = new EncryptedSpaceStore(storageAdapter);
const idMgr = new SpaceIdentityManager();
const appConfig = ConfigManager.getConfig();
const netManager = new NetworkManager(store, {
  httpUrl: appConfig.relayHttpUrl,
  wsUrl: appConfig.relayWsUrl,
  requestTimeoutMs: appConfig.requestTimeoutMs,
  enforceTls: appConfig.enforceTls,
});
const prekeyManager = new PrekeyManager(store, idMgr);
const convManager = new ConversationManager(store, idMgr, prekeyManager);
const sessionController = new SessionController(vault, store, storageAdapter, idMgr, netManager);
const contactManager = new ContactManager(store);
const notificationDispatcher = new NotificationDispatcher('SENDER_ONLY');
const searchEngine = new LocalSearchEngine();
const directoryClient = new DirectoryClient(appConfig.relayHttpUrl || 'http://127.0.0.1:8787');
const contactRequestManager = new ContactRequestManager(store, contactManager, idMgr, netManager);
const cloudClient = new CloudClient(appConfig.relayHttpUrl || 'http://127.0.0.1:8787');
const accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);
const syncEngine = new SyncEngine(store, cloudClient);

export interface AppContextType {
  storageReady: boolean;
  storageError: string | null;
  activeSession: SpaceSession | null;
  conversations: UIConversation[];
  contacts: Contact[];
  contactRequests: ContactRequest[];
  myProfile: SignedProfileDocument | null;
  activeChatId: string | null;
  messages: Record<string, UIMessage[]>;
  activeModal: ActiveModal;
  networkState: NetworkState;
  knownSpacesCount: number;
  searchResults: SearchResult[];
  searchQuery: string;
  config: AppConfig;
  replyTarget: UIMessage | null;

  privacySettings: UserPrivacySettings;
  updatePrivacySettings: (settings: Partial<UserPrivacySettings>) => Promise<void>;

  // Actions
  unlockSpace: (passphrase: string) => Promise<void>;
  createSpace: (name: string, passphrase: string) => Promise<void>;
  restoreAccount: (username: string, password: string) => Promise<void>;
  registerCloudAccount: (username: string, password: string, spaceName?: string) => Promise<void>;
  lockSpace: () => void;
  panicLock: () => void;
  selectConversation: (id: string | null) => void;
  setReplyTarget: (msg: UIMessage | null) => void;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  sendAttachment: (conversationId: string, file: File) => Promise<void>;
  sendVoiceMessage: (conversationId: string, durationSeconds: number, audioBlob: Blob, mimeType: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  deleteMessageLocally: (conversationId: string, messageId: string) => Promise<void>;
  deleteMessagesLocally: (conversationId: string, messageIds: string[]) => Promise<void>;
  retryFailedMessage: (conversationId: string, messageId: string) => Promise<void>;
  markConversationAsRead: (conversationId: string) => void;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  addDirectContact: (doc: IdentityDocument) => Promise<void>;
  addContactFromInvitation: (invitation: InvitationPayload) => Promise<void>;
  exportMyInvitation: () => string | null;
  updateContactVerification: (identityId: string, status: VerificationStatus) => Promise<void>;
  createGroup: (name: string, description?: string) => Promise<void>;
  ensureCloudSession: (session: SpaceSession) => Promise<void>;

  // Phase 23 & Phase 32 Actions
  registerUsername: (username: string, displayName?: string, bio?: string, avatar?: string) => Promise<SignedProfileDocument>;
  searchDirectory: (query: string) => Promise<DirectorySearchResult[]>;
  sendContactRequest: (targetUsername: string, greeting?: string) => Promise<void>;
  acceptContactRequest: (requestId: string) => Promise<void>;
  declineContactRequest: (requestId: string) => Promise<void>;
  cancelContactRequest: (requestId: string) => Promise<void>;
  blockUser: (identityId: string) => Promise<void>;
  unblockUser: (identityId: string) => Promise<void>;
  removeContact: (identityId: string) => Promise<void>;

  sessionController: SessionController;
  idMgr: SpaceIdentityManager;
  store: EncryptedSpaceStore;
  notificationDispatcher: NotificationDispatcher;
  contactRequestManager: ContactRequestManager;
  directoryClient: DirectoryClient;
  cloudClient: CloudClient;
  accountManager: AccountManager;
  syncEngine: SyncEngine;
}

export const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<SpaceSession | null>(null);
  const [conversations, setConversations] = useState<UIConversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [myProfile, setMyProfile] = useState<SignedProfileDocument | null>(null);
  const [privacySettings, setPrivacySettings] = useState<UserPrivacySettings>({
    phoneVisibility: 'contacts',
    profileVisibility: 'everyone',
  });
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

  // Listen for real-time network state changes from NetworkManager
  useEffect(() => {
    const unsub = netManager.onStateChange((state) => {
      setNetworkState(state);
    });
    return unsub;
  }, []);

  // Listen for native online/offline browser & Capacitor events
  useEffect(() => {
    const handleOnline = async () => {
      if (activeSession && activeSession.isActive()) {
        try {
          await loadSpaceData(activeSession);
        } catch (_e) {
          setNetworkState('degraded');
        }
      }
    };

    const handleOffline = () => {
      setNetworkState('offline');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [activeSession, loadSpaceData]);

  // Continuous mailbox polling heartbeat when a Space is active
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(async () => {
      try {
        await netManager.syncMailbox(activeSession);
      } catch (_e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Listen for lock events
  useEffect(() => {
    const unsub = sessionController.onLock(() => {
      cloudClient.setSession(null, null, null);
      setActiveSession(null);
      setConversations([]);
      setContacts([]);
      setContactRequests([]);
      setMyProfile(null);
      setPrivacySettings({
        phoneVisibility: 'contacts',
        profileVisibility: 'everyone',
      });
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

  // Periodic mailbox background sync while Space is unlocked
  useEffect(() => {
    if (!activeSession || !activeSession.isActive()) return;

    const interval = setInterval(async () => {
      try {
        if (activeSession && activeSession.isActive()) {
          await netManager.syncMailbox(activeSession);
        }
      } catch (_e) {}
    }, 2500);

    return () => clearInterval(interval);
  }, [activeSession]);

  const ensureCloudSession = useCallback(async (session: SpaceSession) => {
    if (cloudClient.getSessionToken()) return;

    try {
      const savedCloudSession = (await store.getAsync<{
        sessionToken: string;
        accountId: string;
        deviceId: string;
        expiresAt: number;
        username?: string;
      }>(session, 'veil:cloud:session')) || null;

      const syncCurrentSpace = async (accId: string) => {
        try {
          await cloudClient.syncSpaces([
            {
              spaceId: session.spaceId,
              accountId: accId,
              encryptedHeader: 'encrypted_header_v1',
              version: 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ]);
        } catch (_sErr) {}
      };

      if (savedCloudSession && savedCloudSession.sessionToken && savedCloudSession.expiresAt > Date.now()) {
        cloudClient.setSession(
          savedCloudSession.sessionToken,
          savedCloudSession.accountId,
          savedCloudSession.deviceId
        );
        await syncCurrentSpace(savedCloudSession.accountId);
        return;
      }

      // Auto-register / authenticate cloud session deterministically for this Space
      const identity = idMgr.loadIdentity(session, store);
      const storedProfile = await store.getAsync<SignedProfileDocument>(session, 'veil:user:profile');
      const username = (storedProfile?.username || session.name.toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${session.spaceId.slice(0, 8)}`).replace(/^@/, '');
      const authPassword = bytesToHex(sha256(session.getMasterKey()));
      const deviceId = `dev_${identity ? identity.document.identityId.slice(0, 12) : bytesToHex(randomBytes(6))}`;

      try {
        const logRes = await cloudClient.loginAccount({
          username,
          password: authPassword,
          deviceId,
          deviceName: session.name,
          deviceSigningPub: identity?.document.signingPublicKey,
          deviceKeyAgreementPub: identity?.document.keyAgreementPublicKey,
        });
        if (logRes.session && logRes.session.sessionToken) {
          cloudClient.setSession(logRes.session.sessionToken, logRes.account.accountId, logRes.device.deviceId);
          await store.setAsync(session, 'veil:cloud:session', {
            sessionToken: logRes.session.sessionToken,
            accountId: logRes.account.accountId,
            deviceId: logRes.device.deviceId,
            expiresAt: logRes.session.expiresAt,
            username: username.toLowerCase(),
          });
          await syncCurrentSpace(logRes.account.accountId);
          return;
        }
      } catch (_loginErr) {
        try {
          const regRes = await cloudClient.registerAccount({
            username,
            password: authPassword,
            deviceId,
            deviceName: session.name,
            deviceSigningPub: identity?.document.signingPublicKey,
            deviceKeyAgreementPub: identity?.document.keyAgreementPublicKey,
          });
          if (regRes.session && regRes.session.sessionToken) {
            cloudClient.setSession(regRes.session.sessionToken, regRes.account.accountId, regRes.device.deviceId);
            await store.setAsync(session, 'veil:cloud:session', {
              sessionToken: regRes.session.sessionToken,
              accountId: regRes.account.accountId,
              deviceId: regRes.device.deviceId,
              expiresAt: regRes.session.expiresAt,
              username: username.toLowerCase(),
            });
            await syncCurrentSpace(regRes.account.accountId);
            return;
          }
        } catch (_regErr) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[VEIL-CLOUD] Auto cloud session failed:', _regErr);
          }
        }
      }
    } catch (_e) {}
  }, []);

  const loadSpaceData = useCallback(async (session: SpaceSession) => {
    notificationDispatcher.setLocked(false);

    // 0. Ensure persistent cloud session is active
    await ensureCloudSession(session);

    // 1. Load active conversations
    const storedConvs = (await store.getAsync<UIConversation[]>(session, 'veil:ui:conversations')) || [];
    setConversations(storedConvs);

    // 2. Load contacts
    const storedContacts = await contactManager.listContacts(session);
    setContacts(storedContacts);

    // 3. Load contact requests
    const storedRequests = await contactRequestManager.listRequests(session);
    setContactRequests(storedRequests);

    // 4. Load public profile & privacy settings
    const storedProfile = (await store.getAsync<SignedProfileDocument>(session, 'veil:user:profile')) || null;
    setMyProfile(storedProfile);
    const storedPrivacy = (await store.getAsync<UserPrivacySettings>(session, 'veil:user:privacy_settings')) || {
      phoneVisibility: 'contacts',
      profileVisibility: 'everyone',
    };
    setPrivacySettings(storedPrivacy);

    // 5. Load message history
    const storedMsgs = (await store.getAsync<Record<string, UIMessage[]>>(session, 'veil:ui:messages')) || {};
    setMessages(storedMsgs);

    // 6. Update Search Engine Index
    searchEngine.updateIndex(storedContacts, storedConvs, storedMsgs);

    // 7. Ensure Mailbox, Prekey pool, and Directory registration are initialized
    try {
      const binding = await netManager.getOrCreateMailbox(session);
      if (!prekeyManager.getSignedPrekeyPublic(session)) {
        prekeyManager.generateSignedPrekey(session);
      }
      prekeyManager.generateOneTimePrekeys(session, 10);

      // Auto-register public profile in Directory so Space is immediately routeable
      const identity = idMgr.loadIdentity(session, store);
      const username = storedProfile?.username || session.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (identity && username && binding) {
        const prekeyBundle = prekeyManager.createPrekeyBundle(session);
        const autoProfile = createSignedProfile(
          identity.document.identityId,
          identity.signingPrivateKey,
          username,
          storedProfile?.displayName || session.name,
          binding.mailboxId,
          prekeyBundle,
          storedProfile?.avatar || undefined
        );
        await directoryClient.registerProfile(autoProfile);
        await store.setAsync(session, 'veil:user:profile', autoProfile);
        setMyProfile(autoProfile);
      }
    } catch (_e) {}

    // 8. Connect NetworkManager for real-time WebSocket delivery & sync
    try {
      await netManager.startListening(session, async (payload) => {
        // Check for Contact Requests or Responses
        try {
          if (payload.includes('"type":"CONTACT_REQUEST"')) {
            const parsed = JSON.parse(payload);
            const req = await contactRequestManager.handleInboundRequest(session, parsed);
            if (req) {
              const updated = await contactRequestManager.listRequests(session);
              setContactRequests(updated);
              notificationDispatcher.dispatch({
                id: req.requestId,
                senderName: req.peerDisplayName || `@${req.peerUsername}`,
                text: req.greeting || 'Sent you a contact request',
                timestamp: req.createdAt,
              });
              return;
            }
          } else if (payload.includes('"type":"CONTACT_CANCEL"')) {
            const parsed = JSON.parse(payload);
            const cancelledReq = await contactRequestManager.handleInboundCancel(session, parsed);
            if (cancelledReq) {
              const updatedReqs = await contactRequestManager.listRequests(session);
              setContactRequests(updatedReqs);
              notificationDispatcher.dispatch({
                id: cancelledReq.requestId,
                senderName: cancelledReq.peerDisplayName || `@${cancelledReq.peerUsername}`,
                text: 'Contact request withdrawn.',
                timestamp: Date.now(),
              });
              return;
            }
          } else if (payload.includes('"type":"CONTACT_RESPONSE"')) {
            const parsed = JSON.parse(payload);
            const resp = await contactRequestManager.handleInboundResponse(session, parsed);
            if (resp) {
              const updatedReqs = await contactRequestManager.listRequests(session);
              setContactRequests(updatedReqs);
              const updatedContacts = await contactManager.listContacts(session);
              setContacts(updatedContacts);

              // Ensure conversation exists in UI
              const targetContact = updatedContacts.find((c) => c.identityId === resp.peerIdentityId);
              if (targetContact) {
                setConversations((prev) => {
                  if (prev.some((c) => c.id === targetContact.identityId)) return prev;
                  const newConv: UIConversation = {
                    id: targetContact.identityId,
                    type: 'direct',
                    name: targetContact.name,
                    avatarSeed: targetContact.identityId,
                    fingerprint: targetContact.fingerprint,
                    isVerified: targetContact.verificationStatus === 'VERIFIED',
                    unreadCount: 0,
                    peerDoc: targetContact.prekeyBundle?.identityDocument,
                  };
                  const updated = [newConv, ...prev];
                  store.setAsync(session, 'veil:ui:conversations', updated);
                  return updated;
                });
              }
              return;
            }
          }
        } catch (_reqErr) {}

        // Standard E2EE wire payload processing
        try {
          const result = await convManager.processInboundWirePayload(session, payload);
          const { storedMessage, senderDoc, senderMailboxId, attachment, replyTo, voice } = result;

          const incomingMsg: UIMessage = {
            id: storedMessage.messageId,
            conversationId: storedMessage.conversationId,
            senderId: storedMessage.senderIdentityId,
            text: storedMessage.text,
            isOutgoing: false,
            timestamp: storedMessage.timestamp,
            status: 'DELIVERED_TO_RECIPIENT',
            attachment,
            replyTo,
            voice,
          };

          const currentContacts = await contactManager.listContacts(session);
          let matchingContact = currentContacts.find(
            (c) => c.identityId === incomingMsg.conversationId || c.identityId === senderDoc.identityId
          );

          if (senderMailboxId && (!matchingContact || !matchingContact.mailboxId)) {
            try {
              const updatedContact = await contactManager.addContactFromInvitation(session, {
                version: 1,
                identityId: senderDoc.identityId,
                name: matchingContact?.name || senderDoc.identityId.slice(0, 10),
                signingPublicKey: senderDoc.signingPublicKey,
                keyAgreementPublicKey: senderDoc.keyAgreementPublicKey,
                fingerprint: senderDoc.fingerprint,
                mailboxId: senderMailboxId,
                createdAt: Date.now(),
                expiresAt: 0,
                signature: senderDoc.signature,
              });
              matchingContact = updatedContact;
              setContacts((prev) => [...prev.filter((c) => c.identityId !== updatedContact.identityId), updatedContact]);
            } catch (_e) {}
          }

          setMessages((prev) => {
            const keys = new Set([
              incomingMsg.conversationId,
              senderDoc.identityId,
              matchingContact?.identityId,
              matchingContact?.name,
            ].filter(Boolean) as string[]);

            const list = prev[incomingMsg.conversationId] || (matchingContact?.name ? prev[matchingContact.name] : []) || [];
            const nextList = [...list, incomingMsg];

            const updated = { ...prev };
            for (const k of keys) {
              updated[k] = nextList;
            }
            store.setAsync(session, 'veil:ui:messages', updated);
            searchEngine.updateIndex(currentContacts, storedConvs, updated);
            return updated;
          });

          // Ensure conversation exists in list and update last message
          setConversations((prev) => {
            const matchId = (c: UIConversation) =>
              c.id === incomingMsg.conversationId ||
              c.id === senderDoc.identityId ||
              (matchingContact && (c.id === matchingContact.identityId || c.name === matchingContact.name));

            const existing = prev.find(matchId);
            if (existing) {
              const updated = prev.map((c) =>
                matchId(c)
                  ? {
                      ...c,
                      name: matchingContact?.name || c.name,
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
                id: matchingContact?.identityId || senderDoc.identityId || incomingMsg.conversationId,
                type: 'direct',
                name: matchingContact?.name || senderDoc.identityId.slice(0, 10),
                avatarSeed: incomingMsg.conversationId,
                fingerprint: senderDoc.fingerprint,
                isVerified: matchingContact?.verificationStatus === 'VERIFIED',
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
            senderName: matchingContact?.name || senderDoc.identityId.slice(0, 8),
            text: incomingMsg.text,
            timestamp: Date.now(),
          });

          if (typeof console !== 'undefined' && console.debug) {
            console.debug(`[VEIL-UI] Inbound wire message processed: msgId=${incomingMsg.id.slice(0, 8)}, convId=${incomingMsg.conversationId.slice(0, 8)}`);
          }
        } catch (wireErr: any) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[VEIL-UI] Inbound wire payload decryption error:', wireErr?.name || 'Error', wireErr?.message || wireErr);
          }
          // Fallback to raw JSON if payload was legacy/unencrypted
          try {
            const parsed = JSON.parse(payload);
            if (parsed && parsed.conversationId && (parsed.text || parsed.attachment || parsed.voice)) {
              const incomingMsg: UIMessage = {
                id: parsed.id || `msg_${Date.now()}`,
                conversationId: parsed.conversationId,
                senderId: parsed.senderId || 'peer',
                text: parsed.text || '',
                isOutgoing: false,
                timestamp: Date.now(),
                status: 'DELIVERED_TO_RECIPIENT',
                attachment: parsed.attachment,
                voice: parsed.voice,
                replyTo: parsed.replyTo,
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

  const selectConversation = useCallback(
    (id: string | null) => {
      setActiveChatId(id);
      if (id && activeSession) {
        setConversations((prev) => {
          if (prev.some((c) => c.id === id)) return prev;
          const contact = contacts.find((c) => c.identityId === id);
          if (contact) {
            const newConv: UIConversation = {
              id: contact.identityId,
              type: 'direct',
              name: contact.name,
              avatarSeed: contact.identityId,
              fingerprint: contact.fingerprint,
              isVerified: contact.verificationStatus === 'VERIFIED',
              unreadCount: 0,
              peerDoc: contact.prekeyBundle?.identityDocument,
            };
            const updated = [newConv, ...prev];
            store.setAsync(activeSession, 'veil:ui:conversations', updated);
            return updated;
          }
          return prev;
        });
      }
      sessionController.recordUserActivity();
    },
    [activeSession, contacts]
  );

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    if (!query.trim()) {
      setSearchResults([]);
    } else {
      setSearchResults(searchEngine.search(query));
    }
  }, []);

  const [replyTarget, setReplyTarget] = useState<UIMessage | null>(null);

  const sendMessage = useCallback(
    async (conversationId: string, text: string) => {
      if (!activeSession || !text.trim()) return;

      sessionController.recordUserActivity();
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const activeReply = replyTarget ? {
        messageId: replyTarget.id,
        senderName: replyTarget.senderName || replyTarget.senderId,
        text: replyTarget.text,
        attachmentType: replyTarget.voice ? 'voice' : replyTarget.attachment ? 'file' : undefined,
      } : undefined;

      const newMsg: UIMessage = {
        id: msgId,
        conversationId,
        senderId: activeSession.spaceId,
        text: text.trim(),
        isOutgoing: true,
        timestamp: Date.now(),
        status: 'SENDING',
        replyTo: activeReply,
      };

      setReplyTarget(null);

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
      const freshContacts = await contactManager.listContacts(activeSession);
      let targetContact = freshContacts.find((c) => c.identityId === conversationId) || contacts.find((c) => c.identityId === conversationId);

      // If contact is missing mailboxId or prekeyBundle, try on-the-fly Directory lookup
      if (!targetContact?.mailboxId || !targetContact?.prekeyBundle) {
        try {
          const lookupName = (targetContact?.name || conversationId).replace(/^@/, '').trim();
          let profile = await directoryClient.getProfileByUsername(lookupName);
          if (!profile && targetContact?.identityId) {
            profile = await directoryClient.getProfileByIdentity(targetContact.identityId);
          }
          if (!profile && conversationId) {
            profile = await directoryClient.getProfileByIdentity(conversationId);
          }
          if (!profile) {
            const results = await directoryClient.searchProfiles(lookupName);
            if (results.length > 0) {
              profile = await directoryClient.getProfileByUsername(results[0].username);
            }
          }
          if (profile) {
            targetContact = await contactManager.addContactFromInvitation(activeSession, {
              version: 1,
              identityId: profile.identityId,
              name: profile.displayName || profile.username,
              signingPublicKey: profile.prekeyBundle.identityDocument.signingPublicKey,
              keyAgreementPublicKey: profile.prekeyBundle.identityDocument.keyAgreementPublicKey,
              fingerprint: profile.prekeyBundle.identityDocument.fingerprint,
              mailboxId: profile.mailboxId,
              prekeyBundle: profile.prekeyBundle,
              createdAt: profile.issuedAt,
              expiresAt: profile.expiresAt || 0,
              signature: profile.signature,
            });
            setContacts((prev) => [...prev.filter((c) => c.identityId !== targetContact!.identityId), targetContact!]);
          }
        } catch (_e) {}
      }

      const targetMailboxId = targetContact?.mailboxId || conversationId;

      try {
        let wirePayload: string;
        if (targetContact?.prekeyBundle) {
          const { wirePayloadBase64 } = await convManager.encryptAndPackWireMessage(
            activeSession,
            targetContact.prekeyBundle,
            text.trim(),
            undefined,
            activeReply
          );
          wirePayload = wirePayloadBase64;
        } else {
          wirePayload = JSON.stringify({
            id: msgId,
            conversationId,
            senderId: activeSession.spaceId,
            text: text.trim(),
            replyTo: activeReply,
          });
        }

        const keys = new Set([
          conversationId,
          targetContact?.identityId,
          targetContact?.name,
        ].filter(Boolean) as string[]);

        await netManager.sendEnvelope(activeSession, targetMailboxId, wirePayload);

        setMessages((prev) => {
          const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []).map((m) =>
            m.id === msgId ? { ...m, status: 'SENT_TO_RELAY' as const } : m
          );
          const updated = { ...prev };
          for (const k of keys) {
            updated[k] = list;
          }
          store.setAsync(activeSession, 'veil:ui:messages', updated);
          return updated;
        });

        if (typeof console !== 'undefined' && console.debug) {
          console.debug(`[VEIL-UI] Outbound message sent: msgId=${msgId.slice(0, 8)}, convId=${conversationId.slice(0, 8)}, state=SENT_TO_RELAY`);
        }
      } catch (sendErr: any) {
        const keys = new Set([
          conversationId,
          targetContact?.identityId,
          targetContact?.name,
        ].filter(Boolean) as string[]);

        setMessages((prev) => {
          const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []).map((m) =>
            m.id === msgId ? { ...m, status: 'QUEUED' as const } : m
          );
          const updated = { ...prev };
          for (const k of keys) {
            updated[k] = list;
          }
          store.setAsync(activeSession, 'veil:ui:messages', updated);
          return updated;
        });

        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[VEIL-UI] Outbound message send failed, queued locally: msgId=${msgId.slice(0, 8)}, error=${sendErr?.message || sendErr}`);
        }
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

      // 1. Generate single-use random 32-byte ephemeral key and chunk/encrypt
      const ephemeralKey = randomBytes(32);
      const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
        fileBytes,
        file.name,
        file.type || 'application/octet-stream',
        ephemeralKey
      );

      // 2. Serialize ciphertext chunks into raw payload
      const rawCiphertext = new TextEncoder().encode(JSON.stringify(chunks));
      const ciphertextHash = bytesToHex(sha256(rawCiphertext));

      // 3. Resolve recipient contact for authorization
      const freshContacts = await contactManager.listContacts(activeSession);
      const targetContact = freshContacts.find((c) => c.identityId === conversationId) || contacts.find((c) => c.identityId === conversationId);
      const targetMailboxId = targetContact?.mailboxId || conversationId;
      const targetUsername = targetContact?.name ? targetContact.name.replace(/^@/, '').trim() : undefined;

      if (!cloudClient.getSessionToken()) {
        await ensureCloudSession(activeSession);
      }

      let objectId = `obj_${Date.now()}_${bytesToHex(randomBytes(6))}`;
      try {
        const createRes = await cloudClient.createAttachment({
          attachmentId: metadata.attachmentId,
          spaceId: activeSession.spaceId,
          ciphertextSize: rawCiphertext.length,
          ciphertextHash,
          chunkCount: metadata.chunkCount,
          chunkSize: metadata.chunkSize,
          recipientUsername: targetUsername,
          recipientAccountId: targetContact?.metadata?.accountId,
          encryptedMetadata: JSON.stringify({
            name: metadata.name,
            mimeType: metadata.mimeType,
            sizeBytes: metadata.sizeBytes,
            recipientUsername: targetUsername,
            recipientAccountId: targetContact?.metadata?.accountId,
          }),
        });
        objectId = createRes.attachment.objectId;
        await cloudClient.uploadAttachment(objectId, rawCiphertext);
      } catch (uploadErr: any) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[VEIL-ATTACHMENT] Attachment upload failed:', uploadErr);
        }
        alert(`Attachment upload failed: ${uploadErr?.message || 'Cloud storage unavailable'}`);
        return;
      }

      const attachmentPayload = {
        attachmentId: metadata.attachmentId,
        objectId,
        name: metadata.name,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        chunkCount: metadata.chunkCount,
        chunkSize: metadata.chunkSize,
        sha256Hash: metadata.sha256Hash,
        ciphertextHash,
        encryptionKeyBase64: bytesToBase64(ephemeralKey),
      };

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const activeReply = replyTarget ? {
        messageId: replyTarget.id,
        senderName: replyTarget.senderName || replyTarget.senderId,
        text: replyTarget.text,
        attachmentType: replyTarget.voice ? 'voice' : replyTarget.attachment ? 'file' : undefined,
      } : undefined;

      const newMsg: UIMessage = {
        id: msgId,
        conversationId,
        senderId: activeSession.spaceId,
        text: `📎 Attachment: ${file.name}`,
        isOutgoing: true,
        timestamp: Date.now(),
        status: 'SENDING',
        attachment: attachmentPayload,
        replyTo: activeReply,
      };

      setReplyTarget(null);

      const keys = new Set([
        conversationId,
        targetContact?.identityId,
        targetContact?.name,
      ].filter(Boolean) as string[]);

      setMessages((prev) => {
        const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []);
        const updated = { ...prev };
        for (const k of keys) {
          updated[k] = [...list, newMsg];
        }
        store.setAsync(activeSession, 'veil:ui:messages', updated);
        return updated;
      });

      try {
        let wirePayload: string;
        if (targetContact?.prekeyBundle) {
          const { wirePayloadBase64 } = await convManager.encryptAndPackWireMessage(
            activeSession,
            targetContact.prekeyBundle,
            `📎 Attachment: ${file.name}`,
            attachmentPayload,
            activeReply
          );
          wirePayload = wirePayloadBase64;
        } else {
          wirePayload = JSON.stringify({
            id: msgId,
            conversationId,
            senderId: activeSession.spaceId,
            text: `📎 Attachment: ${file.name}`,
            attachment: attachmentPayload,
            replyTo: activeReply,
          });
        }

        await netManager.sendEnvelope(activeSession, targetMailboxId, wirePayload);

        setMessages((prev) => {
          const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []).map((m) =>
            m.id === msgId ? { ...m, status: 'SENT_TO_RELAY' as const } : m
          );
          const updated = { ...prev };
          for (const k of keys) {
            updated[k] = list;
          }
          store.setAsync(activeSession, 'veil:ui:messages', updated);
          return updated;
        });
      } catch (_e) {}
    },
    [activeSession, contacts, replyTarget]
  );

  const sendVoiceMessage = useCallback(
    async (conversationId: string, durationSeconds: number, audioBlob: Blob, mimeType: string) => {
      if (!activeSession) return;
      sessionController.recordUserActivity();

      const arrayBuffer = await audioBlob.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);

      let voiceMeta: any = {
        durationSeconds,
        sizeBytes: rawBytes.length,
        objectId: `voice_${Date.now()}`,
        mimeType,
        ciphertextHash: '',
        encryptionKeyBase64: '',
        nonceBase64: '',
      };

      const freshContacts = await contactManager.listContacts(activeSession);
      const targetContact = freshContacts.find((c) => c.identityId === conversationId) || contacts.find((c) => c.identityId === conversationId);
      const targetMailboxId = targetContact?.mailboxId || conversationId;
      const targetUsername = targetContact?.name ? targetContact.name.replace(/^@/, '').trim() : undefined;

      if (!cloudClient.getSessionToken()) {
        await ensureCloudSession(activeSession);
      }

      try {
        voiceMeta = await VoiceRecorder.encryptAndUploadVoiceNote(
          activeSession,
          cloudClient,
          rawBytes,
          durationSeconds,
          mimeType,
          {
            recipientUsername: targetUsername,
            recipientAccountId: targetContact?.metadata?.accountId,
          }
        );
      } catch (uploadErr: any) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[VEIL-VOICE] Voice upload failed:', uploadErr);
        }
        alert(`Voice message upload failed: ${uploadErr?.message || 'Cloud storage unavailable'}`);
        return;
      }

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const activeReply = replyTarget ? {
        messageId: replyTarget.id,
        senderName: replyTarget.senderName || replyTarget.senderId,
        text: replyTarget.text,
        attachmentType: replyTarget.voice ? 'voice' : replyTarget.attachment ? 'file' : undefined,
      } : undefined;

      const newMsg: UIMessage = {
        id: msgId,
        conversationId,
        senderId: activeSession.spaceId,
        text: '🎙️ Voice Message',
        isOutgoing: true,
        timestamp: Date.now(),
        status: 'SENDING',
        voice: voiceMeta,
        replyTo: activeReply,
      };

      setReplyTarget(null);

      const keys = new Set([
        conversationId,
        targetContact?.identityId,
        targetContact?.name,
      ].filter(Boolean) as string[]);

      setMessages((prev) => {
        const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []);
        const updated = { ...prev };
        for (const k of keys) {
          updated[k] = [...list, newMsg];
        }
        store.setAsync(activeSession, 'veil:ui:messages', updated);
        return updated;
      });

      try {
        let wirePayload: string;
        if (targetContact?.prekeyBundle) {
          const { wirePayloadBase64 } = await convManager.encryptAndPackWireMessage(
            activeSession,
            targetContact.prekeyBundle,
            '🎙️ Voice Message',
            undefined,
            activeReply,
            voiceMeta
          );
          wirePayload = wirePayloadBase64;
        } else {
          wirePayload = JSON.stringify({
            id: msgId,
            conversationId,
            senderId: activeSession.spaceId,
            text: '🎙️ Voice Message',
            voice: voiceMeta,
            replyTo: activeReply,
          });
        }

        await netManager.sendEnvelope(activeSession, targetMailboxId, wirePayload);

        setMessages((prev) => {
          const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []).map((m) =>
            m.id === msgId ? { ...m, status: 'SENT_TO_RELAY' as const } : m
          );
          const updated = { ...prev };
          for (const k of keys) {
            updated[k] = list;
          }
          store.setAsync(activeSession, 'veil:ui:messages', updated);
          return updated;
        });
      } catch (_e) {
        setMessages((prev) => {
          const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []).map((m) =>
            m.id === msgId ? { ...m, status: 'QUEUED' as const } : m
          );
          const updated = { ...prev };
          for (const k of keys) {
            updated[k] = list;
          }
          store.setAsync(activeSession, 'veil:ui:messages', updated);
          return updated;
        });
      }
    },
    [activeSession, contacts, replyTarget]
  );

  const deleteMessageLocally = useCallback(
    async (conversationId: string, messageId: string) => {
      if (!activeSession) return;
      sessionController.recordUserActivity();

      setMessages((prev) => {
        const list = prev[conversationId] || [];
        const filtered = list.filter((m) => m.id !== messageId);
        const updated = { ...prev, [conversationId]: filtered };
        store.setAsync(activeSession, 'veil:ui:messages', updated);
        searchEngine.updateIndex(contacts, conversations, updated);
        return updated;
      });

      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id === conversationId) {
            const list = (messages[conversationId] || []).filter((m) => m.id !== messageId);
            const lastMsg = list.length > 0 ? list[list.length - 1] : undefined;
            return {
              ...c,
              lastMessage: lastMsg?.text || (c.type === 'group' ? 'Group created' : 'E2EE conversation'),
              timestamp: lastMsg?.timestamp || c.timestamp,
            };
          }
          return c;
        });
        store.setAsync(activeSession, 'veil:ui:conversations', updated);
        return updated;
      });
    },
    [activeSession, contacts, conversations, messages]
  );

  const deleteMessagesLocally = useCallback(
    async (conversationId: string, messageIds: string[]) => {
      if (!activeSession || messageIds.length === 0) return;
      sessionController.recordUserActivity();
      const idSet = new Set(messageIds);

      setMessages((prev) => {
        const list = prev[conversationId] || [];
        const filtered = list.filter((m) => !idSet.has(m.id));
        const updated = { ...prev, [conversationId]: filtered };
        store.setAsync(activeSession, 'veil:ui:messages', updated);
        searchEngine.updateIndex(contacts, conversations, updated);
        return updated;
      });

      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id === conversationId) {
            const list = (messages[conversationId] || []).filter((m) => !idSet.has(m.id));
            const lastMsg = list.length > 0 ? list[list.length - 1] : undefined;
            return {
              ...c,
              lastMessage: lastMsg?.text || (c.type === 'group' ? 'Group created' : 'E2EE conversation'),
              timestamp: lastMsg?.timestamp || c.timestamp,
            };
          }
          return c;
        });
        store.setAsync(activeSession, 'veil:ui:conversations', updated);
        return updated;
      });
    },
    [activeSession, contacts, conversations, messages]
  );

  const retryFailedMessage = useCallback(
    async (conversationId: string, messageId: string) => {
      const convMessages = messages[conversationId] || [];
      const targetMsg = convMessages.find((m) => m.id === messageId);
      if (!targetMsg || !activeSession) return;

      await deleteMessageLocally(conversationId, messageId);
      await sendMessage(conversationId, targetMsg.text);
    },
    [activeSession, messages, deleteMessageLocally, sendMessage]
  );

  const markConversationAsRead = useCallback(
    (conversationId: string) => {
      if (!activeSession) return;
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        );
        store.setAsync(activeSession, 'veil:ui:conversations', updated);
        return updated;
      });
    },
    [activeSession]
  );

  const restoreAccount = useCallback(
    async (username: string, password: string) => {
      const { session, identityDoc } = await accountManager.restoreAccount({
        username,
        password,
      });
      setActiveSession(session);
      sessionController.recordUserActivity();

      const loadedContacts = await contactManager.listContacts(session);
      setContacts(loadedContacts);

      const loadedMessages = store.get<Record<string, UIMessage[]>>(session, 'veil:ui:messages') || {};
      setMessages(loadedMessages);

      const loadedConversations = store.get<UIConversation[]>(session, 'veil:ui:conversations') || [];
      setConversations(loadedConversations);

      try {
        const binding = await netManager.allocateMailbox(session);
        store.set(session, 'net_mailbox_binding', binding);
        await syncEngine.sync(session);
      } catch (_e) {}
    },
    []
  );

  const registerCloudAccount = useCallback(
    async (username: string, password: string, spaceName?: string) => {
      const { session, identityDoc } = await accountManager.registerAccount({
        username,
        password,
        spaceName,
      });
      setActiveSession(session);
      sessionController.recordUserActivity();

      try {
        const loadedIdentity = idMgr.loadIdentity(session, store);
        const binding = await netManager.getOrCreateMailbox(session);
        if (loadedIdentity && binding) {
          const prekeyBundle = prekeyManager.createPrekeyBundle(session);
          const signedProfile = createSignedProfile(
            loadedIdentity.document.identityId,
            loadedIdentity.signingPrivateKey,
            username,
            session.name,
            binding.mailboxId,
            prekeyBundle
          );
          await directoryClient.registerProfile(signedProfile);
          await store.setAsync(session, 'veil:user:profile', signedProfile);
          setMyProfile(signedProfile);
        }
      } catch (_e) {}
    },
    []
  );

  const addDirectContact = useCallback(
    async (doc: IdentityDocument) => {
      if (!activeSession) return;

      const cleanName = doc.identityId.replace(/^@/, '').trim();
      let targetProfile = null;
      try {
        targetProfile = await directoryClient.getProfileByUsername(cleanName);
      } catch (_e) {}

      if (targetProfile) {
        const contact = await contactManager.addContactFromInvitation(activeSession, {
          version: 1,
          identityId: targetProfile.identityId,
          name: targetProfile.displayName || targetProfile.username,
          signingPublicKey: targetProfile.prekeyBundle.identityDocument.signingPublicKey,
          keyAgreementPublicKey: targetProfile.prekeyBundle.identityDocument.keyAgreementPublicKey,
          fingerprint: targetProfile.prekeyBundle.identityDocument.fingerprint,
          mailboxId: targetProfile.mailboxId,
          prekeyBundle: targetProfile.prekeyBundle,
          createdAt: targetProfile.issuedAt,
          expiresAt: targetProfile.expiresAt || 0,
          signature: targetProfile.signature,
        });
        setContacts((prev) => [...prev.filter((c) => c.identityId !== contact.identityId), contact]);
        const newConv: UIConversation = {
          id: contact.identityId,
          type: 'direct',
          name: contact.name,
          avatarSeed: contact.identityId,
          fingerprint: contact.fingerprint,
          isVerified: false,
          unreadCount: 0,
          peerDoc: targetProfile.prekeyBundle?.identityDocument,
        };
        setConversations((prev) => {
          if (prev.some((c) => c.id === contact.identityId)) return prev;
          const updated = [newConv, ...prev];
          store.setAsync(activeSession, 'veil:ui:conversations', updated);
          return updated;
        });
        setActiveChatId(contact.identityId);
      } else {
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
      }
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

  const updatePrivacySettings = useCallback(
    async (updated: Partial<UserPrivacySettings>) => {
      if (!activeSession) return;
      const next = { ...privacySettings, ...updated };
      setPrivacySettings(next);
      await store.setAsync(activeSession, 'veil:user:privacy_settings', next);
    },
    [activeSession, privacySettings]
  );

  const registerUsername = useCallback(
    async (username: string, displayName?: string, bio?: string, avatar?: string) => {
      if (!activeSession) throw new Error('No active Space');
      const identity = idMgr.loadIdentity(activeSession, store);
      if (!identity) throw new Error('Identity not loaded');

      const binding = await netManager.getOrCreateMailbox(activeSession);
      const prekeyBundle = prekeyManager.createPrekeyBundle(activeSession);

      let avatarToUse = avatar !== undefined ? avatar : (privacySettings.avatar || myProfile?.avatar);
      if (avatarToUse && avatarToUse.length > 32 * 1024) {
        try {
          avatarToUse = await processAvatarImage(avatarToUse);
        } catch (_err) {
          // Keep best effort if downsampling fails in headless context
        }
      }

      const profile = createSignedProfile(
        identity.document.identityId,
        identity.signingPrivateKey,
        username,
        displayName || username,
        binding.mailboxId,
        prekeyBundle,
        avatarToUse
      );

      try {
        await directoryClient.registerProfile(profile);
      } catch (err: any) {
        const msg = err.message || '';
        if (msg.includes('CONFLICT') || msg.includes('already registered')) {
          throw new Error(`Username @${username} is already taken by another identity.`);
        }
        if (msg.includes('Invalid') || msg.includes('format')) {
          throw new Error(`Invalid username format: ${msg}`);
        }
        throw new Error("Couldn't publish your profile. Please check your connection and try again.");
      }

      await store.setAsync(activeSession, 'veil:user:profile', profile);
      if (bio !== undefined || avatar !== undefined) {
        await updatePrivacySettings({ bio, avatar });
      }
      setMyProfile(profile);
      return profile;
    },
    [activeSession, myProfile, privacySettings, updatePrivacySettings]
  );

  const searchDirectory = useCallback(
    async (query: string) => {
      return directoryClient.searchProfiles(query);
    },
    []
  );

  const sendContactRequest = useCallback(
    async (targetUsername: string, greeting?: string) => {
      if (!activeSession) throw new Error('No active Space');
      const targetProfile = await directoryClient.getProfileByUsername(targetUsername);
      if (!targetProfile) {
        throw new Error(`User @${targetUsername} not found`);
      }

      let profileToSend = myProfile;
      if (!profileToSend) {
        const identity = idMgr.loadIdentity(activeSession, store);
        if (!identity) throw new Error('Identity not loaded');
        const binding = await netManager.getOrCreateMailbox(activeSession);
        const prekeyBundle = prekeyManager.createPrekeyBundle(activeSession);
        profileToSend = createSignedProfile(
          identity.document.identityId,
          identity.signingPrivateKey,
          `user_${identity.document.identityId.slice(0, 8)}`,
          activeSession.name,
          binding.mailboxId,
          prekeyBundle
        );
      }

      await contactRequestManager.sendContactRequest(
        activeSession,
        profileToSend,
        targetProfile,
        greeting
      );
      setContactRequests(await contactRequestManager.listRequests(activeSession));
    },
    [activeSession, myProfile]
  );

  const acceptContactRequest = useCallback(
    async (requestId: string) => {
      if (!activeSession) throw new Error('No active Space');
      let profileToSend = myProfile;
      if (!profileToSend) {
        const identity = idMgr.loadIdentity(activeSession, store);
        if (!identity) throw new Error('Identity not loaded');
        const binding = await netManager.getOrCreateMailbox(activeSession);
        const prekeyBundle = prekeyManager.createPrekeyBundle(activeSession);
        profileToSend = createSignedProfile(
          identity.document.identityId,
          identity.signingPrivateKey,
          `user_${identity.document.identityId.slice(0, 8)}`,
          activeSession.name,
          binding.mailboxId,
          prekeyBundle
        );
      }

      const req = await contactRequestManager.acceptRequest(activeSession, requestId, profileToSend);
      const updatedReqs = await contactRequestManager.listRequests(activeSession);
      setContactRequests(updatedReqs);
      const updatedContacts = await contactManager.listContacts(activeSession);
      setContacts(updatedContacts);

      // Create conversation entry immediately
      const targetContact = updatedContacts.find((c) => c.identityId === req.peerIdentityId);
      if (targetContact) {
        setConversations((prev) => {
          if (prev.some((c) => c.id === targetContact.identityId)) return prev;
          const newConv: UIConversation = {
            id: targetContact.identityId,
            type: 'direct',
            name: targetContact.name,
            avatarSeed: targetContact.identityId,
            fingerprint: targetContact.fingerprint,
            isVerified: targetContact.verificationStatus === 'VERIFIED',
            unreadCount: 0,
            peerDoc: targetContact.prekeyBundle?.identityDocument,
          };
          const updated = [newConv, ...prev];
          store.setAsync(activeSession, 'veil:ui:conversations', updated);
          return updated;
        });
      }
    },
    [activeSession, myProfile]
  );

  const declineContactRequest = useCallback(
    async (requestId: string) => {
      if (!activeSession) return;
      await contactRequestManager.declineRequest(activeSession, requestId);
      setContactRequests(await contactRequestManager.listRequests(activeSession));
    },
    [activeSession]
  );

  const cancelContactRequest = useCallback(
    async (requestId: string) => {
      if (!activeSession || !myProfile) return;
      await contactRequestManager.cancelRequest(activeSession, requestId, myProfile);
      setContactRequests(await contactRequestManager.listRequests(activeSession));
    },
    [activeSession, myProfile]
  );

  const blockUser = useCallback(
    async (identityId: string) => {
      if (!activeSession) return;
      await contactRequestManager.blockUser(activeSession, identityId);
      setContactRequests(await contactRequestManager.listRequests(activeSession));
      setContacts(await contactManager.listContacts(activeSession));
    },
    [activeSession]
  );

  const unblockUser = useCallback(
    async (identityId: string) => {
      if (!activeSession) return;
      await contactRequestManager.unblockUser(activeSession, identityId);
      setContactRequests(await contactRequestManager.listRequests(activeSession));
      setContacts(await contactManager.listContacts(activeSession));
    },
    [activeSession]
  );

  const removeContact = useCallback(
    async (identityId: string) => {
      if (!activeSession) return;
      await contactManager.deleteContact(activeSession, identityId);
      setContacts(await contactManager.listContacts(activeSession));
    },
    [activeSession]
  );

  const value: AppContextType = {
    storageReady,
    storageError,
    activeSession,
    conversations,
    contacts,
    contactRequests,
    myProfile,
    privacySettings,
    updatePrivacySettings,
    activeChatId,
    messages,
    activeModal,
    networkState,
    knownSpacesCount,
    searchResults,
    searchQuery,
    config: appConfig,
    replyTarget,
    unlockSpace,
    createSpace,
    restoreAccount,
    registerCloudAccount,
    lockSpace,
    panicLock,
    selectConversation,
    setReplyTarget,
    sendMessage,
    sendAttachment,
    sendVoiceMessage,
    setSearchQuery,
    deleteMessageLocally,
    deleteMessagesLocally,
    retryFailedMessage,
    markConversationAsRead,
    openModal,
    closeModal,
    addDirectContact,
    addContactFromInvitation,
    exportMyInvitation,
    updateContactVerification,
    createGroup,
    ensureCloudSession,
    registerUsername,
    searchDirectory,
    sendContactRequest,
    acceptContactRequest,
    declineContactRequest,
    cancelContactRequest,
    blockUser,
    unblockUser,
    removeContact,
    sessionController,
    idMgr,
    store,
    notificationDispatcher,
    contactRequestManager,
    directoryClient,
    cloudClient,
    accountManager,
    syncEngine,
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
