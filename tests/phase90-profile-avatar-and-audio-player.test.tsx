/**
 * Phase 90 Test Suite: Account Profile Avatar in Header & AudioPlayerCard Inline Playback
 *
 * Verifies:
 * 1. Sidebar Header Profile Avatar:
 *    - Replaces static MenuIcon hamburger with circular Avatar bound to myProfile.
 *    - Preserves exact openModal({ type: 'settings' }) action.
 *    - Avatar receives displayName, avatar/avatarUrl, seed, and size=32.
 *    - .veil-sidebar-profile-btn has hover scale and subtle glow styling.
 * 2. AudioPlayerCard Inline Playback vs Download Decoupling:
 *    - handlePlayToggle resolves audio in-memory via onResolveAudio / MediaCache without saving to disk.
 *    - handlePlayToggle does NOT invoke onDownload().
 *    - Dedicated download icon button calls onDownload() for saving to storage.
 *    - Footer subtitle displays clean time (formatTime(currentTime)) and size (formatSize(sizeBytes))
 *      without duplicate "13.5 MB13.5 MB" interpolation.
 * 3. ConversationView Audio Attachment Resolver:
 *    - Implements handleResolveAudioAttachment using MediaCache.getOrFetch.
 *    - Caches decrypted buffer in MediaCache and passes onResolveAudio to AudioPlayerCard.
 * 4. Phase 44a Zero Literal Unicode Emoji Compliance in all touched files.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 90 — Sidebar Header Account Profile Avatar', () => {
  it('Sidebar.tsx replaces hamburger MenuIcon with Avatar bound to myProfile', () => {
    const sidebar = fs.readFileSync(path.join(rootDir, 'src/ui/components/Sidebar.tsx'), 'utf-8');

    // Verify Avatar is rendered inside the top-left header button
    expect(sidebar).toMatch(/className="veil-sidebar-profile-btn"[\s\S]*?<Avatar/);
    expect(sidebar).toContain("name={myProfile?.displayName || myProfile?.username || 'Me'}");
    expect(sidebar).toContain("imageUrl={myProfile?.avatar || myProfile?.avatarUrl}");
    expect(sidebar).toContain("size={32}");

    // Verify exact same settings modal action is preserved
    expect(sidebar).toMatch(/onClick=\{\(\)\s*=>\s*openModal\(\{\s*type:\s*'settings'/);
  });

  it('veil-components.css styles .veil-sidebar-profile-btn with hover micro-animations', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-components.css'), 'utf-8');

    expect(css).toMatch(/\.veil-sidebar-profile-btn\s*\{[^}]*border-radius:\s*50%/);
    expect(css).toMatch(/\.veil-sidebar-profile-btn:hover\s*\{[^}]*transform:\s*scale\(1\.06\)/);
    expect(css).toMatch(/\.veil-sidebar-profile-btn:hover\s*\{[^}]*box-shadow:\s*0\s+0\s+12px/);
  });
});

describe('Phase 90 — AudioPlayerCard Inline Playback & Decoupled Download', () => {
  it('AudioPlayerCardProps defines onResolveAudio, objectId, and attachmentId', () => {
    const audioCard = fs.readFileSync(path.join(rootDir, 'src/ui/components/ui/AudioPlayerCard.tsx'), 'utf-8');

    expect(audioCard).toContain('onResolveAudio?: () => Promise<string | undefined>;');
    expect(audioCard).toContain('objectId?: string;');
    expect(audioCard).toContain('attachmentId?: string;');
  });

  it('AudioPlayerCard handlePlayToggle fetches in-memory and does NOT call onDownload', () => {
    const audioCard = fs.readFileSync(path.join(rootDir, 'src/ui/components/ui/AudioPlayerCard.tsx'), 'utf-8');

    // Verify handlePlayToggle calls onResolveAudio instead of onDownload
    expect(audioCard).toMatch(/if\s*\(!resolvedBlobUrl\)\s*\{[\s\S]*?onResolveAudio\(\)[\s\S]*?setResolvedBlobUrl\(url\)/);
    expect(audioCard).not.toMatch(/if\s*\(!resolvedBlobUrl\)\s*\{[\s\S]*?await\s+onDownload\(\)/);

    // Verify onDownload is strictly bound to the header download icon button
    expect(audioCard).toMatch(/className="veil-audio-player-download-btn"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?onDownload\(\)/);
  });

  it('AudioPlayerCard footer cleanly formats time and size without duplication', () => {
    const audioCard = fs.readFileSync(path.join(rootDir, 'src/ui/components/ui/AudioPlayerCard.tsx'), 'utf-8');

    // Verify conditional duration formatting
    expect(audioCard).toContain(
      "duration > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : formatTime(currentTime)"
    );
    expect(audioCard).toContain('<span className="veil-audio-player-size">');
  });

  it('veil-components.css provides comprehensive styles for AudioPlayerCard', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-components.css'), 'utf-8');

    expect(css).toContain('.veil-audio-player-card');
    expect(css).toContain('.veil-audio-player-play-btn');
    expect(css).toContain('.veil-audio-player-title');
    expect(css).toContain('.veil-audio-player-download-btn');
    expect(css).toContain('.veil-audio-player-track-fill');
    expect(css).toContain('.veil-audio-player-needle');
    expect(css).toContain('.veil-audio-player-footer');
  });
});

describe('Phase 90 — ConversationView In-Memory Audio Resolver', () => {
  it('ConversationView implements handleResolveAudioAttachment without FileSaver', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Verify resolver implementation
    expect(convView).toContain('handleResolveAudioAttachment = useCallback(async (msg: UIMessage)');
    expect(convView).toContain('MediaCache.getOrFetch(msg.attachment, activeSession, cloudClient)');
    expect(convView).toContain('MediaCache.set(msg.id, decrypted)');

    // Verify passed to AudioPlayerCard
    expect(convView).toContain('onResolveAudio={handleResolveAudioAction}');
    expect(convView).toContain('objectId={msg.attachment.objectId}');
  });

  it('Strict Phase 44a Zero Raw Literal Unicode Emoji Compliance', () => {
    const sidebar = fs.readFileSync(path.join(rootDir, 'src/ui/components/Sidebar.tsx'), 'utf-8');
    const audioCard = fs.readFileSync(path.join(rootDir, 'src/ui/components/ui/AudioPlayerCard.tsx'), 'utf-8');
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    const rawEmojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

    expect(rawEmojiRegex.test(sidebar)).toBe(false);
    expect(rawEmojiRegex.test(audioCard)).toBe(false);
    expect(rawEmojiRegex.test(convView)).toBe(false);
  });
});
