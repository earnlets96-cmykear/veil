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
  TrashIcon,
  KeyIcon,
  UserIcon,
  EditIcon,
  LockIcon,
  AlertCircleIcon,
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
  } = useApp();

  const [subView, setSubView] = useState<'list' | 'addAccount' | 'createSpace' | 'changePin' | 'switchPin'>('list');
  const [targetSpaceId, setTargetSpaceId] = useState<string | null>(null);

  // Add account / Create space form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [spaceName, setSpaceName] = useState('');
  const [pin, setPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const registeredSpaces = spacePinManager.listRegisteredSpaces();
  const currentSpaceMeta = activeSession ? spacePinManager.getSpaceMetadata(activeSession.spaceId) : null;
  const currentUsername = myProfile?.username || currentSpaceMeta?.canonicalUsername || 'user';
  const currentSpaceName = currentSpaceMeta?.spaceName || activeSession?.spaceName || 'Main Space';

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
    if (!name || !password || !pin) {
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
      await createSpace(name, password, currentUsername);
      if (activeSession) {
        await spacePinManager.assignPinToSpace({
          spaceId: activeSession.spaceId,
          canonicalUsername: currentUsername,
          spaceName: name,
          password,
          pin,
        });
      }
      setSubView('list');
      setSpaceName('');
      setPassword('');
      setPin('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create new Space');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSpaceId || !oldPin || !newPin) {
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
        spaceId: targetSpaceId,
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
      setError(err?.message || 'Incorrect PIN');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSpace = (spaceId: string) => {
    if (confirm('Remove this space from this device?')) {
      spacePinManager.removeSpace(spaceId);
      if (activeSession && activeSession.spaceId === spaceId) {
        closeModal();
        window.location.reload();
      }
    }
  };

  const handleSaveRename = (spaceId: string) => {
    if (editingName.trim()) {
      spacePinManager.renameSpace(spaceId, editingName.trim());
      setEditingSpaceId(null);
      setEditingName('');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
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
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          backgroundColor: 'var(--veil-bg-surface)',
          borderColor: 'var(--veil-border)',
          borderRadius: 'var(--veil-radius-xl)',
          boxShadow: 'var(--veil-elevation-3)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--veil-radius-md)',
                backgroundColor: 'var(--veil-accent-primary-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--veil-accent-primary)',
              }}
            >
              <ShieldIcon size={18} />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              Accounts &amp; Spaces
            </h2>
          </div>
          <button
            type="button"
            onClick={closeModal}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--veil-text-secondary)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '0.6rem 0.75rem',
              backgroundColor: 'var(--veil-danger-bg)',
              border: '1px solid var(--veil-danger-border)',
              borderRadius: 'var(--veil-radius-md)',
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

        {/* SUBVIEW: LIST */}
        {subView === 'list' && (
          <div>
            {/* Current Active Space */}
            <div style={{ marginBottom: '1.5rem' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--veil-text-muted)',
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                Current Space
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.9rem',
                  backgroundColor: 'var(--veil-bg-surface-elevated)',
                  border: '1px solid var(--veil-accent-primary-alpha)',
                  borderRadius: 'var(--veil-radius-lg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar name={currentSpaceName} size="md" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)' }}>
                      {currentSpaceName}
                    </div>
                    <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)' }}>
                      @{currentUsername}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--veil-radius-full)',
                    backgroundColor: 'var(--veil-accent-primary-subtle)',
                    color: 'var(--veil-accent-primary)',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  Active
                </div>
              </div>
            </div>

            {/* Other Registered Spaces */}
            <div style={{ marginBottom: '1.5rem' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--veil-text-muted)',
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                Registered Spaces on this Device
              </span>

              {registeredSpaces.length === 0 ? (
                <p style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
                  No other spaces configured with an App PIN.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {registeredSpaces.map((sp) => {
                    const isCurrent = activeSession?.spaceId === sp.spaceId;
                    return (
                      <div
                        key={sp.spaceId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem',
                          backgroundColor: 'var(--veil-bg-surface-elevated)',
                          border: '1px solid var(--veil-border)',
                          borderRadius: 'var(--veil-radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <Avatar name={sp.spaceName} size="sm" />
                          <div>
                            {editingSpaceId === sp.spaceId ? (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <input
                                  type="text"
                                  className="veil-input"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  style={{ padding: '2px 6px', fontSize: 'var(--veil-text-xs)' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveRename(sp.spaceId)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--veil-accent-primary)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <CheckIcon size={14} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)' }}>
                                {sp.spaceName}
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: 'var(--veil-text-secondary)' }}>
                              @{sp.canonicalUsername} • {sp.pinLength}-digit PIN
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => {
                                setSubView('switchPin');
                                setError(null);
                              }}
                              style={{
                                border: '1px solid var(--veil-accent-primary)',
                                backgroundColor: 'transparent',
                                color: 'var(--veil-accent-primary)',
                                padding: '3px 8px',
                                borderRadius: 'var(--veil-radius-sm)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Switch
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setTargetSpaceId(sp.spaceId);
                              setSubView('changePin');
                              setError(null);
                            }}
                            title="Change PIN"
                            style={{
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: 'var(--veil-text-secondary)',
                              cursor: 'pointer',
                              padding: '3px',
                            }}
                          >
                            <KeyIcon size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSpaceId(sp.spaceId);
                              setEditingName(sp.spaceName);
                            }}
                            title="Rename"
                            style={{
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: 'var(--veil-text-secondary)',
                              cursor: 'pointer',
                              padding: '3px',
                            }}
                          >
                            <EditIcon size={14} />
                          </button>
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSpace(sp.spaceId)}
                              title="Remove Space"
                              style={{
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: 'var(--veil-danger)',
                                cursor: 'pointer',
                                padding: '3px',
                              }}
                            >
                              <TrashIcon size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => {
                  setSubView('addAccount');
                  setError(null);
                }}
              >
                <PlusIcon size={15} />
                <span>Add Existing Account</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                fullWidth
                onClick={() => {
                  setSubView('createSpace');
                  setError(null);
                }}
              >
                <PlusIcon size={15} />
                <span>Create New Space</span>
              </Button>
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
