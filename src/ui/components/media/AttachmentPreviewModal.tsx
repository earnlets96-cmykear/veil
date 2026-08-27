/**
 * Pre-send Attachment Staging & Confirmation Modal for VEIL.
 *
 * Previews staged files (thumbnails for images/videos, file cards for docs)
 * before sending to prevent accidental transmission.
 */

import React, { useState, useEffect } from 'react';
import {
  CloseIcon,
  SendIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  FilePdfIcon,
  FileZipIcon,
  TrashIcon,
} from '../icons/index.ts';
import { Button, IconButton } from '../ui/index.ts';

export interface StagedAttachment {
  file: File;
  previewUrl?: string;
  isMedia: boolean;
  isVideo: boolean;
}

export interface AttachmentPreviewModalProps {
  files: File[];
  onConfirmSend: (files: File[], caption?: string) => void;
  onCancel: () => void;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  files,
  onConfirmSend,
  onCancel,
}) => {
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const list: StagedAttachment[] = files.map((file) => {
      const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');
      const isVideo = file.type.startsWith('video/');
      let previewUrl: string | undefined;
      if (isMedia) {
        previewUrl = URL.createObjectURL(file);
      }
      return { file, previewUrl, isMedia, isVideo };
    });
    setStaged(list);

    return () => {
      list.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [files]);

  const handleRemove = (index: number) => {
    setStaged((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      const next = [...prev];
      next.splice(index, 1);
      if (next.length === 0) onCancel();
      return next;
    });
  };

  const handleSend = async () => {
    if (staged.length === 0 || isSending) return;
    setIsSending(true);
    try {
      await onConfirmSend(staged.map((s) => s.file), caption.trim() || undefined);
    } finally {
      setIsSending(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocIcon = (file: File) => {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    if (type.includes('pdf') || name.endsWith('.pdf')) return <FilePdfIcon size={28} color="var(--veil-danger)" />;
    if (type.includes('zip') || name.endsWith('.zip')) return <FileZipIcon size={28} color="var(--veil-warning)" />;
    return <FileIcon size={28} color="var(--veil-accent-primary)" />;
  };

  return (
    <div className="veil-modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-label="Attachment preview">
      <div className="veil-attachment-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="veil-preview-header">
          <h3 className="veil-preview-title">
            Send {staged.length} {staged.length === 1 ? 'Attachment' : 'Attachments'}
          </h3>
          <IconButton icon={<CloseIcon />} onClick={onCancel} ariaLabel="Cancel" variant="ghost" />
        </div>

        {/* Staged Items List */}
        <div className="veil-preview-body">
          {staged.map((item, idx) => (
            <div key={idx} className="veil-preview-item">
              {item.isMedia && item.previewUrl ? (
                <div className="veil-preview-thumb-wrapper">
                  <img src={item.previewUrl} alt={item.file.name} className="veil-preview-thumb" />
                  {item.isVideo && <div className="veil-preview-video-tag"><VideoIcon size={14} /></div>}
                </div>
              ) : (
                <div className="veil-preview-doc-icon">{getDocIcon(item.file)}</div>
              )}

              <div className="veil-preview-info">
                <div className="veil-preview-filename">{item.file.name}</div>
                <div className="veil-preview-filesize">{formatSize(item.file.size)}</div>
              </div>

              <IconButton
                icon={<TrashIcon size={18} />}
                onClick={() => handleRemove(idx)}
                ariaLabel={`Remove ${item.file.name}`}
                variant="ghost"
                size="sm"
              />
            </div>
          ))}
        </div>

        {/* Optional Caption Input */}
        <div className="veil-preview-caption-wrapper">
          <input
            type="text"
            className="veil-input"
            placeholder="Add an optional caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
          />
        </div>

        {/* Footer Actions */}
        <div className="veil-preview-footer">
          <Button variant="ghost" onClick={onCancel} disabled={isSending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSend} disabled={staged.length === 0} loading={isSending}>
            <SendIcon size={18} />
            <span>Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
