/**
 * Dedicated Profile View & Management Modal for VEIL.
 *
 * Implements Telegram-inspired profile presentation with VEIL's privacy architecture:
 * - Avatar selection, preview, replace, and fallback
 * - Display Name, @username handle, and Bio
 * - Phone number with granular privacy visibility controls (Nobody, Contacts, Everyone)
 * - Cryptographic identity fingerprint & safety verification
 * - Safe UI error sanitization (no raw PostgreSQL/DB exceptions)
 */

import React, { useState, useRef } from 'react';
import { useApp } from '../app/AppState.tsx';
import { processAvatarImage } from '../utils/avatarProcessor.ts';
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

interface ProfileModalProps {
  peerId?: string;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ peerId }) => {
  const {
    activeSession,
    myProfile,
    privacySettings,
    updatePrivacySettings,
    registerUsername,
    closeModal,
    conversations,
    idMgr,
    store,
  } = useApp();

  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPeer = Boolean(peerId);
  const peerConv = isPeer ? conversations.find((c) => c.id === peerId) : null;

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

  const loadedIdentity = activeSession ? idMgr.loadIdentity(activeSession, store) : null;
  const fingerprint = isPeer
    ? peerConv?.fingerprint || peerConv?.id.slice(0, 16).toUpperCase() || 'E2EE-IDENTITY'
    : loadedIdentity?.document.fingerprint || 'E2EE-IDENTITY';

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

      await registerUsername(
        usernameInput.trim(),
        displayNameInput.trim() || undefined,
        bioInput.trim() || undefined,
        avatarPreview || undefined
      );

      showToast({ type: 'success', message: 'Profile updated successfully' });
      setIsEditing(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile');
      showToast({ type: 'error', message: err.message || 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="veil-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      <div className="veil-modal-card" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div className="veil-modal-header">
          <h2 id="profile-modal-title" style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600 }}>
            {isPeer ? 'Contact Profile' : isEditing ? 'Edit Profile' : 'My Profile'}
          </h2>
          <IconButton
            icon="✕"
            aria-label="Close profile"
            onClick={closeModal}
          />
        </div>

        <div className="veil-modal-body">
          {/* Profile Hero */}
          <div className="veil-profile-hero">
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Avatar
                name={isPeer ? peerConv?.name || 'Contact' : displayNameInput || activeSession?.name || 'User'}
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
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📷 Change
                  </Button>
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleRemovePhoto}
                    >
                      ✕ Remove
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: 'var(--veil-text-base)', fontWeight: 700, color: 'var(--veil-text-primary)' }}>
              {isPeer ? peerConv?.name : myProfile?.displayName || displayNameInput || activeSession?.name}
            </div>

            <div style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-accent-secondary)', marginTop: '0.15rem' }}>
              {isPeer ? (peerConv?.peerDoc?.identityId ? `@${peerConv.name.toLowerCase()}` : '') : `@${myProfile?.username || usernameInput || 'username'}`}
            </div>

            {!isEditing && (
              <div style={{ marginTop: '0.5rem' }}>
                <Badge variant="secure">
                  🔒 E2EE Cryptographic Identity
                </Badge>
              </div>
            )}
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

          {/* Edit Profile Form */}
          {!isPeer && isEditing ? (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                  Display Name
                </label>
                <Input
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Your public name"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                  Public Username (@handle)
                </label>
                <Input
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. alice"
                  required
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--veil-text-muted)' }}>
                  Peers can search and send contact requests using this handle.
                </span>
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
                <Input
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                    Who Can See My Number?
                  </label>
                  <select
                    className="veil-input"
                    style={{ fontSize: 'var(--veil-text-xs)' }}
                    value={phoneVisibility}
                    onChange={(e) => setPhoneVisibility(e.target.value as any)}
                  >
                    <option value="nobody">Nobody (Private)</option>
                    <option value="contacts">Contacts Only</option>
                    <option value="everyone">Everyone</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '0.25rem' }}>
                    Profile Visibility
                  </label>
                  <select
                    className="veil-input"
                    style={{ fontSize: 'var(--veil-text-xs)' }}
                    value={profileVisibility}
                    onChange={(e) => setProfileVisibility(e.target.value as any)}
                  >
                    <option value="everyone">Public Directory</option>
                    <option value="contacts">Contacts Only</option>
                    <option value="nobody">Hidden (Link Only)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Button
                  type="button"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  style={{ flex: 1 }}
                  disabled={isSaving || !usernameInput.trim()}
                >
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
              {(privacySettings.bio || isPeer) && (
                <div className="veil-profile-info-row">
                  <div>
                    <div className="veil-profile-info-label">Bio</div>
                    <div className="veil-profile-info-val">
                      {isPeer ? 'End-to-End Encrypted Contact' : privacySettings.bio || 'No bio set.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Phone / Privacy */}
              {!isPeer && (
                <div className="veil-profile-info-row">
                  <div>
                    <div className="veil-profile-info-label">Phone Number</div>
                    <div className="veil-profile-info-val">
                      {privacySettings.phoneNumber || 'Not configured'}
                    </div>
                  </div>
                  <Badge variant="neutral">
                    {privacySettings.phoneVisibility === 'nobody'
                      ? '🔒 Nobody'
                      : privacySettings.phoneVisibility === 'contacts'
                      ? '👥 Contacts'
                      : '🌐 Everyone'}
                  </Badge>
                </div>
              )}

              {/* Cryptographic Identity Fingerprint */}
              <div style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--veil-border-subtle)' }}>
                <div className="veil-profile-info-label" style={{ marginBottom: '0.35rem' }}>
                  Cryptographic Safety Fingerprint
                </div>
                <div
                  style={{
                    fontFamily: 'var(--veil-font-mono)',
                    fontSize: '0.72rem',
                    backgroundColor: 'var(--veil-bg-base)',
                    padding: '0.45rem 0.6rem',
                    borderRadius: 'var(--veil-radius-sm)',
                    border: '1px solid var(--veil-border)',
                    wordBreak: 'break-all',
                    color: 'var(--veil-text-primary)',
                  }}
                >
                  {fingerprint}
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
                {!isPeer ? (
                  <Button
                    type="button"
                    variant="primary"
                    style={{ width: '100%' }}
                    onClick={() => setIsEditing(true)}
                  >
                    ✏️ Edit Profile
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    style={{ width: '100%' }}
                    onClick={closeModal}
                  >
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
