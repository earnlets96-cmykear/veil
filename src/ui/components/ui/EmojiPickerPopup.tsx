/**
 * Compact Emoji Picker Popup for VEIL.
 * Shows categorized emoji grid with search, positioned near context menu.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeftIcon, ClockIcon } from '../icons/index.ts';
import emojiCategoriesData from '../../../utils/emojiData.json';

const EMOJI_CATEGORIES: Record<string, string[]> = emojiCategoriesData;

const CATEGORY_ICONS: Record<string, string> = {
  'Smileys': '\u{1F60A}',
  'Gestures': '\u{1F44B}',
  'Hearts': '\u2764\uFE0F',
  'People': '\u{1F464}',
  'Animals': '\u{1F436}',
  'Food': '\u{1F354}',
  'Activities': '\u26BD',
  'Travel': '\u{1F697}',
  'Objects': '\u{1F4A1}',
  'Symbols': '\u{1F525}',
};

const RECENT_STORAGE_KEY = 'veil:recent-reactions';
const MAX_RECENT = 20;
export const DEFAULT_RECENT = ['\u2764\uFE0F', '\u{1F44D}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}', '\u{1F525}'];

export function getRecentEmojis(fallback = DEFAULT_RECENT): string[] {
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_e) {}
  return fallback;
}

export function addRecentEmoji(emoji: string): void {
  try {
    const current = getRecentEmojis();
    const updated = [emoji, ...current.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
  } catch (_e) {}
}

export interface EmojiPickerPopupProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPickerPopup: React.FC<EmojiPickerPopupProps> = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('Smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const allEmojis = useMemo(() => {
    const flat: string[] = [];
    for (const emojis of Object.values(EMOJI_CATEGORIES)) {
      flat.push(...emojis);
    }
    return flat;
  }, []);

  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) return null;
    // Simple character match for emoji search
    return allEmojis.filter((e) => e.includes(searchQuery));
  }, [searchQuery, allEmojis]);

  const recentEmojis = useMemo(() => getRecentEmojis(), []);

  const displayEmojis = filteredEmojis || EMOJI_CATEGORIES[activeCategory] || [];

  return (
    <div
      ref={containerRef}
      className="veil-emoji-picker"
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '300px',
        maxHeight: '340px',
        backgroundColor: 'var(--veil-bg-surface-elevated, #1e2530)',
        border: '1px solid var(--veil-border, rgba(255, 255, 255, 0.1))',
        borderRadius: 'var(--veil-radius-lg, 14px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Search */}
      <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid var(--veil-border-subtle, rgba(255,255,255,0.06))' }}>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search emoji..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="veil-input"
          style={{
            width: '100%',
            fontSize: '0.78rem',
            padding: '6px 10px',
            borderRadius: 'var(--veil-radius-md, 10px)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Category tabs */}
      {!searchQuery && (
        <div
          style={{
            display: 'flex',
            gap: '2px',
            padding: '4px 6px',
            borderBottom: '1px solid var(--veil-border-subtle, rgba(255,255,255,0.06))',
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {/* Recent tab */}
          <button
            type="button"
            onClick={() => setActiveCategory('_recent')}
            style={{
              background: activeCategory === '_recent' ? 'var(--veil-accent-primary-subtle, rgba(20,184,166,0.15))' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 6px',
              fontSize: '14px',
              cursor: 'pointer',
              flexShrink: 0,
              lineHeight: 1,
            }}
            title="Recent"
          >
            <ClockIcon size={14} color="var(--veil-text-secondary, rgba(255,255,255,0.6))" />
          </button>
          {Object.keys(EMOJI_CATEGORIES).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              style={{
                background: activeCategory === cat ? 'var(--veil-accent-primary-subtle, rgba(20,184,166,0.15))' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 6px',
                fontSize: '14px',
                cursor: 'pointer',
                flexShrink: 0,
                lineHeight: 1,
              }}
              title={cat}
            >
              {CATEGORY_ICONS[cat]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '2px',
          alignContent: 'start',
        }}
      >
        {(activeCategory === '_recent' && !searchQuery ? recentEmojis : displayEmojis).map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              addRecentEmoji(emoji);
              onSelect(emoji);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '22px',
              padding: '4px',
              cursor: 'pointer',
              borderRadius: '6px',
              lineHeight: 1,
              transition: 'background-color 0.1s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
