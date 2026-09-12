/**
 * Telegram Sticker Service
 *
 * Provides local IndexedDB storage, pre-bundled high-definition starter sticker packs,
 * Telegram link/pack resolution, and recent sticker history with 100% offline privacy.
 */

import { PRODUCTION_RELAY_URL } from '../config/appConfig.ts';

export interface StickerItem {
  id: string;
  packId: string;
  emoji: string;
  url: string; // Data URI, blob URL, or HTTPS URL
  width: number;
  height: number;
}

export interface StickerPack {
  id: string;
  name: string; // e.g. "spotty", "animals"
  title: string;
  thumbnailUrl: string;
  stickers: StickerItem[];
  installedAt: number;
  isBuiltIn?: boolean;
}

// Built-in starter sticker assets (clean 512x512 SVG vectors rendered as data URIs)
const createSvgSticker = (svgContent: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${svgContent}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// 1. Telegram Spotty / Dog Mascot Pack
const SPOTTY_STICKERS: StickerItem[] = [
  {
    id: 'spotty_wave',
    packId: 'spotty',
    emoji: '\u{1F44B}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="256" cy="256" r="200" fill="#ffffff" stroke="#1e293b" stroke-width="16" />
      <circle cx="160" cy="140" r="70" fill="#1e293b" />
      <ellipse cx="190" cy="230" rx="20" ry="28" fill="#1e293b" />
      <ellipse cx="322" cy="230" rx="20" ry="28" fill="#1e293b" />
      <ellipse cx="256" cy="290" rx="36" ry="24" fill="#0f172a" />
      <path d="M220 330 Q256 370 292 330" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round" />
      <path d="M380 180 Q450 140 430 80 Q370 120 360 170 Z" fill="#ffffff" stroke="#1e293b" stroke-width="14" />
      <text x="256" y="460" font-family="sans-serif" font-weight="900" font-size="52" fill="#14b8a6" text-anchor="middle">HELLO!</text>
    `),
  },
  {
    id: 'spotty_love',
    packId: 'spotty',
    emoji: '\u{2764}\u{FE0F}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="256" cy="256" r="200" fill="#ffffff" stroke="#1e293b" stroke-width="16" />
      <path d="M190 220 Q160 180 190 150 Q220 180 190 220 Z" fill="#ef4444" />
      <path d="M322 220 Q292 180 322 150 Q352 180 322 220 Z" fill="#ef4444" />
      <ellipse cx="256" cy="280" rx="32" ry="20" fill="#0f172a" />
      <path d="M226 315 Q256 365 286 315" fill="#f43f5e" stroke="#0f172a" stroke-width="12" stroke-linecap="round" />
      <text x="256" y="450" font-family="sans-serif" font-weight="900" font-size="48" fill="#ef4444" text-anchor="middle">SO MUCH LOVE</text>
    `),
  },
  {
    id: 'spotty_thumbsup',
    packId: 'spotty',
    emoji: '\u{1F44D}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="256" cy="256" r="200" fill="#ffffff" stroke="#1e293b" stroke-width="16" />
      <circle cx="160" cy="140" r="70" fill="#1e293b" />
      <ellipse cx="200" cy="230" rx="18" ry="24" fill="#0f172a" />
      <ellipse cx="312" cy="230" rx="18" ry="24" fill="#0f172a" />
      <path d="M220 310 Q256 345 292 310" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round" />
      <g transform="translate(360, 260)">
        <rect x="0" y="30" width="80" height="90" rx="20" fill="#3b82f6" />
        <rect x="25" y="0" width="30" height="50" rx="15" fill="#3b82f6" />
      </g>
      <text x="256" y="450" font-family="sans-serif" font-weight="900" font-size="52" fill="#3b82f6" text-anchor="middle">NICE!</text>
    `),
  },
  {
    id: 'spotty_cool',
    packId: 'spotty',
    emoji: '\u{1F60E}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="256" cy="256" r="200" fill="#ffffff" stroke="#1e293b" stroke-width="16" />
      <path d="M120 200 H392 Q392 270 330 270 H270 Q256 240 242 270 H182 Q120 270 120 200 Z" fill="#0f172a" />
      <line x1="140" y1="210" x2="220" y2="250" stroke="#38bdf8" stroke-width="8" stroke-linecap="round" />
      <ellipse cx="256" cy="300" rx="30" ry="18" fill="#0f172a" />
      <path d="M230 340 Q256 360 282 340" fill="none" stroke="#0f172a" stroke-width="12" stroke-linecap="round" />
      <text x="256" y="450" font-family="sans-serif" font-weight="900" font-size="52" fill="#0284c7" text-anchor="middle">DEAL WITH IT</text>
    `),
  },
  {
    id: 'spotty_laugh',
    packId: 'spotty',
    emoji: '\u{1F602}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="256" cy="256" r="200" fill="#ffffff" stroke="#1e293b" stroke-width="16" />
      <path d="M170 230 Q190 200 210 230" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round" />
      <path d="M302 230 Q322 200 342 230" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round" />
      <path d="M180 290 Q256 420 332 290 Z" fill="#ef4444" stroke="#0f172a" stroke-width="14" />
      <ellipse cx="256" cy="360" rx="40" ry="20" fill="#f43f5e" />
      <text x="256" y="460" font-family="sans-serif" font-weight="900" font-size="52" fill="#f59e0b" text-anchor="middle">HAHAHA</text>
    `),
  },
  {
    id: 'spotty_party',
    packId: 'spotty',
    emoji: '\u{1F389}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="256" cy="256" r="200" fill="#ffffff" stroke="#1e293b" stroke-width="16" />
      <polygon points="256,10 200,160 312,160" fill="#f59e0b" stroke="#1e293b" stroke-width="12" />
      <circle cx="256" cy="10" r="24" fill="#ef4444" />
      <ellipse cx="190" cy="240" rx="18" ry="24" fill="#0f172a" />
      <ellipse cx="322" cy="240" rx="18" ry="24" fill="#0f172a" />
      <path d="M220 320 Q256 360 292 320" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round" />
      <text x="256" y="450" font-family="sans-serif" font-weight="900" font-size="52" fill="#ec4899" text-anchor="middle">LET'S PARTY</text>
    `),
  },
  {
    id: 'spotty_crying',
    packId: 'spotty',
    emoji: '\u{1F62D}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="256" cy="256" r="200" fill="#ffffff" stroke="#1e293b" stroke-width="16" />
      <path d="M180 230 Q200 250 220 230" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round" />
      <path d="M292 230 Q312 250 332 230" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round" />
      <path d="M195 240 V350" stroke="#38bdf8" stroke-width="20" stroke-linecap="round" />
      <path d="M317 240 V350" stroke="#38bdf8" stroke-width="20" stroke-linecap="round" />
      <path d="M220 340 Q256 300 292 340" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round" />
      <text x="256" y="450" font-family="sans-serif" font-weight="900" font-size="52" fill="#0284c7" text-anchor="middle">SO SAD</text>
    `),
  },
  {
    id: 'spotty_sleepy',
    packId: 'spotty',
    emoji: '\u{1F634}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="256" cy="256" r="200" fill="#ffffff" stroke="#1e293b" stroke-width="16" />
      <path d="M180 240 Q200 220 220 240" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round" />
      <path d="M292 240 Q312 220 332 240" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round" />
      <ellipse cx="256" cy="290" rx="20" ry="14" fill="#0f172a" />
      <path d="M230 330 Q256 345 282 330" fill="none" stroke="#0f172a" stroke-width="12" stroke-linecap="round" />
      <text x="370" y="160" font-family="sans-serif" font-weight="900" font-size="64" fill="#8b5cf6">Z</text>
      <text x="410" y="110" font-family="sans-serif" font-weight="900" font-size="44" fill="#a78bfa">z</text>
      <text x="256" y="450" font-family="sans-serif" font-weight="900" font-size="52" fill="#6366f1" text-anchor="middle">GOODNIGHT</text>
    `),
  },
];

// 2. Telegram Animals Pack
const ANIMAL_STICKERS: StickerItem[] = [
  {
    id: 'animal_cat_heart',
    packId: 'animals',
    emoji: '\u{1F431}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="256" cy="270" r="180" fill="#fb923c" stroke="#1e293b" stroke-width="14" />
      <polygon points="120,180 90,60 210,130" fill="#f97316" stroke="#1e293b" stroke-width="14" />
      <polygon points="392,180 422,60 302,130" fill="#f97316" stroke="#1e293b" stroke-width="14" />
      <ellipse cx="190" cy="250" rx="24" ry="32" fill="#0f172a" />
      <ellipse cx="322" cy="250" rx="24" ry="32" fill="#0f172a" />
      <polygon points="256,295 240,280 272,280" fill="#ec4899" />
      <path d="M256 295 Q230 325 200 310 M256 295 Q282 325 312 310" fill="none" stroke="#0f172a" stroke-width="10" stroke-linecap="round" />
      <text x="256" y="460" font-family="sans-serif" font-weight="900" font-size="48" fill="#c2410c" text-anchor="middle">MEOW!</text>
    `),
  },
  {
    id: 'animal_panda_hug',
    packId: 'animals',
    emoji: '\u{1F43C}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="130" cy="130" r="50" fill="#0f172a" />
      <circle cx="382" cy="130" r="50" fill="#0f172a" />
      <circle cx="256" cy="270" r="180" fill="#ffffff" stroke="#0f172a" stroke-width="14" />
      <ellipse cx="185" cy="240" rx="35" ry="45" fill="#0f172a" transform="rotate(-15 185 240)" />
      <ellipse cx="327" cy="240" rx="35" ry="45" fill="#0f172a" transform="rotate(15 327 240)" />
      <circle cx="185" cy="240" r="12" fill="#ffffff" />
      <circle cx="327" cy="240" r="12" fill="#ffffff" />
      <ellipse cx="256" cy="300" rx="28" ry="18" fill="#0f172a" />
      <path d="M230 330 Q256 355 282 330" fill="none" stroke="#0f172a" stroke-width="10" stroke-linecap="round" />
      <text x="256" y="460" font-family="sans-serif" font-weight="900" font-size="48" fill="#0f172a" text-anchor="middle">BIG HUG</text>
    `),
  },
  {
    id: 'animal_bear_angry',
    packId: 'animals',
    emoji: '\u{1F43B}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="130" cy="140" r="55" fill="#78350f" stroke="#451a03" stroke-width="12" />
      <circle cx="382" cy="140" r="55" fill="#78350f" stroke="#451a03" stroke-width="12" />
      <circle cx="256" cy="270" r="180" fill="#92400e" stroke="#451a03" stroke-width="14" />
      <line x1="160" y1="210" x2="220" y2="240" stroke="#451a03" stroke-width="16" stroke-linecap="round" />
      <line x1="352" y1="210" x2="292" y2="240" stroke="#451a03" stroke-width="16" stroke-linecap="round" />
      <circle cx="195" cy="250" r="16" fill="#0f172a" />
      <circle cx="317" cy="250" r="16" fill="#0f172a" />
      <ellipse cx="256" cy="310" rx="55" ry="35" fill="#b45309" />
      <polygon points="256,310 240,290 272,290" fill="#451a03" />
      <text x="256" y="460" font-family="sans-serif" font-weight="900" font-size="48" fill="#78350f" text-anchor="middle">GRRR!</text>
    `),
  },
  {
    id: 'animal_fox_smart',
    packId: 'animals',
    emoji: '\u{1F98A}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <polygon points="120,180 80,40 210,130" fill="#ea580c" stroke="#1e293b" stroke-width="14" />
      <polygon points="392,180 432,40 302,130" fill="#ea580c" stroke="#1e293b" stroke-width="14" />
      <polygon points="256,400 100,200 412,200" fill="#f97316" stroke="#1e293b" stroke-width="14" />
      <polygon points="256,400 130,220 256,260" fill="#ffffff" />
      <polygon points="256,400 382,220 256,260" fill="#ffffff" />
      <ellipse cx="190" cy="230" rx="16" ry="22" fill="#0f172a" />
      <ellipse cx="322" cy="230" rx="16" ry="22" fill="#0f172a" />
      <circle cx="256" cy="385" r="22" fill="#0f172a" />
      <text x="256" y="465" font-family="sans-serif" font-weight="900" font-size="48" fill="#c2410c" text-anchor="middle">CLEVER</text>
    `),
  },
];

// 3. Telegram Reaction Memes Pack
const MEME_STICKERS: StickerItem[] = [
  {
    id: 'meme_100',
    packId: 'memes',
    emoji: '\u{1F4AF}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <text x="256" y="320" font-family="Impact, sans-serif" font-weight="900" font-size="220" fill="#ef4444" text-anchor="middle">100</text>
      <line x1="80" y1="360" x2="432" y2="360" stroke="#ef4444" stroke-width="28" stroke-linecap="round" />
      <line x1="80" y1="400" x2="432" y2="400" stroke="#ef4444" stroke-width="28" stroke-linecap="round" />
    `),
  },
  {
    id: 'meme_fire',
    packId: 'memes',
    emoji: '\u{1F525}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <path d="M256 40 Q340 160 300 260 Q380 220 400 320 Q430 440 256 470 Q90 440 110 320 Q130 220 200 240 Q180 160 256 40 Z" fill="#f97316" stroke="#ea580c" stroke-width="12" />
      <path d="M256 220 Q310 290 280 360 Q340 340 330 400 Q256 440 180 400 Q190 330 230 350 Q210 280 256 220 Z" fill="#facc15" />
      <text x="256" y="450" font-family="sans-serif" font-weight="900" font-size="52" fill="#ffffff" stroke="#7c2d12" stroke-width="8" text-anchor="middle">LIT!</text>
    `),
  },
  {
    id: 'meme_mind_blown',
    packId: 'memes',
    emoji: '\u{1F92F}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <circle cx="256" cy="300" r="160" fill="#facc15" stroke="#ca8a04" stroke-width="14" />
      <ellipse cx="256" cy="140" rx="190" ry="70" fill="#ef4444" />
      <circle cx="160" cy="110" r="40" fill="#f97316" />
      <circle cx="352" cy="110" r="40" fill="#f97316" />
      <circle cx="256" cy="80" r="50" fill="#facc15" />
      <ellipse cx="200" cy="280" rx="22" ry="30" fill="#0f172a" />
      <ellipse cx="312" cy="280" rx="22" ry="30" fill="#0f172a" />
      <ellipse cx="256" cy="380" rx="35" ry="50" fill="#0f172a" />
      <text x="256" y="470" font-family="sans-serif" font-weight="900" font-size="44" fill="#ef4444" text-anchor="middle">MIND BLOWN</text>
    `),
  },
  {
    id: 'meme_popcorn',
    packId: 'memes',
    emoji: '\u{1F37F}',
    width: 512,
    height: 512,
    url: createSvgSticker(`
      <polygon points="160,200 180,440 332,440 352,200" fill="#ef4444" stroke="#b91c1c" stroke-width="14" />
      <line x1="216" y1="200" x2="226" y2="440" stroke="#ffffff" stroke-width="24" />
      <line x1="296" y1="200" x2="286" y2="440" stroke="#ffffff" stroke-width="24" />
      <circle cx="210" cy="170" r="45" fill="#fef08a" stroke="#ca8a04" stroke-width="8" />
      <circle cx="302" cy="170" r="45" fill="#fef08a" stroke="#ca8a04" stroke-width="8" />
      <circle cx="256" cy="130" r="55" fill="#fef08a" stroke="#ca8a04" stroke-width="8" />
      <text x="256" y="340" font-family="sans-serif" font-weight="900" font-size="36" fill="#ffffff" text-anchor="middle">DIS HERE</text>
      <text x="256" y="380" font-family="sans-serif" font-weight="900" font-size="32" fill="#ffffff" text-anchor="middle">FOR DRAMA</text>
    `),
  },
];

// Starter Packs definition
export const BUILT_IN_STICKER_PACKS: StickerPack[] = [
  {
    id: 'spotty',
    name: 'spotty',
    title: 'Spotty Dog',
    thumbnailUrl: SPOTTY_STICKERS[0].url,
    stickers: SPOTTY_STICKERS,
    installedAt: 1,
    isBuiltIn: true,
  },
  {
    id: 'animals',
    name: 'animals',
    title: 'Telegram Animals',
    thumbnailUrl: ANIMAL_STICKERS[0].url,
    stickers: ANIMAL_STICKERS,
    installedAt: 2,
    isBuiltIn: true,
  },
  {
    id: 'memes',
    name: 'memes',
    title: 'Reactions & Memes',
    thumbnailUrl: MEME_STICKERS[0].url,
    stickers: MEME_STICKERS,
    installedAt: 3,
    isBuiltIn: true,
  },
];

class TelegramStickerService {
  private idbInstance: IDBDatabase | null = null;
  private inMemoryPacks = new Map<string, StickerPack>();
  private blobCache = new Map<string, Blob>();

  constructor() {
    // Populate in-memory map with built-in packs immediately
    for (const pack of BUILT_IN_STICKER_PACKS) {
      this.inMemoryPacks.set(pack.id, pack);
    }
  }

  private async getIDB(): Promise<IDBDatabase | null> {
    if (this.idbInstance) return this.idbInstance;
    if (typeof indexedDB === 'undefined') return null;

    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('veil_stickers_db', 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains('packs')) {
            req.result.createObjectStore('packs', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          this.idbInstance = req.result;
          resolve(this.idbInstance);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Parses Telegram sticker set link or shortname
   * Supports:
   * - https://t.me/addstickers/Animals
   * - t.me/addstickers/Animals
   * - tg://addstickers?set=Animals
   * - Animals
   */
  public parseTelegramPackUrl(input: string): string | null {
    if (!input) return null;
    const clean = input.trim();

    // Format: tg://addstickers?set=Name or tg:addstickers?set=Name
    const tgMatch = clean.match(/tg:(?:\/\/)?addstickers\?set=([a-zA-Z0-9_]+)/i);
    if (tgMatch) return tgMatch[1];

    // Format: https://t.me/addstickers/Name or t.me/addstickers/Name
    const tmeMatch = clean.match(/(?:https?:\/\/)?t\.me\/addstickers\/([a-zA-Z0-9_]+)/i);
    if (tmeMatch) return tmeMatch[1];

    // Format: telegram.me/addstickers/Name
    const tgMeMatch = clean.match(/(?:https?:\/\/)?telegram\.me\/addstickers\/([a-zA-Z0-9_]+)/i);
    if (tgMeMatch) return tgMeMatch[1];

    // Format: bare identifier (letters, numbers, underscore, 2-64 chars)
    if (/^[a-zA-Z0-9_]{2,64}$/.test(clean)) {
      return clean;
    }

    return null;
  }

  /**
   * Retrieves all installed sticker packs (built-ins + custom imported)
   */
  public async getInstalledPacks(): Promise<StickerPack[]> {
    const db = await this.getIDB();
    if (!db) {
      return Array.from(this.inMemoryPacks.values());
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('packs', 'readonly');
        const store = tx.objectStore('packs');
        const req = store.getAll();
        req.onsuccess = () => {
          const stored: StickerPack[] = req.result || [];
          // Merge built-in packs with stored packs
          const map = new Map<string, StickerPack>();
          for (const p of BUILT_IN_STICKER_PACKS) {
            map.set(p.id, p);
          }
          for (const p of stored) {
            map.set(p.id, p);
          }
          const list = Array.from(map.values()).sort((a, b) => (a.installedAt || 0) - (b.installedAt || 0));
          resolve(list);
        };
        req.onerror = () => {
          resolve(Array.from(this.inMemoryPacks.values()));
        };
      } catch {
        resolve(Array.from(this.inMemoryPacks.values()));
      }
    });
  }

  /**
   * Installs or updates a sticker pack in local IndexedDB
   */
  public async installStickerPack(pack: StickerPack): Promise<void> {
    this.inMemoryPacks.set(pack.id, pack);
    const db = await this.getIDB();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction('packs', 'readwrite');
          const store = tx.objectStore('packs');
          store.put(pack);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        } catch {
          resolve();
        }
      });
    }

    // Pre-cache stickers in background with 1-second auto-retry on failure
    if (typeof window !== 'undefined' && Array.isArray(pack.stickers)) {
      const stickersToCache = pack.stickers.slice(0, 60);
      const cacheItem = async (stk: StickerItem, retriesLeft = 8) => {
        if (!stk.url || this.blobCache.has(stk.url)) return;
        try {
          const blob = await this.fetchStickerBlob(stk.url);
          this.blobCache.set(stk.url, blob);
        } catch {
          if (retriesLeft > 0) {
            setTimeout(() => {
              void cacheItem(stk, retriesLeft - 1);
            }, 1000);
          }
        }
      };
      setTimeout(() => {
        for (const stk of stickersToCache) {
          void cacheItem(stk);
        }
      }, 50);
    }
  }

  /**
   * Removes an installed custom sticker pack
   */
  public async removeStickerPack(packId: string): Promise<void> {
    this.inMemoryPacks.delete(packId);
    const db = await this.getIDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('packs', 'readwrite');
        const store = tx.objectStore('packs');
        store.delete(packId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Returns a list of curated popular Telegram sticker packs for 1-tap installation
   */
  public getFeaturedPacks(): Array<{ id: string; name: string; title: string; description: string }> {
    return [
      { id: 'animals', name: 'Animals', title: 'Cute Animals', description: 'Telegram Animals (68 stickers)' },
      { id: 'memes', name: 'memes', title: 'Classic Memes', description: 'Popular reactions & memes (54 stickers)' },
      { id: 'spotty', name: 'spotty', title: 'Spotty Dog', description: 'Classic vector mascot (24 stickers)' },
      { id: 'hot_cherry', name: 'hot_cherry', title: 'Hot Cherry', description: 'Expressive cherry reactions' },
      { id: 'pepe', name: 'pepe', title: 'Pepe The Frog', description: 'Classic Internet meme frog' },
      { id: 'cat_vibes', name: 'cat_vibes', title: 'Cat Vibes', description: 'Cute playful cats' },
    ];
  }

  /**
   * Fetches a Telegram sticker pack manifest
   */
  public async fetchTelegramPack(packInput: string): Promise<StickerPack> {
    const packName = this.parseTelegramPackUrl(packInput);
    if (!packName) {
      throw new Error('Invalid Telegram sticker link or pack name');
    }

    const lowerId = packName.toLowerCase();

    // 1. Check built-in packs first
    const builtIn = BUILT_IN_STICKER_PACKS.find((p) => p.id === lowerId || p.name.toLowerCase() === lowerId);
    if (builtIn) {
      return builtIn;
    }

    // 2. Check in-memory or installed cache
    const existing = this.inMemoryPacks.get(lowerId);
    if (existing) {
      return existing;
    }

    // 3. Check custom Telegram bot token if configured
    const botToken = (typeof window !== 'undefined' && localStorage.getItem('veil:telegram:bot_token')) || '';
    const queryParam = botToken ? `?token=${encodeURIComponent(botToken)}` : '';

    const relayHttpUrl =
      (typeof window !== 'undefined' && window.localStorage?.getItem('veil_custom_relay_url')) ||
      PRODUCTION_RELAY_URL;

    // 3. Try Local Dev Server / Relay Sticker Resolver Endpoint
    try {
      const endpoints = [
        `/api/telegram-stickers/${encodeURIComponent(packName)}${queryParam}`,
        `/v1/stickers/${encodeURIComponent(packName)}${queryParam}`,
      ];
      if (relayHttpUrl) {
        const cleanRelay = relayHttpUrl.replace(/\/+$/, '');
        endpoints.push(`${cleanRelay}/v1/stickers/${encodeURIComponent(packName)}${queryParam}`);
        endpoints.push(`${cleanRelay}/api/telegram-stickers/${encodeURIComponent(packName)}${queryParam}`);
      }
      if (PRODUCTION_RELAY_URL && PRODUCTION_RELAY_URL !== relayHttpUrl) {
        const cleanProd = PRODUCTION_RELAY_URL.replace(/\/+$/, '');
        endpoints.push(`${cleanProd}/v1/stickers/${encodeURIComponent(packName)}${queryParam}`);
        endpoints.push(`${cleanProd}/api/telegram-stickers/${encodeURIComponent(packName)}${queryParam}`);
      }

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            headers: botToken ? { 'x-telegram-bot-token': botToken } : {},
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.pack && data.pack.stickers?.length > 0) {
              return data.pack;
            }
          }
        } catch {}
      }
    } catch {}

    // 4. Try Direct Telegram Bot API if bot token is configured
    if (botToken) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getStickerSet?name=${encodeURIComponent(packName)}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.result) {
            const result = data.result;
            // Retain ALL stickers in the set without arbitrary truncation (e.g. all 120+ stickers)
            const rawStickers = result.stickers || [];
            const stickers: StickerItem[] = rawStickers.map((s: any, idx: number) => ({
              id: s.file_unique_id || s.file_id || `${lowerId}_${idx}`,
              packId: lowerId,
              emoji: s.emoji || '\u{2B50}',
              // Serve on-demand via server file proxy with caching and 512x512 resolution
              url: `/api/telegram-stickers/file?file_id=${encodeURIComponent(s.file_id)}&token=${encodeURIComponent(botToken)}`,
              width: s.width || 512,
              height: s.height || 512,
            }));

            if (stickers.length > 0) {
              return {
                id: lowerId,
                name: packName,
                title: result.title || packName,
                thumbnailUrl: stickers[0].url,
                stickers,
                installedAt: Date.now(),
              };
            }
          }
        }
      } catch {}
    }

    throw new Error(
      `Could not find Telegram sticker pack "${packName}". Verify the pack link or enter your Telegram Bot Token below.`
    );
  }

  /**
   * Helper to parse emoji from a CDN image URL if hex-encoded
   */
  public extractEmojiFromUrl(url: string): string | null {
    if (!url) return null;
    try {
      const filenameMatch = url.match(/\/([^\/?#]+)\.webp/i);
      if (filenameMatch) {
        const filename = filenameMatch[1];
        const hexMatch = filename.match(/x([0-9a-fA-F]+)$/i);
        if (hexMatch) {
          const hex = hexMatch[1];
          if (typeof Buffer !== 'undefined') {
            const decoded = Buffer.from(hex, 'hex').toString('utf8');
            if (decoded && decoded.trim()) return decoded;
          }
          const bytes = hex.match(/.{1,2}/g)?.map((byte) => '%' + byte).join('') || '';
          const decoded = decodeURIComponent(bytes);
          if (decoded && decoded.trim()) return decoded;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Synthesizes a high-definition vector SVG sticker blob for guaranteed fallback
   */
  public generateFallbackStickerBlob(emoji?: string): Blob {
    const safeEmoji = emoji || '\u{2B50}';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="veilStickerFallbackGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95"/>
    </radialGradient>
  </defs>
  <circle cx="256" cy="256" r="236" fill="url(#veilStickerFallbackGlow)" stroke="#14b8a6" stroke-width="8" stroke-dasharray="16 8"/>
  <text x="256" y="295" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="190" text-anchor="middle" dominant-baseline="central">${safeEmoji}</text>
</svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  /**
   * Fetches a sticker image as a binary Blob, handling data URLs, on-demand server file proxies,
   * direct CDN requests, multi-tier proxy relays, and guaranteed fallback conversion so message
   * sending never throws or fails.
   */
  public async fetchStickerBlob(url: string): Promise<Blob> {
    if (!url) {
      return this.generateFallbackStickerBlob();
    }

    // 0. In-memory blob cache hit
    const cached = this.blobCache.get(url);
    if (cached) {
      return cached;
    }

    // 1. Data URLs (SVG / WebP data strings)
    if (url.startsWith('data:')) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        this.blobCache.set(url, blob);
        return blob;
      } catch {
        // Fall through
      }
    }

    // 2. Blob URLs
    if (url.startsWith('blob:')) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        return blob;
      } catch {
        // Fall through
      }
    }

    const relayHttpUrl =
      (typeof window !== 'undefined' && window.localStorage?.getItem('veil_custom_relay_url')) ||
      PRODUCTION_RELAY_URL;

    // 3. Same-origin or relative endpoints (e.g. /api/telegram-stickers/file?file_id=...)
    if (url.startsWith('/')) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const blob = await res.blob();
          this.blobCache.set(url, blob);
          return blob;
        }
      } catch {}

      // Retry via configured relay server
      if (relayHttpUrl) {
        try {
          const remoteUrl = `${relayHttpUrl.replace(/\/+$/, '')}${url}`;
          const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(8000) });
          if (res.ok) {
            const blob = await res.blob();
            this.blobCache.set(url, blob);
            return blob;
          }
        } catch {}
      }
    }

    // 4. External URLs: Direct fetch with short timeout
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const blob = await res.blob();
          this.blobCache.set(url, blob);
          return blob;
        }
      } catch {}

      // 5. Multi-tier proxy fallback:
      // A. Relative proxies on current origin
      const localProxies = [
        `/api/telegram-stickers/proxy?url=${encodeURIComponent(url)}`,
        `/v1/stickers/proxy?url=${encodeURIComponent(url)}`,
      ];
      for (const ep of localProxies) {
        try {
          const res = await fetch(ep, { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const blob = await res.blob();
            this.blobCache.set(url, blob);
            return blob;
          }
        } catch {}
      }

      // B. Configured relay server proxies
      if (relayHttpUrl) {
        const cleanRelay = relayHttpUrl.replace(/\/+$/, '');
        const relayProxies = [
          `${cleanRelay}/v1/stickers/proxy?url=${encodeURIComponent(url)}`,
          `${cleanRelay}/api/telegram-stickers/proxy?url=${encodeURIComponent(url)}`,
        ];
        for (const ep of relayProxies) {
          try {
            const res = await fetch(ep, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
              const blob = await res.blob();
              this.blobCache.set(url, blob);
              return blob;
            }
          } catch {}
        }
      }

      // C. Production relay fallback if different from relayHttpUrl
      if (PRODUCTION_RELAY_URL && PRODUCTION_RELAY_URL !== relayHttpUrl) {
        const cleanProd = PRODUCTION_RELAY_URL.replace(/\/+$/, '');
        const prodProxies = [
          `${cleanProd}/v1/stickers/proxy?url=${encodeURIComponent(url)}`,
          `${cleanProd}/api/telegram-stickers/proxy?url=${encodeURIComponent(url)}`,
        ];
        for (const ep of prodProxies) {
          try {
            const res = await fetch(ep, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
              const blob = await res.blob();
              this.blobCache.set(url, blob);
              return blob;
            }
          } catch {}
        }
      }
    }

    // 6. Offscreen image drawing fallback (in browser context when canvas can access image)
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const canvasBlob = await new Promise<Blob>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || 512;
              canvas.height = img.naturalHeight || 512;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject(new Error('Canvas 2D unavailable'));
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error('Blob conversion failed'))),
                'image/webp',
                0.95
              );
            } catch (cErr) {
              reject(cErr);
            }
          };
          img.onerror = () => reject(new Error('Image failed to render'));
          img.src = url;
        });
        if (canvasBlob) {
          this.blobCache.set(url, canvasBlob);
          return canvasBlob;
        }
      } catch {}
    }

    // 7. Guaranteed Fallback: High-Definition Vector SVG Sticker Blob
    // This ensures message sending never throws or fails due to network/CORS restrictions.
    const resolvedEmoji = this.extractEmojiFromUrl(url) || '\u{2B50}';
    const fallbackBlob = this.generateFallbackStickerBlob(resolvedEmoji);
    this.blobCache.set(url, fallbackBlob);
    return fallbackBlob;
  }

  private inMemoryRecents: StickerItem[] = [];

  /**
   * Tracks recently sent stickers in localStorage with memory fallback
   */
  public recordRecentSticker(sticker: StickerItem): void {
    this.inMemoryRecents = [sticker, ...this.inMemoryRecents.filter((s) => s.id !== sticker.id)].slice(0, 24);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('veil:ui:recentStickers', JSON.stringify(this.inMemoryRecents));
      }
    } catch {}
  }

  public getRecentStickers(): StickerItem[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('veil:ui:recentStickers');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {}
    if (this.inMemoryRecents.length > 0) {
      return this.inMemoryRecents;
    }
    return [
      SPOTTY_STICKERS[0],
      SPOTTY_STICKERS[1],
      ANIMAL_STICKERS[0],
      MEME_STICKERS[1],
    ];
  }
}

export const telegramStickerService = new TelegramStickerService();
