import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '../ui/index.ts';
import { CloseIcon, KeyIcon, ArrowLeftIcon, CheckIcon } from '../icons/index.ts';
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
  const [installedPackIds, setInstalledPackIds] = useState<Set<string>>(new Set());
  const [botToken, setBotToken] = useState(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('veil:telegram:bot_token')) || '';
  });

  const previewRef = useRef<HTMLDivElement>(null);
  const featuredPacks = useMemo(() => telegramStickerService.getFeaturedPacks(), []);

  // Track installed packs to show "Installed" state
  useEffect(() => {
    if (isOpen) {
      telegramStickerService.getInstalledPacks().then((installed) => {
        setInstalledPackIds(new Set(installed.map((p) => p.id.toLowerCase())));
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isAlreadyInstalled = Boolean(previewPack && installedPackIds.has(previewPack.id.toLowerCase()));

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
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
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
      setInstalledPackIds((prev) => new Set([...prev, previewPack.id.toLowerCase()]));
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

  const modalContent = (
    <div
      className="veil-modal-backdrop"
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
      aria-labelledby="add-sticker-title"
    >
      <div
        className="veil-add-sticker-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="veil-add-sticker-header">
          {previewPack ? (
            <div className="veil-add-sticker-header-left">
              <button
                type="button"
                className="veil-add-sticker-back-btn"
                onClick={() => setPreviewPack(null)}
                title="Search another sticker pack"
                aria-label="Back to search"
              >
                <ArrowLeftIcon size={18} />
              </button>
              <div className="veil-add-sticker-header-text">
                <h3 id="add-sticker-title" className="veil-add-sticker-title" title={previewPack.title}>
                  {previewPack.title}
                </h3>
                <span className="veil-add-sticker-count-badge">
                  {previewPack.stickers.length} stickers {previewPack.stickers.length > 20 || botToken ? '\u2022 512x512 HD' : ''}
                </span>
              </div>
            </div>
          ) : (
            <div className="veil-add-sticker-header-text">
              <h3 id="add-sticker-title" className="veil-add-sticker-title">
                Add Telegram Stickers
              </h3>
              <p className="veil-add-sticker-subtitle">
                Enter any Telegram sticker set link or name (e.g. t.me/addstickers/Animals)
              </p>
            </div>
          )}
          <button
            type="button"
            className="veil-btn-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Content Body */}
        {previewPack ? (
          /* Live Full-Set Scrollable Preview */
          <div className="veil-add-sticker-preview-grid-wrap" ref={previewRef}>
            {previewPack.stickers.length <= 20 && !botToken && (
              <div style={{ padding: '8px 12px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', margin: '0 12px 10px 12px', fontSize: '0.75rem', color: '#93c5fd', lineHeight: '1.4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  Showing 20 preview stickers. Add your free Telegram Bot Token to unlock all 120+ stickers in full 512x512 High Definition.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewPack(null);
                    setShowTokenInput(true);
                  }}
                  style={{
                    background: 'rgba(59, 130, 246, 0.25)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  Connect Token
                </button>
              </div>
            )}
            <div className="veil-add-sticker-preview-grid">
              {previewPack.stickers.map((stk: StickerItem, idx: number) => (
                <div
                  key={stk.id || `stk-${idx}`}
                  className="veil-add-sticker-preview-cell"
                  title={stk.emoji || 'Sticker'}
                >
                  <img src={stk.url} alt={stk.emoji || 'Sticker'} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Search & Popular Sets Screen */
          <div className="veil-add-sticker-search-body">
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--veil-accent-primary, #14b8a6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="veil-icon">
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
                      padding: '6px 13px',
                      color: 'var(--veil-text-primary, #f1f5f9)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {fp.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Telegram Bot Token Setting */}
            <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
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
                  color: botToken ? 'var(--veil-accent-primary, #14b8a6)' : 'var(--veil-text-muted, #64748b)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <KeyIcon size={12} />
                <span>
                  {botToken
                    ? 'Telegram Bot Token Connected (120+ HD Stickers Active)'
                    : 'Telegram Bot Token (Unlock 120+ Stickers in 512x512 HD)'}
                </span>
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
                  <div style={{ fontSize: '0.7rem', color: 'var(--veil-text-muted, #64748b)', marginTop: '4px', lineHeight: '1.4' }}>
                    <p style={{ margin: '0 0 2px 0' }}>
                      Get a free token in 20 seconds: open <strong>@BotFather</strong> on Telegram &rarr; send <code>/newbot</code> &rarr; paste token.
                    </p>
                    <p style={{ margin: 0, color: 'var(--veil-text-secondary, #94a3b8)' }}>
                      Enables downloading complete 120+ sticker sets in full 512x512 High Definition without limits.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sticky Action Footer when previewing pack */}
        {previewPack && (
          <div className="veil-add-sticker-sticky-footer">
            <button
              type="button"
              className={`veil-add-sticker-install-btn ${isAlreadyInstalled ? 'installed' : ''}`}
              onClick={handleInstall}
              disabled={isLoading || isAlreadyInstalled}
            >
              {isLoading ? (
                <Spinner size="sm" />
              ) : isAlreadyInstalled ? (
                <>
                  <CheckIcon size={16} />
                  <span>Installed in VEIL</span>
                </>
              ) : (
                <span>{`+ Add ${previewPack.stickers.length} Stickers to VEIL`}</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Portal to document.body so modal is never clipped by parent drawer or containers
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
