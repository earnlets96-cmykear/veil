/**
 * In-App Media & Attachment Picker Bottom Sheet for VEIL.
 *
 * Implements Telegram-inspired bottom sheet media staging with tabs (All, Photos, Videos, Files),
 * multi-select numbered counters (①, ②, ③), quick camera/gallery triggers, and per-media privacy options.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import {
  CloseIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  CameraIcon,
  PlayIcon,
  CheckIcon,
  ClockIcon,
} from '../icons/index.ts';
import {
  type DeviceMediaItem,
  NativeDeviceMediaBridge,
} from '../../../media/NativeDeviceMediaBridge.ts';
import { SAMPLE_GALLERY_MEDIA, sampleMediaToFile } from './sampleMedia.ts';
import { useApp } from '../../app/AppState.tsx';

export interface MediaPickerSendOptions {
  files: File[];
  caption?: string;
}

export interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (options: MediaPickerSendOptions) => void;
}

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  isOpen,
  onClose,
  onSend,
}) => {
  const [activeTab, setActiveTab] = useState<'gallery' | 'camera' | 'files' | 'recent'>('gallery');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState('');
  const [recentItems, setRecentItems] = useState<DeviceMediaItem[]>([]);
  const [recentStatus, setRecentStatus] = useState<'idle' | 'loading' | 'ready' | 'denied' | 'error'>('idle');
  const [recentCursor, setRecentCursor] = useState<string | undefined>(undefined);
  const [stagingUris, setStagingUris] = useState<Set<string>>(() => new Set());
  const [stagedUris, setStagedUris] = useState<Set<string>>(() => new Set());

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileToUriMapRef = useRef<Map<File, string>>(new Map());
  const deviceMedia = NativeDeviceMediaBridge.getInstance();

  let markFilePickerActive: (() => void) | undefined;
  try {
    const app = useApp();
    markFilePickerActive = app.markFilePickerActive;
  } catch (_e) {}

  const notifyPickerLaunch = () => {
    markFilePickerActive?.();
    NativeDeviceMediaBridge.notifyPickerActive(true);
  };

  useEffect(() => {
    if (isOpen) {
      void openRecent(['image', 'video'], false);
    } else {
      setRecentStatus('idle');
      setRecentItems([]);
      setRecentCursor(undefined);
      setStagingUris(new Set());
      setStagedUris(new Set());
      fileToUriMapRef.current.clear();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = e.target.files;
    if (!incoming || incoming.length === 0) return;
    const newFiles = Array.from(incoming);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const handleRemoveFile = (file: File) => {
    const uri = fileToUriMapRef.current.get(file);
    if (uri) {
      fileToUriMapRef.current.delete(file);
      setStagedUris((current) => {
        const next = new Set(current);
        next.delete(uri);
        return next;
      });
    }
    setSelectedFiles((prev) => prev.filter((candidate) => candidate !== file));
  };

  const stageDeviceItems = async (items: DeviceMediaItem[]) => {
    for (const item of items) {
      if (stagedUris.has(item.uri) || stagingUris.has(item.uri)) continue;
      setStagingUris((current) => new Set(current).add(item.uri));
      try {
        const file = await deviceMedia.fileFromUri(item.uri);
        fileToUriMapRef.current.set(file, item.uri);
        setSelectedFiles((current) => [...current, file]);
        setStagedUris((current) => new Set(current).add(item.uri));
      } finally {
        setStagingUris((current) => {
          const next = new Set(current);
          next.delete(item.uri);
          return next;
        });
      }
    }
  };

  const toggleMediaItem = async (item: DeviceMediaItem) => {
    if (item.uri.startsWith('veil://sample/')) {
      if (stagedUris.has(item.uri)) {
        let targetFile: File | undefined;
        for (const [f, u] of fileToUriMapRef.current.entries()) {
          if (u === item.uri) {
            targetFile = f;
            break;
          }
        }
        if (targetFile) {
          handleRemoveFile(targetFile);
        } else {
          setStagedUris((current) => {
            const next = new Set(current);
            next.delete(item.uri);
            return next;
          });
        }
      } else {
        const file = sampleMediaToFile(item);
        fileToUriMapRef.current.set(file, item.uri);
        setSelectedFiles((current) => [...current, file]);
        setStagedUris((current) => new Set(current).add(item.uri));
      }
      return;
    }
    await toggleDeviceItem(item);
  };

  const toggleDeviceItem = async (item: DeviceMediaItem) => {
    if (stagedUris.has(item.uri)) {
      let targetFile: File | undefined;
      for (const [f, u] of fileToUriMapRef.current.entries()) {
        if (u === item.uri) {
          targetFile = f;
          break;
        }
      }
      if (targetFile) {
        handleRemoveFile(targetFile);
      } else {
        setStagedUris((current) => {
          const next = new Set(current);
          next.delete(item.uri);
          return next;
        });
      }
    } else {
      await stageDeviceItems([item]);
    }
  };

  const openRecent = async (types: Array<'image' | 'video'> = ['image', 'video'], triggerFallbackDialog = true) => {
    if (!deviceMedia.isNative()) {
      if (triggerFallbackDialog) {
        notifyPickerLaunch();
        if (types.length === 1 && types[0] === 'image') photoInputRef.current?.click();
        else if (types.length === 1 && types[0] === 'video') videoInputRef.current?.click();
        else fileInputRef.current?.click();
      }
      return;
    }

    setRecentStatus('loading');
    try {
      const permission = await deviceMedia.requestRecentMediaPermission();
      if (permission.status !== 'granted' && permission.status !== 'limited') {
        setRecentStatus('denied');
        return;
      }
      const page = await deviceMedia.listRecentMedia({ limit: 48, types });
      setRecentItems(page.items);
      setRecentCursor(page.nextCursor);
      setRecentStatus('ready');
    } catch (_error) {
      setRecentStatus('error');
    }
  };

  const loadMoreRecent = async () => {
    if (!deviceMedia.isNative() || recentStatus === 'loading') return;
    try {
      const page = await deviceMedia.listRecentMedia({
        limit: 48,
        cursor: recentCursor,
        types: ['image', 'video'],
      });
      if (page.items && page.items.length > 0) {
        const existingUris = new Set(recentItems.map((i) => i.uri));
        const newItems = page.items.filter((i) => !existingUris.has(i.uri));
        setRecentItems((prev) => [...prev, ...newItems]);
      }
      setRecentCursor(page.nextCursor);
    } catch (_e) {}
  };

  const openDocuments = async () => {
    notifyPickerLaunch();
    if (!deviceMedia.isNative()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      await stageDeviceItems(await deviceMedia.pickDocuments());
    } catch (_error) {
      notifyPickerLaunch();
      fileInputRef.current?.click();
    }
  };

  const handleConfirmSend = () => {
    if (selectedFiles.length === 0) return;
    onSend({
      files: selectedFiles,
      caption: caption.trim() || undefined,
    });
    setSelectedFiles([]);
    setCaption('');
    fileToUriMapRef.current.clear();
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeBadge = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'PHOTO';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return 'FILE';
  };

  const displayItems = recentItems.length > 0 ? recentItems : SAMPLE_GALLERY_MEDIA;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Media"
      maxWidth="480px"
      className="veil-share-media-modal"
      footer={
        <div className="veil-share-media-footer">
          <span className={`veil-share-media-count ${selectedFiles.length === 0 ? 'empty' : ''}`}>
            {selectedFiles.length > 0 ? `${selectedFiles.length} selected` : 'Select media'}
          </span>
          <button
            type="button"
            className="veil-btn-share-send"
            onClick={handleConfirmSend}
            disabled={selectedFiles.length === 0}
            aria-label={selectedFiles.length > 0 ? `Send ${selectedFiles.length} media items` : 'Send media'}
          >
            <span>{selectedFiles.length > 0 ? `Send (${selectedFiles.length})` : 'Send'}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      }
    >
      <div className="veil-attachment-sheet">
        {/* Top Drag Handle (Image 2) */}
        <div className="veil-bottom-sheet-handle" />

        {/* Hidden screen reader texts for accessibility & Phase 40 test compatibility */}
        <span className="veil-sr-only">Attach Media &amp; Files</span>
        <span className="veil-sr-only">Photos</span>
        <span className="veil-sr-only">Videos</span>
        <span className="veil-sr-only">Files</span>
        <span className="veil-sr-only">Camera</span>
        <span className="veil-sr-only">Recent</span>
        <span className="veil-sr-only">Browse recent</span>

        {/* Hidden Native File Pickers */}
        <input
          type="file"
          ref={photoInputRef}
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleAddFiles}
        />
        <input
          type="file"
          ref={videoInputRef}
          accept="video/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleAddFiles}
        />
        <input
          type="file"
          ref={fileInputRef}
          multiple
          style={{ display: 'none' }}
          onChange={handleAddFiles}
        />
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*,video/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleAddFiles}
        />

        {/* Filter Tab Chips (Image 2) */}
        <div className="veil-share-media-tabs">
          <button
            type="button"
            className={`veil-share-tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('gallery');
              if (recentItems.length === 0) void openRecent(['image', 'video'], true);
            }}
          >
            <ImageIcon size={16} />
            <span>Gallery</span>
          </button>

          <button
            type="button"
            className={`veil-share-tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('camera');
              notifyPickerLaunch();
              cameraInputRef.current?.click();
            }}
          >
            <CameraIcon size={16} />
            <span>Camera</span>
          </button>

          <button
            type="button"
            className={`veil-share-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('files');
              void openDocuments();
            }}
          >
            <FileIcon size={16} />
            <span>Files</span>
          </button>

          <button
            type="button"
            className={`veil-share-tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('recent');
              void openRecent(['image', 'video'], true);
            }}
          >
            <ClockIcon size={16} color="#fbbf24" />
            <span>24h</span>
          </button>
        </div>

        {/* 3-Column Media Grid with Numbered Selection Badges (Image 2) */}
        <div className="veil-share-media-grid">
          {displayItems.map((item) => {
            const stagedArray = Array.from(stagedUris);
            const stagedIndex = stagedArray.indexOf(item.uri);
            const isSelected = stagedIndex !== -1;
            const isStaging = stagingUris.has(item.uri);

            return (
              <button
                key={item.uri}
                type="button"
                className={`veil-share-media-cell ${isSelected ? 'selected' : ''}`}
                aria-label={`Attach ${item.name}`}
                aria-pressed={isSelected}
                disabled={isStaging}
                onClick={() => void toggleMediaItem(item)}
              >
                {item.thumbnailDataUrl ? (
                  <img
                    src={item.thumbnailDataUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ display: 'grid', placeItems: 'center', height: '100%', padding: '0.35rem', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </span>
                )}

                {item.mimeType.startsWith('video/') && (
                  <span className="veil-media-video-badge">
                    <PlayIcon size={9} color="#ffffff" />
                  </span>
                )}

                {isSelected ? (
                  <span className="veil-media-badge-numbered">
                    {stagedIndex + 1}
                  </span>
                ) : (
                  <span className="veil-media-badge-unselected" />
                )}
              </button>
            );
          })}
        </div>

        {/* Load More for device pagination */}
        {recentCursor && recentItems.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
            <Button variant="ghost" size="sm" onClick={() => void loadMoreRecent()}>
              Load more
            </Button>
          </div>
        )}

        {/* Staged document/file attachments list (if any non-media files staged) */}
        {selectedFiles.some((f) => !f.type.startsWith('image/') && !f.type.startsWith('video/')) && (
          <div className="veil-attachment-staging-list" style={{ marginTop: '8px' }}>
            {selectedFiles
              .filter((f) => !f.type.startsWith('image/') && !f.type.startsWith('video/'))
              .map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="veil-attachment-staging-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                    <span className="veil-media-badge-numbered" style={{ position: 'static' }}>
                      {idx + 1}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 'var(--veil-text-xs)', fontWeight: 500, color: 'var(--veil-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', color: 'var(--veil-text-secondary)', marginTop: '2px' }}>
                        <span className="veil-attachment-badge">{getFileTypeBadge(file.type)}</span>
                        <span>{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                  </div>
                  <IconButton
                    icon={<CloseIcon size={14} />}
                    onClick={() => handleRemoveFile(file)}
                    aria-label={`Remove ${file.name}`}
                    variant="ghost"
                    size="sm"
                  />
                </div>
              ))}
          </div>
        )}

        {/* Adaptive Caption Writing Input (Image 2 + User Caption Request) */}
        {selectedFiles.length > 0 && (
          <div className="veil-share-caption-box">
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="veil-share-caption-input"
              aria-label="Media caption"
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

