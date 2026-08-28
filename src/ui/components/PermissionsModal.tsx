/**
 * Permissions Explanation & Request Modal for VEIL.
 *
 * Provides a human-centered, privacy-first explanation before invoking
 * native Android/Capacitor runtime permissions, avoiding abrupt "Permission Denied" crashes.
 */

import React from 'react';
import { MicIcon, SettingsIcon, AlertCircleIcon, ShieldIcon, CloseIcon } from './icons/index.ts';
import { Button, IconButton } from './ui/index.ts';

export type PermissionType = 'microphone' | 'camera' | 'storage' | 'notifications';

export interface PermissionsModalProps {
  type: PermissionType;
  isPermanentlyDenied?: boolean;
  onAllow: () => Promise<void> | void;
  onCancel: () => void;
  onOpenSettings?: () => void;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  type,
  isPermanentlyDenied = false,
  onAllow,
  onCancel,
  onOpenSettings,
}) => {
  const getPermissionDetails = () => {
    switch (type) {
      case 'microphone':
        return {
          icon: <MicIcon size={32} color="#ffffff" />,
          title: isPermanentlyDenied ? 'Microphone Permission Disabled' : 'Microphone Access Required',
          description: isPermanentlyDenied
            ? 'Microphone access is disabled in your Android Settings. Please grant microphone permission to record encrypted voice messages.'
            : 'VEIL needs microphone access to record encrypted voice messages on this device. Audio is encrypted with single-use AEAD keys before transmission.',
          allowText: 'Allow Microphone',
        };
      case 'notifications':
        return {
          icon: <ShieldIcon size={32} color="#ffffff" />,
          title: isPermanentlyDenied ? 'Notifications Disabled' : 'Enable Encrypted Notifications',
          description: isPermanentlyDenied
            ? 'Notifications are disabled in Android Settings. Enable notifications to receive incoming encrypted messages.'
            : 'VEIL can notify you when new encrypted messages arrive without leaking message content or sender identities to the lock screen.',
          allowText: 'Enable Notifications',
        };
      default:
        return {
          icon: <ShieldIcon size={32} color="#ffffff" />,
          title: 'Permission Required',
          description: 'VEIL requires access to complete this action securely.',
          allowText: 'Grant Permission',
        };
    }
  };

  const details = getPermissionDetails();

  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings();
    } else if (typeof window !== 'undefined' && (window as any).Capacitor) {
      // In Capacitor native app, prompt user to check Android App Info settings
      alert('Please open Android Settings > Apps > VEIL > Permissions and enable Microphone.');
    } else {
      alert('Please check browser/app settings and enable permission.');
    }
    onCancel();
  };

  return (
    <div
      className="veil-modal-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-modal-title"
    >
      <div
        className="veil-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '420px', padding: '1.75rem', textAlign: 'center' }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--veil-radius-xl)',
            background: isPermanentlyDenied
              ? 'linear-gradient(135deg, var(--veil-danger) 0%, #d97706 100%)'
              : 'var(--veil-gradient-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 24px var(--veil-accent-glow-subtle)',
          }}
        >
          {isPermanentlyDenied ? <AlertCircleIcon size={32} color="#ffffff" /> : details.icon}
        </div>

        <h3
          id="perm-modal-title"
          style={{
            fontSize: 'var(--veil-text-lg)',
            fontWeight: 700,
            color: 'var(--veil-text-primary)',
            marginBottom: '0.5rem',
          }}
        >
          {details.title}
        </h3>

        <p
          style={{
            fontSize: 'var(--veil-text-sm)',
            color: 'var(--veil-text-secondary)',
            lineHeight: 1.5,
            marginBottom: '1.75rem',
          }}
        >
          {details.description}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {isPermanentlyDenied ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleOpenSettings}
              icon={<SettingsIcon size={18} />}
            >
              Open Settings
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={async () => {
                await onAllow();
              }}
              icon={<MicIcon size={18} />}
            >
              {details.allowText}
            </Button>
          )}

          <Button variant="ghost" size="md" fullWidth onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
