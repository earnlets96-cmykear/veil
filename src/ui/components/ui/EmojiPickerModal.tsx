/**
 * Full Emoji Picker Modal for VEIL.
 *
 * A categorized scrollable grid of ~120 common emojis that opens from
 * the reaction bar expand button in the context menu.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { CloseIcon, SearchIcon } from '../icons/index.ts';

export interface EmojiPickerModalProps {
  isOpen: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Smileys',
    icon: '\u{1F600}',
    emojis: [
      '\u{1F600}', '\u{1F603}', '\u{1F604}', '\u{1F601}', '\u{1F606}', '\u{1F605}', '\u{1F602}', '\u{1F923}',
      '\u{1F60A}', '\u{1F607}', '\u{1F609}', '\u{1F60D}', '\u{1F929}', '\u{1F618}', '\u{1F617}', '\u{1F61A}',
      '\u{1F60B}', '\u{1F61C}', '\u{1F61D}', '\u{1F911}', '\u{1F917}', '\u{1F914}', '\u{1F910}', '\u{1F928}',
      '\u{1F610}', '\u{1F611}', '\u{1F636}', '\u{1F60F}', '\u{1F612}', '\u{1F644}', '\u{1F62C}', '\u{1F925}',
      '\u{1F60C}', '\u{1F614}', '\u{1F62A}', '\u{1F924}', '\u{1F634}', '\u{1F637}', '\u{1F912}', '\u{1F915}',
      '\u{1F922}', '\u{1F92E}', '\u{1F927}', '\u{1F975}', '\u{1F976}', '\u{1F974}', '\u{1F635}', '\u{1F92F}',
    ],
  },
  {
    name: 'Emotions',
    icon: '\u{1F62D}',
    emojis: [
      '\u{1F633}', '\u{1F61E}', '\u{1F61F}', '\u{1F620}', '\u{1F621}', '\u{1F624}', '\u{1F622}', '\u{1F62D}',
      '\u{1F626}', '\u{1F627}', '\u{1F628}', '\u{1F629}', '\u{1F62B}', '\u{1F631}', '\u{1F630}', '\u{1F616}',
      '\u{1F623}', '\u{1F625}', '\u{1F613}', '\u{1F62E}', '\u{1F632}', '\u{1F971}', '\u{1F973}', '\u{1F978}',
    ],
  },
  {
    name: 'Hearts',
    icon: '\u2764\uFE0F',
    emojis: [
      '\u2764\uFE0F', '\u{1F9E1}', '\u{1F49B}', '\u{1F49A}', '\u{1F499}', '\u{1F49C}', '\u{1F5A4}', '\u{1F90D}',
      '\u{1F90E}', '\u{1F498}', '\u{1F49D}', '\u{1F496}', '\u{1F497}', '\u{1F493}', '\u{1F49E}', '\u{1F495}',
      '\u{1F48C}', '\u{1F49F}', '\u{1F48B}', '\u{1FA77}',
    ],
  },
  {
    name: 'Hands',
    icon: '\u{1F44D}',
    emojis: [
      '\u{1F44D}', '\u{1F44E}', '\u{1F44A}', '\u270A', '\u{1F91B}', '\u{1F91C}', '\u{1F44F}', '\u{1F64C}',
      '\u{1F450}', '\u{1F932}', '\u{1F91D}', '\u{1F64F}', '\u270D\uFE0F', '\u{1F485}', '\u{1F933}', '\u{1F4AA}',
      '\u{1F448}', '\u{1F449}', '\u261D\uFE0F', '\u{1F446}', '\u{1F447}', '\u270C\uFE0F', '\u{1F91E}', '\u{1F91F}',
      '\u{1F918}', '\u{1F44C}', '\u{1F90C}', '\u{1F90F}', '\u270B', '\u{1F44B}',
    ],
  },
  {
    name: 'Animals',
    icon: '\u{1F436}',
    emojis: [
      '\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F439}', '\u{1F430}', '\u{1F98A}', '\u{1F43B}', '\u{1F43C}',
      '\u{1F428}', '\u{1F42F}', '\u{1F981}', '\u{1F42E}', '\u{1F437}', '\u{1F438}', '\u{1F435}', '\u{1F412}',
      '\u{1F414}', '\u{1F426}', '\u{1F427}', '\u{1F40D}', '\u{1F422}', '\u{1F41D}', '\u{1F98B}', '\u{1F984}',
    ],
  },
  {
    name: 'Food',
    icon: '\u{1F354}',
    emojis: [
      '\u{1F34E}', '\u{1F34F}', '\u{1F34A}', '\u{1F34B}', '\u{1F34D}', '\u{1F34C}', '\u{1F349}', '\u{1F347}',
      '\u{1F353}', '\u{1F348}', '\u{1F352}', '\u{1F351}', '\u{1F354}', '\u{1F355}', '\u{1F32D}', '\u{1F32E}',
      '\u{1F32F}', '\u{1F37F}', '\u{1F9C1}', '\u{1F382}', '\u{1F370}', '\u2615', '\u{1F37A}', '\u{1F377}',
    ],
  },
  {
    name: 'Objects',
    icon: '\u{1F525}',
    emojis: [
      '\u{1F525}', '\u2B50', '\u{1F31F}', '\u{1F4A5}', '\u{1F4AF}', '\u{1F389}', '\u{1F388}', '\u{1F381}',
      '\u{1F3C6}', '\u{1F3B5}', '\u{1F3B6}', '\u{1F4F8}', '\u{1F4E3}', '\u{1F514}', '\u{1F451}', '\u{1F48E}',
      '\u{1F680}', '\u{1F6A8}', '\u26A1', '\u{1F4A1}', '\u{1F4CC}', '\u{1F511}', '\u{1F512}', '\u{1F4DD}',
    ],
  },
  {
    name: 'Symbols',
    icon: '\u2705',
    emojis: [
      '\u2705', '\u274C', '\u2753', '\u2757', '\u{1F4AC}', '\u{1F4AD}', '\u{1F5E8}\uFE0F', '\u{1F440}',
      '\u{1F4A4}', '\u{1F4A8}', '\u{1F4A2}', '\u{1F4AB}', '\u{1F44C}', '\u{1F596}', '\u262E\uFE0F', '\u2622\uFE0F',
      '\u267B\uFE0F', '\u{1F508}', '\u{1F509}', '\u{1F50A}',
    ],
  },
];

export const EmojiPickerModal: React.FC<EmojiPickerModalProps> = ({
  isOpen,
  onSelect,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);

  const allEmojis = useMemo(() => {
    return EMOJI_CATEGORIES.flatMap((cat) => cat.emojis);
  }, []);

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      onSelect(emoji);
    },
    [onSelect]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="veil-emoji-picker-backdrop"
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1200,
          animation: 'veilFadeIn 0.15s ease',
        }}
      />

      {/* Modal */}
      <div
        className="veil-emoji-picker-modal"
        role="dialog"
        aria-label="Emoji picker"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '55vh',
          background: 'rgba(22, 27, 34, 0.95)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px 16px 0 0',
          zIndex: 1201,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'veilSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Handle bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 4px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              background: 'rgba(255, 255, 255, 0.2)',
            }}
          />
        </div>

        {/* Category tabs */}
        <div
          className="veil-emoji-category-tabs"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 12px',
            gap: '2px',
            overflowX: 'auto',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            flexShrink: 0,
          }}
        >
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => {
                setActiveCategory(idx);
                // Scroll to category section
                const el = document.getElementById(`emoji-cat-${idx}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              aria-label={cat.name}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                background: activeCategory === idx
                  ? 'rgba(20, 184, 166, 0.2)'
                  : 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '1.15rem',
                padding: '6px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.12s ease',
                flexShrink: 0,
              }}
            >
              {cat.icon}
            </button>
          ))}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close emoji picker"
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              outline: 'none',
              color: 'var(--veil-text-secondary, rgba(255, 255, 255, 0.6))',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Emoji grid */}
        <div
          className="veil-emoji-picker-grid-container"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '8px 12px 16px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {EMOJI_CATEGORIES.map((cat, catIdx) => (
            <div key={cat.name} id={`emoji-cat-${catIdx}`}>
              <div
                className="veil-emoji-category-header"
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.45)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '8px 4px 6px',
                  position: 'sticky',
                  top: 0,
                  background: 'rgba(22, 27, 34, 0.95)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 2,
                }}
              >
                {cat.name}
              </div>
              <div
                className="veil-emoji-picker-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '2px',
                }}
              >
                {cat.emojis.map((emoji, emojiIdx) => (
                  <button
                    key={`${catIdx}-${emojiIdx}`}
                    type="button"
                    className="veil-emoji-picker-btn"
                    onClick={() => handleEmojiClick(emoji)}
                    aria-label={`Select ${emoji}`}
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: '1.4rem',
                      padding: '6px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'transform 0.12s ease, background-color 0.12s ease',
                      lineHeight: 1,
                      textAlign: 'center',
                      userSelect: 'none',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
