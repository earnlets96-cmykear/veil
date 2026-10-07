/**
 * Telegram-Inspired Shared Media Gallery Modal for VEIL.
 *
 * Provides organized tabs (Photos & Videos, Files & Documents, Voice Notes)
 * for browsing all shared media in a conversation.
 */

import React, { useMemo, useState } from 'react';
import {
  CloseIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  FileTextIcon,
  FilePdfIcon,
  FileZipIcon,
  MicIcon,
  DownloadIcon,
  PlayIcon,
} from '../icons/index.ts';
import { IconButton } from '../ui/IconButton.tsx';
import { MediaViewerItem } from './MediaViewer.tsx';
import { MediaImage } from './MediaImage.tsx';
import { MediaCache } from '../../utils/mediaCache.ts';
import { getGalleryAttachmentEntries } from './galleryAttachments.ts';

export interface MediaGalleryModalProps {
  conversationName: string;
  messages: any[];
  onClose: () => void;
  onOpenMedia: (item: MediaViewerItem, allItems: MediaViewerItem[]) => void;
  onDownloadFile: (msg: any) => void;
}

export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({
  conversationName,
  messages,
  onClose,
  onOpenMedia,
  onDownloadFile,
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'voice'>('media');

  // Filter conversation messages into categories
  const galleryEntries = useMemo(() => getGalleryAttachmentEntries(messages), [messages]);
  const mediaEntries = galleryEntries.filter((entry) => entry.category === 'media');
  const fileEntries = galleryEntries.filter((entry) => entry.category === 'file');

  const voiceMessages = messages.filter((m) => m.voice);

  const getMediaViewerItems = (): MediaViewerItem[] => {
    return mediaEntries.map(({ message, attachment, attachmentIndex }) => {
      const key = attachment.objectId || attachment.attachmentId || attachment.name;
      const cached = MediaCache.get(key);
      return {
        id: Array.isArray(message.attachments) && message.attachments.length > 1 ? `${message.id}_${attachmentIndex}` : message.id,
        type: attachment.mimeType?.startsWith('video/') ? 'video' as const : 'image' as const,
        url: cached?.blobUrl || attachment.previewUrl || attachment.url || '',
        name: attachment.name || 'Attachment',
        sizeBytes: attachment.sizeBytes,
        mimeType: attachment.mimeType,
        timestamp: message.timestamp,
        senderName: message.senderName,
        attachment,
        data: cached?.data,
      };
    });
  };
  const mediaViewerItems = getMediaViewerItems();

  const getFileIcon = (mimeType?: string, name?: string) => {
    const n = (name || '').toLowerCase();
    const m = (mimeType || '').toLowerCase();
    if (m.includes('pdf') || n.endsWith('.pdf')) return <FilePdfIcon size={24} color="var(--veil-danger)" />;
    if (m.includes('zip') || m.includes('tar') || m.includes('rar') || n.endsWith('.zip')) {
      return <FileZipIcon size={24} color="var(--veil-warning)" />;
    }
    if (m.startsWith('text/') || n.endsWith('.txt') || n.endsWith('.md')) {
      return <FileTextIcon size={24} color="var(--veil-accent-secondary)" />;
    }
    return <FileIcon size={24} color="var(--veil-accent-primary)" />;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="veil-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      onTouchEnd={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Shared media gallery"
    >
      <div className="veil-gallery-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="veil-gallery-header">
          <div>
            <h2 className="veil-gallery-title">Shared Media</h2>
            <p className="veil-gallery-subtitle">{conversationName}</p>
          </div>
          <IconButton icon={<CloseIcon size={20} />} onClick={onClose} aria-label="Close gallery" variant="ghost" />
        </div>

        {/* Tab Selector */}
        <div className="veil-gallery-tabs">
          <button
            type="button"
            className={`veil-gallery-tab ${activeTab === 'media' ? 'veil-gallery-tab-active' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            <ImageIcon size={18} />
            <span>Photos & Videos ({mediaEntries.length})</span>
          </button>

          <button
            type="button"
            className={`veil-gallery-tab ${activeTab === 'files' ? 'veil-gallery-tab-active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <FileIcon size={18} />
            <span>Files ({fileEntries.length})</span>
          </button>

          <button
            type="button"
            className={`veil-gallery-tab ${activeTab === 'voice' ? 'veil-gallery-tab-active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            <MicIcon size={18} />
            <span>Voice ({voiceMessages.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="veil-gallery-body">
          {/* 1. Photos & Videos Grid */}
          {activeTab === 'media' && (
            <>
              {mediaEntries.length === 0 ? (
                <div className="veil-gallery-empty">
                  <ImageIcon size={48} color="var(--veil-text-muted)" />
                  <p>No photos or videos shared yet</p>
                </div>
              ) : (
                <div className="veil-gallery-grid">
                  {mediaEntries.map((entry, idx) => {
                    const { message, attachment } = entry;
                    const isVideo = attachment.mimeType?.startsWith('video/');
                    const item = mediaViewerItems[idx];
                    return (
                      <div
                        key={item.id}
                        className="veil-gallery-item"
                        onClick={() => onOpenMedia(item, mediaViewerItems)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenMedia(item, mediaViewerItems);
                          }
                        }}
                      >
                        <MediaImage
                          attachment={attachment}
                          isVideo={isVideo}
                          alt={attachment.name}
                          preferFullResolution
                          className="veil-gallery-thumb-custom"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* 2. Files List */}
          {activeTab === 'files' && (
            <>
              {fileEntries.length === 0 ? (
                <div className="veil-gallery-empty">
                  <FileIcon size={48} color="var(--veil-text-muted)" />
                  <p>No files or documents shared yet</p>
                </div>
              ) : (
                <div className="veil-gallery-list">
                  {fileEntries.map(({ message, attachment, attachmentIndex }) => (
                    <div key={`${message.id}_${attachmentIndex}`} className="veil-gallery-file-row">
                      <div className="veil-gallery-file-icon">
                        {getFileIcon(attachment.mimeType, attachment.name)}
                      </div>
                      <div className="veil-gallery-file-info">
                        <div className="veil-gallery-file-name">{attachment.name}</div>
                        <div className="veil-gallery-file-meta">
                          {formatSize(attachment.sizeBytes)} • {formatDate(message.timestamp)}
                        </div>
                      </div>
                      <IconButton
                        icon={<DownloadIcon size={18} />}
                        onClick={() => onDownloadFile({ ...message, attachment })}
                        aria-label={`Download ${attachment.name}`}
                        variant="secondary"
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 3. Voice Notes List */}
          {activeTab === 'voice' && (
            <>
              {voiceMessages.length === 0 ? (
                <div className="veil-gallery-empty">
                  <MicIcon size={48} color="var(--veil-text-muted)" />
                  <p>No voice notes shared yet</p>
                </div>
              ) : (
                <div className="veil-gallery-list">
                  {voiceMessages.map((m) => (
                    <div key={m.id} className="veil-gallery-voice-row">
                      <div className="veil-gallery-voice-icon">
                        <MicIcon size={20} color="var(--veil-accent-primary)" />
                      </div>
                      <div className="veil-gallery-file-info">
                        <div className="veil-gallery-file-name">
                          Voice Message ({formatDuration(m.voice.durationSeconds)})
                        </div>
                        <div className="veil-gallery-file-meta">
                          {formatDate(m.timestamp)} • {m.senderName || 'Voice note'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
