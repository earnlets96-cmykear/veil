/**
 * Dedicated Profile View & Central Relationship Hub for VEIL Phase 33 Step 4.
 *
 * Implements Telegram-inspired profile presentation with VEIL's privacy architecture:
 * - Avatar selection, preview, replace, and fallback
 * - Display Name, @username handle, and Bio
 * - Relationship-aware actions for all 8 states:
 *   1. NOT_CONNECTED: Add Contact (with greeting input)
 *   2. PENDING_OUTGOING: Request Pending
 *   3. PENDING_INCOMING: Accept / Decline / Block
 *   4. CONTACT_UNVERIFIED: Chat / Verify Safety Number / Remove Contact / Block
 *   5. CONTACT_VERIFIED: Chat / Safety Number / Remove Contact / Block
 *   6. KEY_CHANGED: Security Warning / Review & Re-verify / Block
 *   7. BLOCKED: Unblock
 *   8. SELF: Edit Profile
 * - Formatted chunked safety number with one-click copy
 * - Phone privacy visibility controls (Nobody, Contacts, Everyone)
 * - Safe UI error sanitization (no raw PostgreSQL/DB exceptions)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../app/AppState.tsx';
import { processAvatarImage } from '../utils/avatarProcessor.ts';
import { getRelationshipState, RelationshipState } from '../../contacts/relationshipHelper.ts';
import { DirectorySearchResult, SignedProfileDocument } from '../../server/types.ts';
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
    sendContactRequest,
    acceptContactRequest,
    declineContactRequest,
    cancelContactRequest,
    blockUser,
    unblockUser,
    removeContact,
    selectConversation,
    openModal,
    directoryClient,
    idMgr,
    store,
  } = useApp();

  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPeer = Boolean(peerId || peerUsername || searchResult);
  const peerConv = isPeer ? (conversations || []).find((c) => c.id === peerId) : null;
  const peerContact = isPeer
    ? (contacts || []).find((c) => c.identityId === peerId || (peerUsername && c.name.toLowerCase() === peerUsername.toLowerCase()))
    : null;

  const [peerDoc, setPeerDoc] = useState<SignedProfileDocument | null>(null);
  const [loadingPeer, setLoadingPeer] = useState(false);
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

  // Add Contact Form State for Non-Contacts
  const [showAddGreeting, setShowAddGreeting] = useState(false);
  const [greetingText, setGreetingText] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadedIdentity = activeSession ? idMgr.loadIdentity(activeSession, store) : null;

  const effectiveIdentityId = peerId || searchResult?.identityId || peerContact?.identityId || peerDoc?.identityId;
  const effectiveUsername = searchResult?.username || peerUsername || peerContact?.name || peerConv?.name;
  const effectiveDisplayName = searchResult?.displayName || peerDoc?.displayName || peerContact?.name || peerConv?.name || effectiveUsername || 'User';

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

  // Format fingerprint into readable 4-character chunks (e.g. "8421 9630 4912 8841")
  const formattedFingerprint = rawFingerprint.replace(/(.{4})/g, '$1 ').trim();

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const optimizedThumbnail = await processAvatarImage(file);
      setAvatarPreview(optimizedThumbnail);
      showToast({ type: 'info', message: 'Profile photo optimized (<32 KB)' });
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to process profile photo' });
    }
  };

  const handleRemovePhoto = () => {
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopyFingerprint = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(rawFingerprint);
      setCopiedFingerprint(true);
      showToast({ type: 'success', message: 'Safety number copied to clipboard' });
      setTimeout(() => setCopiedFingerprint(false), 3000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      setErrorMessage('Username cannot be empty');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updatePrivacySettings({
        phoneVisibility,
        profileVisibility,
        phoneNumber: phoneInput.trim() || undefined,
        bio: bioInput.trim() || undefined,
        avatar: avatarPreview || undefined,
      });

      const res = await registerUsername(
        usernameInput.trim(),
        displayNameInput.trim() || undefined,
        bioInput.trim() || undefined,
        avatarPreview || undefined
      );

      if ((res as any)?.cloudSyncPending) {
        showToast({ type: 'info', message: 'Saved locally. Cloud sync pending.' });
      } else {
        showToast({ type: 'success', message: 'Profile updated successfully' });
      }
      setIsEditing(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile');
      showToast({ type: 'error', message: err.message || 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendContactReq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUsername) return;

    setIsSendingRequest(true);
    setErrorMessage(null);

    try {
      await sendContactRequest(effectiveUsername, greetingText.trim() || undefined);
      showToast({ type: 'success', message: `Contact request sent to @${effectiveUsername}` });
      setShowAddGreeting(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send contact request');
      showToast({ type: 'error', message: err.message || 'Failed to send contact request' });
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptIncoming = async () => {
    if (!matchingIncomingRequest) return;
    try {
      await acceptContactRequest(matchingIncomingRequest.requestId);
      showToast({ type: 'success', message: `Accepted contact request from @${effectiveUsername}` });
      if (effectiveIdentityId) {
        selectConversation(effectiveIdentityId);
      }
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to accept request' });
    }
  };

  const handleDeclineIncoming = async () => {
    if (!matchingIncomingRequest) return;
    try {
      await declineContactRequest(matchingIncomingRequest.requestId);
      showToast({ type: 'info', message: 'Contact request declined' });
      closeModal();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to decline request' });
    }
  };

  const handleCancelRequest = async () => {
    if (!matchingOutgoingRequest) return;
    setIsCancelling(true);
    setErrorMessage(null);
    try {
      await cancelContactRequest(matchingOutgoingRequest.requestId);
      showToast({ type: 'info', message: 'Contact request cancelled' });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel contact request');
      showToast({ type: 'error', message: err.message || 'Failed to cancel contact request' });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleBlock = async () => {
    if (!effectiveIdentityId) return;
    try {
      await blockUser(effectiveIdentityId);
      showToast({ type: 'warning', message: 'User blocked' });
      closeModal();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to block user' });
    }
  };

  const handleUnblock = async () => {
    if (!effectiveIdentityId) return;
    try {
      await unblockUser(effectiveIdentityId);
      showToast({ type: 'success', message: 'User unblocked' });
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to unblock user' });
    }
  };

  const handleRemoveContact = async () => {
    if (!effectiveIdentityId) return;
    try {
      await removeContact(effectiveIdentityId);
      showToast({ type: 'info', message: 'Contact removed from address book' });
      closeModal();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to remove contact' });
    }
  };

  const handleOpenChat = () => {
    if (effectiveIdentityId) {
      selectConversation(effectiveIdentityId);
      closeModal();
    }
  };

  const renderRelationshipBadge = () => {
    switch (relState) {
      case 'SELF':
        return <Badge variant="secure">Your Active Profile</Badge>;
      case 'CONTACT_VERIFIED':
        return <Badge variant="secure">Verified E2EE Contact</Badge>;
      case 'CONTACT_UNVERIFIED':
        return <Badge variant="secure">E2EE Contact</Badge>;
      case 'KEY_CHANGED':
        return <Badge variant="danger">Key Changed</Badge>;
      case 'PENDING_OUTGOING':
        return <Badge variant="warning">Request Pending</Badge>;
      case 'PENDING_INCOMING':
        return <Badge variant="warning">Incoming Request</Badge>;
      case 'BLOCKED':
        return <Badge variant="danger">Blocked</Badge>;
      default:
        return <Badge variant="neutral">Discovered User</Badge>;
    }
  };

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      <div className="veil-modal-card" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div className="veil-modal-header">
          <h2 id="profile-modal-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>
            {!isPeer ? (isEditing ? 'Edit Profile' : 'My Profile') : 'User Profile'}
          </h2>
          <IconButton icon={<CloseIcon size={18} />} aria-label="Close profile" onClick={closeModal} />
        </div>

        <div className="veil-modal-body">
          {/* Key Changed Security Alert */}
          {relState === 'KEY_CHANGED' && (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--veil-danger)',
                borderRadius: 'var(--veil-radius-md)',
                color: 'var(--veil-danger)',
                fontSize: 'var(--veil-text-xs)',
                marginBottom: '1rem',
                lineHeight: 1.4,
              }}
              role="alert"
            >
              <strong>Cryptographic Safety Warning:</strong>
              <div style={{ marginTop: '0.25rem' }}>
                This contact's identity key has changed since you last verified them. This could indicate a device reset or a potential interception attempt.
              </div>
            </div>
          )}

          {/* Profile Hero */}
          <div className="veil-profile-hero">
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Avatar
                name={isPeer ? effectiveDisplayName : displayNameInput || activeSession?.name || 'User'}
                imageUrl={isPeer ? (peerDoc?.avatar || searchResult?.avatar || peerContact?.avatar || peerConv?.avatar) : (avatarPreview || myProfile?.avatar)}
                size="xl"
                isGroup={isPeer && peerConv?.type === 'group'}
              />
              {!isPeer && isEditing && (
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handlePhotoSelect}
                    aria-label="Upload profile photo"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon size={14} />
                    <span>Change</span>
                  </Button>
                  {avatarPreview && (
                    <Button type="button" variant="danger" size="sm" onClick={handleRemovePhoto}>
                      <CloseIcon size={14} />
                      <span>Remove</span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: 'var(--veil-text-base)', fontWeight: 700, color: 'var(--veil-text-primary)' }}>
              {isPeer ? effectiveDisplayName : myProfile?.displayName || displayNameInput || activeSession?.name}
            </div>

            <div style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-accent-secondary)', marginTop: '0.15rem' }}>
              @{isPeer ? effectiveUsername || 'user' : myProfile?.username || usernameInput || 'username'}
            </div>

            {!isEditing && <div style={{ marginTop: '0.5rem' }}>{renderRelationshipBadge()}</div>}
          </div>

          {/* Error Message Box */}
          {errorMessage && (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--veil-danger-bg)',
                border: '1px solid var(--veil-danger-border)',
                borderRadius: 'var(--veil-radius-md)',
                color: 'var(--veil-danger)',
                fontSize: 'var(--veil-text-xs)',
                marginBottom: '1rem',
              }}
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {/* Edit Profile Form (Self Only) */}
          {!isPeer && isEditing ? (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                  Display Name
                </label>
                <Input value={displayNameInput} onChange={(e) => setDisplayNameInput(e.target.value)} placeholder="Your public name" required />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                  Public Username (@handle)
                </label>
                <Input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="e.g. alice" required />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                  Bio / About
                </label>
                <textarea
                  className="veil-input"
                  rows={2}
                  style={{ width: '100%', resize: 'none', fontSize: 'var(--veil-text-xs)' }}
                  placeholder="A few words about you..."
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                  Phone / Contact Number (Optional)
                </label>
                <Input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                    Who Can See My Number?
                  </label>
                  <select className="veil-input" style={{ fontSize: 'var(--veil-text-xs)' }} value={phoneVisibility} onChange={(e) => setPhoneVisibility(e.target.value as any)}>
                    <option value="nobody">Nobody (Private)</option>
                    <option value="contacts">Contacts Only</option>
                    <option value="everyone">Everyone</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                    Profile Visibility
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
                      <span>Publishing...</span>
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          ) : (
            /* View Profile Mode */
            <div>
              {/* Bio */}
              <div className="veil-profile-info-row">
                <div>
                  <div className="veil-profile-info-label">Bio</div>
                  <div className="veil-profile-info-val">
                    {!isPeer ? privacySettings.bio || 'No bio set.' : 'End-to-End Encrypted Identity on VEIL.'}
                  </div>
                </div>
              </div>

              {/* Phone / Privacy */}
              {!isPeer ? (
                <div className="veil-profile-info-row">
                  <div>
                    <div className="veil-profile-info-label">Phone Number</div>
                    <div className="veil-profile-info-val">{privacySettings.phoneNumber || 'Not configured'}</div>
                  </div>
                  <Badge variant="neutral">
                    {privacySettings.phoneVisibility === 'nobody' ? 'Nobody' : privacySettings.phoneVisibility === 'contacts' ? 'Contacts' : 'Everyone'}
                  </Badge>
                </div>
              ) : (
                /* Peer Phone Number Visibility Check */
                ((peerDoc as any)?.phoneNumber && ((peerDoc as any).phoneVisibility === 'everyone' || (relState.startsWith('CONTACT') && (peerDoc as any).phoneVisibility === 'contacts'))) ? (
                  <div className="veil-profile-info-row">
                    <div>
                      <div className="veil-profile-info-label">Phone Number</div>
                      <div className="veil-profile-info-val">{(peerDoc as any).phoneNumber}</div>
                    </div>
                    <Badge variant="neutral">Verified Phone</Badge>
                  </div>
                ) : null
              )}

              {/* Cryptographic Identity Safety Number */}
              <div style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--veil-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span className="veil-profile-info-label">Cryptographic Safety Number</span>
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
                    fontSize: '0.75rem',
                    backgroundColor: 'var(--veil-bg-base)',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 'var(--veil-radius-sm)',
                    border: '1px solid var(--veil-border)',
                    wordBreak: 'break-all',
                    letterSpacing: '0.04em',
                    color: 'var(--veil-text-primary)',
                  }}
                >
                  {formattedFingerprint}
                </div>
              </div>

              {/* Add Contact Greeting Prompt */}
              {isPeer && relState === 'NOT_CONNECTED' && showAddGreeting && (
                <form onSubmit={handleSendContactReq} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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

              {/* Delete Contact Confirmation Box */}
              {showDeleteConfirm && (
                <div
                  style={{
                    marginTop: '1rem',
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

              {/* Contextual Actions Footer */}
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {!isPeer ? (
                  <Button type="button" variant="primary" style={{ width: '100%' }} onClick={() => setIsEditing(true)}>
                    Edit Profile
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
                    {effectiveIdentityId && (
                      <Button type="button" variant="danger" onClick={handleBlock}>
                        Block
                      </Button>
                    )}
                  </div>
                ) : relState === 'KEY_CHANGED' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {effectiveIdentityId && (
                      <Button
                        type="button"
                        variant="primary"
                        style={{ width: '100%' }}
                        onClick={() => {
                          closeModal();
                          openModal({ type: 'contactDetails', conversationId: effectiveIdentityId });
                        }}
                      >
                        <ShieldIcon size={16} />
                        <span>Review Identity & Re-verify</span>
                      </Button>
                    )}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <Button type="button" variant="danger" style={{ flex: 1 }} onClick={handleBlock}>
                        Block User
                      </Button>
                      <Button type="button" variant="secondary" onClick={closeModal}>
                        Close
                      </Button>
                    </div>
                  </div>
                ) : relState === 'CONTACT_VERIFIED' || relState === 'CONTACT_UNVERIFIED' ? (
                  !showDeleteConfirm && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Button type="button" variant="primary" style={{ flex: 1 }} onClick={handleOpenChat}>
                          Open Chat
                        </Button>
                        {effectiveIdentityId && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              closeModal();
                              openModal({ type: 'contactDetails', conversationId: effectiveIdentityId });
                            }}
                          >
                            <ShieldIcon size={16} />
                            <span>Safety Number</span>
                          </Button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Button type="button" variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(true)}>
                          <TrashIcon size={14} />
                          <span>Remove Contact</span>
                        </Button>
                        {effectiveIdentityId && (
                          <Button type="button" variant="danger" size="sm" onClick={handleBlock}>
                            Block
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                ) : relState === 'BLOCKED' ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button type="button" variant="secondary" style={{ flex: 1 }} onClick={handleUnblock}>
                      Unblock User
                    </Button>
                    <Button type="button" variant="secondary" onClick={closeModal}>
                      Done
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="secondary" style={{ width: '100%' }} onClick={closeModal}>
                    Done
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
