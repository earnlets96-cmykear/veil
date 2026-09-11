import React, { useState, useMemo } from 'react';
import { Spinner } from '../ui/index.ts';
import { CloseIcon, KeyIcon } from '../icons/index.ts';
import { telegramStickerService, StickerPack, StickerItem } from '../../../media/telegramStickerService.ts';

export interface AddStickerPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPackInstalled: (pack: StickerPack) => void;
}

export const AddStickerPackModal: React.FC<AddStickerPackModalProps> = ({
  isOpen,
  onClose,
  onPackInstalled,
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewPack, setPreviewPack] = useState<StickerPack | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [botToken, setBotToken] = useState(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('veil:telegram:bot_token')) || '';
  });

  const featuredPacks = useMemo(() => telegramStickerService.getFeaturedPacks(), []);

  if (!isOpen) return null;

  const handleResolvePack = async (packInput?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = (packInput || inputUrl).trim();
    if (!clean) {
      setError('Please enter a Telegram sticker pack link or name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const pack = await telegramStickerService.fetchTelegramPack(clean);
      setPreviewPack(pack);
    } catch (err: any) {
      setError(err?.message || 'Could not find Telegram sticker pack. Verify the pack link or name.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFeatured = (packName: string) => {
    setInputUrl(packName);
    handleResolvePack(packName);
  };

  const handleInstall = async () => {
    if (!previewPack) return;
    setIsLoading(true);
    try {
      await telegramStickerService.installStickerPack(previewPack);
      onPackInstalled(previewPack);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to install sticker pack');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToken = (val: string) => {
    setBotToken(val);
    try {
      if (typeof window !== 'undefined') {
        if (val.trim()) {
          localStorage.setItem('veil:telegram:bot_token', val.trim());
        } else {
          localStorage.removeItem('veil:telegram:bot_token');
        }
      }
    } catch {}
  };

  return (
    <div
      className="veil-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-sticker-title"
    >
      <div
        className="veil-add-sticker-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="veil-add-sticker-header">
          <div className="veil-add-sticker-header-text">
            <h3 id="add-sticker-title" className="veil-add-sticker-title">
              Add Telegram Stickers
            </h3>
            <p className="veil-add-sticker-subtitle">
              Paste any Telegram sticker link (e.g. t.me/addstickers/Animals)
            </p>
          </div>
          <button
            type="button"
            className="veil-btn-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={(e) => handleResolvePack(undefined, e)} className="veil-add-sticker-form">
          <div className="veil-add-sticker-input-row">
            <input
              type="text"
              className="veil-add-sticker-input"
              placeholder="t.me/addstickers/... or pack name"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              aria-label="Telegram sticker link"
            />
            <button
              type="submit"
              className="veil-add-sticker-resolve-btn"
              disabled={isLoading || !inputUrl.trim()}
            >
              {isLoading ? <Spinner size="sm" /> : 'Find'}
            </button>
          </div>

          {error && <div className="veil-add-sticker-error">{error}</div>}
        </form>

        {/* Featured 1-Tap Popular Packs */}
        <div className="veil-add-sticker-featured">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--veil-accent-primary, #6366f1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="veil-icon">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--veil-text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Popular Telegram Packs
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {featuredPacks.map((fp) => (
              <button
                key={fp.id}
                type="button"
                className={`veil-sticker-pack-chip ${inputUrl.toLowerCase() === fp.name.toLowerCase() ? 'active' : ''}`}
                onClick={() => handleSelectFeatured(fp.name)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '5px 12px',
                  color: 'var(--veil-text-primary, #f1f5f9)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {fp.title}
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        {previewPack && (
          <div className="veil-add-sticker-preview">
            <div className="veil-add-sticker-preview-header">
              <span className="veil-add-sticker-preview-title">{previewPack.title}</span>
              <span className="veil-add-sticker-preview-count">
                {previewPack.stickers.length} stickers
              </span>
            </div>
            <div className="veil-add-sticker-preview-grid">
              {previewPack.stickers.slice(0, 12).map((stk: StickerItem) => (
                <div key={stk.id} className="veil-add-sticker-preview-cell">
                  <img src={stk.url} alt={stk.emoji} loading="lazy" />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="veil-add-sticker-install-btn"
              onClick={handleInstall}
              disabled={isLoading}
            >
              {isLoading ? <Spinner size="sm" /> : `Install "${previewPack.title}" (${previewPack.stickers.length} stickers)`}
            </button>
          </div>
        )}

        {/* Optional Telegram Bot Token Setting */}
        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
          <button
            type="button"
            onClick={() => setShowTokenInput(!showTokenInput)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--veil-text-muted, #64748b)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            <KeyIcon size={12} />
            <span>Telegram Bot Token (Optional for private packs)</span>
          </button>
          {showTokenInput && (
            <div style={{ marginTop: '8px' }}>
              <input
                type="password"
                className="veil-add-sticker-input"
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                value={botToken}
                onChange={(e) => handleSaveToken(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                aria-label="Telegram Bot Token"
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--veil-text-muted, #64748b)', display: 'block', marginTop: '4px' }}>
                Stored locally on this device only. Allows unrestricted pack downloading directly from Telegram API.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
