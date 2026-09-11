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
} from '../icons/index.ts';
import {
  type DeviceMediaItem,
  NativeDeviceMediaBridge,
} from '../../../media/NativeDeviceMediaBridge.ts';
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
  const [activeTab, setActiveTab] = useState<'all' | 'photos' | 'videos' | 'files'>('all');
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
    if (!isOpen) {
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

  const openRecent = async (types: Array<'image' | 'video'> = ['image', 'video']) => {
    if (!deviceMedia.isNative()) {
      notifyPickerLaunch();
      if (types.length === 1 && types[0] === 'image') photoInputRef.current?.click();
      else if (types.length === 1 && types[0] === 'video') videoInputRef.current?.click();
      else fileInputRef.current?.click();
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

  const filteredFiles = selectedFiles.filter((f) => {
    if (activeTab === 'photos') return f.type.startsWith('image/');
    if (activeTab === 'videos') return f.type.startsWith('video/');
    if (activeTab === 'files') return !f.type.startsWith('image/') && !f.type.startsWith('video/');
    return true;
  });

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attach Media & Files"
      maxWidth="480px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.75rem' }}>
          <span style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)' }}>
            {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'Select media to send'}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmSend}
              disabled={selectedFiles.length === 0}
            >
              {selectedFiles.length > 1 ? `Send (${selectedFiles.length})` : 'Send'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="veil-attachment-sheet">
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

        {/* Top Quick Actions Grid */}
        <div className="veil-attachment-action-grid">
          <button
            type="button"
            className="veil-attachment-action-btn"
            onClick={() => void openRecent(['image'])}
          >
            <ImageIcon size={22} color="var(--veil-accent-primary)" />
            <span>Photos</span>
          </button>

          <button
            type="button"
            className="veil-attachment-action-btn"
            onClick={() => void openRecent(['video'])}
          >
            <VideoIcon size={22} color="var(--veil-accent-primary)" />
            <span>Videos</span>
          </button>

          <button
            type="button"
            className="veil-attachment-action-btn"
            onClick={() => void openDocuments()}
          >
            <FileIcon size={22} color="var(--veil-accent-primary)" />
            <span>Files</span>
          </button>

          <button
            type="button"
            className="veil-attachment-action-btn"
            onClick={() => {
              notifyPickerLaunch();
              cameraInputRef.current?.click();
            }}
          >
            <CameraIcon size={22} color="var(--veil-accent-primary)" />
            <span>Camera</span>
          </button>
        </div>

        {/* Recent Device Media Section */}
        <section aria-label="Recent device media">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: 650, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>Recent</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--veil-text-secondary)' }}>Choose media without leaving VEIL</div>
            </div>
            <Button variant="secondary" onClick={() => void openRecent()} disabled={recentStatus === 'loading'}>
              {recentStatus === 'loading' ? 'Loading...' : 'Browse recent'}
            </Button>
          </div>
          {recentStatus === 'denied' && (
            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)' }}>
              Device media access was not granted. You can still choose a file with the actions above.
            </div>
          )}
          {recentStatus === 'error' && (
            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)' }}>
              Recent media is unavailable right now. Try again or use the file picker.
            </div>
          )}
          {recentStatus === 'ready' && recentItems.length === 0 && (
            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-secondary)' }}>No recent photos or videos found.</div>
          )}
          {recentItems.length > 0 && (
            <>
              <div className="veil-attachment-recent-grid">
                {recentItems.map((item) => {
                  const selected = stagedUris.has(item.uri);
                  const staging = stagingUris.has(item.uri);
                  return (
                    <button
                      key={item.uri}
                      type="button"
                      className={`veil-attachment-recent-item ${selected ? 'selected' : ''}`}
                      aria-label={`Attach ${item.name}`}
                      aria-pressed={selected}
                      disabled={staging}
                      onClick={() => void toggleDeviceItem(item)}
                    >
                      {item.thumbnailDataUrl ? (
                        <img src={item.thumbnailDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ display: 'grid', placeItems: 'center', height: '100%', padding: '0.35rem', fontSize: '0.66rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </span>
                      )}
                      {item.mimeType.startsWith('video/') && (
                        <span style={{ position: 'absolute', bottom: '0.2rem', left: '0.2rem', padding: '2px 4px', borderRadius: '3px', background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center' }}>
                          <PlayIcon size={8} color="#ffffff" />
                        </span>
                      )}
                      {(selected || staging) && (
                        <span className="veil-attachment-selected-overlay">
                          {staging ? '...' : <CheckIcon size={12} color="#ffffff" />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {recentCursor && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
                  <Button variant="ghost" size="sm" onClick={() => void loadMoreRecent()}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Filter Tabs */}
        {selectedFiles.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              borderBottom: '1px solid var(--veil-border-subtle)',
              paddingBottom: '0.4rem',
            }}
          >
            {(['all', 'photos', 'videos', 'files'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`veil-tab-btn ${activeTab === tab ? 'active' : ''}`}
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: 'var(--veil-text-xs)',
                  borderRadius: 'var(--veil-radius-sm)',
                  background: activeTab === tab ? 'var(--veil-accent-primary)' : 'transparent',
                  color: activeTab === tab ? '#ffffff' : 'var(--veil-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Selected Media Staging List */}
        {selectedFiles.length > 0 ? (
          <div className="veil-attachment-staging-list">
            {filteredFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="veil-attachment-staging-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'var(--veil-accent-primary)',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 'bold',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 'var(--veil-text-xs)',
                        fontWeight: 500,
                        color: 'var(--veil-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', color: 'var(--veil-text-secondary)', marginTop: '2px' }}>
                      <span className="veil-attachment-badge">
                        {getFileTypeBadge(file.type)}
                      </span>
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
        ) : (
          <div
            style={{
              padding: '1.5rem 1rem',
              textAlign: 'center',
              color: 'var(--veil-text-secondary)',
              fontSize: 'var(--veil-text-xs)',
              background: 'var(--veil-surface-elevated)',
              borderRadius: 'var(--veil-radius-md)',
              border: '1px dashed var(--veil-border-subtle)',
            }}
          >
            Tap Photos, Videos, or Files above to stage attachments
          </div>
        )}

        {/* Optional Caption */}
        {selectedFiles.length > 0 && (
          <input
            type="text"
            placeholder="Add an optional caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="veil-input"
            style={{ fontSize: 'var(--veil-text-xs)' }}
          />
        )}
      </div>
    </Modal>
  );
};
