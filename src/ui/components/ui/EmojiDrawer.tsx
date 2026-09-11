/**
 * In-Line Slide-Up Emoji Drawer for VEIL (Phase 82).
 *
 * Implements Telegram/WhatsApp-style bottom emoji drawer docked beneath the composer.
 * Features:
 * - Top drag handle
 * - Search bar with category segmented control (Emoji, Stickers, GIFs)
 * - Category navigation icon tab bar
 * - Frequently Used section + latest Unicode 15/16 emojis
 * - Floating bottom-right backspace button
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { SearchIcon, CloseIcon } from '../icons/index.ts';

export interface EmojiDrawerProps {
  isOpen: boolean;
  onSelectEmoji: (emoji: string) => void;
  onBackspace: () => void;
  onClose?: () => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'SMILEYS & EMOTION',
    icon: '\u{263A}',
    emojis: [
      '\u{1F600}', '\u{1F603}', '\u{1F604}', '\u{1F601}', '\u{1F606}', '\u{1F605}', '\u{1F923}', '\u{1F602}', '\u{1F642}', '\u{1F643}', '\u{1FAE0}', '\u{1F609}', '\u{1F60A}', '\u{1F607}',
      '\u{1F970}', '\u{1F60D}', '\u{1F929}', '\u{1F618}', '\u{1F617}', '\u{1F61A}', '\u{1F619}', '\u{1F972}', '\u{1F60B}', '\u{1F61B}', '\u{1F61C}', '\u{1F92A}', '\u{1F61D}', '\u{1F911}',
      '\u{1F917}', '\u{1FAE3}', '\u{1F92D}', '\u{1FAE2}', '\u{1FAE1}', '\u{1F92B}', '\u{1FAE0}', '\u{1F914}', '\u{1F910}', '\u{1F928}', '\u{1F610}', '\u{1F611}', '\u{1F636}', '\u{1FAE5}',
      '\u{1F60F}', '\u{1F612}', '\u{1F644}', '\u{1F62C}', '\u{1F62E}‍\u{1F4A8}', '\u{1F925}', '\u{1FAE8}', '\u{1F60C}', '\u{1F614}', '\u{1F62A}', '\u{1F924}', '\u{1F634}', '\u{1F637}', '\u{1F912}',
      '\u{1F915}', '\u{1F922}', '\u{1F92E}', '\u{1F927}', '\u{1F975}', '\u{1F976}', '\u{1F974}', '\u{1F635}', '\u{1F635}‍\u{1F4AB}', '\u{1F92F}', '\u{1F920}', '\u{1F973}', '\u{1F978}', '\u{1F60E}',
      '\u{1F913}', '\u{1F9D0}', '\u{1F615}', '\u{1FAE4}', '\u{1F61F}', '\u{1F641}', '\u{1F62E}', '\u{1F62F}', '\u{1F632}', '\u{1F633}', '\u{1F97A}', '\u{1F979}', '\u{1F626}', '\u{1F627}',
      '\u{1F628}', '\u{1F630}', '\u{1F625}', '\u{1F622}', '\u{1F62D}', '\u{1F631}', '\u{1F616}', '\u{1F623}', '\u{1F61E}', '\u{1F613}', '\u{1F629}', '\u{1F62B}', '\u{1F971}', '\u{1F624}',
      '\u{1F621}', '\u{1F620}', '\u{1F92C}', '\u{1F608}', '\u{1F47F}', '\u{1F480}', '\u{2620}️', '\u{1F4A9}', '\u{1F921}', '\u{1F479}', '\u{1F47A}', '\u{1F47B}', '\u{1F47D}', '\u{1F47E}',
    ],
  },
  {
    id: 'hands',
    name: 'PEOPLE & BODY',
    icon: '\u{1F44B}',
    emojis: [
      '\u{1F44B}', '\u{1F91A}', '\u{1F590}️', '\u{270B}', '\u{1F596}', '\u{1FAF1}', '\u{1FAF2}', '\u{1FAF3}', '\u{1FAF4}', '\u{1FAF5}', '\u{1F44C}', '\u{1F90C}', '\u{1F90F}', '\u{270C}️',
      '\u{1F91E}', '\u{1FAF0}', '\u{1F91F}', '\u{1F918}', '\u{1F919}', '\u{1F448}', '\u{1F449}', '\u{1F446}', '\u{1F595}', '\u{1F447}', '\u{261D}️', '\u{1F44D}', '\u{1F44E}', '\u{270A}',
      '\u{1F44A}', '\u{1F91B}', '\u{1F91C}', '\u{1F44F}', '\u{1F64C}', '\u{1FAF6}', '\u{1F450}', '\u{1F932}', '\u{1F91D}', '\u{1F64F}', '\u{270D}️', '\u{1F485}', '\u{1F933}', '\u{1F4AA}',
      '\u{1F9BE}', '\u{1F9BF}', '\u{1F9B5}', '\u{1F9B6}', '\u{1F442}', '\u{1F9BB}', '\u{1F443}', '\u{1F9E0}', '\u{1FAC0}', '\u{1FAC1}', '\u{1F9B7}', '\u{1F9B4}', '\u{1F440}', '\u{1F441}️',
      '\u{1F445}', '\u{1F444}', '\u{1FAE6}', '\u{1F48B}', '\u{2764}️', '\u{1FA77}', '\u{1F9E1}', '\u{1F49B}', '\u{1F49A}', '\u{1F499}', '\u{1FA75}', '\u{1F49C}', '\u{1F5A4}', '\u{1FA76}',
      '\u{1F90D}', '\u{1F90E}', '\u{1F494}', '\u{2764}️‍\u{1F525}', '\u{2764}️‍\u{1FA79}', '\u{2763}️', '\u{1F495}', '\u{1F49E}', '\u{1F493}', '\u{1F497}', '\u{1F496}', '\u{1F498}', '\u{1F49D}',
    ],
  },
  {
    id: 'animals',
    name: 'ANIMALS & NATURE',
    icon: '\u{1F43E}',
    emojis: [
      '\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F439}', '\u{1F430}', '\u{1F98A}', '\u{1F43B}', '\u{1F43C}', '\u{1F43B}‍\u{2744}️', '\u{1F428}', '\u{1F42F}', '\u{1F981}', '\u{1F42E}', '\u{1F437}',
      '\u{1F43D}', '\u{1F438}', '\u{1F435}', '\u{1F648}', '\u{1F649}', '\u{1F64A}', '\u{1F412}', '\u{1F414}', '\u{1F427}', '\u{1F426}', '\u{1F424}', '\u{1F423}', '\u{1F425}', '\u{1F986}',
      '\u{1F985}', '\u{1F989}', '\u{1F987}', '\u{1F43A}', '\u{1F417}', '\u{1F434}', '\u{1F984}', '\u{1F41D}', '\u{1FAB1}', '\u{1F41B}', '\u{1F98B}', '\u{1F40C}', '\u{1F41E}', '\u{1F41C}',
      '\u{1FAB0}', '\u{1FAB2}', '\u{1FAB3}', '\u{1F99F}', '\u{1F997}', '\u{1F577}️', '\u{1F578}️', '\u{1F982}', '\u{1F422}', '\u{1F40D}', '\u{1F98E}', '\u{1F419}', '\u{1F991}', '\u{1F990}',
      '\u{1F99E}', '\u{1F980}', '\u{1F421}', '\u{1F420}', '\u{1F41F}', '\u{1F42C}', '\u{1F433}', '\u{1F40B}', '\u{1F988}', '\u{1F9AD}', '\u{1F40A}', '\u{1F405}', '\u{1F406}', '\u{1F993}',
      '\u{1F98D}', '\u{1F9A7}', '\u{1F9A3}', '\u{1F418}', '\u{1F99B}', '\u{1F98F}', '\u{1F42A}', '\u{1F42B}', '\u{1F992}', '\u{1F998}', '\u{1F9AC}', '\u{1F403}', '\u{1F402}', '\u{1F404}',
      '\u{1F40E}', '\u{1F416}', '\u{1F40F}', '\u{1F411}', '\u{1F999}', '\u{1F410}', '\u{1F98C}', '\u{1F415}', '\u{1F429}', '\u{1F9AE}', '\u{1F415}‍\u{1F9BA}', '\u{1F408}', '\u{1F408}‍⬛', '\u{1FAB6}',
    ],
  },
  {
    id: 'food',
    name: 'FOOD & DRINK',
    icon: '\u{1F374}',
    emojis: [
      '\u{1F34F}', '\u{1F34E}', '\u{1F350}', '\u{1F34A}', '\u{1F34B}', '\u{1F34C}', '\u{1F349}', '\u{1F347}', '\u{1F353}', '\u{1FAD0}', '\u{1F348}', '\u{1F352}', '\u{1F351}', '\u{1F96D}',
      '\u{1F34D}', '\u{1F965}', '\u{1F95D}', '\u{1F345}', '\u{1F346}', '\u{1F951}', '\u{1F966}', '\u{1F96C}', '\u{1F952}', '\u{1F336}️', '\u{1FAD1}', '\u{1F33D}', '\u{1F955}', '\u{1FAD2}',
      '\u{1F9C4}', '\u{1F9C5}', '\u{1F954}', '\u{1F360}', '\u{1F950}', '\u{1F96F}', '\u{1F35E}', '\u{1F956}', '\u{1F968}', '\u{1F9C0}', '\u{1F95A}', '\u{1F373}', '\u{1F9C8}', '\u{1F95E}',
      '\u{1F9C7}', '\u{1F953}', '\u{1F969}', '\u{1F357}', '\u{1F356}', '\u{1F9B4}', '\u{1F32D}', '\u{1F354}', '\u{1F35F}', '\u{1F355}', '\u{1FAD3}', '\u{1F96A}', '\u{1F959}', '\u{1F9C6}',
      '\u{1F32E}', '\u{1F32F}', '\u{1FAD4}', '\u{1F957}', '\u{1F958}', '\u{1FAD5}', '\u{1F96B}', '\u{1F35D}', '\u{1F35C}', '\u{1F372}', '\u{1F35B}', '\u{1F363}', '\u{1F371}', '\u{1F95F}',
      '\u{1F9AA}', '\u{1F364}', '\u{1F359}', '\u{1F35A}', '\u{1F358}', '\u{1F365}', '\u{1F960}', '\u{1F96E}', '\u{1F362}', '\u{1F361}', '\u{1F367}', '\u{1F368}', '\u{1F366}', '\u{1F967}',
      '\u{1F9C1}', '\u{1F370}', '\u{1F382}', '\u{1F36E}', '\u{1F36D}', '\u{1F36C}', '\u{1F36B}', '\u{1F37F}', '\u{1F369}', '\u{1F36A}', '\u{1F330}', '\u{1F95C}', '\u{1FAD8}', '\u{1F36F}',
    ],
  },
  {
    id: 'travel',
    name: 'TRAVEL & PLACES',
    icon: '\u{2708}',
    emojis: [
      '\u{1F697}', '\u{1F695}', '\u{1F699}', '\u{1F68C}', '\u{1F68E}', '\u{1F3CE}️', '\u{1F693}', '\u{1F691}', '\u{1F692}', '\u{1F690}', '\u{1F6FB}', '\u{1F69A}', '\u{1F69B}', '\u{1F69C}',
      '\u{1F9AF}', '\u{1F9BD}', '\u{1F9BC}', '\u{1F6F4}', '\u{1F6B2}', '\u{1F6F5}', '\u{1F3CD}️', '\u{1F6FA}', '\u{1F6A8}', '\u{1F694}', '\u{1F68D}', '\u{1F698}', '\u{1F696}', '\u{1F6A1}',
      '\u{1F6A0}', '\u{1F69F}', '\u{1F683}', '\u{1F68B}', '\u{1F69E}', '\u{1F69D}', '\u{1F684}', '\u{1F685}', '\u{1F688}', '\u{1F682}', '\u{1F686}', '\u{1F687}', '\u{1F68A}', '\u{1F689}',
      '\u{2708}️', '\u{1F6EB}', '\u{1F6EC}', '\u{1F6E9}️', '\u{1F4BA}', '\u{1F6F0}️', '\u{1F680}', '\u{1F6F8}', '\u{1F681}', '\u{1F6F6}', '\u{26F5}', '\u{1F6A4}', '\u{1F6E5}️', '\u{1F6F3}️',
      '\u{26F4}️', '\u{1F6A2}', '\u{2693}', '\u{1F6DF}', '\u{1FA9D}', '\u{26FD}', '\u{1F6A7}', '\u{1F6A6}', '\u{1F6A5}', '\u{1F68F}', '\u{1F5FA}️', '\u{1F5FF}', '\u{1F5FD}', '\u{1F5FC}',
    ],
  },
  {
    id: 'activities',
    name: 'ACTIVITIES',
    icon: '\u{1F3AE}',
    emojis: [
      '\u{26BD}', '\u{1F3C0}', '\u{1F3C8}', '\u{26BE}', '\u{1F94E}', '\u{1F3BE}', '\u{1F3D0}', '\u{1F3C9}', '\u{1F94F}', '\u{1F3B1}', '\u{1FA80}', '\u{1F3D3}', '\u{1F3F8}', '\u{1F3D2}',
      '\u{1F3D1}', '\u{1F94D}', '\u{1F3CF}', '\u{1FA83}', '\u{1F945}', '\u{26F3}', '\u{1FA81}', '\u{1F3F9}', '\u{1F3A3}', '\u{1F93F}', '\u{1F94A}', '\u{1F94B}', '\u{1F3BD}', '\u{1F6F9}',
      '\u{1F6FC}', '\u{1F6F7}', '\u{26F8}️', '\u{1F94C}', '\u{1F3BF}', '\u{26F7}️', '\u{1F3C2}', '\u{1FA82}', '\u{1F3CB}️', '\u{1F93C}', '\u{1F938}', '\u{1F93A}', '\u{1F3AE}', '\u{1F579}️',
      '\u{1F3B0}', '\u{1F3B2}', '\u{1F9E9}', '\u{265F}️', '\u{1F3AF}', '\u{1F3B3}', '\u{1F3AA}', '\u{1F3A8}', '\u{1F3AC}', '\u{1F3A4}', '\u{1F3A7}', '\u{1F3BC}', '\u{1F3B9}', '\u{1F941}',
    ],
  },
  {
    id: 'objects',
    name: 'OBJECTS',
    icon: '\u{1F4A1}',
    emojis: [
      '\u{1F4A1}', '\u{1F526}', '\u{1F3EE}', '\u{1FA94}', '\u{1F56F}️', '\u{1F9EF}', '\u{1F6E2}️', '\u{1F4B8}', '\u{1F4B5}', '\u{1F4B4}', '\u{1F4B6}', '\u{1F4B7}', '\u{1FA99}', '\u{1F4B0}',
      '\u{1F4B3}', '\u{1F48E}', '\u{2696}️', '\u{1FA9C}', '\u{1F9F0}', '\u{1FA9B}', '\u{1F527}', '\u{1F528}', '\u{2692}️', '\u{1F6E0}️', '\u{26CF}️', '\u{1FA9A}', '\u{1F529}', '\u{2699}️',
      '\u{1FAA4}', '\u{1F9F1}', '\u{26D3}️', '\u{1F9F2}', '\u{1F52B}', '\u{1F4A3}', '\u{1F9E8}', '\u{1FA93}', '\u{1F52A}', '\u{1F5E1}️', '\u{2694}️', '\u{1F6E1}️', '\u{1F6AC}', '\u{26B0}️',
      '\u{1FAA6}', '\u{26B1}️', '\u{1F3FA}', '\u{1F52E}', '\u{1F4FF}', '\u{1F9FF}', '\u{1FAAC}', '\u{1F488}', '\u{2697}️', '\u{1F52D}', '\u{1F52C}', '\u{1F573}️', '\u{1FA79}', '\u{1FA7A}',
    ],
  },
  {
    id: 'symbols',
    name: 'SYMBOLS',
    icon: '#',
    emojis: [
      '\u{2728}', '⭐', '\u{1F31F}', '\u{1F4AB}', '\u{26A1}', '\u{2604}️', '\u{1F4A5}', '\u{1F525}', '\u{1F32A}️', '\u{1F308}', '\u{2600}️', '\u{1F324}️', '\u{26C5}', '\u{1F325}️',
      '\u{2601}️', '\u{1F326}️', '\u{1F327}️', '\u{26C8}️', '\u{1F329}️', '\u{1F328}️', '\u{2744}️', '\u{2603}️', '\u{26C4}', '\u{1F32C}️', '\u{1F4A8}', '\u{1F4A7}', '\u{1FAE7}', '\u{1F30A}',
      '\u{1F4A4}', '\u{1F514}', '\u{1F515}', '\u{1F4E2}', '\u{1F4E3}', '\u{1F4AC}', '\u{1F4AD}', '\u{1F5EF}️', '\u{2660}️', '\u{2663}️', '\u{2665}️', '\u{2666}️', '🃏', '\u{1F3B4}',
      '\u{1F512}', '\u{1F513}', '\u{1F50F}', '\u{1F510}', '\u{1F511}', '\u{1F5DD}️', '\u{1F4AF}', '\u{2705}', '\u{274C}', '\u{26A0}️', '\u{26D4}', '\u{1F6AB}', '\u{1F534}', '\u{1F7E2}',
    ],
  },
];

const DEFAULT_FREQUENT_EMOJIS = [
  '\u{1F525}', '\u{2764}️', '\u{1F44D}', '\u{1F602}', '\u{2728}', '\u{1F680}', '\u{1F512}', '\u{1F440}', '\u{26A1}', '\u{1FAE1}', '\u{1F979}', '\u{1FAE0}', '\u{1FAF6}', '\u{1FAE2}', '\u{1FAE5}', '\u{1FAE3}',
];

export const EmojiDrawer: React.FC<EmojiDrawerProps> = ({
  isOpen,
  onSelectEmoji,
  onBackspace,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'emoji' | 'stickers' | 'gifs'>('emoji');
  const [activeCategoryId, setActiveCategoryId] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Retrieve recent emojis from localStorage
  const frequentEmojis = useMemo(() => {
    try {
      const stored = localStorage.getItem('veil:ui:recentEmojis');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...new Set([...parsed, ...DEFAULT_FREQUENT_EMOJIS])].slice(0, 16);
        }
      }
    } catch {}
    return DEFAULT_FREQUENT_EMOJIS;
  }, [isOpen]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return EMOJI_CATEGORIES;
    const q = searchQuery.toLowerCase().trim();
    return EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter((e) => e.includes(q)),
    })).filter((cat) => cat.emojis.length > 0);
  }, [searchQuery]);

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      onSelectEmoji(emoji);
      // Update recent emojis in local storage
      try {
        const stored = localStorage.getItem('veil:ui:recentEmojis');
        const list: string[] = stored ? JSON.parse(stored) : [];
        const next = [emoji, ...list.filter((e) => e !== emoji)].slice(0, 24);
        localStorage.setItem('veil:ui:recentEmojis', JSON.stringify(next));
      } catch {}
    },
    [onSelectEmoji]
  );

  const scrollToCategory = (catId: string) => {
    setActiveCategoryId(catId);
    if (!scrollContainerRef.current) return;
    const el = document.getElementById(`emoji-section-${catId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      className={`veil-emoji-drawer ${isOpen ? 'veil-emoji-drawer-open' : ''}`}
      style={!isOpen ? { display: 'none' } : undefined}
      role="region"
      aria-label="Emoji and stickers picker"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Drag Handle (Screenshot 3) */}
      <div className="veil-emoji-drawer-handle-wrap" onClick={onClose}>
        <div className="veil-emoji-drawer-handle" />
      </div>

      {/* Top Toolbar: Search + Tab Segmented Control (Screenshot 3) */}
      <div className="veil-emoji-drawer-toolbar">
        <div className="veil-emoji-search-box">
          <SearchIcon size={15} style={{ opacity: 0.6 }} />
          <input
            type="text"
            className="veil-emoji-search-input"
            placeholder="Search emojis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search emojis"
          />
          {searchQuery && (
            <button
              type="button"
              className="veil-emoji-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <CloseIcon size={12} />
            </button>
          )}
        </div>

        {/* Tab Segmented Control */}
        <div className="veil-emoji-segmented-control" role="tablist">
          <button
            type="button"
            className={`veil-emoji-segment-btn ${activeTab === 'emoji' ? 'active' : ''}`}
            onClick={() => setActiveTab('emoji')}
            role="tab"
            aria-selected={activeTab === 'emoji'}
          >
            Emoji
          </button>
          <button
            type="button"
            className={`veil-emoji-segment-btn ${activeTab === 'stickers' ? 'active' : ''}`}
            onClick={() => setActiveTab('stickers')}
            role="tab"
            aria-selected={activeTab === 'stickers'}
          >
            Stickers
          </button>
          <button
            type="button"
            className={`veil-emoji-segment-btn ${activeTab === 'gifs' ? 'active' : ''}`}
            onClick={() => setActiveTab('gifs')}
            role="tab"
            aria-selected={activeTab === 'gifs'}
          >
            GIFs
          </button>
        </div>
      </div>

      {/* Category Icons Row (Screenshot 3) */}
      {activeTab === 'emoji' && !searchQuery && (
        <div className="veil-emoji-category-bar" role="tablist" aria-label="Emoji categories">
          <button
            type="button"
            className={`veil-emoji-cat-icon-btn ${activeCategoryId === 'recent' ? 'active' : ''}`}
            onClick={() => scrollToCategory('recent')}
            title="Frequently Used"
            aria-label="Frequently Used"
          >
            <span>{'\u{1F552}'}</span>
          </button>

          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`veil-emoji-cat-icon-btn ${activeCategoryId === cat.id ? 'active' : ''}`}
              onClick={() => scrollToCategory(cat.id)}
              title={cat.name}
              aria-label={cat.name}
            >
              <span>{cat.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Emoji Grid Content */}
      <div ref={scrollContainerRef} className="veil-emoji-scroll-body">
        {activeTab === 'emoji' ? (
          <>
            {/* Frequently Used Section (Screenshot 3) */}
            {!searchQuery && frequentEmojis.length > 0 && (
              <div id="emoji-section-recent" className="veil-emoji-section">
                <div className="veil-emoji-section-title">FREQUENTLY USED</div>
                <div className="veil-emoji-grid">
                  {frequentEmojis.map((emoji, idx) => (
                    <button
                      key={`freq-${idx}`}
                      type="button"
                      className="veil-emoji-item-btn"
                      onClick={() => handleEmojiClick(emoji)}
                      aria-label={emoji}
                    >
                      <span>{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categorized Emojis */}
            {filteredCategories.map((cat) => (
              <div key={cat.id} id={`emoji-section-${cat.id}`} className="veil-emoji-section">
                <div className="veil-emoji-section-title">{cat.name}</div>
                <div className="veil-emoji-grid">
                  {cat.emojis.map((emoji, idx) => (
                    <button
                      key={`${cat.id}-${idx}`}
                      type="button"
                      className="veil-emoji-item-btn"
                      onClick={() => handleEmojiClick(emoji)}
                      aria-label={emoji}
                    >
                      <span>{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="veil-emoji-empty-tab">
            <span style={{ fontSize: '0.85rem', color: 'var(--veil-text-secondary, #94a3b8)' }}>
              {activeTab === 'stickers' ? 'Stickers library coming soon' : 'GIFs library coming soon'}
            </span>
          </div>
        )}
      </div>

      {/* Floating Bottom-Right Backspace Action Button (Screenshot 3) */}
      <button
        type="button"
        className="veil-emoji-floating-backspace-btn"
        onClick={(e) => {
          e.stopPropagation();
          onBackspace();
        }}
        title="Delete character"
        aria-label="Delete character"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
          <line x1="18" y1="9" x2="12" y2="15" />
          <line x1="12" y1="9" x2="18" y2="15" />
        </svg>
      </button>
    </div>
  );
};
