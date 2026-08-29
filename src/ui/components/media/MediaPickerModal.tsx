/**
 * In-App Media & Attachment Picker Bottom Sheet for VEIL.
 *
 * Implements Telegram-inspired bottom sheet media staging with tabs (All, Photos, Videos, Files),
 * multi-select numbered counters (①, ②, ③), quick camera/gallery triggers, and per-media privacy options.
 */

import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import {
  CloseIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  CameraIcon,
  CheckIcon,
  ShieldIcon,
  DownloadIcon,
  ShareIcon,
  TrashIcon,
} from '../icons/index.ts';

export interface MediaPickerSendOptions {
  files: File[];
  allowSave: boolean;
  allowForward: boolean;
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
  const [allowSave, setAllowSave] = useState(true);
  const [allowForward, setAllowForward] = useState(true);
  const [caption, setCaption] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = e.target.files;
    if (!incoming || incoming.length === 0) return;
    const newFiles = Array.from(incoming);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmSend = () => {
    if (selectedFiles.length === 0) return;
    onSend({
      files: selectedFiles,
      allowSave,
      allowForward,
      caption: caption.trim() || undefined,
    });
    setSelectedFiles([]);
    setCaption('');
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '0.65rem 0.25rem', height: 'auto' }}
            onClick={() => photoInputRef.current?.click()}
          >
            <ImageIcon size={22} color="var(--veil-accent-primary)" />
            <span style={{ fontSize: '0.72rem' }}>Photos</span>
          </button>

          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '0.65rem 0.25rem', height: 'auto' }}
            onClick={() => videoInputRef.current?.click()}
          >
            <VideoIcon size={22} color="var(--veil-accent-primary)" />
            <span style={{ fontSize: '0.72rem' }}>Videos</span>
          </button>

          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '0.65rem 0.25rem', height: 'auto' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileIcon size={22} color="var(--veil-accent-primary)" />
            <span style={{ fontSize: '0.72rem' }}>Files</span>
          </button>

          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '0.65rem 0.25rem', height: 'auto' }}
            onClick={() => cameraInputRef.current?.click()}
          >
            <CameraIcon size={22} color="var(--veil-accent-primary)" />
            <span style={{ fontSize: '0.72rem' }}>Camera</span>
          </button>
        </div>

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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              maxHeight: '200px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {filteredFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.6rem',
                  background: 'var(--veil-surface-elevated)',
                  borderRadius: 'var(--veil-radius-sm)',
                  border: '1px solid var(--veil-border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'var(--veil-accent-primary)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
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
                    <div style={{ fontSize: '0.65rem', color: 'var(--veil-text-secondary)' }}>
                      {formatFileSize(file.size)} • {file.type || 'file'}
                    </div>
                  </div>
                </div>

                <IconButton
                  icon={<CloseIcon size={14} />}
                  onClick={() => handleRemoveFile(idx)}
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

        {/* Privacy Options Accordion */}
        <div
          style={{
            padding: '0.75rem',
            background: 'var(--veil-surface-elevated)',
            borderRadius: 'var(--veil-radius-md)',
            border: '1px solid var(--veil-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: 'var(--veil-text-xs)',
              fontWeight: 600,
              color: 'var(--veil-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShieldIcon size={14} color="var(--veil-accent-primary)" />
            <span>Per-Media Privacy Controls</span>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--veil-text-xs)',
              color: 'var(--veil-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <span>Allow recipient to save to gallery</span>
            <input
              type="checkbox"
              checked={allowSave}
              onChange={(e) => setAllowSave(e.target.checked)}
              style={{ accentColor: 'var(--veil-accent-primary)', cursor: 'pointer' }}
            />
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--veil-text-xs)',
              color: 'var(--veil-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <span>Allow forwarding</span>
            <input
              type="checkbox"
              checked={allowForward}
              onChange={(e) => setAllowForward(e.target.checked)}
              style={{ accentColor: 'var(--veil-accent-primary)', cursor: 'pointer' }}
            />
          </label>
        </div>
      </div>
    </Modal>
  );
};
