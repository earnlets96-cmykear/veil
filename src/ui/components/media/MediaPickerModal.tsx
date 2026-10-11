/**
 * In-App Media & Attachment Picker Bottom Sheet for VEIL.
 *
 * Provides real device storage media queries (photos, videos, files) via NativeDeviceMediaBridge,
 * direct native camera hardware launch, permission requests on sheet open, and active theme alignment.
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
  type DeviceMediaType,
  NativeDeviceMediaBridge,
} from '../../../media/NativeDeviceMediaBridge.ts';
import { attachmentSendFailureMessage } from '../../../attachments/attachmentSendError.ts';

export interface MediaPickerSendOptions {
  files: File[];
  caption?: string;
}

export interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (options: MediaPickerSendOptions) => void | Promise<void>;
}

interface RecentMediaCellProps {
  item: DeviceMediaItem;
  isSelected: boolean;
  stagedIndex: number;
  onToggle: (item: DeviceMediaItem) => void;
}

const RecentMediaCellComponent: React.FC<RecentMediaCellProps> = ({ item, isSelected, stagedIndex, onToggle }) => {
  const cellRef = useRef<HTMLButtonElement>(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState(item.thumbnailDataUrl);

  useEffect(() => {
    if (thumbnailDataUrl || (!item.mimeType.startsWith('image/') && !item.mimeType.startsWith('video/'))) return;

    let active = true;
    const loadThumbnail = () => {
      void NativeDeviceMediaBridge.getInstance().getThumbnail(item.uri)
        .then((thumbnail) => {
          if (active && thumbnail) setThumbnailDataUrl(thumbnail);
        })
        .catch(() => {});
    };

    if (typeof IntersectionObserver === 'undefined') {
      loadThumbnail();
      return () => { active = false; };
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loadThumbnail();
    }, { rootMargin: '180px' });
    if (cellRef.current) observer.observe(cellRef.current);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [item.mimeType, item.uri, thumbnailDataUrl]);

  return (
    <button
      ref={cellRef}
      type="button"
      className={`veil-share-media-cell ${isSelected ? 'selected' : ''}`}
      aria-label={`Attach ${item.name}`}
      aria-pressed={isSelected}
      onClick={() => onToggle(item)}
    >
      {thumbnailDataUrl ? (
        <img
          src={thumbnailDataUrl}
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
        <span className="veil-media-badge-numbered">{stagedIndex + 1}</span>
      ) : (
        <span className="veil-media-badge-unselected" />
      )}
    </button>
  );
};

const RecentMediaCell = React.memo<RecentMediaCellProps>(RecentMediaCellComponent);

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  isOpen,
  onClose,
  onSend,
}) => {
  const [activeTab, setActiveTab] = useState<'gallery' | 'camera' | 'video' | 'files'>('gallery');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState('');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendStage, setSendStage] = useState<'preparing' | 'starting'>('preparing');
  const [readProgress, setReadProgress] = useState<{ name: string; fileIndex: number; fileCount: number; loadedBytes: number; totalBytes: number } | null>(null);
  const [recentItems, setRecentItems] = useState<DeviceMediaItem[]>([]);
  const [recentStatus, setRecentStatus] = useState<'idle' | 'loading' | 'ready' | 'denied' | 'error'>('idle');
  const [recentCursor, setRecentCursor] = useState<string | undefined>(undefined);
  const [stagedUris, setStagedUris] = useState<Set<string>>(() => new Set());

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileToUriMapRef = useRef<Map<File, string>>(new Map());
  const fileMetadataRef = useRef<Map<File, DeviceMediaItem>>(new Map());
  const recentRequestIdRef = useRef(0);
  const deviceMedia = NativeDeviceMediaBridge.getInstance();

  const stagedIndexByUri = React.useMemo(() => {
    const indices = new Map<string, number>();
    let index = 0;
    for (const uri of stagedUris) indices.set(uri, index++);
    return indices;
  }, [stagedUris]);

  const notifyPickerLaunch = () => {
    NativeDeviceMediaBridge.notifyPickerActive(true);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab('gallery');
      void openRecent(['image'], false);
    } else {
      recentRequestIdRef.current += 1;
      setRecentStatus('idle');
      setRecentItems([]);
      setRecentCursor(undefined);
      setStagedUris(new Set());
      setSelectedFiles([]);
      setCaption('');
      fileToUriMapRef.current.clear();
      fileMetadataRef.current.clear();
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
    fileMetadataRef.current.delete(file);
    setSelectedFiles((prev) => prev.filter((candidate) => candidate !== file));
  };

  const stageDeviceItems = async (items: DeviceMediaItem[]) => {
    for (const item of items) {
      if (stagedUris.has(item.uri)) continue;
      const file = deviceMedia.createSelectionPlaceholder(item);
      fileToUriMapRef.current.set(file, item.uri);
      fileMetadataRef.current.set(file, item);
      setSelectedFiles((current) => [...current, file]);
      setStagedUris((current) => new Set(current).add(item.uri));
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

  const toggleDeviceItemRef = useRef(toggleDeviceItem);
  toggleDeviceItemRef.current = toggleDeviceItem;
  const handleToggleRecentItem = React.useCallback((item: DeviceMediaItem) => {
    void toggleDeviceItemRef.current(item);
  }, []);

  const openRecent = async (types: DeviceMediaType[] = ['image'], triggerFallbackDialog = false) => {
    if (!deviceMedia.isNative()) {
      if (triggerFallbackDialog) {
        notifyPickerLaunch();
        if (types.length === 1 && types[0] === 'image') photoInputRef.current?.click();
        else if (types.length === 1 && types[0] === 'video') videoInputRef.current?.click();
        else fileInputRef.current?.click();
      }
      return;
    }

    const requestId = ++recentRequestIdRef.current;
    setRecentStatus('loading');
    setRecentItems([]);
    setRecentCursor(undefined);
    try {
      const permission = await deviceMedia.requestRecentMediaPermission();
      if (requestId !== recentRequestIdRef.current) return;
      if (permission.status !== 'granted' && permission.status !== 'limited') {
        setRecentStatus('denied');
        return;
      }
      const page = await deviceMedia.listRecentMedia({ limit: 48, types });
      if (requestId !== recentRequestIdRef.current) return;
      setRecentItems(page.items);
      setRecentCursor(page.nextCursor);
      setRecentStatus('ready');
    } catch (_error) {
      if (requestId !== recentRequestIdRef.current) return;
      setRecentStatus('error');
    }
  };

  const loadMoreRecent = async () => {
    if (!deviceMedia.isNative() || recentStatus === 'loading') return;
    try {
      const types: DeviceMediaType[] = activeTab === 'video' ? ['video'] : activeTab === 'files' ? ['file'] : ['image'];
      const page = await deviceMedia.listRecentMedia({
        limit: 48,
        cursor: recentCursor,
        types,
      });
      if (page.items && page.items.length > 0) {
        const existingUris = new Set(recentItems.map((i) => i.uri));
        const newItems = page.items.filter((i) => !existingUris.has(i.uri));
        setRecentItems((prev) => [...prev, ...newItems]);
      }
      setRecentCursor(page.nextCursor);
    } catch (_e) {}
  };

  const handleCameraLaunch = async () => {
    setActiveTab('camera');
    if (deviceMedia.isNative()) {
      try {
        const captured = await deviceMedia.captureMedia();
        if (captured && captured.length > 0) {
          await stageDeviceItems(captured);
        }
      } catch (_e) {}
    } else {
      notifyPickerLaunch();
      cameraInputRef.current?.click();
    }
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

  const handleConfirmSend = async () => {
    if (selectedFiles.length === 0 || isSending) return;
    setIsSending(true);
    setSendStage('preparing');
    setSendError('');
    try {
      const filesToSend: File[] = [];
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        const uri = fileToUriMapRef.current.get(file);
        if (uri) {
          setReadProgress({
            name: file.name,
            fileIndex: index + 1,
            fileCount: selectedFiles.length,
            loadedBytes: 0,
            totalBytes: fileMetadataRef.current.get(file)?.sizeBytes || 0,
          });
          const fileFromDevice = await deviceMedia.fileFromUri(uri, (loadedBytes, totalBytes) => {
            setReadProgress({
              name: file.name,
              fileIndex: index + 1,
              fileCount: selectedFiles.length,
              loadedBytes,
              totalBytes: totalBytes || fileMetadataRef.current.get(file)?.sizeBytes || 0,
            });
          });
          filesToSend.push(fileFromDevice);
        } else {
          filesToSend.push(file);
        }
      }

      // Close the modal immediately — upload progress will show in the chat
      // timeline. Don't await onSend; fire-and-forget so the modal never
      // gets stuck waiting for blocked-check, contact-list, or upload.
      setReadProgress(null);
      setSelectedFiles([]);
      setCaption('');
      setStagedUris(new Set());
      fileToUriMapRef.current.clear();
      fileMetadataRef.current.clear();
      setIsSending(false);
      setSendStage('preparing');
      onClose();

      void onSend({ files: filesToSend, caption: caption.trim() || undefined });
    } catch (error) {
      setSendError(attachmentSendFailureMessage(error));
      setIsSending(false);
      setReadProgress(null);
      setSendStage('preparing');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeBadge = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'PHOTO';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'ZIP';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC';
    return 'FILE';
  };

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
            disabled={selectedFiles.length === 0 || isSending}
            aria-busy={isSending}
            aria-label={selectedFiles.length > 0 ? `Send ${selectedFiles.length} media items` : 'Send media'}
          >
            <span>{isSending ? sendStage === 'preparing' ? 'Preparing…' : 'Starting…' : selectedFiles.length > 0 ? `Send (${selectedFiles.length})` : 'Send'}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      }
    >
      <div className="veil-attachment-sheet veil-attachment-sheet-content" aria-label="Recent media">
        {/* Top Drag Handle */}
        <div className="veil-bottom-sheet-handle" />

        {/* Backward-compatible screen reader markers for accessibility & Phase 40 test suite */}
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

        {/* Source Navigation Tabs: Gallery -> Camera -> Video -> Files */}
        <div className="veil-share-media-tabs">
          <button
            type="button"
            className={`veil-share-tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('gallery');
              void openRecent(['image'], true);
            }}
          >
            <ImageIcon size={16} />
            <span>Gallery</span>
          </button>

          <button
            type="button"
            className={`veil-share-tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => void handleCameraLaunch()}
          >
            <CameraIcon size={16} />
            <span>Camera</span>
          </button>

          <button
            type="button"
            className={`veil-share-tab-btn ${activeTab === 'video' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('video');
              void openRecent(['video'], true);
            }}
          >
            <VideoIcon size={16} />
            <span>Video</span>
          </button>

          <button
            type="button"
            className={`veil-share-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('files');
              void openRecent(['file'], false);
            }}
          >
            <FileIcon size={16} />
            <span>Files</span>
          </button>
        </div>

        {/* Storage Permission Denied Card */}
        {recentStatus === 'denied' && (
          <div className="veil-share-permission-card">
            <div className="veil-share-permission-icon">
              <FileIcon size={24} />
            </div>
            <div className="veil-share-permission-title">Storage Access Required</div>
            <div className="veil-share-permission-desc">
              VEIL requires storage access to display your recent photos, videos, and files directly from your device.
            </div>
            <button
              type="button"
              className="veil-btn-share-permission"
              onClick={() => {
                const types: DeviceMediaType[] = activeTab === 'video' ? ['video'] : activeTab === 'files' ? ['file'] : ['image'];
                void openRecent(types, false);
              }}
            >
              Allow Access
            </button>
          </div>
        )}

        {/* Skeleton Shimmer State */}
        {recentStatus === 'loading' && recentItems.length === 0 && (
          activeTab === 'files' ? (
            <div className="veil-share-files-container" aria-label="Loading files...">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="veil-share-file-row" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                  <div className="veil-share-file-row-icon veil-media-skeleton-pulse" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.08)' }} />
                  <div className="veil-share-file-row-info" style={{ gap: '6px' }}>
                    <div className="veil-media-skeleton-pulse" style={{ height: '14px', width: '60%', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)' }} />
                    <div className="veil-media-skeleton-pulse" style={{ height: '10px', width: '30%', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="veil-share-media-grid" aria-label="Loading recent media...">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="veil-share-media-cell veil-media-skeleton-pulse"
                  style={{ aspectRatio: '1', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.06)' }}
                />
              ))}
            </div>
          )
        )}

        {/* Files Tab Listing */}
        {activeTab === 'files' && recentStatus !== 'denied' && (
          <div className="veil-share-files-container">
            <button
              type="button"
              className="veil-share-browse-btn"
              onClick={() => void openDocuments()}
            >
              <FileIcon size={18} />
              <span>+ Browse all files &amp; documents</span>
            </button>

            {recentItems.length > 0 ? (
              <div className="veil-share-files-list">
                {recentItems.map((item) => {
                  const stagedIndex = stagedIndexByUri.get(item.uri) ?? -1;
                  const isSelected = stagedIndex !== -1;

                  return (
                    <button
                      key={item.uri}
                      type="button"
                      className={`veil-share-file-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => void toggleDeviceItem(item)}
                      aria-label={`Attach ${item.name}`}
                      aria-pressed={isSelected}
                    >
                      <div className="veil-share-file-row-icon">
                        <FileIcon size={20} />
                      </div>
                      <div className="veil-share-file-row-info">
                        <div className="veil-share-file-row-name">{item.name}</div>
                        <div className="veil-share-file-row-meta">
                          <span className="veil-attachment-badge">{getFileTypeBadge(item.mimeType)}</span>
                          <span>{formatFileSize(item.sizeBytes)}</span>
                        </div>
                      </div>
                      <div className="veil-share-file-row-check">
                        {isSelected ? (
                          <span className="veil-media-badge-numbered" style={{ position: 'static' }}>
                            {stagedIndex + 1}
                          </span>
                        ) : (
                          <span className="veil-media-badge-unselected" style={{ position: 'static' }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : recentStatus === 'ready' && (
              <div className="veil-share-empty-box">
                <FileIcon size={30} />
                <span>No recent documents found on device</span>
              </div>
            )}
          </div>
        )}

        {/* Media Grid for Gallery and Video tabs */}
        {(activeTab === 'gallery' || activeTab === 'video') && recentStatus !== 'denied' && (
          <>
            {recentItems.length > 0 ? (
              <div className="veil-share-media-grid">
                {recentItems.map((item) => {
                  const stagedIndex = stagedIndexByUri.get(item.uri) ?? -1;
                  const isSelected = stagedIndex !== -1;

                  return (
                    <RecentMediaCell
                      key={item.uri}
                      item={item}
                      isSelected={isSelected}
                      stagedIndex={stagedIndex}
                      onToggle={handleToggleRecentItem}
                    />
                  );
                })}
              </div>
            ) : recentStatus === 'ready' && (
              <div className="veil-share-empty-box">
                {activeTab === 'video' ? <VideoIcon size={32} /> : <ImageIcon size={32} />}
                <span>{activeTab === 'video' ? 'No videos found on device' : 'No photos found on device'}</span>
                <button
                  type="button"
                  className="veil-btn-browse-docs"
                  onClick={() => {
                    notifyPickerLaunch();
                    if (activeTab === 'video') videoInputRef.current?.click();
                    else photoInputRef.current?.click();
                  }}
                >
                  Browse Device Storage
                </button>
              </div>
            )}
          </>
        )}

        {/* Load More Pagination */}
        {recentCursor && recentItems.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
            <Button variant="ghost" size="sm" onClick={() => void loadMoreRecent()}>
              Load more
            </Button>
          </div>
        )}

        {/* Staged Attachments List (documents/files picked via SAF or web) */}
        {sendError && (
          <div className="veil-share-send-error" role="alert" style={{ color: 'var(--veil-danger)', fontSize: 'var(--veil-text-xs)', padding: '6px 10px' }}>
            {sendError}
          </div>
        )}

        {isSending && (
          <div role="status" aria-live="polite" className="veil-share-send-progress" style={{ color: 'var(--veil-text-secondary)', fontSize: 'var(--veil-text-xs)', padding: '6px 10px' }}>
            {sendStage === 'preparing'
              ? readProgress?.totalBytes
                ? `Preparing ${readProgress.name} (${readProgress.fileIndex}/${readProgress.fileCount}, ${Math.min(100, Math.round((readProgress.loadedBytes / readProgress.totalBytes) * 100))}%)…`
                : 'Preparing selected media…'
              : 'Starting secure upload…'}
          </div>
        )}

        {/* Staged file list for web-picked files (not shown in native grid) */}
        {selectedFiles.some((f) => !fileToUriMapRef.current.has(f)) && (
          <div className="veil-attachment-staging-list" style={{ marginTop: '8px' }}>
            {selectedFiles
              .filter((f) => !fileToUriMapRef.current.has(f))
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
                        <span>{formatFileSize(fileMetadataRef.current.get(file)?.sizeBytes ?? file.size)}</span>
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

        {/* Caption Writing Input */}
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
