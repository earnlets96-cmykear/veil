/**
 * Dedicated Profile View & Central Relationship Hub for VEIL.
 *
 * Implements Telegram reference architecture:
 * 1. Header: Close button (X), Large Avatar, Display Name, Online / Last Seen status
 * 2. Primary Actions Bar: Message, Mute, Call, More
 * 3. Identity Information: Phone / Mobile, Canonical @username (with QR & copy), Bio
 * 4. Media Section: Categorized media item counts (Photos, Videos, Files, Audio, Shared Links, Voice Messages, GIFs, Groups in common)
 * 5. Contact Actions: Share Contact, Edit Contact / Safety Number, Delete Contact, Block User
 * 6. Self Profile: View & Edit Profile with avatar upload, phone privacy, and directory visibility
 * 7. Safe Error Handling: Zero unformatted [object Object] leaks.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../app/AppState.tsx';
import { processAvatarImage } from '../utils/avatarProcessor.ts';
import { getRelationshipState, RelationshipState } from '../../contacts/relationshipHelper.ts';
import { DirectorySearchResult, SignedProfileDocument } from '../../server/types.ts';
import { getErrorMessage } from '../../utils/errors.ts';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Input,
  StatusIndicator,
  Spinner,
  useToast,
} from './ui/index.ts';
import {
  CloseIcon,
  CopyIcon,
  CheckIcon,
  ShieldIcon,
  AlertCircleIcon,
  LockIcon,
  TrashIcon,
  PlusIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  FileAudioIcon,
  MicIcon,
  LinkIcon,
  MessageSquareIcon,
  BellIcon,
  BellOffIcon,
  QrCodeIcon,
  ShareIcon,
  EditIcon,
  UsersIcon,
  MoreVerticalIcon,
  CameraIcon,
} from './icons/index.ts';

interface ProfileModalProps {
  peerId?: string;
  peerUsername?: string;
  searchResult?: DirectorySearchResult;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ peerId, peerUsername, searchResult }) => {
  const {
    activeSession,
    myProfile,
    privacySettings,
    updatePrivacySettings,
    registerUsername,
    closeModal,
    conversations,
    contacts,
    contactRequests,
    messages,
    sendContactRequest,
    acceptContactRequest,
    declineContactRequest,
    cancelContactRequest,
    blockUser,
    unblockUser,
    removeContact,
    updateContactMediaPermissions,
    selectConversation,
    openModal,
    directoryClient,
    idMgr,
    store,
    isConversationMuted,
    toggleMuteConversation,
    deleteAvatar,
  } = useApp();

  const { showToast } = useToast();
  const isPeer = Boolean(peerId || peerUsername || searchResult);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const peerConv = isPeer
    ? (conversations || []).find(
        (c) =>
          c.id === peerId ||
          c.name === peerId ||
          (peerUsername && (c.name.toLowerCase() === peerUsername.toLowerCase() || c.id.toLowerCase() === peerUsername.toLowerCase()))
      )
    : null;
  const peerContact = isPeer
    ? (contacts || []).find(
        (c) =>
          c.identityId === peerId ||
          c.name === peerId ||
          (peerUsername &&
            (c.name.toLowerCase() === peerUsername.toLowerCase() ||
              c.accountUsername?.toLowerCase() === peerUsername.toLowerCase()))
      )
    : null;

  const [peerDoc, setPeerDoc] = useState<SignedProfileDocument | null>(null);
  const [loadingPeer, setLoadingPeer] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Self Profile Form State
  const [isEditing, setIsEditing] = useState(false);
  const [usernameInput, setUsernameInput] = useState(myProfile?.username || '');
  const [displayNameInput, setDisplayNameInput] = useState(myProfile?.displayName || activeSession?.name || '');
  const [bioInput, setBioInput] = useState(privacySettings.bio || '');
  const [phoneInput, setPhoneInput] = useState(privacySettings.phoneNumber || '');
  const [phoneVisibility, setPhoneVisibility] = useState<'nobody' | 'contacts' | 'everyone'>(
    privacySettings.phoneVisibility || 'contacts'
  );
  const [profileVisibility, setProfileVisibility] = useState<'nobody' | 'contacts' | 'everyone'>(
    privacySettings.profileVisibility || 'everyone'
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(privacySettings.avatar || myProfile?.avatar || null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setAvatarPreview(privacySettings.avatar || myProfile?.avatar || null);
    }
  }, [privacySettings.avatar, myProfile?.avatar, isEditing]);

  // Add Contact Form State for Non-Contacts
  const [showAddGreeting, setShowAddGreeting] = useState(false);
  const [greetingText, setGreetingText] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadedIdentity = activeSession ? idMgr.loadIdentity(activeSession, store) : null;

  const effectiveIdentityId = peerId || searchResult?.identityId || peerContact?.identityId || peerDoc?.identityId;
  const isMuted = (effectiveIdentityId && typeof isConversationMuted === 'function') ? isConversationMuted(effectiveIdentityId) : false;
  const effectiveUsername = (
    searchResult?.username ||
    peerUsername ||
    peerContact?.accountUsername ||
    (peerContact?.name && !peerContact.name.includes(' ') ? peerContact.name.replace(/^@/, '').trim() : undefined) ||
    peerConv?.name ||
    'user'
  ).toLowerCase().replace(/^@/, '');

  const effectiveDisplayName =
    searchResult?.displayName ||
    peerDoc?.displayName ||
    peerContact?.name ||
    peerConv?.name ||
    effectiveUsername ||
    'User';

  // Determine relationship state
  const relState: RelationshipState = !isPeer
    ? 'SELF'
    : getRelationshipState(effectiveIdentityId, effectiveUsername, {
        myIdentityId: myProfile?.identityId || loadedIdentity?.document.identityId,
        myUsername: myProfile?.username,
        contacts: contacts || [],
        contactRequests: contactRequests || [],
      });

  const matchingIncomingRequest = (contactRequests || []).find(
    (r) =>
      r.status === 'INCOMING_PENDING' &&
      ((effectiveIdentityId && r.peerIdentityId === effectiveIdentityId) ||
        (effectiveUsername && r.peerUsername.toLowerCase() === effectiveUsername.toLowerCase()))
  );

  const matchingOutgoingRequest = (contactRequests || []).find(
    (r) =>
      r.status === 'OUTGOING_PENDING' &&
      ((effectiveIdentityId && r.peerIdentityId === effectiveIdentityId) ||
        (effectiveUsername && r.peerUsername.toLowerCase() === effectiveUsername.toLowerCase()))
  );

  // Fetch full profile document for peer if not available
  useEffect(() => {
    if (!isPeer || peerDoc) return;
    let isMounted = true;

    async function fetchPeerProfile() {
      if (effectiveUsername) {
        setLoadingPeer(true);
        try {
          const fetched = await directoryClient.getProfileByUsername(effectiveUsername);
          if (isMounted && fetched) {
            setPeerDoc(fetched);
          }
        } catch (_err) {
          // Profile may be direct contact without directory entry
        } finally {
          if (isMounted) setLoadingPeer(false);
        }
      }
    }

    fetchPeerProfile();
    return () => {
      isMounted = false;
    };
  }, [isPeer, effectiveUsername, directoryClient]);

  const rawFingerprint = isPeer
    ? peerDoc?.prekeyBundle?.identityDocument?.fingerprint ||
      peerConv?.fingerprint ||
      peerContact?.fingerprint ||
      (effectiveIdentityId ? effectiveIdentityId.slice(0, 16).toUpperCase() : 'E2EE-IDENTITY')
    : loadedIdentity?.document.fingerprint || 'E2EE-IDENTITY';

  const isAllNumeric = /^\d{60}$/.test(rawFingerprint.replace(/\s+/g, ''));
  const formattedFingerprint = isAllNumeric
    ? rawFingerprint.replace(/\s+/g, '').replace(/(.{5})/g, '$1 ').trim()
    : rawFingerprint.replace(/(.{4})/g, '$1 ').trim();

  // Compute Categorized Media Counts for this Peer Conversation
  const convKey = peerConv?.id || effectiveIdentityId || '';
  const peerMessages = (messages && (messages[convKey] || (peerConv?.id && messages[peerConv.id]) || (effectiveIdentityId && messages[effectiveIdentityId]))) || [];

  const photosCount = peerMessages.filter(
    (m) =>
      (m.attachment && m.attachment.mimeType?.startsWith('image/') && m.attachment.mimeType !== 'image/gif') ||
      (m.attachments && m.attachments.some((a) => a.mimeType?.startsWith('image/') && a.mimeType !== 'image/gif'))
  ).length;

  const videosCount = peerMessages.filter(
    (m) =>
      (m.attachment && m.attachment.mimeType?.startsWith('video/')) ||
      (m.attachments && m.attachments.some((a) => a.mimeType?.startsWith('video/')))
  ).length;

  const filesCount = peerMessages.filter(
    (m) =>
      (m.attachment &&
        !m.attachment.mimeType?.startsWith('image/') &&
        !m.attachment.mimeType?.startsWith('video/') &&
        !m.attachment.mimeType?.startsWith('audio/')) ||
      (m.attachments &&
        m.attachments.some(
          (a) =>
            !a.mimeType?.startsWith('image/') &&
            !a.mimeType?.startsWith('video/') &&
            !a.mimeType?.startsWith('audio/')
        ))
  ).length;

  const audioCount = peerMessages.filter(
    (m) =>
      (m.attachment && m.attachment.mimeType?.startsWith('audio/') && !m.voice) ||
      (m.attachments && m.attachments.some((a) => a.mimeType?.startsWith('audio/') && !m.voice))
  ).length;

  const voiceCount = peerMessages.filter(
    (m) => m.voice !== undefined || (m.attachment && m.attachment.mimeType?.startsWith('audio/') && m.voice)
  ).length;

  const linksCount = peerMessages.filter((m) => m.text && /https?:\/\/[^\s]+/i.test(m.text)).length;

  const gifsCount = peerMessages.filter(
    (m) =>
      (m.attachment && m.attachment.mimeType === 'image/gif') ||
      (m.attachments && m.attachments.some((a) => a.mimeType === 'image/gif'))
  ).length;

  const commonGroupsCount = (conversations || []).filter(
    (c) => c.type === 'group' && Boolean(c.groupState?.members && effectiveIdentityId && c.groupState.members[effectiveIdentityId])
  ).length;

  // Avatar Selection for Self Profile
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processAvatarImage(file);
      setAvatarPreview(processed);
      if (!isEditing && myProfile) {
        setIsSaving(true);
        await registerUsername(myProfile.username, myProfile.displayName, privacySettings.bio, processed);
        await updatePrivacySettings({ avatar: processed });
        showToast({ type: 'success', message: 'Profile photo updated!' });
      }
    } catch (err: any) {
      showToast({ type: 'error', message: getErrorMessage(err, 'Failed to process avatar image') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setAvatarPreview(null);
      if (!isEditing && myProfile) {
        setIsSaving(true);
        await deleteAvatar();
        showToast({ type: 'info', message: 'Profile photo removed' });
      }
    } catch (err: any) {
      showToast({ type: 'error', message: getErrorMessage(err, 'Failed to remove avatar') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    const cleanUsername = usernameInput.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setErrorMessage('Username cannot be empty.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const avatarToPass = avatarPreview !== null ? (avatarPreview || undefined) : '';
      await registerUsername(
        cleanUsername,
        displayNameInput.trim() || undefined,
        bioInput.trim() || undefined,
        avatarToPass
      );

      await updatePrivacySettings({
        bio: bioInput.trim() || undefined,
        phoneNumber: phoneInput.trim() || undefined,
        phoneVisibility,
        profileVisibility,
        avatar: avatarToPass,
      });

      setIsEditing(false);
      showToast({ type: 'success', message: 'Profile updated successfully!' });
    } catch (err: any) {
      setErrorMessage(getErrorMessage(err, 'Failed to update profile'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyUsername = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`@${effectiveUsername}`);
      setCopiedUsername(true);
      showToast({ type: 'success', message: `@${effectiveUsername} copied to clipboard` });
      setTimeout(() => setCopiedUsername(false), 2500);
    }
  };

  const handleCopyFingerprint = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(rawFingerprint);
      setCopiedFingerprint(true);
      showToast({ type: 'success', message: 'Safety Number copied to clipboard' });
      setTimeout(() => setCopiedFingerprint(false), 3000);
    }
  };

  const handleOpenChat = () => {
    closeModal();
    if (effectiveIdentityId) {
      selectConversation(effectiveIdentityId);
    }
  };

  const handleToggleMute = async () => {
    if (!effectiveIdentityId) return;
    if (typeof toggleMuteConversation === 'function') {
      const nowMuted = await toggleMuteConversation(effectiveIdentityId);
      showToast({
        type: 'info',
        message: nowMuted ? `Muted notifications from ${effectiveDisplayName}` : `Unmuted notifications from ${effectiveDisplayName}`,
      });
    }
  };

  const handleOpenSafetyNumberModal = () => {
    if (effectiveIdentityId) {
      closeModal();
      openModal({ type: 'contactDetails', conversationId: effectiveIdentityId });
    }
  };

  const handleShareContact = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`veil://user/${effectiveUsername}`);
      showToast({ type: 'success', message: `Share link for @${effectiveUsername} copied to clipboard` });
    }
  };

  const handleSendContactReq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUsername) return;
    setIsSendingRequest(true);
    try {
      await sendContactRequest(effectiveUsername, greetingText.trim() || undefined);
      showToast({ type: 'success', message: `Contact request sent to @${effectiveUsername}` });
      setShowAddGreeting(false);
      closeModal();
    } catch (err: any) {
      showToast({ type: 'error', message: getErrorMessage(err, 'Failed to send contact request') });
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptIncoming = async () => {
    if (!matchingIncomingRequest) return;
    try {
      await acceptContactRequest(matchingIncomingRequest.requestId);
      showToast({ type: 'success', message: `Connected with @${effectiveUsername}` });
      closeModal();
    } catch (err: any) {
      showToast({ type: 'error', message: getErrorMessage(err, 'Failed to accept contact request') });
    }
  };

  const handleDeclineIncoming = async () => {
    if (!matchingIncomingRequest) return;
    try {
      await declineContactRequest(matchingIncomingRequest.requestId);
      showToast({ type: 'info', message: 'Contact request declined' });
      closeModal();
    } catch (err: any) {
      showToast({ type: 'error', message: getErrorMessage(err, 'Failed to decline request') });
    }
  };

  const handleCancelRequest = async () => {
    if (!matchingOutgoingRequest) return;
    setIsCancelling(true);
    try {
      await cancelContactRequest(matchingOutgoingRequest.requestId);
      showToast({ type: 'info', message: 'Contact request cancelled' });
      closeModal();
    } catch (err: any) {
      showToast({ type: 'error', message: getErrorMessage(err, 'Failed to cancel request') });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRemoveContact = async () => {
    if (!effectiveIdentityId) return;
    try {
      await removeContact(effectiveIdentityId);
      showToast({ type: 'info', message: `Removed @${effectiveUsername} from contacts` });
      closeModal();
    } catch (err: any) {
      showToast({ type: 'error', message: getErrorMessage(err, 'Failed to remove contact') });
    }
  };

  const handleBlock = async () => {
    if (!effectiveIdentityId) return;
    try {
      await blockUser(effectiveIdentityId);
      showToast({ type: 'info', message: `Blocked @${effectiveUsername}` });
      closeModal();
    } catch (err: any) {
      showToast({ type: 'error', message: getErrorMessage(err, 'Failed to block user') });
    }
  };

  const handleUnblock = async () => {
    if (!effectiveIdentityId) return;
    try {
      await unblockUser(effectiveIdentityId);
      showToast({ type: 'success', message: `Unblocked @${effectiveUsername}` });
      closeModal();
    } catch (err: any) {
      showToast({ type: 'error', message: getErrorMessage(err, 'Failed to unblock user') });
    }
  };

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      <div className="veil-modal-card" style={{ maxWidth: '440px', padding: 0, overflow: 'hidden' }}>
        {/* 1. Header Section with Avatar, Display Name, Status & Close Button */}
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(180deg, var(--veil-bg-surface-elevated) 0%, var(--veil-bg-surface) 100%)',
            padding: '1.75rem 1.25rem 1.25rem',
            textAlign: 'center',
            borderBottom: '1px solid var(--veil-border-subtle)',
          }}
        >
          {/* Close button in top right corner */}
          <button
            type="button"
            className="veil-icon-btn"
            onClick={closeModal}
            aria-label="Close profile"
            style={{ position: 'absolute', top: '12px', right: '12px' }}
          >
            <CloseIcon size={18} />
          </button>

          {/* Large Avatar */}
          <div style={{ display: 'inline-block', position: 'relative', marginBottom: '0.75rem' }}>
            <Avatar
              name={isPeer ? effectiveDisplayName : myProfile?.displayName || activeSession?.name || 'Self'}
              imageUrl={isPeer ? (peerDoc?.avatar || peerContact?.avatar) : (avatarPreview || myProfile?.avatar || undefined)}
              size={88}
            />
            {!isPeer && (
              <button
                type="button"
                className="veil-avatar-camera-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Change Avatar Photo"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: 'var(--veil-accent-primary)',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--veil-bg-surface)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                }}
              >
                <CameraIcon size={14} color="#ffffff" />
              </button>
            )}
            {isPeer && relState === 'CONTACT_VERIFIED' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: 'var(--veil-accent-primary)',
                  borderRadius: '50%',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}
                title="Identity Verified"
              >
                <ShieldIcon size={14} color="#ffffff" />
              </div>
            )}
          </div>

          {/* Display Name */}
          <h2
            id="profile-modal-title"
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              margin: '0 0 0.25rem 0',
              color: 'var(--veil-text-primary)',
            }}
          >
            {isPeer ? effectiveDisplayName : myProfile?.displayName || activeSession?.name || 'Personal Space'}
          </h2>

          {/* Online / Last seen status */}
          <div style={{ fontSize: '0.8rem', color: 'var(--veil-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <StatusIndicator status={relState === 'BLOCKED' ? 'offline' : 'online'} />
            <span>{relState === 'BLOCKED' ? 'Blocked' : 'last seen recently'}</span>
          </div>
        </div>

        {/* 2. Primary Actions Bar: Message | Mute | Safety */}
        {isPeer && relState !== 'BLOCKED' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--veil-bg-surface)',
              borderBottom: '1px solid var(--veil-border-subtle)',
            }}
          >
            <button
              type="button"
              className="veil-btn veil-btn-secondary"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '0.5rem 0.25rem', height: 'auto' }}
              onClick={handleOpenChat}
            >
              <MessageSquareIcon size={18} color="var(--veil-accent-primary)" />
              <span style={{ fontSize: '0.72rem' }}>Message</span>
            </button>

            <button
              type="button"
              className="veil-btn veil-btn-secondary"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '0.5rem 0.25rem', height: 'auto' }}
              onClick={handleToggleMute}
            >
              {isMuted ? <BellOffIcon size={18} color="var(--veil-text-muted)" /> : <BellIcon size={18} color="var(--veil-accent-primary)" />}
              <span style={{ fontSize: '0.72rem' }}>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              type="button"
              className="veil-btn veil-btn-secondary"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '0.5rem 0.25rem', height: 'auto' }}
              onClick={handleOpenSafetyNumberModal}
            >
              <ShieldIcon size={18} color="var(--veil-accent-primary)" />
              <span style={{ fontSize: '0.72rem' }}>Safety</span>
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div style={{ padding: '1rem 1.25rem', maxHeight: '420px', overflowY: 'auto' }}>
          {errorMessage && (
            <div style={{ padding: '0.65rem', marginBottom: '1rem', backgroundColor: 'var(--veil-danger-bg)', border: '1px solid var(--veil-danger-border)', borderRadius: 'var(--veil-radius-md)', color: 'var(--veil-danger)', fontSize: 'var(--veil-text-xs)' }}>
              {errorMessage}
            </div>
          )}

          {/* Self Profile Edit Form */}
          {!isPeer && isEditing ? (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleAvatarSelect} />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <CameraIcon size={14} />
                  <span>{avatarPreview ? 'Change Photo' : 'Upload Photo'}</span>
                </Button>
                {avatarPreview && (
                  <Button type="button" variant="danger" size="sm" onClick={handleRemovePhoto}>
                    <TrashIcon size={14} />
                    <span>Remove Photo</span>
                  </Button>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)', marginBottom: '0.3rem' }}>
                  @username
                </label>
                <Input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="username" required />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)', marginBottom: '0.3rem' }}>
                  Display Name
                </label>
                <Input value={displayNameInput} onChange={(e) => setDisplayNameInput(e.target.value)} placeholder="Display name" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)', marginBottom: '0.3rem' }}>
                  Bio
                </label>
                <Input value={bioInput} onChange={(e) => setBioInput(e.target.value)} placeholder="A few words about yourself" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)', marginBottom: '0.3rem' }}>
                  Phone Number
                </label>
                <Input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="+1 555 0100" />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                    Phone Visibility
                  </label>
                  <select className="veil-input" style={{ fontSize: 'var(--veil-text-xs)' }} value={phoneVisibility} onChange={(e) => setPhoneVisibility(e.target.value as any)}>
                    <option value="nobody">Nobody (Private)</option>
                    <option value="contacts">Contacts Only</option>
                    <option value="everyone">Everyone</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                    Directory Visibility
                  </label>
                  <select className="veil-input" style={{ fontSize: 'var(--veil-text-xs)' }} value={profileVisibility} onChange={(e) => setProfileVisibility(e.target.value as any)}>
                    <option value="everyone">Public Directory</option>
                    <option value="contacts">Contacts Only</option>
                    <option value="nobody">Hidden (Link Only)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Button type="button" variant="secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }} disabled={isSaving || !usernameInput.trim()}>
                  {isSaving ? (
                    <>
                      <Spinner size="sm" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save Profile'
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div>
              {/* 3. Identity Information Section */}
              <div style={{ backgroundColor: 'var(--veil-bg-base)', borderRadius: 'var(--veil-radius-md)', padding: '0.75rem', marginBottom: '1rem', border: '1px solid var(--veil-border-subtle)' }}>
                {/* Phone Number / Mobile */}
                <div style={{ paddingBottom: '0.65rem', borderBottom: '1px solid var(--veil-border-subtle)' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
                    {!isPeer
                      ? privacySettings.phoneNumber || 'Not configured'
                      : (peerDoc as any)?.phoneNumber || (peerContact as any)?.phoneNumber || 'Mobile'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--veil-text-secondary)' }}>Mobile</div>
                </div>

                {/* Canonical @username with QR and Copy buttons */}
                <div style={{ paddingTop: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
                      @{isPeer ? effectiveUsername : myProfile?.username || 'unregistered'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--veil-text-secondary)' }}>Username</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <IconButton
                      icon={<QrCodeIcon size={16} />}
                      onClick={handleOpenSafetyNumberModal}
                      aria-label="View QR Code"
                      variant="ghost"
                    />
                    <IconButton
                      icon={copiedUsername ? <CheckIcon size={16} color="var(--veil-success)" /> : <CopyIcon size={16} />}
                      onClick={handleCopyUsername}
                      aria-label="Copy Username"
                      variant="ghost"
                    />
                  </div>
                </div>

                {/* Bio (if available) */}
                {((!isPeer && privacySettings.bio) || (isPeer && (peerDoc as any)?.bio)) && (
                  <div style={{ paddingTop: '0.65rem', borderTop: '1px solid var(--veil-border-subtle)', marginTop: '0.65rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--veil-text-primary)' }}>
                      {!isPeer ? privacySettings.bio : (peerDoc as any)?.bio}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--veil-text-secondary)' }}>Bio</div>
                  </div>
                )}
              </div>

              {/* 4. Media Section: Categorized Counts */}
              {isPeer && (
                <div style={{ backgroundColor: 'var(--veil-bg-base)', borderRadius: 'var(--veil-radius-md)', padding: '0.75rem', marginBottom: '1rem', border: '1px solid var(--veil-border-subtle)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--veil-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                    Media
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--veil-text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ImageIcon size={16} color="var(--veil-accent-primary)" />
                        <span>{photosCount} photos</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--veil-text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <VideoIcon size={16} color="var(--veil-accent-primary)" />
                        <span>{videosCount} videos</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--veil-text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileIcon size={16} color="var(--veil-accent-primary)" />
                        <span>{filesCount} files</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--veil-text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileAudioIcon size={16} color="var(--veil-accent-primary)" />
                        <span>{audioCount} audio files</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--veil-text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LinkIcon size={16} color="var(--veil-accent-primary)" />
                        <span>{linksCount} shared links</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--veil-text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MicIcon size={16} color="var(--veil-accent-primary)" />
                        <span>{voiceCount} voice messages</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--veil-text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ImageIcon size={16} color="var(--veil-accent-primary)" />
                        <span>{gifsCount} GIFs</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--veil-text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UsersIcon size={16} color="var(--veil-accent-primary)" />
                        <span>{commonGroupsCount} groups in common</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Safety Number Fingerprint Block */}
              <div style={{ backgroundColor: 'var(--veil-bg-base)', borderRadius: 'var(--veil-radius-md)', padding: '0.75rem', marginBottom: '1rem', border: '1px solid var(--veil-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--veil-text-secondary)' }}>Cryptographic Safety Number</span>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--veil-accent-secondary)',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onClick={handleCopyFingerprint}
                  >
                    {copiedFingerprint ? (
                      <>
                        <CheckIcon size={12} color="var(--veil-success)" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--veil-font-mono)',
                    fontSize: '0.72rem',
                    backgroundColor: 'var(--veil-bg-surface)',
                    padding: '0.5rem',
                    borderRadius: 'var(--veil-radius-sm)',
                    border: '1px solid var(--veil-border)',
                    wordBreak: 'break-all',
                    color: 'var(--veil-text-primary)',
                  }}
                >
                  {formattedFingerprint}
                </div>
              </div>

              {/* Add Contact Greeting for Non-Connected Users */}
              {isPeer && relState === 'NOT_CONNECTED' && showAddGreeting && (
                <form onSubmit={handleSendContactReq} style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)' }}>
                    Optional Greeting to @{effectiveUsername}
                  </label>
                  <Input
                    value={greetingText}
                    onChange={(e) => setGreetingText(e.target.value)}
                    placeholder="Hi! Let's connect on VEIL."
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                    <Button type="button" variant="secondary" style={{ flex: 1 }} onClick={() => setShowAddGreeting(false)} disabled={isSendingRequest}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" style={{ flex: 1 }} disabled={isSendingRequest}>
                      {isSendingRequest ? <Spinner size="sm" /> : 'Send Request'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Delete Confirmation Warning */}
              {showDeleteConfirm && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    backgroundColor: 'var(--veil-danger-bg)',
                    border: '1px solid var(--veil-danger-border)',
                    borderRadius: 'var(--veil-radius-md)',
                  }}
                >
                  <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-danger)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Remove @{effectiveUsername} from contacts?
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Button type="button" variant="danger" size="sm" style={{ flex: 1 }} onClick={handleRemoveContact}>
                      Yes, Remove
                    </Button>
                    <Button type="button" variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* 5. Contact Actions Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {!isPeer ? (
                  <Button type="button" variant="primary" style={{ width: '100%' }} onClick={() => setIsEditing(true)}>
                    <EditIcon size={16} />
                    <span>Edit Profile</span>
                  </Button>
                ) : relState === 'NOT_CONNECTED' && !showAddGreeting ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button type="button" variant="primary" style={{ flex: 1 }} onClick={() => setShowAddGreeting(true)}>
                      <PlusIcon size={16} />
                      <span>Add Contact</span>
                    </Button>
                    <Button type="button" variant="secondary" onClick={closeModal}>
                      Done
                    </Button>
                  </div>
                ) : relState === 'PENDING_OUTGOING' ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Button
                      type="button"
                      variant="danger"
                      style={{ flex: 1 }}
                      onClick={handleCancelRequest}
                      disabled={isCancelling}
                    >
                      {isCancelling ? (
                        <>
                          <Spinner size="sm" />
                          <span>Cancelling...</span>
                        </>
                      ) : (
                        'Cancel Request'
                      )}
                    </Button>
                    <Button type="button" variant="secondary" onClick={closeModal}>
                      Done
                    </Button>
                  </div>
                ) : relState === 'PENDING_INCOMING' ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Button type="button" variant="primary" style={{ flex: 1 }} onClick={handleAcceptIncoming}>
                      <CheckIcon size={16} />
                      <span>Accept</span>
                    </Button>
                    <Button type="button" variant="secondary" onClick={handleDeclineIncoming}>
                      <CloseIcon size={16} />
                      <span>Decline</span>
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="veil-btn veil-btn-secondary"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                      onClick={handleShareContact}
                    >
                      <ShareIcon size={16} color="var(--veil-accent-primary)" />
                      <span>Share this contact</span>
                    </button>

                    <button
                      type="button"
                      className="veil-btn veil-btn-secondary"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                      onClick={handleOpenSafetyNumberModal}
                    >
                      <ShieldIcon size={16} color="var(--veil-accent-secondary)" />
                      <span>Verify Safety Number</span>
                    </button>

                    {!showDeleteConfirm && (
                      <button
                        type="button"
                        className="veil-btn veil-btn-secondary"
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <TrashIcon size={16} color="var(--veil-danger)" />
                        <span style={{ color: 'var(--veil-danger)' }}>Delete contact</span>
                      </button>
                    )}

                    {relState === 'BLOCKED' ? (
                      <button
                        type="button"
                        className="veil-btn veil-btn-secondary"
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                        onClick={handleUnblock}
                      >
                        <ShieldIcon size={16} />
                        <span>Unblock user</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="veil-btn veil-btn-secondary"
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem', color: 'var(--veil-danger)' }}
                        onClick={handleBlock}
                      >
                        <AlertCircleIcon size={16} color="var(--veil-danger)" />
                        <span>Block user</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
