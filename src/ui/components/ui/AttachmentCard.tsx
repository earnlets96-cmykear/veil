/**
 * Reusable AttachmentCard Presentation Component for VEIL.
 *
 * Strictly handles presentation and interaction states (downloading, decrypting, completed).
 * Encapsulates zero network or cryptographic logic directly.
 */

import React from 'react';
import { Spinner } from './Spinner.tsx';
import { Progress } from './Progress.tsx';

export type AttachmentStatus = 'ready' | 'uploading' | 'downloading' | 'decrypting' | 'completed' | 'failed';

export interface AttachmentCardProps {
  name: string;
  sizeBytes?: number;
  mimeType?: string;
  status?: AttachmentStatus;
  progressPercent?: number;
  onDownload?: () => void;
  className?: string;
}

export const AttachmentCard: React.FC<AttachmentCardProps> = ({
  name,
  sizeBytes,
  mimeType,
  status = 'ready',
  progressPercent,
  onDownload,
  className = '',
}) => {
  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mime?: string) => {
    if (!mime) return '📄';
    if (mime.startsWith('image/')) return '🖼️';
    if (mime.startsWith('video/')) return '🎥';
    if (mime.startsWith('audio/')) return '🎵';
    if (mime.includes('pdf')) return '📕';
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed')) return '📦';
    return '📄';
  };

  const isBusy = status === 'uploading' || status === 'downloading' || status === 'decrypting';

  return (
    <div
      className={`veil-attachment-card ${onDownload && !isBusy ? 'veil-attachment-card-interactive' : ''} ${className}`.trim()}
      onClick={!isBusy ? onDownload : undefined}
      role={onDownload && !isBusy ? 'button' : 'region'}
      tabIndex={onDownload && !isBusy ? 0 : undefined}
      aria-label={`Attachment: ${name}`}
    >
      <div className="veil-attachment-info">
        <div className="veil-attachment-icon" aria-hidden="true">
          {getFileIcon(mimeType)}
        </div>
        <div className="veil-attachment-text">
          <div className="veil-attachment-name" title={name}>
            {name}
          </div>
          <div className="veil-attachment-meta">
            {formatSize(sizeBytes)} • {status === 'decrypting' ? 'Decrypting...' : 'End-to-End Encrypted'}
          </div>
          {progressPercent !== undefined && progressPercent > 0 && progressPercent < 100 && (
            <div style={{ marginTop: '4px' }}>
              <Progress value={progressPercent} aria-label="Transfer progress" />
            </div>
          )}
        </div>
      </div>

      <div>
        {isBusy ? (
          <Spinner size="sm" aria-label={status} />
        ) : onDownload ? (
          <button
            type="button"
            className="veil-btn veil-btn-secondary veil-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            aria-label="Download attachment"
          >
            ⬇
          </button>
        ) : null}
      </div>
    </div>
  );
};
