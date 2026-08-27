/**
 * Reusable AttachmentCard Presentation Component for VEIL.
 *
 * Strictly handles presentation and interaction states (downloading, decrypting, completed).
 * Uses crisp SVG file-type icons with zero emoji usage.
 */

import React from 'react';
import { Spinner } from './Spinner.tsx';
import { Progress } from './Progress.tsx';
import {
  FileIcon,
  FilePdfIcon,
  FileZipIcon,
  FileTextIcon,
  FileAudioIcon,
  ImageIcon,
  VideoIcon,
  DownloadIcon,
  CheckIcon,
} from '../icons/index.ts';

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

  const getFileSvg = (mime?: string, filename?: string) => {
    const m = (mime || '').toLowerCase();
    const n = (filename || '').toLowerCase();

    if (m.includes('pdf') || n.endsWith('.pdf')) {
      return <FilePdfIcon size={26} color="var(--veil-danger)" />;
    }
    if (m.includes('zip') || m.includes('tar') || m.includes('compressed') || n.endsWith('.zip') || n.endsWith('.gz')) {
      return <FileZipIcon size={26} color="var(--veil-warning)" />;
    }
    if (m.startsWith('text/') || n.endsWith('.txt') || n.endsWith('.md')) {
      return <FileTextIcon size={26} color="var(--veil-accent-secondary)" />;
    }
    if (m.startsWith('audio/') || n.endsWith('.mp3') || n.endsWith('.wav') || n.endsWith('.ogg')) {
      return <FileAudioIcon size={26} color="var(--veil-accent-primary)" />;
    }
    if (m.startsWith('image/')) {
      return <ImageIcon size={26} color="var(--veil-accent-primary)" />;
    }
    if (m.startsWith('video/')) {
      return <VideoIcon size={26} color="var(--veil-accent-primary)" />;
    }
    return <FileIcon size={26} color="var(--veil-accent-primary)" />;
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
        <div className="veil-attachment-icon-wrapper" aria-hidden="true">
          {getFileSvg(mimeType, name)}
        </div>
        <div className="veil-attachment-text">
          <div className="veil-attachment-name" title={name}>
            {name}
          </div>
          <div className="veil-attachment-meta">
            {formatSize(sizeBytes)} • {status === 'decrypting' ? 'Decrypting...' : status === 'downloading' ? 'Downloading...' : 'Encrypted File'}
          </div>
          {progressPercent !== undefined && progressPercent > 0 && progressPercent < 100 && (
            <div style={{ marginTop: '4px' }}>
              <Progress value={progressPercent} aria-label="Transfer progress" />
            </div>
          )}
        </div>
      </div>

      <div className="veil-attachment-action">
        {isBusy ? (
          <Spinner size="sm" aria-label={status} />
        ) : status === 'completed' ? (
          <div className="veil-attachment-done-badge" title="Downloaded">
            <CheckIcon size={16} color="var(--veil-success)" />
          </div>
        ) : onDownload ? (
          <button
            type="button"
            className="veil-btn veil-btn-secondary veil-btn-sm veil-attachment-dl-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            aria-label="Download attachment"
          >
            <DownloadIcon size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
};
