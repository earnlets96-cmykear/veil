/**
 * VEIL Accounts & Spaces Management Modal.
 *
 * Implements authenticated space & account administration:
 * - Displays Current Active Space with status & details.
 * - Lists other registered spaces on this device.
 * - Actions: Add Existing Account, Create New Space, Switch Space, Rename, Change PIN, Remove.
 * - Fully respects cryptographic isolation.
 */

import React, { useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { spacePinManager } from '../../privacy/pinManager.ts';
import {
  CloseIcon,
  ShieldIcon,
  PlusIcon,
  CheckIcon,
  KeyIcon,
  UserIcon,
  EditIcon,
  LockIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
} from './icons/index.ts';
import { Avatar } from './ui/Avatar.tsx';
import { Button } from './ui/Button.tsx';
import { PasswordInput } from './ui/PasswordInput.tsx';

export const AccountsAndSpacesModal: React.FC = () => {
  const {
    activeSession,
    closeModal,
    openModal,
    myProfile,
    switchSpaceWithPin,
    unlockSpace,
    createSpace,
    lockSpace,
  } = useApp();

  const [subView, setSubView] = useState<'list' | 'addAccount' | 'createSpace' | 'changePin' | 'switchPin'>('list');
  const [targetSpaceId, setTargetSpaceId] = useState<string | null>(null);

  // Add account / Create space form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [spaceName, setSpaceName] = useState('');
  const [spaceUsername, setSpaceUsername] = useState('');
  const [pin, setPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editingName, setEditingName] = useState('');

  const currentSpaceMeta = activeSession ? spacePinManager.getSpaceMetadata(activeSession.spaceId) : null;
  const currentUsername = myProfile?.username || currentSpaceMeta?.canonicalUsername || 'user';
  const currentSpaceName = currentSpaceMeta?.spaceName || 'Main Space';

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanU = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanU || !password || !pin) {
      setError('Please fill in all fields.');
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4 or 6 digits.');
      return;
    }

    const avail = await spacePinManager.isPinAvailable(pin);
    if (!avail) {
      setError('This PIN is unavailable. Please choose a different PIN.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Authenticate with backend
      await unlockSpace(password, cleanU);
      // 2. Assign unique PIN for this space
      if (activeSession) {
        await spacePinManager.assignPinToSpace({
          spaceId: activeSession.spaceId,
          canonicalUsername: cleanU,
          spaceName: spaceName.trim() || `${cleanU}'s Space`,
          password,
          pin,
        });
      }
      setSubView('list');
      setUsername('');
      setPassword('');
      setPin('');
      setSpaceName('');
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = spaceName.trim();
    const cleanU = spaceUsername.trim().toLowerCase().replace(/^@/, '');
    if (!name || !cleanU || !password || !pin) {
      setError('Please fill in all fields (name, username, password, PIN).');
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4 or 6 digits.');
      return;
    }

    const avail = await spacePinManager.isPinAvailable(pin);
    if (!avail) {
      setError('This PIN is unavailable. Please choose a different PIN.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await createSpace(name, password, cleanU, pin);
      setSubView('list');
      setSpaceName('');
      setSpaceUsername('');
      setPassword('');
      setPin('');
      setSuccessMsg(`Space "${name}" created with its own PIN. Switch to it anytime using that PIN.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create new Space');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentSpaceId = targetSpaceId || activeSession?.spaceId;
    if (!currentSpaceId || !oldPin || !newPin) {
      setError('Please enter both current and new PIN.');
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      setError('New PIN must be 4 or 6 digits.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await spacePinManager.changePin({
        spaceId: currentSpaceId,
        oldPin,
        newPin,
      });
      setSubView('list');
      setOldPin('');
      setNewPin('');
      setTargetSpaceId(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to change PIN');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await switchSpaceWithPin(pin);
      closeModal();
    } catch (err: any) {
      setError(err?.message || 'Incorrect PIN or space not found');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveRename = () => {
    if (activeSession && editingName.trim()) {
      spacePinManager.renameSpace(activeSession.spaceId, editingName.trim());
      setIsRenaming(false);
      setEditingName('');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className="veil-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '1.5rem',
          backgroundColor: 'var(--veil-bg-base)',
          border: '1px solid var(--veil-border)',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
          }}
        >
          <button
            type="button"
            onClick={closeModal}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--veil-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
          >
            <ArrowLeftIcon size={18} />
          </button>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--veil-text-primary)' }}>
            Accounts &amp; Spaces
          </h2>
          <div style={{ width: '24px' }} />
        </div>

        {error && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: 'var(--veil-danger-bg)',
              border: '1px solid var(--veil-danger-border)',
              borderRadius: '12px',
              color: 'var(--veil-danger)',
              fontSize: 'var(--veil-text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginBottom: '1.25rem',
            }}
          >
            <AlertCircleIcon size={14} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              color: 'var(--veil-accent)',
              fontSize: 'var(--veil-text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginBottom: '1.25rem',
            }}
          >
            <ShieldIcon size={14} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* SUBVIEW: LIST (ZERO SPACE ENUMERATION) */}
        {subView === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Current Active Space */}
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--veil-text-muted)',
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                Current Active Space
              </span>
              <div
                style={{
                  padding: '1.1rem',
                  backgroundColor: 'var(--veil-bg-surface)',
                  border: '1px solid var(--veil-border)',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                    <Avatar name={currentSpaceName} size="md" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isRenaming ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="text"
                            className="veil-input"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            placeholder="Space Name"
                            autoFocus
                            style={{ padding: '3px 8px', fontSize: 'var(--veil-text-xs)', width: '130px' }}
                          />
                          <button
                            type="button"
                            onClick={handleSaveRename}
                            title="Save"
                            style={{ background: 'none', border: 'none', color: 'var(--veil-accent-primary)', cursor: 'pointer', padding: '2px' }}
                          >
                            <CheckIcon size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setIsRenaming(false); setEditingName(''); }}
                            title="Cancel"
                            style={{ background: 'none', border: 'none', color: 'var(--veil-text-muted)', cursor: 'pointer', padding: '2px' }}
                          >
                            <CloseIcon size={14} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {currentSpaceName}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setIsRenaming(true); setEditingName(currentSpaceName); }}
                            title="Rename Space"
                            style={{ background: 'none', border: 'none', color: 'var(--veil-text-muted)', cursor: 'pointer', padding: '2px' }}
                          >
                            <EditIcon size={13} />
                          </button>
                        </div>
                      )}
                      <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentUsername.includes('@') ? currentUsername : `${currentUsername}@veil.space`}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '3px 10px',
                      borderRadius: '20px',
                      backgroundColor: 'rgba(20, 184, 166, 0.15)',
                      color: 'var(--veil-accent-primary)',
                      border: '1px solid rgba(20, 184, 166, 0.3)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}
                  >
                    ACTIVE
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--veil-border-subtle)', paddingTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetSpaceId(activeSession?.spaceId || null);
                      setSubView('changePin');
                      setError(null);
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--veil-border)',
                      color: 'var(--veil-text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <KeyIcon size={13} />
                    <span>Change PIN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      lockSpace();
                      closeModal();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: 'var(--veil-danger)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <LockIcon size={13} />
                    <span>Lock Space</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy-Preserving Space Actions (No List of Spaces) */}
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--veil-text-muted)',
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                Space Actions
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPin('');
                    setSubView('switchPin');
                    setError(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    padding: '0.9rem 1rem',
                    borderRadius: '16px',
                    backgroundColor: 'var(--veil-bg-surface)',
                    border: '1px solid var(--veil-border)',
                    color: 'var(--veil-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: '0.15s',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(20, 184, 166, 0.12)',
                      color: 'var(--veil-accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <KeyIcon size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
                      Switch Space
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--veil-text-secondary)', marginTop: '2px' }}>
                      Enter PIN to unlock any registered space directly
                    </div>
                  </div>
                  <ChevronRightIcon size={16} color="var(--veil-text-muted)" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubView('createSpace');
                    setError(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    padding: '0.9rem 1rem',
                    borderRadius: '16px',
                    backgroundColor: 'var(--veil-bg-surface)',
                    border: '1px solid var(--veil-border)',
                    color: 'var(--veil-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: '0.15s',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(20, 184, 166, 0.12)',
                      color: 'var(--veil-accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <PlusIcon size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
                      Create New Space
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--veil-text-secondary)', marginTop: '2px' }}>
                      Isolated cryptographic space with dedicated PIN
                    </div>
                  </div>
                  <ChevronRightIcon size={16} color="var(--veil-text-muted)" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubView('addAccount');
                    setError(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    padding: '0.9rem 1rem',
                    borderRadius: '16px',
                    backgroundColor: 'var(--veil-bg-surface)',
                    border: '1px solid var(--veil-border)',
                    color: 'var(--veil-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: '0.15s',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(20, 184, 166, 0.12)',
                      color: 'var(--veil-accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <UserIcon size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
                      Add Existing Account
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--veil-text-secondary)', marginTop: '2px' }}>
                      Authenticate and isolate another account on this device
                    </div>
                  </div>
                  <ChevronRightIcon size={16} color="var(--veil-text-muted)" />
                </button>
              </div>
            </div>

            {/* Bottom Info Card: Plausible Deniability */}
            <div
              style={{
                backgroundColor: 'var(--veil-bg-surface)',
                border: '1px solid var(--veil-border)',
                borderRadius: '16px',
                padding: '1rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <ShieldIcon size={24} color="var(--veil-accent-primary)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 700, color: 'var(--veil-text-primary)' }}>
                  Zero Space Enumeration
                </div>
                <div style={{ fontSize: '11px', color: 'var(--veil-text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                  VEIL never lists inactive or decoy spaces. Provide the secret PIN to switch directly into any space.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBVIEW: ADD EXISTING ACCOUNT */}
        {subView === 'addAccount' && (
          <form onSubmit={handleAddAccount}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '1rem' }}>
              Authenticate Existing Account
            </h3>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', marginBottom: '0.35rem' }}>
                Username
              </label>
              <input
                type="text"
                className="veil-input"
                placeholder="e.g. bob"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', marginBottom: '0.35rem' }}>
                Account Password
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', marginBottom: '0.35rem' }}>
                Space Name
              </label>
              <input
                type="text"
                className="veil-input"
                placeholder="e.g. Work"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', marginBottom: '0.35rem' }}>
                Choose a Unique App PIN (4 or 6 digits)
              </label>
              <input
                type="password"
                maxLength={6}
                className="veil-input"
                placeholder="Unique PIN for this space"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
                Authenticate &amp; Save
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSubView('list')}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* SUBVIEW: CREATE NEW SPACE */}
        {subView === 'createSpace' && (
          <form onSubmit={handleCreateSpace}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '1rem' }}>
              Create New Isolated Space
            </h3>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', marginBottom: '0.35rem' }}>
                Space Name
              </label>
              <input
                type="text"
                className="veil-input"
                placeholder="e.g. Private Space, Whistleblowing"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', marginBottom: '0.35rem' }}>
                Account Username (@username)
              </label>
              <input
                type="text"
                className="veil-input"
                placeholder="e.g. alice_ops"
                value={spaceUsername}
                onChange={(e) => setSpaceUsername(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', marginBottom: '0.35rem' }}>
                Space Password / Encryption Key
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', marginBottom: '0.35rem' }}>
                Assign Unique App PIN (4 or 6 digits)
              </label>
              <input
                type="password"
                maxLength={6}
                className="veil-input"
                placeholder="PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
                Create Space
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSubView('list')}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* SUBVIEW: CHANGE PIN */}
        {subView === 'changePin' && (
          <form onSubmit={handleChangePin}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '1rem' }}>
              Change Space PIN
            </h3>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', marginBottom: '0.35rem' }}>
                Current PIN
              </label>
              <input
                type="password"
                maxLength={6}
                className="veil-input"
                placeholder="Enter current PIN"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: 'var(--veil-text-xs)', marginBottom: '0.35rem' }}>
                New PIN (4 or 6 digits)
              </label>
              <input
                type="password"
                maxLength={6}
                className="veil-input"
                placeholder="Enter new unique PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
                Save New PIN
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSubView('list')}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* SUBVIEW: SWITCH SPACE VIA PIN */}
        {subView === 'switchPin' && (
          <form onSubmit={handleSwitchPinSubmit}>
            <h3 style={{ fontSize: 'var(--veil-text-sm)', fontWeight: 600, marginBottom: '1rem' }}>
              Switch Space
            </h3>
            <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)', marginBottom: '1rem' }}>
              Enter the App PIN of the space you wish to switch to:
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <input
                type="password"
                maxLength={6}
                className="veil-input"
                placeholder="Enter destination PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
                Unlock &amp; Switch
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSubView('list')}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
