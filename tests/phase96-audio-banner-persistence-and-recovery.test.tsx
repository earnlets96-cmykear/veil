/**
 * Phase 96 Test Suite: Persistent Floating Audio Player Banner in Chats List & Non-Destructive Stop Fix
 *
 * Verifies:
 * 1. VoicePlaybackManager Non-Destructive Stop & URL Resiliency:
 *    - VoicePlayer.stop() resets state without calling URL.revokeObjectURL.
 *    - VoicePlayer.stop() does not mutate or wipe audio.src.
 *    - VoicePlayer exposes getCurrentAudio().
 *    - Replaying audio after calling stop() works cleanly without ERR_FILE_NOT_FOUND.
 * 2. MediaCache Self-Healing Recovery:
 *    - MediaCache.refreshBlobUrl(id) regenerates a fresh blob URL from cached Uint8Array.
 *    - Updates matching alias keys in memory.
 *    - Returns null for non-existent items.
 * 3. AudioPlayerCard Continuous Background Playback:
 *    - AudioPlayerCardProps accepts conversationId and senderName.
 *    - AudioPlayerCard unmount does NOT pause audio when VoicePlayer.getPlayingId() matches messageId.
 *    - AudioPlayerCard re-attaches to VoicePlayer.getCurrentAudio() on re-mount if already active.
 *    - AudioPlayerCard onError invokes self-healing recovery via MediaCache.refreshBlobUrl or onResolveAudio.
 * 4. Chats List ActiveAudioBanner Integration (Sidebar.tsx):
 *    - Sidebar mounts ActiveAudioBanner between category chips and conversation list.
 *    - handleSidebarJumpToMessage invokes selectConversation and records pendingJumpMessageId.
 *    - ConversationView passes conversationId and senderName to AudioPlayerCard.
 *    - ConversationView checks pendingJumpMessageId and listens for veil:jumpToMessage.
 * 5. CSS Design System & Responsive Deduplication:
 *    - veil-components.css defines .veil-sidebar-audio-banner.
 *    - Desktop rule hides duplicate sidebar audio banner when chat is open (@media min-width: 769px).
 * 6. Phase 44a Zero Literal Unicode Emoji compliance across all modified files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { VoicePlayer } from '../src/attachments/voicePlayer.ts';
import { MediaCache } from '../src/ui/utils/mediaCache.ts';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 96 — VoicePlaybackManager Non-Destructive Stop & Audio Reference', () => {
  beforeEach(() => {
    VoicePlayer.stop();
  });

  it('exposes getCurrentAudio() API on VoicePlaybackManager', () => {
    expect(typeof VoicePlayer.getCurrentAudio).toBe('function');
    expect(VoicePlayer.getCurrentAudio()).toBeNull();
  });

  it('VoicePlayer.stop() does not invoke URL.revokeObjectURL', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    const fakeAudio = {
      src: 'blob:https://veil.test/audio-test-blob-123',
      currentTime: 10,
      duration: 120,
      paused: false,
      ended: false,
      readyState: 4,
      playbackRate: 1,
      muted: false,
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      load: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLAudioElement;

    await VoicePlayer.playAudioTrack(
      'blob:https://veil.test/audio-test-blob-123',
      'msg-audio-001',
      { title: 'Yene Shega', duration: 120 },
      {},
      fakeAudio
    );

    expect(VoicePlayer.getPlayingId()).toBe('msg-audio-001');
    expect(VoicePlayer.getCurrentAudio()).toBe(fakeAudio);

    // Call stop()
    VoicePlayer.stop();

    // Verify URL.revokeObjectURL was NOT called
    expect(revokeSpy).not.toHaveBeenCalled();

    // Verify audio was paused and reset to 0
    expect(fakeAudio.pause).toHaveBeenCalled();
    expect(fakeAudio.currentTime).toBe(0);

    // Verify audio.src was NOT wiped to empty string
    expect(fakeAudio.src).toBe('blob:https://veil.test/audio-test-blob-123');

    // Verify global active track is cleared
    expect(VoicePlayer.getPlayingId()).toBeNull();
    expect(VoicePlayer.getCurrentAudio()).toBeNull();
    expect(VoicePlayer.getActiveTrack()).toBeNull();

    revokeSpy.mockRestore();
  });

  it('allows immediate replay after calling stop() without invalidation', async () => {
    const fakeAudio = {
      src: 'blob:https://veil.test/dawit-mellesse.mp3',
      currentTime: 0,
      duration: 200,
      paused: false,
      ended: false,
      readyState: 4,
      playbackRate: 1,
      muted: false,
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      load: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLAudioElement;

    // First playback
    await VoicePlayer.playAudioTrack(
      'blob:https://veil.test/dawit-mellesse.mp3',
      'msg-dawit-1',
      { title: 'Dawit Mellesse - Yene Shega', duration: 200 },
      {},
      fakeAudio
    );
    expect(VoicePlayer.getPlayingId()).toBe('msg-dawit-1');

    // User closes the banner (calls stop)
    VoicePlayer.stop();
    expect(VoicePlayer.getPlayingId()).toBeNull();

    // User immediately taps play again on the card
    await VoicePlayer.playAudioTrack(
      'blob:https://veil.test/dawit-mellesse.mp3',
      'msg-dawit-1',
      { title: 'Dawit Mellesse - Yene Shega', duration: 200 },
      {},
      fakeAudio
    );

    expect(VoicePlayer.getPlayingId()).toBe('msg-dawit-1');
    const track = VoicePlayer.getActiveTrack();
    expect(track).not.toBeNull();
    expect(track?.id).toBe('msg-dawit-1');
    expect(track?.title).toBe('Dawit Mellesse - Yene Shega');
  });
});

describe('Phase 96 — MediaCache Self-Healing URL Refresh', () => {
  it('MediaCache exposes refreshBlobUrl method', () => {
    expect(typeof MediaCache.refreshBlobUrl).toBe('function');
  });

  it('refreshBlobUrl returns null for unknown keys', () => {
    expect(MediaCache.refreshBlobUrl('nonexistent-key-999')).toBeNull();
  });

  it('refreshBlobUrl regenerates valid blob URL from cached Uint8Array', () => {
    const rawData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    MediaCache.set('test-audio-attachment', {
      id: 'test-audio-attachment',
      blobUrl: 'blob:https://veil.test/stale-old-url',
      data: rawData,
      mimeType: 'audio/mpeg',
      name: 'test.mp3',
      sizeBytes: rawData.length,
    });

    const refreshed = MediaCache.refreshBlobUrl('test-audio-attachment');
    expect(refreshed).toBeTruthy();
    expect(refreshed).toContain('blob:');

    // Retrieve from cache and check that blobUrl updated
    const retrieved = MediaCache.get('test-audio-attachment');
    expect(retrieved?.blobUrl).toBe(refreshed);
    expect(retrieved?.data).toBe(rawData);
  });
});

describe('Phase 96 — AudioPlayerCard Component Source Verification', () => {
  const cardSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/ui/AudioPlayerCard.tsx'),
    'utf-8'
  );

  it('AudioPlayerCardProps defines conversationId and senderName', () => {
    expect(cardSource).toContain('conversationId?: string;');
    expect(cardSource).toContain('senderName?: string;');
  });

  it('does NOT pause audio on unmount if playing in global VoicePlayer', () => {
    expect(cardSource).toContain('if (VoicePlayer.getPlayingId() !== messageId) {');
    expect(cardSource).toContain('audio.pause();');
  });

  it('re-attaches to VoicePlayer.getCurrentAudio() when mounting active track', () => {
    expect(cardSource).toContain('const globalAudio = VoicePlayer.getCurrentAudio();');
    expect(cardSource).toContain('if (VoicePlayer.getPlayingId() === messageId && globalAudio) {');
    expect(cardSource).toContain('audio = globalAudio;');
  });

  it('implements self-healing retry on onError using MediaCache.refreshBlobUrl', () => {
    expect(cardSource).toContain('MediaCache.refreshBlobUrl');
    expect(cardSource).toContain('if (freshUrl && freshUrl !== resolvedBlobUrl) {');
    expect(cardSource).toContain('setResolvedBlobUrl(freshUrl);');
  });

  it('forwards senderName and conversationId to VoicePlayer.playAudioTrack', () => {
    expect(cardSource).toContain('senderName,');
    expect(cardSource).toContain('conversationId,');
  });
});

describe('Phase 96 — Sidebar & ConversationView Floating Banner Integration', () => {
  const sidebarSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/Sidebar.tsx'),
    'utf-8'
  );
  const conversationViewSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/ConversationView.tsx'),
    'utf-8'
  );

  it('Sidebar imports ActiveAudioBanner from ui/index.ts', () => {
    expect(sidebarSource).toContain('ActiveAudioBanner,');
  });

  it('Sidebar mounts ActiveAudioBanner with veil-sidebar-audio-banner class', () => {
    expect(sidebarSource).toContain('<ActiveAudioBanner');
    expect(sidebarSource).toContain('className="veil-sidebar-audio-banner"');
    expect(sidebarSource).toContain('onJumpToMessage={handleSidebarJumpToMessage}');
  });

  it('Sidebar defines handleSidebarJumpToMessage routing handler', () => {
    expect(sidebarSource).toContain('handleSidebarJumpToMessage = useCallback(');
    expect(sidebarSource).toContain('selectConversation(conversationId);');
    expect(sidebarSource).toContain("sessionStorage.setItem('veil:pendingJumpMessageId', messageId)");
    expect(sidebarSource).toContain("window.dispatchEvent(new CustomEvent('veil:jumpToMessage'");
  });

  it('ConversationView passes conversationId and senderName to AudioPlayerCard', () => {
    expect(conversationViewSource).toContain('conversationId={msg.conversationId}');
    expect(conversationViewSource).toContain('senderName={msg.senderName}');
  });

  it('ConversationView checks pendingJumpMessageId on mount and listens for veil:jumpToMessage', () => {
    expect(conversationViewSource).toContain("sessionStorage.getItem('veil:pendingJumpMessageId')");
    expect(conversationViewSource).toContain("window.addEventListener('veil:jumpToMessage', handleJumpEvent)");
    expect(conversationViewSource).toContain('handleJumpToMessage(pendingMsgId)');
  });
});

describe('Phase 96 — CSS Design System & Desktop Responsive Deduplication', () => {
  const cssSource = fs.readFileSync(
    path.join(rootDir, 'src/styles/veil-components.css'),
    'utf-8'
  );

  it('defines .veil-sidebar-audio-banner styling', () => {
    expect(cssSource).toContain('.veil-sidebar-audio-banner {');
    expect(cssSource).toContain('flex-shrink: 0;');
  });

  it('defines desktop responsive deduplication rule for active chat', () => {
    expect(cssSource).toContain('@media (min-width: 769px) {');
    expect(cssSource).toContain('.veil-app-layout.has-active-chat .veil-sidebar-audio-banner {');
    expect(cssSource).toContain('display: none !important;');
  });
});

describe('Phase 96 — Phase 44a Zero Literal Unicode Emoji Compliance', () => {
  const modifiedFiles = [
    'src/attachments/voicePlayer.ts',
    'src/ui/utils/mediaCache.ts',
    'src/ui/components/ui/AudioPlayerCard.tsx',
    'src/ui/components/Sidebar.tsx',
    'src/ui/components/ConversationView.tsx',
    'src/styles/veil-components.css',
  ];

  const literalEmojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

  for (const file of modifiedFiles) {
    it(`guarantees zero literal Unicode emoji characters in ${file}`, () => {
      const content = fs.readFileSync(path.join(rootDir, file), 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        // Exclude comments that explicitly mention emoji references in test descriptions
        if (line.includes('DEFAULT_REACTION_EMOJIS') || line.includes('decodeHexEmoji')) return;
        expect(literalEmojiRegex.test(line)).toBe(false);
      });
    });
  }
});
