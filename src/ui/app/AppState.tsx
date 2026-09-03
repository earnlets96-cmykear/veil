/**
 * Top-Level AppState & React Context Provider for VEIL Phase 15.
 *
 * Integrates ContactManager, InvitationManager, AttachmentPipeline,
 * NotificationDispatcher, LocalSearchEngine, and AppConfig.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { SpaceVaultManager } from '../../spaces/vault.ts';
import { EncryptedSpaceStore } from '../../storage/spaceStore.ts';
import { IndexedDBStorageAdapter } from '../../storage/indexedDbAdapter.ts';
import { SpaceIdentityManager } from '../../identity/manager.ts';
import { NetworkManager } from '../../network/networkManager.ts';
import { SessionController } from './sessionController.ts';
import { UIConversation, UIMessage, ActiveModal, UserPrivacySettings, ReplyReference } from './types.ts';

export function resolveReplyReference(
  target: UIMessage | null,
  selfName?: string,
  peerName?: string
): ReplyReference | undefined {
  if (!target) return undefined;

  let attachmentType: 'image' | 'video' | 'file' | 'voice' | 'grouped' | undefined;
  let text = target.text || '';

  if (target.voice) {
    attachmentType = 'voice';
    if (!text || text === 'Voice Message') text = 'Voice note';
  } else if (target.attachments && target.attachments.length > 1) {
    attachmentType = 'grouped';
    if (!text || text.startsWith('Attachment:') || text.includes('Media Files')) {
      text = `${target.attachments.length} Media Files`;
    }
  } else if (target.attachment || (target.attachments && target.attachments.length === 1)) {
    const att = target.attachment || target.attachments![0];
    const mime = att.mimeType || '';
    if (mime.startsWith('image/')) {
      attachmentType = 'image';
      if (!text || text.startsWith('Attachment:')) text = 'Photo';
    } else if (mime.startsWith('video/')) {
      attachmentType = 'video';
      if (!text || text.startsWith('Attachment:')) text = 'Video';
    } else {
      attachmentType = 'file';
      if (!text || text.startsWith('Attachment:')) text = att.name || 'File';
    }
  }

  const isSelf = Boolean(target.isOutgoing);
  const senderName = isSelf
    ? (selfName || target.senderName || 'You')
    : (peerName || target.senderName || 'Contact');

  return {
    messageId: target.id,
    senderName,
    text,
    attachmentType,
    isSelfReply: isSelf,
  };
}
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
import { MediaCache } from '../utils/mediaCache.ts';
import { MediaLogger } from '../utils/mediaLogger.ts';
import {
  LocalAttachmentPayload,
  WireAttachmentPayload,
  toWireAttachment,
  toWireAttachments,
} from '../../attachments/types.ts';
import { readReceiptManager } from '../../messaging/readReceipts.ts';
import { inferMediaMime } from '../../attachments/mimeUtils.ts';
import { presenceManager } from '../../presence/presenceManager.ts';
import { RuntimeDiagnostics } from '../../debug/runtimeDiagnostics.ts';
import { DeletedMessageTombstone } from '../../storage/types.ts';

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
const directoryClient = new DirectoryClient(appConfig.relayHttpUrl || 'http://127.0.0.1:8787', appConfig.requestTimeoutMs || 30000);
const contactRequestManager = new ContactRequestManager(store, contactManager, idMgr, netManager);
const cloudClient = new CloudClient({
  baseUrl: appConfig.relayHttpUrl || 'http://127.0.0.1:8787',
  requestTimeoutMs: appConfig.requestTimeoutMs || 30000,
});
const accountManager = new AccountManager(cloudClient, vault, idMgr, store, storageAdapter);
const syncEngine = new SyncEngine(store, cloudClient);

export function normalizeUsername(u: string): string {
  return (u || '').trim().toLowerCase().replace(/^@/, '');
}

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
  activeModal: ActiveModal | null;
  networkState: NetworkState;
  knownSpacesCount: number;
  searchResults: SearchResult[];
  searchQuery: string;
  config: AppConfig;
  replyTarget: UIMessage | null;
  recoveryPasswordChangeRequired: boolean;

  privacySettings: UserPrivacySettings;
  updatePrivacySettings: (settings: Partial<UserPrivacySettings>) => Promise<void>;

  muteSettings: Record<string, boolean>;
  isConversationMuted: (conversationId: string) => boolean;
  toggleMuteConversation: (conversationId: string) => Promise<boolean>;

  // Actions
  unlockSpace: (passphrase: string, username?: string) => Promise<void>;
  createSpace: (name: string, passphrase: string, explicitUsername?: string) => Promise<void>;
  changeAccountPassword: (oldPassword: string, newPassword: string) => Promise<void>;
  restoreAccount: (username: string, password: string) => Promise<void>;
  registerCloudAccount: (username: string, password: string, spaceName?: string) => Promise<void>;
  lockSpace: () => void;
  panicLock: () => void;
  selectConversation: (id: string | null) => void;
  setReplyTarget: (msg: UIMessage | null) => void;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  sendAttachment: (conversationId: string, file: File, options?: { allowSave?: boolean; allowForward?: boolean }) => Promise<void>;
  sendAttachments: (conversationId: string, files: File[], options?: { allowSave?: boolean; allowForward?: boolean }) => Promise<void>;
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
  ensureCloudSession: (session: SpaceSession, forceReauth?: boolean, customPassword?: string) => Promise<boolean | void>;
  updateContactMediaPermissions: (identityId: string, permissions: { allowSave?: boolean; allowForward?: boolean }) => Promise<void>;

  // Phase 23 & Phase 32 Actions
  registerUsername: (username: string, displayName?: string, bio?: string, avatar?: string) => Promise<SignedProfileDocument>;
  deleteAvatar: () => Promise<void>;
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
  const [recoveryPasswordChangeRequired, setRecoveryPasswordChangeRequired] = useState(false);
  const [muteSettings, setMuteSettings] = useState<Record<string, boolean>>({});
  const cloudCredentials = useRef(new Map<string, string>());
  const activeCredentialsRef = useRef(new Map<string, { passphrase?: string; username?: string }>());
  const searchIndexTimeoutRef = useRef<any>(null);

  const queueSearchIndexUpdate = useCallback(
    (c: Contact[], convs: UIConversation[], msgs: Record<string, UIMessage[]>) => {
      if (searchIndexTimeoutRef.current) {
        clearTimeout(searchIndexTimeoutRef.current);
      }
      searchIndexTimeoutRef.current = setTimeout(() => {
        searchEngine.updateIndex(c, convs, msgs);
      }, 250);
    },
    [searchEngine]
  );

  const scheduleCloudSync = useCallback((session: SpaceSession, immediate = false) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const creds = activeCredentialsRef.current.get(session.spaceId);
        if (creds?.passphrase && creds?.username) {
          await accountManager.createOrUpdateRecoveryVault(session, creds.passphrase, creds.username);
        }
      } catch (err) {
        console.warn('[VEIL-SYNC] Background cloud snapshot sync error:', err);
      }
    }, immediate ? 100 : 15000); // 15s idle debounce during active messaging to prevent Argon2 CPU spikes
  }, []);

  const isConversationMuted = useCallback(
    (conversationId: string): boolean => {
      return !!muteSettings[conversationId];
    },
    [muteSettings]
  );

  const toggleMuteConversation = useCallback(
    async (conversationId: string): Promise<boolean> => {
      if (!activeSession) return false;
      const nextVal = !muteSettings[conversationId];
      const updated = { ...muteSettings, [conversationId]: nextVal };
      setMuteSettings(updated);
      if (nextVal) {
        notificationDispatcher.muteConversation(conversationId);
      } else {
        notificationDispatcher.unmuteConversation(conversationId);
      }
      await store.setAsync(activeSession, 'veil:contacts:mute_settings', updated);
      scheduleCloudSync(activeSession);
      return nextVal;
    },
    [activeSession, muteSettings, scheduleCloudSync]
  );

  const ensureCloudSession = useCallback(
    async (session: SpaceSession, forceReauth = false, customPassword?: string): Promise<boolean> => {
      if (!forceReauth && cloudClient.getSessionToken()) return true;

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

        if (!forceReauth && savedCloudSession && savedCloudSession.sessionToken && savedCloudSession.expiresAt > Date.now()) {
          cloudClient.setSession(
            savedCloudSession.sessionToken,
            savedCloudSession.accountId,
            savedCloudSession.deviceId
          );
          await syncCurrentSpace(savedCloudSession.accountId);
          return true;
        }

        // Auto-register / authenticate cloud session deterministically for this Space
        const identity = idMgr.loadIdentity(session, store);
        const storedProfile = await store.getAsync<SignedProfileDocument>(session, 'veil:user:profile');
        const envelope = vault.getEnvelope(session.spaceId);
        const rawUsername =
          savedCloudSession?.username ||
          storedProfile?.username ||
          envelope?.canonicalUsername;

        if (!rawUsername) {
          return false;
        }
        const username = normalizeUsername(rawUsername);

        if (customPassword) {
          cloudCredentials.current.set(session.spaceId, customPassword);
          activeCredentialsRef.current.set(session.spaceId, {
            passphrase: customPassword,
            username,
          });
        }
        const authPassword = customPassword || cloudCredentials.current.get(session.spaceId);
        if (!authPassword) return false;

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

            return true;
          }
        } catch (_loginErr) {
          return false;
        }
      } catch (_e) {}
      return false;
    },
    []
  );

  useEffect(() => {
    cloudClient.setOnUnauthorized(async () => {
      if (activeSession) {
        return (await ensureCloudSession(activeSession, true)) as boolean;
      }
      return false;
    });
  }, [activeSession, ensureCloudSession]);

  const loadSpaceData = useCallback(async (session: SpaceSession) => {
    notificationDispatcher.setLocked(false);

    // 0. Ensure persistent cloud session is active
    await ensureCloudSession(session);

    // 0.1 Check post-recovery security requirements
    const recoverySec = await store.getAsync<{ recoveryPasswordChangeRequired?: boolean }>(session, 'veil:account:recovery_security');
    setRecoveryPasswordChangeRequired(!!recoverySec?.recoveryPasswordChangeRequired);

    // 1. Load contacts
    const storedContacts = await contactManager.listContacts(session);
    setContacts(storedContacts);

    // 2. Load active conversations & hydrate contact avatars
    const storedConvs = (await store.getAsync<UIConversation[]>(session, 'veil:ui:conversations')) || [];
    const hydratedConvs = storedConvs.map((conv) => {
      if (conv.type === 'direct') {
        const contact = storedContacts.find((c) => c.identityId === conv.id);
        if (contact?.avatar && conv.avatar !== contact.avatar) {
          return { ...conv, avatar: contact.avatar };
        }
      }
      return conv;
    });
    setConversations(hydratedConvs);

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

    // 4.1 Load conversation mute settings
    const storedMute = (await store.getAsync<Record<string, boolean>>(session, 'veil:contacts:mute_settings')) || {};
    setMuteSettings(storedMute);
    const mutedList = Object.keys(storedMute).filter((id) => storedMute[id]);
    notificationDispatcher.setMutedConversations(mutedList);

    // 5. Load message history
    const storedMsgs = (await store.getAsync<Record<string, UIMessage[]>>(session, 'veil:ui:messages')) || {};
    setMessages(storedMsgs);

    // 6. Update Search Engine Index
    searchEngine.updateIndex(storedContacts, storedConvs, storedMsgs);

    // 6.1 Reconcile with cloud sync engine
    try {
      if (cloudClient.getSessionToken()) {
        await syncEngine.sync(session);
        const postSyncConvs = await store.getAsync<UIConversation[]>(session, 'veil:ui:conversations');
        if (postSyncConvs) setConversations(postSyncConvs);
        const postSyncMsgs = await store.getAsync<Record<string, UIMessage[]>>(session, 'veil:ui:messages');
        if (postSyncMsgs) setMessages(postSyncMsgs);
      }
    } catch (_syncErr) {}

    // 7. Ensure Mailbox, Prekey pool, and Directory registration are initialized
    try {
      const binding = await netManager.getOrCreateMailbox(session);
      if (!prekeyManager.getSignedPrekeyPublic(session)) {
        prekeyManager.generateSignedPrekey(session);
      }
      prekeyManager.generateOneTimePrekeys(session, 10);

      // Auto-register public profile in Directory so Space is immediately routeable
      const identity = idMgr.loadIdentity(session, store);
      const cloudSession = await store.getAsync<any>(session, 'veil:cloud:session');
      const envelope = vault.getEnvelope(session.spaceId);
      const rawUsername =
        storedProfile?.username ||
        cloudSession?.username ||
        envelope?.canonicalUsername;

      if (identity && rawUsername && binding) {
        const username = normalizeUsername(rawUsername);
        const avatarTombstone = await store.getAsync<{ deletedAt: number }>(session, 'veil:avatar:tombstone');
        const isAvatarDeleted = avatarTombstone && avatarTombstone.deletedAt >= (storedProfile?.issuedAt || 0);

        let resolvedAvatar = isAvatarDeleted ? undefined : (storedProfile?.avatar || storedPrivacy?.avatar || undefined);
        if (!resolvedAvatar && !isAvatarDeleted) {
          try {
            const dirProfile = await directoryClient.getProfileByUsername(username);
            if (dirProfile?.avatar) {
              resolvedAvatar = dirProfile.avatar;
            }
          } catch (_dpErr) {}
        }

        const prekeyBundle = prekeyManager.createPrekeyBundle(session);
        const autoProfile = createSignedProfile(
          identity.document.identityId,
          identity.signingPrivateKey,
          username,
          storedProfile?.displayName || username,
          binding.mailboxId,
          prekeyBundle,
          resolvedAvatar
        );
        try {
          await directoryClient.registerProfile(autoProfile);
        } catch (_dErr) {}
        await store.setAsync(session, 'veil:user:profile', autoProfile);
        setMyProfile(autoProfile);
        if (resolvedAvatar && storedPrivacy.avatar !== resolvedAvatar) {
          storedPrivacy.avatar = resolvedAvatar;
          await store.setAsync(session, 'veil:user:privacy_settings', storedPrivacy);
          setPrivacySettings(storedPrivacy);
        } else if (isAvatarDeleted && storedPrivacy.avatar) {
          storedPrivacy.avatar = undefined;
          await store.setAsync(session, 'veil:user:privacy_settings', storedPrivacy);
          setPrivacySettings(storedPrivacy);
        }
      }
    } catch (_e) {}

    // 8. Connect NetworkManager for real-time WebSocket delivery & sync
    try {
      // Wire outbound queue flush listener for monotonic status updates
      netManager.onOutboundFlushed = ({ messageId, conversationId }) => {
        if (!messageId) return;
        setMessages((prev) => {
          let didMutate = false;
          const updated = { ...prev };
          for (const [cId, list] of Object.entries(updated)) {
            if (conversationId && cId !== conversationId) continue;
            const idx = list.findIndex((m) => m.id === messageId);
            if (idx !== -1) {
              const currentStatus = list[idx].status;
              if (currentStatus === 'QUEUED' || currentStatus === 'SENDING' || currentStatus === 'FAILED') {
                const newList = [...list];
                newList[idx] = { ...newList[idx], status: 'SENT_TO_RELAY' };
                updated[cId] = newList;
                didMutate = true;
              }
            }
          }
          if (didMutate) {
            store.setAsync(session, 'veil:ui:messages', updated);
            scheduleCloudSync(session);
            return updated;
          }
          return prev;
        });
      };

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
                  if (prev.some((c) => c.id === targetContact.identityId)) {
                    return prev.map((c) =>
                      c.id === targetContact.identityId
                        ? { ...c, name: targetContact.name, avatar: targetContact.avatar || c.avatar, fingerprint: targetContact.fingerprint }
                        : c
                    );
                  }
                  const newConv: UIConversation = {
                    id: targetContact.identityId,
                    type: 'direct',
                    name: targetContact.name,
                    avatarSeed: targetContact.identityId,
                    avatar: targetContact.avatar,
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
          const { storedMessage, senderDoc, senderMailboxId, attachment, attachments, replyTo, voice, receipt } = result;

          // Phase 55 P0-2: Check blocking immediately
          const isSenderBlocked = await contactRequestManager.isBlocked(session, senderDoc.identityId);
          const currentContacts = await contactManager.listContacts(session);
          let matchingContact = currentContacts.find(
            (c) => c.identityId === storedMessage.conversationId || c.identityId === senderDoc.identityId
          );

          if (isSenderBlocked || matchingContact?.status === 'BLOCKED') {
            RuntimeDiagnostics.receive('blockedMessageDropped', {
              senderId: senderDoc.identityId,
              conversationId: storedMessage.conversationId,
              messageId: storedMessage.messageId,
            });
            return;
          }

          if (receipt) {
            setMessages((prev) => {
              const { updatedMessages, didChange } = readReceiptManager.processInboundReceipt(
                receipt,
                prev,
                senderDoc.identityId
              );
              if (didChange) {
                store.setAsync(session, 'veil:ui:messages', updatedMessages);
                scheduleCloudSync(session);
              }
              return didChange ? updatedMessages : prev;
            });
            return;
          }

          const incomingAttachments = attachments || (attachment ? [attachment] : undefined);
          const incomingMsg: UIMessage = {
            id: storedMessage.messageId,
            conversationId: storedMessage.conversationId,
            senderId: storedMessage.senderIdentityId,
            text: storedMessage.text,
            isOutgoing: false,
            timestamp: storedMessage.timestamp,
            status: 'DELIVERED_TO_RECIPIENT',
            attachment: incomingAttachments ? incomingAttachments[0] : attachment,
            attachments: incomingAttachments,
            replyTo,
            voice,
          };

          RuntimeDiagnostics.receive('wireMessageReceived', {
            messageId: incomingMsg.id,
            conversationId: incomingMsg.conversationId,
            senderId: incomingMsg.senderId,
            attachmentCount: incomingAttachments?.length || (attachment ? 1 : 0),
            attachmentIds: incomingAttachments?.map((a: any) => a.attachmentId) || (attachment ? [attachment.attachmentId] : []),
            objectIds: incomingAttachments?.map((a: any) => a.objectId) || (attachment ? [attachment.objectId] : []),
          });

          if (!matchingContact) {
            matchingContact = currentContacts.find(
              (c) => c.identityId === incomingMsg.conversationId || c.identityId === senderDoc.identityId
            );
          }

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

          // An acknowledgement is sent only after the encrypted conversation
          // history has accepted the message. It uses the existing ratchet,
          // so a relay or another contact cannot forge delivery state.
          if (senderMailboxId) {
            try {
              const receiptWire = await convManager.encryptAndPackReceipt(session, senderDoc, {
                type: 'DELIVERY_RECEIPT',
                conversationId: senderDoc.identityId,
                messageId: incomingMsg.id,
                receivedAt: Date.now(),
              });
              await netManager.sendEnvelope(session, senderMailboxId, receiptWire);
            } catch (_receiptError) {}
          }

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
                      avatar: matchingContact?.avatar || c.avatar,
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
                avatar: matchingContact?.avatar,
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

          // Dispatch notification (honors muted conversations)
          notificationDispatcher.dispatch({
            id: incomingMsg.id,
            conversationId: incomingMsg.conversationId,
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
              const isBlocked = (await contactRequestManager.isBlocked(session, parsed.senderId)) ||
                (await contactRequestManager.isBlocked(session, parsed.conversationId));
              if (isBlocked) return;

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
                conversationId: incomingMsg.conversationId,
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
  }, [ensureCloudSession]);

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
          await netManager.reconnect(activeSession);
          await loadSpaceData(activeSession);
          const pending = await store.getAsync<SignedProfileDocument>(activeSession, 'veil:pending:profile_sync');
          if (pending) {
            try {
              await directoryClient.registerProfile(pending);
              await store.deleteAsync(activeSession, 'veil:pending:profile_sync');
            } catch (_e) {}
          }
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
      MediaCache.clear();
      notificationDispatcher.setLocked(true);
    });
    return unsub;
  }, []);

  // Periodic mailbox background sync while Space is unlocked + immediate on focus/resume
  useEffect(() => {
    if (!activeSession || !activeSession.isActive()) return;

    const performSync = async () => {
      try {
        if (activeSession && activeSession.isActive()) {
          await netManager.syncMailbox(activeSession);
          const pending = await store.getAsync<SignedProfileDocument>(activeSession, 'veil:pending:profile_sync');
          if (pending) {
            try {
              await directoryClient.registerProfile(pending);
              await store.deleteAsync(activeSession, 'veil:pending:profile_sync');
            } catch (_e) {}
          }
        }
      } catch (_e) {}
    };

    const interval = setInterval(performSync, 3000);

    const handleResume = () => {
      performSync();
      netManager.reconnect(activeSession);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleResume);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleResume();
        }
      });
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleResume);
      }
    };
  }, [activeSession]);

  const unlockSpace = useCallback(
    async (passphrase: string, username?: string) => {
      const cleanUsername = username ? normalizeUsername(username) : undefined;
      let session: SpaceSession | null = null;

      try {
        session = await sessionController.unlock(passphrase, cleanUsername);
      } catch (localErr) {
        // If username is provided, attempt cloud authentication / restoration fallback
        if (cleanUsername) {
          try {
            const restored = await accountManager.restoreAccount({
              username: cleanUsername,
              password: passphrase,
              allowFreshSpaceCreation: true,
            });
            session = restored.session;
          } catch (cloudErr: any) {
            throw new Error(cloudErr?.message || 'Invalid username or password');
          }
        } else {
          throw localErr;
        }
      }

      if (!session) {
        throw new Error('Invalid username or password');
      }

      setActiveSession(session);
      sessionController.recordUserActivity();
      setKnownSpacesCount(vault.listEnvelopes().length);
      await loadSpaceData(session);
      await ensureCloudSession(session, false, passphrase);

      const profile = await store.getAsync<SignedProfileDocument>(session, 'veil:user:profile');
      const cloudSess = await store.getAsync<any>(session, 'veil:cloud:session');
      const canonicalU = normalizeUsername(cleanUsername || profile?.username || cloudSess?.username || '');
      if (canonicalU) {
        activeCredentialsRef.current.set(session.spaceId, {
          passphrase,
          username: canonicalU,
        });
        cloudCredentials.current.set(session.spaceId, passphrase);
      }
      if (canonicalU && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('veil:last_username', canonicalU);
        } catch (_e) {}
      }
    },
    [ensureCloudSession, loadSpaceData]
  );

  const createSpace = useCallback(
    async (name: string, passphrase: string, explicitUsername?: string) => {
      // If no active session, register a distinct account
      if (!activeSession) {
        if (!explicitUsername || !explicitUsername.trim()) {
          throw new Error('An account username is required to create an account');
        }
        const cleanUsername = normalizeUsername(explicitUsername);
        const { session } = await accountManager.registerAccount({
          username: cleanUsername,
          password: passphrase,
          spaceName: name,
        });
        setKnownSpacesCount(vault.listEnvelopes().length);
        setActiveSession(session);
        sessionController.recordUserActivity();
        activeCredentialsRef.current.set(session.spaceId, {
          passphrase,
          username: cleanUsername,
        });
        cloudCredentials.current.set(session.spaceId, passphrase);

        try {
          const loadedId = idMgr.loadIdentity(session, store);
          if (loadedId) {
            const signedProfile = createSignedProfile(
              loadedId.document.identityId,
              loadedId.signingPrivateKey,
              cleanUsername,
              cleanUsername
            );
            await store.setAsync(session, 'veil:user:profile', signedProfile);
            setMyProfile(signedProfile);
          }
        } catch (_pErr) {}

        await store.setAsync(session, 'veil:cloud:session', {
          sessionToken: cloudClient.getSessionToken() || '',
          accountId: cloudClient.getAccountId() || '',
          deviceId: cloudClient.getDeviceId() || '',
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          username: cleanUsername,
        });

        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('veil:last_username', cleanUsername);
          } catch (_e) {}
        }

        await loadSpaceData(session);
        await ensureCloudSession(session, false, passphrase);
        return;
      }

      // If session is already active, create additional space on the current account
      const activeCloud = await store.getAsync<any>(activeSession, 'veil:cloud:session');
      const activeProfile = await store.getAsync<SignedProfileDocument>(activeSession, 'veil:user:profile');
      const activeEnvelope = vault.getEnvelope(activeSession.spaceId);
      const activeUsername = normalizeUsername(
        activeProfile?.username || activeCloud?.username || activeEnvelope?.canonicalUsername || ''
      );
      if (!activeUsername) {
        throw new Error('Cannot create secondary Space: active account username not found');
      }
      const activeAccountId = activeCloud?.accountId || activeEnvelope?.accountId || '';

      await sessionController.createSpace(name, passphrase, false, activeUsername, activeAccountId);
      setKnownSpacesCount(vault.listEnvelopes().length);
      const session = await sessionController.unlock(passphrase, activeUsername);
      setActiveSession(session);

      try {
        const loadedId = idMgr.loadIdentity(session, store);
        if (loadedId) {
          const signedProfile = createSignedProfile(
            loadedId.document.identityId,
            loadedId.signingPrivateKey,
            activeUsername,
            activeProfile?.displayName || activeUsername
          );
          await store.setAsync(session, 'veil:user:profile', signedProfile);
          setMyProfile(signedProfile);
        }
      } catch (_pErr) {}

      await store.setAsync(session, 'veil:cloud:session', {
        sessionToken: cloudClient.getSessionToken() || '',
        accountId: activeAccountId,
        deviceId: cloudClient.getDeviceId() || '',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        username: activeUsername,
      });

      await loadSpaceData(session);
      await ensureCloudSession(session, false, passphrase);
      await accountManager.createOrUpdateRecoveryVault(session, passphrase, activeUsername);
    },
    [activeSession, ensureCloudSession, loadSpaceData]
  );

  const changeAccountPassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      if (!activeSession) throw new Error('No active Space session');
      const profile = await store.getAsync<SignedProfileDocument>(activeSession, 'veil:user:profile');
      const cloudSess = await store.getAsync<any>(activeSession, 'veil:cloud:session');
      const envelope = vault.getEnvelope(activeSession.spaceId);
      const username = normalizeUsername(profile?.username || cloudSess?.username || envelope?.canonicalUsername || '');
      
      if (cloudSess?.sessionToken && !cloudClient.hasAuthenticatedSession()) {
        cloudClient.setSession(cloudSess.sessionToken, cloudSess.accountId, cloudSess.deviceId);
      }

      await accountManager.changePassword({
        session: activeSession,
        oldPassword,
        newPassword,
        username,
      });
      cloudCredentials.current.set(activeSession.spaceId, newPassword);
      setRecoveryPasswordChangeRequired(false);
      await store.setAsync(activeSession, 'veil:account:recovery_security', {
        recoveryPasswordChangeRequired: false,
        updatedAt: Date.now(),
      });
    },
    [activeSession]
  );

  const lockSpace = useCallback(() => {
    sessionController.lock();
  }, []);

  const panicLock = useCallback(() => {
    sessionController.panicLock();
  }, []);

  const markConversationAsRead = useCallback(
    (conversationId: string) => {
      if (!activeSession || !conversationId) return;
      setConversations((prev) => {
        let didUpdate = false;
        const updated = prev.map((c) => {
          if ((c.id === conversationId || c.name === conversationId) && c.unreadCount > 0) {
            didUpdate = true;
            return { ...c, unreadCount: 0 };
          }
          return c;
        });
        if (didUpdate) {
          store.setAsync(activeSession, 'veil:ui:conversations', updated);
          scheduleCloudSync(activeSession);
        }
        return didUpdate ? updated : prev;
      });

      // Dispatch read receipt wire message if there are inbound messages
      try {
        const contact = contacts.find((c) => c.identityId === conversationId || c.name === conversationId);
        const candidateKeys = [
          conversationId,
          contact?.identityId,
          contact?.name,
        ].filter(Boolean) as string[];

        let convMsgs: UIMessage[] = [];
        for (const k of candidateKeys) {
          if (messages[k] && messages[k].length > 0) {
            convMsgs = messages[k];
            break;
          }
        }

        const lastInbound = [...convMsgs].reverse().find((m) => !m.isOutgoing);
        if (lastInbound) {
          const targetMailboxId = contact?.mailboxId || conversationId;
          const peerDocument =
            contact?.prekeyBundle?.identityDocument ||
            conversations.find((c) => c.id === conversationId || c.name === conversationId)?.peerDoc;
          if (peerDocument && targetMailboxId) {
            readReceiptManager.scheduleReadReceipt(
              contact?.identityId || conversationId,
              lastInbound.id,
              async (receipt) => {
                const wirePayload = await convManager.encryptAndPackReceipt(activeSession, peerDocument, receipt);
                await netManager.sendEnvelope(activeSession, targetMailboxId, wirePayload);
              }
            );
          }
        }
      } catch (_e) {}
    },
    [activeSession, messages, contacts, conversations, scheduleCloudSync]
  );

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
              avatar: contact.avatar,
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
        markConversationAsRead(id);
      }
      sessionController.recordUserActivity();
    },
    [activeSession, contacts, markConversationAsRead]
  );

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    if (!query.trim()) {
      setSearchResults([]);
    } else {
      setSearchResults(searchEngine.search(query));
    }
  }, []);

  const [replyTarget, setReplyTargetState] = useState<UIMessage | null>(null);
  const replyTargetRef = useRef<UIMessage | null>(null);

  const setReplyTarget = useCallback((target: UIMessage | null) => {
    replyTargetRef.current = target;
    setReplyTargetState(target);
  }, []);

  const sendMessage = useCallback(
    async (conversationId: string, text: string) => {
      if (!activeSession || !text.trim()) return;

      // Phase 55 P0-2: Check if recipient is blocked
      const isBlocked = (await contactRequestManager.isBlocked(activeSession, conversationId)) ||
        contacts.some((c) => c.identityId === conversationId && c.status === 'BLOCKED');
      if (isBlocked) {
        throw new Error('Cannot send message: this user is blocked. Unblock them to resume messaging.');
      }

      sessionController.recordUserActivity();
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Resolve recipient contact for mailboxId and prekeyBundle
      const freshContacts = await contactManager.listContacts(activeSession);
      let targetContact = freshContacts.find((c) => c.identityId === conversationId) || contacts.find((c) => c.identityId === conversationId);

      const activeReply = resolveReplyReference(
        replyTargetRef.current || replyTarget,
        myProfile?.displayName || myProfile?.username || activeSession.name,
        targetContact?.name
      );

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

      replyTargetRef.current = null;
      setReplyTargetState(null);

      setMessages((prev) => {
        const list = prev[conversationId] || [];
        const updated = { ...prev, [conversationId]: [...list, newMsg] };
        store.setAsync(activeSession, 'veil:ui:messages', updated);
        queueSearchIndexUpdate(contacts, conversations, updated);
        return updated;
      });

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === conversationId ? { ...c, lastMessage: text.trim(), timestamp: Date.now() } : c
        );
        store.setAsync(activeSession, 'veil:ui:conversations', updated);
        return updated;
      });

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

        await netManager.sendEnvelope(activeSession, targetMailboxId, wirePayload, undefined, {
          messageId: msgId,
          conversationId,
        });

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

        scheduleCloudSync(activeSession, false);

        if (typeof console !== 'undefined' && console.debug) {
          console.debug(`[VEIL-UI] Outbound message sent: msgId=${msgId.slice(0, 8)}, convId=${conversationId.slice(0, 8)}, state=SENT_TO_RELAY`);
        }
      } catch (sendErr: any) {
        const isOffline = networkState === 'offline';
        const failureStatus = isOffline ? ('QUEUED' as const) : ('FAILED' as const);

        const keys = new Set([
          conversationId,
          targetContact?.identityId,
          targetContact?.name,
        ].filter(Boolean) as string[]);

        setMessages((prev) => {
          const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []).map((m) =>
            m.id === msgId ? { ...m, status: failureStatus } : m
          );
          const updated = { ...prev };
          for (const k of keys) {
            updated[k] = list;
          }
          store.setAsync(activeSession, 'veil:ui:messages', updated);
          return updated;
        });

        scheduleCloudSync(activeSession, false);

        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[VEIL-UI] Outbound message send failed: msgId=${msgId.slice(0, 8)}, status=${failureStatus}, error=${sendErr?.message || sendErr}`);
        }
      }
    },
    [activeSession, contacts, conversations, replyTarget, networkState, myProfile]
  );

  const sendAttachments = useCallback(
    async (
      conversationId: string,
      files: File[],
      options?: { allowSave?: boolean; allowForward?: boolean }
    ) => {
      if (!activeSession || files.length === 0) return;

      // Phase 55 P0-2: Check if recipient is blocked
      const isBlocked = (await contactRequestManager.isBlocked(activeSession, conversationId)) ||
        contacts.some((c) => c.identityId === conversationId && c.status === 'BLOCKED');
      if (isBlocked) {
        throw new Error('Cannot send attachments: this user is blocked. Unblock them to resume messaging.');
      }

      sessionController.recordUserActivity();
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const freshContacts = await contactManager.listContacts(activeSession);
      const targetContact =
        freshContacts.find((c) => c.identityId === conversationId) ||
        contacts.find((c) => c.identityId === conversationId);

      const contactAllowSave = targetContact?.metadata?.allowSave !== 'false';
      const contactAllowForward = targetContact?.metadata?.allowForward !== 'false';

      const allowSave = options?.allowSave !== undefined ? options.allowSave : contactAllowSave;
      const allowForward = options?.allowForward !== undefined ? options.allowForward : contactAllowForward;

      const activeReply = resolveReplyReference(
        replyTargetRef.current || replyTarget,
        myProfile?.displayName || myProfile?.username || activeSession.name,
        targetContact?.name
      );

      replyTargetRef.current = null;
      setReplyTargetState(null);

      // 1. Construct local attachments with immediate RAM preview URLs (bounded concurrency initial states)
      const initialAttachments: LocalAttachmentPayload[] = files.map((file, idx) => {
        const attachmentId = `att_${bytesToHex(randomBytes(8))}`;
        const effectiveMime = inferMediaMime(file);
        let initialPreviewUrl: string | undefined;
        if (effectiveMime.startsWith('image/') || effectiveMime.startsWith('video/')) {
          try {
            initialPreviewUrl = URL.createObjectURL(file);
          } catch (_e) {}
        }
        return {
          attachmentId,
          name: file.name,
          sizeBytes: file.size,
          mimeType: effectiveMime,
          previewUrl: initialPreviewUrl,
          localPreviewUrl: initialPreviewUrl,
          state: idx < 2 ? ('UPLOADING' as const) : ('QUEUED' as const),
          allowSave,
          allowForward,
        };
      });
      const targetMailboxId = targetContact?.mailboxId || conversationId;
      const targetUsername =
        targetContact?.accountUsername ||
        (targetContact?.name && !targetContact.name.includes(' ') ? targetContact.name.replace(/^@/, '').trim() : undefined) ||
        (conversationId.startsWith('@') ? conversationId.slice(1).trim() : undefined) ||
        targetContact?.name?.trim();
      const recipientAccountId = targetContact?.metadata?.accountId;
      const recipientIdentityId = targetContact?.identityId || conversationId;
      const isGroup = conversationId.startsWith('grp_') || conversations.find((c) => c.id === conversationId)?.type === 'group';

      const keys = new Set([
        conversationId,
        targetContact?.identityId,
        targetContact?.name,
      ].filter(Boolean) as string[]);

      const firstMime = initialAttachments[0]?.mimeType || '';
      const summaryText =
        files.length === 1 && !firstMime.startsWith('image/') && !firstMime.startsWith('video/')
          ? `Attachment: ${files[0].name}`
          : '';

      const pendingMsg: UIMessage = {
        id: msgId,
        conversationId,
        senderId: activeSession.spaceId,
        text: summaryText,
        isOutgoing: true,
        timestamp: Date.now(),
        status: 'UPLOADING',
        attachment: initialAttachments[0],
        attachments: initialAttachments,
        replyTo: activeReply,
        privacy: {
          allowSave,
          allowForward,
        },
      };

      // 2. Instantly display in UI timeline (0ms lag, non-blocking composer)
      setMessages((prev) => {
        const list = prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || [];
        const updated = { ...prev };
        for (const k of keys) {
          updated[k] = [...list, pendingMsg];
        }
        store.setAsync(activeSession, 'veil:ui:messages', updated);
        return updated;
      });

      const summaryBadge =
        files.length === 1
          ? files[0].type.startsWith('image/')
            ? 'Photo'
            : files[0].type.startsWith('video/')
            ? 'Video'
            : files[0].name
          : `${files.length} Media Files`;

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === conversationId || c.id === targetContact?.identityId || c.name === targetContact?.name
            ? { ...c, lastMessage: summaryBadge, timestamp: Date.now() }
            : c
        );
        store.setAsync(activeSession, 'veil:ui:conversations', updated);
        return updated;
      });

      // 3. Perform bounded background encryption, cloud upload (MAX CONCURRENCY = 2) and wire dispatch
      (async () => {
        const activeAttachments = [...initialAttachments];
        let hasAnyError = false;

        const updateTimeline = (currentAtts: LocalAttachmentPayload[], status: any) => {
          setMessages((prev) => {
            const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []).map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    status,
                    attachment: currentAtts[0],
                    attachments: currentAtts,
                  }
                : m
            );
            const updated = { ...prev };
            for (const k of keys) {
              updated[k] = list;
            }
            store.setAsync(activeSession, 'veil:ui:messages', updated);
            return updated;
          });
        };

        // Bounded concurrency pool (max 2 parallel tasks)
        let queueIndex = 0;
        const uploadWorker = async () => {
          while (queueIndex < files.length) {
            const idx = queueIndex++;
            const file = files[idx];
            const currentAtt = activeAttachments[idx];

            currentAtt.state = 'UPLOADING';
            updateTimeline(activeAttachments, 'UPLOADING');

            try {
              MediaLogger.log({
                event: 'ENCRYPTION_STARTED',
                attachmentId: currentAtt.attachmentId,
                mimeType: currentAtt.mimeType,
                sizeBytes: currentAtt.sizeBytes,
              });

              const fileBytes = new Uint8Array(await file.arrayBuffer());

              // Pre-cache staging bytes for immediate inline rendering
              MediaCache.set(currentAtt.attachmentId, {
                id: currentAtt.attachmentId,
                blobUrl: currentAtt.previewUrl || URL.createObjectURL(file),
                data: fileBytes,
                mimeType: currentAtt.mimeType,
                name: currentAtt.name,
                sizeBytes: currentAtt.sizeBytes,
              });

              const ephemeralKey = randomBytes(32);
              const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(
                fileBytes,
                file.name,
                currentAtt.mimeType,
                ephemeralKey,
                undefined,
                currentAtt.attachmentId
              );

              const rawCiphertext = new TextEncoder().encode(JSON.stringify(chunks));
              const ciphertextHash = bytesToHex(sha256(rawCiphertext));

              MediaLogger.log({
                event: 'R2_UPLOAD_STARTED',
                attachmentId: currentAtt.attachmentId,
                sizeBytes: rawCiphertext.length,
              });

              await ensureCloudSession(activeSession);
              if (!cloudClient.getSessionToken()) {
                await ensureCloudSession(activeSession, true);
              }

              RuntimeDiagnostics.upload('uploadStarted', {
                attachmentId: currentAtt.attachmentId,
                mimeType: currentAtt.mimeType,
                sizeBytes: rawCiphertext.length,
                hasSession: !!cloudClient.getSessionToken(),
              });

              let objectId = `obj_${Date.now()}_${bytesToHex(randomBytes(6))}`;
              const uploadWithSession = async () => {
                const createParams: any = {
                  attachmentId: metadata.attachmentId,
                  spaceId: activeSession.spaceId,
                  ciphertextSize: rawCiphertext.length,
                  ciphertextHash,
                  chunkCount: metadata.chunkCount,
                  chunkSize: metadata.chunkSize,
                  conversationId,
                  encryptedMetadata: JSON.stringify({
                    name: metadata.name,
                    mimeType: metadata.mimeType,
                    sizeBytes: metadata.sizeBytes,
                    conversationId,
                    recipientUsername: isGroup ? undefined : targetUsername,
                    recipientAccountId: isGroup ? undefined : targetContact?.metadata?.accountId,
                    allowSave,
                    allowForward,
                  }),
                };

                if (!isGroup) {
                  createParams.recipientUsername = targetUsername;
                  createParams.recipientAccountId = targetContact?.metadata?.accountId;
                }

                const createRes = await cloudClient.createAttachment(createParams);
                objectId = createRes.attachment.objectId;
                await cloudClient.uploadAttachment(objectId, rawCiphertext);
              };

              const uploadTimeoutMs = Math.max(180000, Math.ceil(file.size / 50000) * 1000);
              try {
                const timeoutPromise = new Promise<never>((_, reject) =>
                  setTimeout(
                    () => reject(new Error(`Upload timeout (${Math.round(uploadTimeoutMs / 1000)}s limit exceeded)`)),
                    uploadTimeoutMs
                  )
                );
                await Promise.race([uploadWithSession(), timeoutPromise]);
              } catch (uploadErr: any) {
                const reauthed = await ensureCloudSession(activeSession, true);
                if (reauthed) {
                  const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(
                      () => reject(new Error(`Upload timeout (${Math.round(uploadTimeoutMs / 1000)}s limit exceeded)`)),
                      uploadTimeoutMs
                    )
                  );
                  await Promise.race([uploadWithSession(), timeoutPromise]);
                } else {
                  throw uploadErr;
                }
              }

              RuntimeDiagnostics.upload('uploadCompleted', {
                attachmentId: currentAtt.attachmentId,
                objectId,
                uploadedBytes: rawCiphertext.length,
              });

              MediaLogger.log({
                event: 'R2_UPLOAD_COMPLETED',
                attachmentId: currentAtt.attachmentId,
                objectId,
              });

              let localPreview = currentAtt.previewUrl;
              if (!localPreview && (metadata.mimeType.startsWith('image/') || metadata.mimeType.startsWith('video/'))) {
                localPreview = AttachmentPipeline.createEphemeralBlobUrl(fileBytes, metadata.mimeType);
              }

              activeAttachments[idx] = {
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
                previewUrl: localPreview,
                localPreviewUrl: localPreview,
                state: 'SENT' as const,
                allowSave,
                allowForward,
              };

              MediaCache.set(objectId, {
                id: objectId,
                blobUrl: localPreview || '',
                data: fileBytes,
                mimeType: metadata.mimeType,
                name: metadata.name,
                sizeBytes: fileBytes.length,
              });

              updateTimeline(activeAttachments, 'UPLOADING');
            } catch (err: any) {
              hasAnyError = true;
              activeAttachments[idx] = {
                ...currentAtt,
                state: 'FAILED' as const,
                error: err?.message || 'Upload failed',
              };
              RuntimeDiagnostics.upload('uploadFailed', {
                attachmentId: currentAtt.attachmentId,
                error: err?.message,
              });
              MediaLogger.log({
                event: 'MEDIA_ERROR',
                attachmentId: currentAtt.attachmentId,
                error: err?.message,
              });
              updateTimeline(activeAttachments, 'FAILED');
            }
          }
        };

        // Run worker pool with max concurrency = 2
        await Promise.all([uploadWorker(), uploadWorker()]);

        // If all attachments succeeded, dispatch wire message and mark SENT_TO_RELAY
        if (!hasAnyError && activeAttachments.every((a) => a.state === 'SENT' && a.objectId)) {
          try {
            const wireAttachments = toWireAttachments(activeAttachments);
            const wireSingle = activeAttachments.length === 1 ? toWireAttachment(activeAttachments[0]) : undefined;
            const wireText = summaryText;

            let wirePayload: string;
            if (targetContact?.prekeyBundle) {
              const { wirePayloadBase64 } = await convManager.encryptAndPackWireMessage(
                activeSession,
                targetContact.prekeyBundle,
                wireText,
                wireSingle,
                activeReply,
                undefined,
                activeAttachments.length > 1 ? wireAttachments : undefined
              );
              wirePayload = wirePayloadBase64;
            } else {
              wirePayload = JSON.stringify({
                id: msgId,
                conversationId,
                senderId: activeSession.spaceId,
                text: wireText,
                attachment: wireSingle,
                attachments: activeAttachments.length > 1 ? wireAttachments : undefined,
                replyTo: activeReply,
              });
            }

            await netManager.sendEnvelope(activeSession, targetMailboxId, wirePayload, undefined, {
              messageId: msgId,
              conversationId,
            });

            RuntimeDiagnostics.wire('wireDispatched', {
              msgId,
              attachmentCount: activeAttachments.length,
              attachmentIds: activeAttachments.map((a) => a.attachmentId),
              objectIds: activeAttachments.map((a) => a.objectId),
              previewUrlPresent: false,
            });

            MediaLogger.log({
              event: 'WIRE_DISPATCHED',
              attachmentId: activeAttachments[0]?.attachmentId,
            });

            updateTimeline(activeAttachments, 'SENT_TO_RELAY');
          } catch (wireErr: any) {
            RuntimeDiagnostics.wire('wireFailed', {
              msgId,
              error: wireErr?.message,
            });
            MediaLogger.log({
              event: 'MEDIA_ERROR',
              error: wireErr?.message || 'Wire dispatch failed',
            });
            updateTimeline(activeAttachments, 'FAILED');
          }
        } else {
          updateTimeline(activeAttachments, 'FAILED');
        }
      })();
    },
    [activeSession, contacts, conversations, replyTarget]
  );

  const sendAttachment = useCallback(
    async (conversationId: string, file: File, options?: { allowSave?: boolean; allowForward?: boolean }) => {
      return sendAttachments(conversationId, [file], options);
    },
    [sendAttachments]
  );

  const sendVoiceMessage = useCallback(
    async (conversationId: string, durationSeconds: number, audioBlob: Blob, mimeType: string) => {
      if (!activeSession) return;

      // Phase 55 P0-2: Check if recipient is blocked
      const isBlocked = (await contactRequestManager.isBlocked(activeSession, conversationId)) ||
        contacts.some((c) => c.identityId === conversationId && c.status === 'BLOCKED');
      if (isBlocked) {
        throw new Error('Cannot send voice note: this user is blocked. Unblock them to resume messaging.');
      }

      sessionController.recordUserActivity();

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const freshContacts = await contactManager.listContacts(activeSession);
      const targetContact = freshContacts.find((c) => c.identityId === conversationId) || contacts.find((c) => c.identityId === conversationId);

      const activeReply = resolveReplyReference(
        replyTargetRef.current || replyTarget,
        myProfile?.displayName || myProfile?.username || activeSession.name,
        targetContact?.name
      );

      replyTargetRef.current = null;
      setReplyTargetState(null);
      const targetMailboxId = targetContact?.mailboxId || conversationId;
      const targetUsername =
        targetContact?.accountUsername ||
        (targetContact?.name && !targetContact.name.includes(' ') ? targetContact.name.replace(/^@/, '').trim() : undefined) ||
        (conversationId.startsWith('@') ? conversationId.slice(1).trim() : undefined) ||
        targetContact?.name?.trim();
      const recipientAccountId = targetContact?.metadata?.accountId;
      const recipientIdentityId = targetContact?.identityId || conversationId;

      const keys = new Set([
        conversationId,
        targetContact?.identityId,
        targetContact?.name,
      ].filter(Boolean) as string[]);

      const pendingMsg: UIMessage = {
        id: msgId,
        conversationId,
        senderId: activeSession.spaceId,
        text: 'Voice Message',
        isOutgoing: true,
        timestamp: Date.now(),
        status: 'UPLOADING',
        voice: {
          durationSeconds,
          sizeBytes: audioBlob.size,
          objectId: `voice_${Date.now()}`,
          mimeType,
          ciphertextHash: '',
          encryptionKeyBase64: '',
          nonceBase64: '',
        },
        replyTo: activeReply,
      };

      setMessages((prev) => {
        const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []);
        const updated = { ...prev };
        for (const k of keys) {
          updated[k] = [...list, pendingMsg];
        }
        store.setAsync(activeSession, 'veil:ui:messages', updated);
        return updated;
      });

      // Background upload and wire dispatch
      (async () => {
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const rawBytes = new Uint8Array(arrayBuffer);

          if (!cloudClient.getSessionToken()) {
            await ensureCloudSession(activeSession);
          }

          const voiceMeta = await VoiceRecorder.encryptAndUploadVoiceNote(
            activeSession,
            cloudClient,
            rawBytes,
            durationSeconds,
            mimeType,
            {
              recipientUsername: targetUsername,
              recipientAccountId,
              allowedAccounts: recipientAccountId ? [recipientAccountId] : undefined,
            }
          );

          let wirePayload: string;
          if (targetContact?.prekeyBundle) {
            const { wirePayloadBase64 } = await convManager.encryptAndPackWireMessage(
              activeSession,
              targetContact.prekeyBundle,
              'Voice Message',
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
              text: 'Voice Message',
              voice: voiceMeta,
              replyTo: activeReply,
            });
          }

          await netManager.sendEnvelope(activeSession, targetMailboxId, wirePayload, undefined, {
            messageId: msgId,
            conversationId,
          });

          setMessages((prev) => {
            const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []).map((m) =>
              m.id === msgId ? { ...m, status: 'SENT_TO_RELAY' as const, voice: voiceMeta } : m
            );
            const updated = { ...prev };
            for (const k of keys) {
              updated[k] = list;
            }
            store.setAsync(activeSession, 'veil:ui:messages', updated);
            return updated;
          });
        } catch (voiceErr) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[VEIL-VOICE] Background voice upload failed:', voiceErr);
          }
          setMessages((prev) => {
            const list = (prev[conversationId] || (targetContact?.name ? prev[targetContact.name] : []) || []).map((m) =>
              m.id === msgId ? { ...m, status: 'FAILED' as const } : m
            );
            const updated = { ...prev };
            for (const k of keys) {
              updated[k] = list;
            }
            store.setAsync(activeSession, 'veil:ui:messages', updated);
            return updated;
          });
        }
      })();
    },
    [activeSession, contacts, replyTarget]
  );

  const deleteMessageLocally = useCallback(
    async (conversationId: string, messageId: string) => {
      if (!activeSession) return;
      sessionController.recordUserActivity();

      // Phase 55 P0-1: Record deletion tombstone in encrypted space store
      const tombstone: DeletedMessageTombstone = {
        messageId,
        conversationId,
        deletedAt: Date.now(),
      };
      const existingTombstones = (await store.getAsync<DeletedMessageTombstone[]>(activeSession, 'veil:ui:deleted_messages')) || [];
      const updatedTombstones = [...existingTombstones.filter((t) => t.messageId !== messageId), tombstone];
      await store.setAsync(activeSession, 'veil:ui:deleted_messages', updatedTombstones);

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

      scheduleCloudSync(activeSession);
    },
    [activeSession, contacts, conversations, messages, scheduleCloudSync]
  );

  const deleteMessagesLocally = useCallback(
    async (conversationId: string, messageIds: string[]) => {
      if (!activeSession || messageIds.length === 0) return;
      sessionController.recordUserActivity();
      const idSet = new Set(messageIds);

      // Phase 55 P0-1: Record deletion tombstones in encrypted space store
      const now = Date.now();
      const newTombstones: DeletedMessageTombstone[] = messageIds.map((id) => ({
        messageId: id,
        conversationId,
        deletedAt: now,
      }));
      const existingTombstones = (await store.getAsync<DeletedMessageTombstone[]>(activeSession, 'veil:ui:deleted_messages')) || [];
      const updatedTombstones = [
        ...existingTombstones.filter((t) => !idSet.has(t.messageId)),
        ...newTombstones,
      ];
      await store.setAsync(activeSession, 'veil:ui:deleted_messages', updatedTombstones);

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

      scheduleCloudSync(activeSession);
    },
    [activeSession, contacts, conversations, messages, scheduleCloudSync]
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


  const restoreAccount = useCallback(
    async (username: string, password: string) => {
      const cleanUsername = normalizeUsername(username);
      const { session } = await accountManager.restoreAccount({
        username: cleanUsername,
        password,
        isEmergencyRecovery: true,
      });
      setActiveSession(session);
      sessionController.recordUserActivity();
      setKnownSpacesCount(vault.listEnvelopes().length);
      setRecoveryPasswordChangeRequired(true);
      await store.setAsync(session, 'veil:account:recovery_security', {
        recoveryPasswordChangeRequired: true,
        restoredAt: Date.now(),
      });

      // Rehydrate user profile with recovered username and re-register directory profile
      try {
        const loadedId = idMgr.loadIdentity(session, store);
        if (loadedId) {
          const existingProfile = await store.getAsync<SignedProfileDocument>(session, 'veil:user:profile');
          const signedProfile = createSignedProfile(
            loadedId.document.identityId,
            loadedId.signingPrivateKey,
            cleanUsername,
            existingProfile?.displayName || cleanUsername
          );
          await store.setAsync(session, 'veil:user:profile', signedProfile);
          setMyProfile(signedProfile);

          const binding = await netManager.getOrCreateMailbox(session);
          const prekeyBundle = prekeyManager.createPrekeyBundle(session);
          const profileToRegister = createSignedProfile(
            loadedId.document.identityId,
            loadedId.signingPrivateKey,
            cleanUsername,
            existingProfile?.displayName || cleanUsername,
            binding.mailboxId,
            prekeyBundle,
            existingProfile?.avatar || undefined
          );
          try {
            await directoryClient.registerProfile(profileToRegister);
          } catch (_dErr) {}
        }
      } catch (_pErr) {}

      await store.setAsync(session, 'veil:cloud:session', {
        sessionToken: cloudClient.getSessionToken() || '',
        accountId: cloudClient.getAccountId() || '',
        deviceId: cloudClient.getDeviceId() || '',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        username: cleanUsername,
      });

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('veil:last_username', cleanUsername);
        } catch (_e) {}
      }

      await loadSpaceData(session);
      await ensureCloudSession(session, false, password);
    },
    [ensureCloudSession, loadSpaceData]
  );

  const updateContactMediaPermissions = useCallback(
    async (identityId: string, permissions: { allowSave?: boolean; allowForward?: boolean }) => {
      if (!activeSession) return;
      const freshContacts = await contactManager.listContacts(activeSession);
      const contact = freshContacts.find((c) => c.identityId === identityId);
      if (contact) {
        const currentMeta = contact.metadata || {};
        const updatedMeta = {
          ...currentMeta,
          ...(permissions.allowSave !== undefined ? { allowSave: permissions.allowSave ? 'true' : 'false' } : {}),
          ...(permissions.allowForward !== undefined ? { allowForward: permissions.allowForward ? 'true' : 'false' } : {}),
        };
        await contactManager.updateContact(activeSession, {
          ...contact,
          metadata: updatedMeta,
        });
        const updatedList = await contactManager.listContacts(activeSession);
        setContacts(updatedList);
      }
    },
    [activeSession]
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
            username,
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
          avatar: targetProfile.avatar,
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
          avatar: contact.avatar,
          fingerprint: contact.fingerprint,
          isVerified: false,
          unreadCount: 0,
          peerDoc: targetProfile.prekeyBundle?.identityDocument,
        };
        setConversations((prev) => {
          if (prev.some((c) => c.id === contact.identityId)) {
            return prev.map((c) =>
              c.id === contact.identityId ? { ...c, name: contact.name, avatar: contact.avatar || c.avatar, fingerprint: contact.fingerprint } : c
            );
          }
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
        avatar: contact.avatar,
        fingerprint: contact.fingerprint,
        isVerified: false,
        unreadCount: 0,
        peerDoc: invitation.prekeyBundle?.identityDocument,
      };

      setConversations((prev) => {
        if (prev.some((c) => c.id === contact.identityId)) {
          return prev.map((c) =>
            c.id === contact.identityId ? { ...c, name: contact.name, avatar: contact.avatar || c.avatar, fingerprint: contact.fingerprint } : c
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

    const envelope = vault.getEnvelope(activeSession.spaceId);
    const profile = myProfile;
    const invDisplayName = profile?.displayName || profile?.username || envelope?.canonicalUsername || activeSession.name;

    const invitation = InvitationManager.createInvitation(
      identity.document,
      identity.signingPrivateKey,
      invDisplayName,
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
      if (updated.avatar === null || updated.avatar === '') {
        updated.avatar = undefined;
        await store.setAsync(activeSession, 'veil:avatar:tombstone', { deletedAt: Date.now() });
      } else if (updated.avatar) {
        await store.deleteAsync(activeSession, 'veil:avatar:tombstone');
      }
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

      let avatarToUse: string | undefined;
      if (avatar === null || avatar === '') {
        avatarToUse = undefined;
        await store.setAsync(activeSession, 'veil:avatar:tombstone', { deletedAt: Date.now() });
      } else if (avatar !== undefined) {
        avatarToUse = avatar;
        await store.deleteAsync(activeSession, 'veil:avatar:tombstone');
      } else {
        const tombstone = await store.getAsync<{ deletedAt: number }>(activeSession, 'veil:avatar:tombstone');
        const isDeleted = tombstone && tombstone.deletedAt >= (myProfile?.issuedAt || 0);
        avatarToUse = isDeleted ? undefined : (privacySettings.avatar || myProfile?.avatar);
      }

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

      // 1. Always persist profile and privacy settings locally first (offline-first resilience)
      await store.setAsync(activeSession, 'veil:user:profile', profile);
      if (bio !== undefined || avatar !== undefined) {
        await updatePrivacySettings({ bio, avatar: avatarToUse });
      }
      setMyProfile(profile);
      scheduleCloudSync(activeSession);

      // 2. Attempt cloud directory registration
      let cloudSyncPending = false;
      try {
        await directoryClient.registerProfile(profile);
        await store.deleteAsync(activeSession, 'veil:pending:profile_sync');
      } catch (err: any) {
        const msg = err.message || '';
        if (msg.includes('CONFLICT') || msg.includes('already registered')) {
          throw new Error(`Username @${username} is already taken by another identity.`);
        }
        if (msg.includes('Invalid') || msg.includes('format')) {
          throw new Error(`Invalid username format: ${msg}`);
        }
        // Network / relay unavailable -> record pending sync for automatic retry
        cloudSyncPending = true;
        await store.setAsync(activeSession, 'veil:pending:profile_sync', profile);
      }

      // 3. Propagate username change to cloud auth and local vault so login works with the new username
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
      const currentCreds = activeCredentialsRef.current.get(activeSession.spaceId);
      const currentStoredUsername = currentCreds?.username || '';
      const isUsernameChanged = currentStoredUsername && cleanUsername !== currentStoredUsername;

      if (isUsernameChanged) {
        // 3a. Update cloud backend auth username
        try {
          await cloudClient.changeUsername(cleanUsername);
        } catch (err: any) {
          const msg = err.message || '';
          if (msg.includes('already taken') || msg.includes('409')) {
            throw new Error(`Username @${cleanUsername} is already taken`);
          }
          // Non-fatal: cloud will still accept old username for auth
          if (typeof console !== 'undefined') {
            console.warn('[VEIL] Cloud username change failed, will retry on next sync:', msg);
          }
        }

        // 3b. Update local Space envelope so local login finds the correct envelope
        try {
          const updatedEnvelope = vault.updateCanonicalUsername(activeSession.spaceId, cleanUsername);
          await vault.saveEnvelopeToStorage(updatedEnvelope, storageAdapter);
        } catch (_envErr) {
          // Non-fatal: worst case, user must use old username to login locally once
        }
      }

      // 3c. Always update credentials ref and localStorage with current username
      if (cleanUsername) {
        activeCredentialsRef.current.set(activeSession.spaceId, {
          passphrase: currentCreds?.passphrase || '',
          username: cleanUsername,
        });
        cloudCredentials.current.set(activeSession.spaceId, currentCreds?.passphrase || '');
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('veil:last_username', cleanUsername);
          } catch (_e) {}
        }
      }

      return {
        ...profile,
        cloudSyncPending,
      };
    },
    [activeSession, myProfile, privacySettings, updatePrivacySettings, scheduleCloudSync]
  );

  const deleteAvatar = useCallback(async () => {
    if (!activeSession) return;
    await store.setAsync(activeSession, 'veil:avatar:tombstone', { deletedAt: Date.now() });
    await updatePrivacySettings({ avatar: undefined });
    if (myProfile) {
      await registerUsername(myProfile.username, myProfile.displayName, privacySettings.bio, '');
    }
  }, [activeSession, myProfile, privacySettings.bio, updatePrivacySettings, registerUsername]);

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
        const cloudSession = await store.getAsync<any>(activeSession, 'veil:cloud:session');
        const envelope = vault.getEnvelope(activeSession.spaceId);
        const resolvedUsername = normalizeUsername(cloudSession?.username || envelope?.canonicalUsername || '');
        if (!resolvedUsername) {
          throw new Error('Cannot send contact request: account username is not established');
        }
        profileToSend = createSignedProfile(
          identity.document.identityId,
          identity.signingPrivateKey,
          resolvedUsername,
          resolvedUsername,
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
        const cloudSession = await store.getAsync<any>(activeSession, 'veil:cloud:session');
        const envelope = vault.getEnvelope(activeSession.spaceId);
        const resolvedUsername = normalizeUsername(cloudSession?.username || envelope?.canonicalUsername || '');
        if (!resolvedUsername) {
          throw new Error('Cannot accept contact request: account username is not established');
        }
        profileToSend = createSignedProfile(
          identity.document.identityId,
          identity.signingPrivateKey,
          resolvedUsername,
          resolvedUsername,
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
          if (prev.some((c) => c.id === targetContact.identityId)) {
            return prev.map((c) =>
              c.id === targetContact.identityId
                ? { ...c, name: targetContact.name, avatar: targetContact.avatar || c.avatar, fingerprint: targetContact.fingerprint }
                : c
            );
          }
          const newConv: UIConversation = {
            id: targetContact.identityId,
            type: 'direct',
            name: targetContact.name,
            avatarSeed: targetContact.identityId,
            avatar: targetContact.avatar,
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
    muteSettings,
    isConversationMuted,
    toggleMuteConversation,
    activeChatId,
    messages,
    activeModal,
    networkState,
    knownSpacesCount,
    searchResults,
    searchQuery,
    config: appConfig,
    replyTarget,
    recoveryPasswordChangeRequired,
    unlockSpace,
    createSpace,
    changeAccountPassword,
    restoreAccount,
    registerCloudAccount,
    lockSpace,
    panicLock,
    selectConversation,
    setReplyTarget,
    sendMessage,
    sendAttachment,
    sendAttachments,
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
    updateContactMediaPermissions,
    registerUsername,
    deleteAvatar,
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
