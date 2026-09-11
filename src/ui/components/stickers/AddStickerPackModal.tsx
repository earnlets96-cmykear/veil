import React, { useState } from 'react';
import { Spinner } from '../ui/index.ts';
import { CloseIcon } from '../icons/index.ts';
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

  if (!isOpen) return null;

  const handleResolvePack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputUrl.trim();
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
      setError(err?.message || 'Could not find Telegram sticker pack');
    } finally {
      setIsLoading(false);
    }
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
        <form onSubmit={handleResolvePack} className="veil-add-sticker-form">
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
              {previewPack.stickers.slice(0, 8).map((stk: StickerItem) => (
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
              {isLoading ? <Spinner size="sm" /> : `Install "${previewPack.title}"`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
