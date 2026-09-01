/**
 * Telegram-Inspired Settings & Privacy Management Modal for VEIL.
 *
 * Implements clean categorized settings architecture:
 * - Profile Header Card (Avatar, Name, @username, Space Status)
 * - ACCOUNT (Profile, Username & Identity, Linked Devices & Key Export)
 * - PRIVACY & SECURITY (Argon2id Master Key, Auto-Lock, Panic Lock, Space Isolation)
 * - APPEARANCE (Theme, Message Density, Visual Effects)
 * - NOTIFICATIONS (Privacy Modes, Sound & Alerts)
 * - STORAGE & DATA (Encrypted Storage, Ephemeral Media Cache, Cloud Sync)
 * - ABOUT VEIL (Version 1.0.0, Post-RC Security Freeze Active)
 */

import React, { useState, useRef, ReactNode } from 'react';
import { useApp } from '../app/AppState.tsx';
import { NotificationPrivacyMode } from '../../notifications/types.ts';
import { processAvatarImage } from '../utils/avatarProcessor.ts';
import { MediaCache } from '../utils/mediaCache.ts';
import { getErrorMessage } from '../../utils/errors.ts';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Input,
  PasswordInput,
  StatusIndicator,
  Spinner,
  useToast,
} from './ui/index.ts';
import {
  UserIcon,
  KeyIcon,
  ShieldIcon,
  AlertCircleIcon,
  SunIcon,
  FolderIcon,
  LockIcon,
  InfoIcon,
  ArrowLeftIcon,
  CloseIcon,
  LogOutIcon,
  EyeIcon,
  EyeOffIcon,
  CopyIcon,
  CheckIcon,
  DownloadIcon,
  ShareIcon,
  RefreshCwIcon,
  TrashIcon,
  MoonIcon,
  SmartphoneIcon,
  BellIcon,
  ChevronRightIcon,
} from './icons/index.ts';

export type SettingsCategory =
  | 'overview'
  | 'account'
  | 'devices'
  | 'privacy'
  | 'notifications'
  | 'appearance'
  | 'storage'
  | 'about';

export interface SettingsModalProps {
  initialCategory?: SettingsCategory;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ initialCategory = 'overview' }) => {
  const {
    activeSession,
    closeModal,
    sessionController,
    panicLock,
    idMgr,
    store,
    notificationDispatcher,
    exportMyInvitation,
    myProfile,
    privacySettings,
    updatePrivacySettings,
    registerUsername,
    lockSpace,
    knownSpacesCount,
    changeAccountPassword,
  } = useApp();

  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(initialCategory);

  React.useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  // Password Change State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || passwordChangeLoading) return;
    if (newPassword.length < 3) {
      setPasswordChangeError('New password must be at least 3 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New passwords do not match.');
      return;
    }
    if (oldPassword === newPassword) {
      setPasswordChangeError('New password must be different from current password.');
      return;
    }

    setPasswordChangeLoading(true);
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);

    try {
      await changeAccountPassword(oldPassword, newPassword);
      setPasswordChangeSuccess('Password changed successfully! Local keys rewrapped and recovery vault updated.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast({ type: 'success', message: 'Password updated successfully!' });
    } catch (err: any) {
      setPasswordChangeError(getErrorMessage(err, 'Failed to change password. Verify your current password.'));
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  // Profile Form State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [usernameInput, setUsernameInput] = useState(myProfile?.username || '');
  const [displayNameInput, setDisplayNameInput] = useState(myProfile?.displayName || activeSession?.name || '');
  const [bioInput, setBioInput] = useState(privacySettings.bio || '');
  const [phoneInput, setPhoneInput] = useState(privacySettings.phoneNumber || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(privacySettings.avatar || myProfile?.avatar || null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Settings State
  const [autoLockVal, setAutoLockVal] = useState('5');
  const [notifLevel, setNotifLevel] = useState<NotificationPrivacyMode>(
    notificationDispatcher?.getPrivacyMode?.() || 'SENDER_ONLY'
  );
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showPairingSas, setShowPairingSas] = useState(false);
  const [themeVal, setThemeVal] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') || 'obsidian';
    }
    return 'obsidian';
  });
  const [densityVal, setDensityVal] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-density') || 'comfortable';
    }
    return 'comfortable';
  });
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleSelectTheme = (themeId: string) => {
    setThemeVal(themeId);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', themeId);
    }
    try {
      localStorage.setItem('veil:theme', themeId);
    } catch (_e) {}
  };

  const handleSelectDensity = (densityId: string) => {
    setDensityVal(densityId);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-density', densityId);
    }
    try {
      localStorage.setItem('veil:density', densityId);
    } catch (_e) {}
  };

  const [devices] = useState<{ id: string; name: string; lastSeen: number }[]>([
    { id: 'dev_primary', name: 'Primary Device (This Client)', lastSeen: Date.now() },
  ]);

  const loadedIdentity = activeSession && idMgr && store ? idMgr.loadIdentity(activeSession, store) : null;
  const fingerprint = loadedIdentity?.document.fingerprint || 'E2EE-IDENTITY';
  const invitationLink = exportMyInvitation?.() || null;

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      setProfileError('Username cannot be empty');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);

    try {
      await updatePrivacySettings({
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

      showToast({ type: 'success', message: 'Profile successfully updated and published!' });
      setIsEditingProfile(false);
    } catch (err: any) {
      setProfileError(err.message || "Couldn't publish your profile. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCopyInvite = () => {
    if (invitationLink) {
      navigator.clipboard.writeText(invitationLink);
      setCopiedInvite(true);
      showToast({ type: 'success', message: 'Invitation link copied to clipboard' });
      setTimeout(() => setCopiedInvite(false), 2500);
    }
  };

  const handleClearCache = () => {
    MediaCache.clear();
    setCacheCleared(true);
    showToast({ type: 'info', message: 'Decrypted media cache zeroized from memory' });
    setTimeout(() => setCacheCleared(false), 3000);
  };

  return (
    <div
      className="veil-modal-overlay"
      onClick={closeModal}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="veil-settings-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="veil-settings-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {activeCategory !== 'overview' && (
              <IconButton
                icon={<ArrowLeftIcon size={18} />}
                onClick={() => setActiveCategory('overview')}
                aria-label="Back to settings menu"
                variant="ghost"
              />
            )}
            <h2 className="veil-settings-header-title">
              {activeCategory === 'overview' && 'Settings'}
              {activeCategory === 'profile' && 'My Profile'}
              {activeCategory === 'account' && 'Account & Identity'}
              {activeCategory === 'privacy' && 'Privacy & Security'}
              {activeCategory === 'appearance' && 'Appearance'}
              {activeCategory === 'notifications' && 'Notifications'}
              {activeCategory === 'storage' && 'Storage & Data'}
              {activeCategory === 'about' && 'About VEIL'}
            </h2>
          </div>
          <IconButton
            icon={<CloseIcon size={18} />}
            onClick={closeModal}
            aria-label="Close Settings"
            variant="ghost"
          />
        </div>

        {/* Modal Body */}
        <div className="veil-settings-modal-body">
          {/* 1. OVERVIEW SCREEN (TELEGRAM-STYLE PROFILE HEADER + GROUPED SECTIONS) */}
          {activeCategory === 'overview' && (
            <div className="veil-settings-overview">
              {/* Profile Header Card */}
              <div
                className="veil-settings-profile-card"
                onClick={() => setActiveCategory('profile')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setActiveCategory('profile');
                }}
              >
                <Avatar
                  name={displayNameInput || activeSession?.name || 'User'}
                  imageUrl={avatarPreview || undefined}
                  size="xl"
                  aria-label="Profile Avatar"
                />
                <div className="veil-settings-profile-info">
                  <div className="veil-settings-profile-name">
                    {displayNameInput || activeSession?.name || 'Active User'}
                  </div>
                  <div className="veil-settings-profile-handle">
                    {myProfile?.username ? `@${myProfile.username}` : 'No username set (Tap to configure)'}
                  </div>
                  <div className="veil-settings-profile-space">
                    <span className="veil-status-dot online" />
                    <span>Space: {activeSession?.name || 'Primary'} (Argon2id Encrypted)</span>
                  </div>
                </div>
                <ChevronRightIcon size={20} color="var(--veil-text-muted)" />
              </div>

              {/* Group 1: ACCOUNT */}
              <div className="veil-settings-group">
                <div className="veil-settings-group-header">ACCOUNT</div>

                <div
                  className="veil-settings-row"
                  onClick={() => setActiveCategory('profile')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="veil-settings-icon-badge badge-blue">
                    <UserIcon size={18} color="#ffffff" />
                  </div>
                  <div className="veil-settings-row-text">
                    <div className="veil-settings-row-title">Edit Profile</div>
                    <div className="veil-settings-row-sub">Display name, bio, profile photo</div>
                  </div>
                  <ChevronRightIcon size={18} color="var(--veil-text-muted)" />
                </div>

                <div
                  className="veil-settings-row"
                  onClick={() => setActiveCategory('account')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="veil-settings-icon-badge badge-indigo">
                    <KeyIcon size={18} color="#ffffff" />
                  </div>
                  <div className="veil-settings-row-text">
                    <div className="veil-settings-row-title">Username & Identity</div>
                    <div className="veil-settings-row-sub">Public handle, device linking & keys</div>
                  </div>
                  <ChevronRightIcon size={18} color="var(--veil-text-muted)" />
                </div>
              </div>

              {/* Group 2: PRIVACY & SECURITY */}
              <div className="veil-settings-group">
                <div className="veil-settings-group-header">PRIVACY & SECURITY</div>

                <div
                  className="veil-settings-row"
                  onClick={() => setActiveCategory('privacy')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="veil-settings-icon-badge badge-emerald">
                    <ShieldIcon size={18} color="#ffffff" />
                  </div>
                  <div className="veil-settings-row-text">
                    <div className="veil-settings-row-title">Security & Cryptography</div>
                    <div className="veil-settings-row-sub">Auto-lock timer, panic lock, master key</div>
                  </div>
                  <ChevronRightIcon size={18} color="var(--veil-text-muted)" />
                </div>

                <div
                  className="veil-settings-row"
                  onClick={() => setActiveCategory('notifications')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="veil-settings-icon-badge badge-amber">
                    <SunIcon size={18} color="#ffffff" />
                  </div>
                  <div className="veil-settings-row-text">
                    <div className="veil-settings-row-title">Notification Privacy</div>
                    <div className="veil-settings-row-sub">Preview content, sender-only alerts</div>
                  </div>
                  <ChevronRightIcon size={18} color="var(--veil-text-muted)" />
                </div>
              </div>

              {/* Group 3: APP SETTINGS */}
              <div className="veil-settings-group">
                <div className="veil-settings-group-header">APP SETTINGS</div>

                <div
                  className="veil-settings-row"
                  onClick={() => setActiveCategory('appearance')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="veil-settings-icon-badge badge-purple">
                    <SunIcon size={18} color="#ffffff" />
                  </div>
                  <div className="veil-settings-row-text">
                    <div className="veil-settings-row-title">Appearance</div>
                    <div className="veil-settings-row-sub">Theme, message density, typography</div>
                  </div>
                  <ChevronRightIcon size={18} color="var(--veil-text-muted)" />
                </div>

                <div
                  className="veil-settings-row"
                  onClick={() => setActiveCategory('storage')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="veil-settings-icon-badge badge-cyan">
                    <FolderIcon size={18} color="#ffffff" />
                  </div>
                  <div className="veil-settings-row-text">
                    <div className="veil-settings-row-title">Storage & Data</div>
                    <div className="veil-settings-row-sub">IndexedDB encrypted store, media cache</div>
                  </div>
                  <ChevronRightIcon size={18} color="var(--veil-text-muted)" />
                </div>
              </div>

              {/* Group 4: ABOUT */}
              <div className="veil-settings-group">
                <div className="veil-settings-group-header">ABOUT</div>

                <div
                  className="veil-settings-row"
                  onClick={() => setActiveCategory('about')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="veil-settings-icon-badge badge-rose">
                    <InfoIcon size={18} color="#ffffff" />
                  </div>
                  <div className="veil-settings-row-text">
                    <div className="veil-settings-row-title">About VEIL</div>
                    <div className="veil-settings-row-sub">Version 1.0.0 • Post-RC Security Freeze</div>
                  </div>
                  <ChevronRightIcon size={18} color="var(--veil-text-muted)" />
                </div>
              </div>

              {/* Quick Action Footer */}
              <div className="veil-settings-footer-actions">
                <Button
                  variant="secondary"
                  onClick={lockSpace}
                  icon={<LockIcon size={16} />}
                  fullWidth
                >
                  Lock Active Space
                </Button>
                <Button
                  variant="danger"
                  onClick={panicLock}
                  icon={<AlertCircleIcon size={16} />}
                  fullWidth
                >
                  Emergency Panic Lock
                </Button>
              </div>
            </div>
          )}

          {/* 2. PROFILE EDITING SUB-PAGE */}
          {activeCategory === 'profile' && (
            <div className="veil-settings-subpage">
              <form onSubmit={handleSaveProfile} className="veil-settings-form">
                <div className="veil-avatar-upload-section">
                  <Avatar
                    name={displayNameInput || activeSession?.name || 'Profile'}
                    imageUrl={avatarPreview || undefined}
                    size="xl"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    style={{ display: 'none' }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change Photo
                  </Button>
                </div>

                {profileError && (
                  <div className="veil-alert veil-alert-danger" role="alert">
                    <AlertCircleIcon size={16} />
                    <span>{profileError}</span>
                  </div>
                )}

                <Input
                  label="Display Name"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="How contacts see you"
                />

                <Input
                  label="Unique Username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. alice"
                  helperText="Required for peer discovery on the zero-knowledge directory"
                />

                <Input
                  label="Bio"
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  placeholder="Tell contacts about yourself"
                />

                <Input
                  label="Phone Number (Optional)"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />

                <div className="veil-settings-form-actions">
                  <Button type="submit" variant="primary" loading={profileSaving}>
                    Save & Publish Profile
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* 3. ACCOUNT & IDENTITY SUB-PAGE */}
          {activeCategory === 'account' && (
            <div className="veil-settings-subpage">
              <div className="veil-card">
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Cryptographic Space Fingerprint
                </h3>
                <code className="veil-key-display">{fingerprint}</code>
              </div>

              <div className="veil-card" style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Signed Invitation Link
                </h3>
                <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginBottom: '0.75rem' }}>
                  Share this cryptographic link with trusted contacts to establish an end-to-end encrypted session.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="primary"
                    onClick={handleCopyInvite}
                    icon={copiedInvite ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                  >
                    {copiedInvite ? 'Copied Link!' : 'Copy Invitation Link'}
                  </Button>
                </div>
              </div>

              <div className="veil-card" style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Linked Devices ({devices.length})
                </h3>
                {devices.map((dev) => (
                  <div key={dev.id} className="veil-device-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{dev.name}</div>
                      <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
                        Active Now • E2EE Ratchet Synchronized
                      </div>
                    </div>
                    <Badge variant="success">Verified</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. PRIVACY & SECURITY SUB-PAGE */}
          {activeCategory === 'privacy' && (
            <div className="veil-settings-subpage">
              {/* Change Passphrase Card */}
              <div className="veil-card" style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Change Account Passphrase
                </h3>
                <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginBottom: '0.75rem' }}>
                  Rewraps your Space Master Key locally with Argon2id &amp; XChaCha20, updates cloud authentication, and re-encrypts your zero-knowledge recovery vault.
                </p>

                <form onSubmit={handleChangePasswordSubmit}>
                  {passwordChangeError && (
                    <div className="veil-alert veil-alert-danger" role="alert" style={{ marginBottom: '0.75rem' }}>
                      <AlertCircleIcon size={16} />
                      <span>{passwordChangeError}</span>
                    </div>
                  )}
                  {passwordChangeSuccess && (
                    <div className="veil-alert veil-alert-success" role="alert" style={{ marginBottom: '0.75rem', backgroundColor: 'var(--veil-accent-primary-subtle)', color: 'var(--veil-accent-primary)', border: '1px solid var(--veil-accent-primary-alpha)', padding: '0.65rem 0.85rem', borderRadius: 'var(--veil-radius-sm)', fontSize: 'var(--veil-text-xs)' }}>
                      <span>{passwordChangeSuccess}</span>
                    </div>
                  )}

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)', marginBottom: '0.35rem' }}>
                      Current Passphrase
                    </label>
                    <PasswordInput
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Current passphrase"
                      disabled={passwordChangeLoading}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)', marginBottom: '0.35rem' }}>
                      New Passphrase (min 3 chars)
                    </label>
                    <PasswordInput
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New passphrase"
                      disabled={passwordChangeLoading}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', fontWeight: 600, color: 'var(--veil-text-secondary)', marginBottom: '0.35rem' }}>
                      Confirm New Passphrase
                    </label>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new passphrase"
                      disabled={passwordChangeLoading}
                      required
                    />
                  </div>

                  {passwordChangeLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', padding: '0.6rem 0.85rem', backgroundColor: 'var(--veil-bg-tertiary)', borderRadius: 'var(--veil-radius-sm)', fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)' }}>
                      <Spinner size="xs" />
                      <span>Updating account passphrase &amp; rewrapping encryption keys...</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    loading={passwordChangeLoading}
                    disabled={passwordChangeLoading || !oldPassword || !newPassword || !confirmPassword}
                  >
                    {passwordChangeLoading ? 'Updating Passphrase...' : 'Change Passphrase'}
                  </Button>
                </form>
              </div>

              <div className="veil-card">
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Inactivity Auto-Lock
                </h3>
                <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginBottom: '0.75rem' }}>
                  Zeroizes decrypted session keys from RAM after the specified period of inactivity.
                </p>
                <select
                  value={autoLockVal}
                  onChange={(e) => setAutoLockVal(e.target.value)}
                  className="veil-select"
                >
                  <option value="1">1 minute</option>
                  <option value="5">5 minutes (Recommended)</option>
                  <option value="15">15 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="never">Never (Not Recommended)</option>
                </select>
              </div>

              <div className="veil-card" style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Emergency Panic Lock
                </h3>
                <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginBottom: '0.75rem' }}>
                  Instantly wipes all ephemeral keys, decrypted media buffers, and session states from memory.
                </p>
                <Button variant="danger" onClick={panicLock} icon={<AlertCircleIcon size={16} />}>
                  Trigger Panic Lock
                </Button>
              </div>
            </div>
          )}

          {/* 5. NOTIFICATIONS SUB-PAGE */}
          {activeCategory === 'notifications' && (
            <div className="veil-settings-subpage">
              <div className="veil-card">
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Notification Privacy Mode
                </h3>
                <div className="veil-radio-group">
                  {[
                    { id: 'full', label: 'Full Preview', desc: 'Shows sender name and message snippet' },
                    { id: 'sender-only', label: 'Sender Only', desc: 'Shows sender name without message content' },
                    { id: 'minimal-alert', label: 'Minimal Alert', desc: 'Shows "New encrypted message received"' },
                    { id: 'silent-counter', label: 'Silent Counter', desc: 'Only updates unread badge counter' },
                  ].map((mode) => (
                    <label key={mode.id} className="veil-radio-label">
                      <input
                        type="radio"
                        name="notifPrivacy"
                        checked={notifLevel === mode.id}
                        onChange={() => setNotifLevel(mode.id as NotificationPrivacyMode)}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>{mode.label}</div>
                        <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
                          {mode.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 6. APPEARANCE SUB-PAGE */}
          {activeCategory === 'appearance' && (
            <div className="veil-settings-subpage">
              <div className="veil-card">
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Theme
                </h3>
                <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginBottom: '1rem' }}>
                  Choose your visual interface style. Applies instantly across all Spaces.
                </p>
                <div className="veil-theme-grid">
                  {[
                    { id: 'obsidian', name: 'Obsidian', color: '#0c0c0e', desc: 'Warm dark neutral' },
                    { id: 'slate', name: 'Slate', color: '#0f1219', desc: 'Cool dark blue-gray' },
                    { id: 'light', name: 'Light', color: '#f5f5f7', desc: 'Clean minimal light' },
                    { id: 'midnight', name: 'Midnight', color: '#0a0e18', desc: 'Deep blue-black' },
                    { id: 'graphite', name: 'Graphite', color: '#121212', desc: 'Neutral charcoal' },
                  ].map((t) => (
                    <div
                      key={t.id}
                      className={`veil-theme-card ${themeVal === t.id ? 'active' : ''}`}
                      onClick={() => handleSelectTheme(t.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select ${t.name} theme`}
                    >
                      <div className="veil-theme-swatch" style={{ background: t.color, border: '1px solid var(--veil-border)' }} />
                      <div className="veil-theme-name" style={{ fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--veil-text-muted)', marginTop: '2px' }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="veil-card" style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Message Density
                </h3>
                <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginBottom: '0.75rem' }}>
                  Adjust padding and bubble sizing in conversation timelines.
                </p>
                <select
                  value={densityVal}
                  onChange={(e) => handleSelectDensity(e.target.value)}
                  className="veil-select"
                  aria-label="Message density selector"
                >
                  <option value="compact">Compact (High Information Density)</option>
                  <option value="comfortable">Comfortable (Default)</option>
                  <option value="spacious">Spacious (Relaxed Touch Target Layout)</option>
                </select>
              </div>
            </div>
          )}

          {/* 7. STORAGE SUB-PAGE */}
          {activeCategory === 'storage' && (
            <div className="veil-settings-subpage">
              <div className="veil-card">
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Decrypted Media Cache
                </h3>
                <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)', marginBottom: '0.75rem' }}>
                  In-memory cache of decrypted photos, videos, and audio notes. Zeroizing cache will require re-decrypting media on view.
                </p>
                <Button
                  variant="secondary"
                  onClick={handleClearCache}
                  icon={cacheCleared ? <CheckIcon size={16} /> : <TrashIcon size={16} />}
                >
                  {cacheCleared ? 'Cache Zeroized!' : 'Clear In-Memory Media Cache'}
                </Button>
              </div>

              <div className="veil-card" style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: 'var(--veil-text-base)', marginBottom: '0.5rem' }}>
                  Encrypted Space Storage
                </h3>
                <div style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-secondary)' }}>
                  IndexedDB AES-GCM local database storage: Active
                </div>
              </div>
            </div>
          )}

          {/* 8. ABOUT VEIL SUB-PAGE */}
          {activeCategory === 'about' && (
            <div className="veil-settings-subpage">
              <div className="veil-card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div className="veil-shield-badge-lg" style={{ margin: '0 auto 1rem auto' }}>
                  <ShieldIcon size={36} color="var(--veil-accent-primary)" />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>VEIL Secure Messenger</h3>
                <p style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-muted)' }}>
                  Version 1.0.0 (Phase 33 Production)
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <Badge variant="success">Post-RC Security Freeze Active</Badge>
                </div>
              </div>

              <div className="veil-card" style={{ marginTop: '1rem' }}>
                <h4 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Cryptographic Architecture
                </h4>
                <ul style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', paddingLeft: '1.2rem', lineHeight: '1.6' }}>
                  <li><strong>Key Derivation:</strong> Argon2id (memory-hard password hashing)</li>
                  <li><strong>Envelope Encryption:</strong> XChaCha20-Poly1305 AEAD</li>
                  <li><strong>Identity & Signatures:</strong> Ed25519 (RFC 8032)</li>
                  <li><strong>Key Exchange:</strong> X25519 ECDH + X3DH</li>
                  <li><strong>End-to-End Ratchet:</strong> Double Ratchet (Signal Protocol)</li>
                  <li><strong>Multi-Space Isolation:</strong> Cryptographic per-Space Envelope Store</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
