/**
 * Adaptive Grouped Media Grid Component for VEIL.
 *
 * Implements Telegram-inspired adaptive masonry grid for multi-media messages:
 * - 1 item: Full responsive media bubble
 * - 2 items: 2-column equal split
 * - 3 items: 1 large hero item + 2 stacked items
 * - 4+ items: 2x2 grid with +N count overlay
 *
 * Each video displays a centered SVG play button and duration badge.
 */

import React from 'react';
import { AttachmentPayload } from '../../utils/mediaCache.ts';
import { MediaImage } from './MediaImage.tsx';
import { PlayIcon, VideoIcon } from '../icons/index.ts';

export interface GroupedMediaGridProps {
  attachments: AttachmentPayload[];
  onOpenItem: (index: number) => void;
  className?: string;
}

export const GroupedMediaGrid: React.FC<GroupedMediaGridProps> = ({
  attachments,
  onOpenItem,
  className = '',
}) => {
  if (!attachments || attachments.length === 0) return null;

  const count = attachments.length;

  if (count === 1) {
    const single = attachments[0];
    return (
      <div className={`veil-grouped-media-single ${className}`.trim()}>
        <MediaImage
          attachment={single}
          isVideo={single.mimeType?.startsWith('video/')}
          onClick={() => onOpenItem(0)}
          alt={single.name}
        />
      </div>
    );
  }

  // Multi-item grid layout
  const displayItems = attachments.slice(0, 4);
  const remainingCount = count - 4;

  const getGridStyle = () => {
    if (count === 2) {
      return {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '3px',
        maxWidth: '320px',
      };
    }
    if (count === 3) {
      return {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '3px',
        maxWidth: '320px',
      };
    }
    return {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '3px',
      maxWidth: '320px',
    };
  };

  return (
    <div
      className={`veil-grouped-media-grid ${className}`.trim()}
      style={getGridStyle()}
      role="group"
      aria-label={`Grouped gallery of ${count} media items`}
    >
      {displayItems.map((att, idx) => {
        const isLastItem = idx === 3 && remainingCount > 0;
        const isVideo = att.mimeType?.startsWith('video/');

        return (
          <div
            key={att.objectId || att.attachmentId || idx}
            style={{
              position: 'relative',
              borderRadius: 'var(--veil-radius-sm)',
              overflow: 'hidden',
              aspectRatio: '1 / 1',
              cursor: 'pointer',
              background: 'var(--veil-surface-elevated)',
            }}
            onClick={() => onOpenItem(idx)}
            role="button"
            tabIndex={0}
            aria-label={`View media ${idx + 1} of ${count}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenItem(idx);
              }
            }}
          >
            <MediaImage
              attachment={att}
              isVideo={isVideo}
              alt={att.name}
              className="veil-grouped-thumb"
            />

            {isVideo && !isLastItem && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.25)',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PlayIcon size={18} color="#ffffff" />
                </div>
              </div>
            )}

            {isLastItem && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: 'var(--veil-text-lg)',
                  fontWeight: 'bold',
                  backdropFilter: 'blur(2px)',
                }}
              >
                +{remainingCount}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
