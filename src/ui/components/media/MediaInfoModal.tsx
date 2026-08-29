/**
 * Media Information Inspector Modal for VEIL.
 *
 * Displays rich, non-sensitive forensic metadata (dimensions, duration, file size,
 * delivery receipts, timestamps, MIME format) with strict privacy invariants.
 *
 * HARD SECURITY INVARIANT:
 * - NEVER displays cryptographic master keys, Double Ratchet keys, or session tokens.
 */

import React from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import {
  FileIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  CheckIcon,
  ClockIcon,
  ShieldIcon,
} from '../icons/index.ts';
import { AttachmentPayload } from '../../utils/mediaCache.ts';

export interface MediaInfoData {
  name: string;
  mimeType: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  timestamp?: number;
  senderName?: string;
  status?: string;
  allowSave?: boolean;
  allowForward?: boolean;
}

export interface MediaInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  info: MediaInfoData | null;
}

export const MediaInfoModal: React.FC<MediaInfoModalProps> = ({
  isOpen,
  onClose,
  info,
}) => {
  if (!info) return null;

  const isVideo = info.mimeType.startsWith('video/');
  const isImage = info.mimeType.startsWith('image/');
  const isVoice = info.mimeType.startsWith('audio/');

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDuration = (sec?: number) => {
    if (!sec || isNaN(sec)) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Media Information"
      maxWidth="420px"
      footer={
        <Button variant="secondary" onClick={onClose} style={{ width: '100%' }}>
          Close
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header Preview Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            padding: '0.85rem',
            background: 'var(--veil-surface-elevated)',
            borderRadius: 'var(--veil-radius-md)',
            border: '1px solid var(--veil-border-subtle)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--veil-radius-sm)',
              background: 'var(--veil-accent-subtle)',
              color: 'var(--veil-accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isVideo ? (
              <VideoIcon size={20} />
            ) : isImage ? (
              <ImageIcon size={20} />
            ) : isVoice ? (
              <MicIcon size={20} />
            ) : (
              <FileIcon size={20} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 'var(--veil-text-sm)',
                color: 'var(--veil-text-primary)',
                wordBreak: 'break-all',
              }}
            >
              {info.name}
            </div>
            <div
              style={{
                fontSize: 'var(--veil-text-xs)',
                color: 'var(--veil-text-secondary)',
                marginTop: '2px',
              }}
            >
              {info.mimeType} • {formatBytes(info.sizeBytes)}
            </div>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {info.senderName && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--veil-text-xs)' }}>
              <span style={{ color: 'var(--veil-text-secondary)' }}>Sender</span>
              <span style={{ fontWeight: 500, color: 'var(--veil-text-primary)' }}>{info.senderName}</span>
            </div>
          )}

          {info.timestamp && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--veil-text-xs)' }}>
              <span style={{ color: 'var(--veil-text-secondary)' }}>Sent Date</span>
              <span style={{ color: 'var(--veil-text-primary)' }}>
                {new Date(info.timestamp).toLocaleString()}
              </span>
            </div>
          )}

          {formatDuration(info.durationSeconds) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--veil-text-xs)' }}>
              <span style={{ color: 'var(--veil-text-secondary)' }}>Duration</span>
              <span style={{ color: 'var(--veil-text-primary)' }}>
                {formatDuration(info.durationSeconds)}
              </span>
            </div>
          )}

          {info.width && info.height && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--veil-text-xs)' }}>
              <span style={{ color: 'var(--veil-text-secondary)' }}>Dimensions</span>
              <span style={{ color: 'var(--veil-text-primary)' }}>
                {info.width} × {info.height} px
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--veil-text-xs)' }}>
            <span style={{ color: 'var(--veil-text-secondary)' }}>Encryption</span>
            <span style={{ color: 'var(--veil-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldIcon size={12} />
              <span>XChaCha20-Poly1305 (E2EE)</span>
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--veil-text-xs)' }}>
            <span style={{ color: 'var(--veil-text-secondary)' }}>Save to Gallery</span>
            <span style={{ color: info.allowSave !== false ? 'var(--veil-text-primary)' : 'var(--veil-danger)' }}>
              {info.allowSave !== false ? 'Allowed' : 'Disabled by sender'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--veil-text-xs)' }}>
            <span style={{ color: 'var(--veil-text-secondary)' }}>Forwarding</span>
            <span style={{ color: info.allowForward !== false ? 'var(--veil-text-primary)' : 'var(--veil-danger)' }}>
              {info.allowForward !== false ? 'Allowed' : 'Disabled by sender'}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
