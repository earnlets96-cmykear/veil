/**
 * Telegram-Inspired Shared Media Gallery Modal for VEIL.
 *
 * Provides organized tabs (Photos & Videos, Files & Documents, Voice Notes)
 * for browsing all shared media in a conversation.
 */

import React, { useState } from 'react';
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
  const mediaMessages = messages.filter(
    (m) => m.attachment && (m.attachment.mimeType?.startsWith('image/') || m.attachment.mimeType?.startsWith('video/'))
  );

  const fileMessages = messages.filter(
    (m) =>
      m.attachment &&
      !m.attachment.mimeType?.startsWith('image/') &&
      !m.attachment.mimeType?.startsWith('video/')
  );

  const voiceMessages = messages.filter((m) => m.voice);

  const mediaViewerItems: MediaViewerItem[] = mediaMessages.map((m) => ({
    id: m.id,
    type: m.attachment.mimeType?.startsWith('video/') ? 'video' : 'image',
    url: m.attachment.previewUrl || m.attachment.url || '',
    name: m.attachment.name || 'Attachment',
    sizeBytes: m.attachment.sizeBytes,
    mimeType: m.attachment.mimeType,
    timestamp: m.timestamp,
    senderName: m.senderName,
  }));

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
    <div className="veil-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Shared media gallery">
      <div className="veil-gallery-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="veil-gallery-header">
          <div>
            <h2 className="veil-gallery-title">Shared Media</h2>
            <p className="veil-gallery-subtitle">{conversationName}</p>
          </div>
          <IconButton icon={<CloseIcon />} onClick={onClose} ariaLabel="Close gallery" variant="ghost" />
        </div>

        {/* Tab Selector */}
        <div className="veil-gallery-tabs">
          <button
            className={`veil-gallery-tab ${activeTab === 'media' ? 'veil-gallery-tab-active' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            <ImageIcon size={18} />
            <span>Photos & Videos ({mediaMessages.length})</span>
          </button>

          <button
            className={`veil-gallery-tab ${activeTab === 'files' ? 'veil-gallery-tab-active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <FileIcon size={18} />
            <span>Files ({fileMessages.length})</span>
          </button>

          <button
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
              {mediaMessages.length === 0 ? (
                <div className="veil-gallery-empty">
                  <ImageIcon size={48} color="var(--veil-text-muted)" />
                  <p>No photos or videos shared yet</p>
                </div>
              ) : (
                <div className="veil-gallery-grid">
                  {mediaMessages.map((m, idx) => {
                    const isVideo = m.attachment.mimeType?.startsWith('video/');
                    const item = mediaViewerItems[idx];
                    return (
                      <div
                        key={m.id}
                        className="veil-gallery-item"
                        onClick={() => onOpenMedia(item, mediaViewerItems)}
                        role="button"
                        tabIndex={0}
                      >
                        {m.attachment.previewUrl ? (
                          <img
                            src={m.attachment.previewUrl}
                            alt={m.attachment.name}
                            className="veil-gallery-thumb"
                            loading="lazy"
                          />
                        ) : (
                          <div className="veil-gallery-thumb-placeholder">
                            {isVideo ? <VideoIcon size={32} /> : <ImageIcon size={32} />}
                          </div>
                        )}
                        {isVideo && (
                          <div className="veil-gallery-video-badge">
                            <PlayIcon size={12} />
                          </div>
                        )}
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
              {fileMessages.length === 0 ? (
                <div className="veil-gallery-empty">
                  <FileIcon size={48} color="var(--veil-text-muted)" />
                  <p>No files or documents shared yet</p>
                </div>
              ) : (
                <div className="veil-gallery-list">
                  {fileMessages.map((m) => (
                    <div key={m.id} className="veil-gallery-file-row">
                      <div className="veil-gallery-file-icon">
                        {getFileIcon(m.attachment.mimeType, m.attachment.name)}
                      </div>
                      <div className="veil-gallery-file-info">
                        <div className="veil-gallery-file-name">{m.attachment.name}</div>
                        <div className="veil-gallery-file-meta">
                          {formatSize(m.attachment.sizeBytes)} • {formatDate(m.timestamp)}
                        </div>
                      </div>
                      <IconButton
                        icon={<DownloadIcon size={18} />}
                        onClick={() => onDownloadFile(m)}
                        ariaLabel={`Download ${m.attachment.name}`}
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
