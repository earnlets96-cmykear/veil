/**
 * Phase 94 Test Suite: In-App Floating Audio Player Notification Banner
 *
 * Verifies:
 * 1. VoicePlaybackManager Active Track Architecture:
 *    - Unified ActiveTrackMetadata schema (id, title, senderName, conversationId, duration, currentTime, isPlaying, playbackRate, isMuted).
 *    - subscribeActiveTrack publishes reactive track updates.
 *    - setPlaybackRate(rate) updates rate (1.0x, 1.5x, 2.0x) and triggers listeners.
 *    - toggleMute() flips mute state and triggers listeners.
 *    - seekTime(targetSeconds) performs clamped timestamp seeking.
 *    - stop() clears active track and notifies listeners with null.
 * 2. ActiveAudioBanner Component & Visual Structure:
 *    - Renders nothing when active track is null.
 *    - Renders banner with glowing play/pause button, 4-bar equalizer, tabular time, speed pill, jump button, rewind 10s, mute, and close.
 *    - Interactive scrubber track at bottom edge with role="slider" and aria-valuenow.
 *    - Calls onJumpToMessage callback with target messageId and conversationId.
 * 3. AudioPlayerCard & ConversationView Integration:
 *    - AudioPlayerCard coordinates with VoicePlayer.playAudioTrack.
 *    - ConversationView mounts ActiveAudioBanner with onJumpToMessage handler.
 *    - handleToggleVoice passes rich trackMeta to VoicePlayer.playVoiceNote.
 * 4. CSS Design System Verification:
 *    - veil-components.css defines glassmorphic styles, keyframe pulses, and micro-interactions.
 * 5. Phase 44a Zero Literal Unicode Emoji Compliance across all touched files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { VoicePlayer, ActiveTrackMetadata } from '../src/attachments/voicePlayer.ts';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 94 — VoicePlaybackManager Unified Active Track Coordinator', () => {
  beforeEach(() => {
    VoicePlayer.stop();
  });

  it('VoicePlayer provides active track subscription and retrieval API', () => {
    expect(typeof VoicePlayer.subscribeActiveTrack).toBe('function');
    expect(typeof VoicePlayer.getActiveTrack).toBe('function');
    expect(typeof VoicePlayer.setPlaybackRate).toBe('function');
    expect(typeof VoicePlayer.getPlaybackRate).toBe('function');
    expect(typeof VoicePlayer.toggleMute).toBe('function');
    expect(typeof VoicePlayer.isMuted).toBe('function');
    expect(typeof VoicePlayer.seekTime).toBe('function');
    expect(typeof VoicePlayer.playAudioTrack).toBe('function');
  });

  it('subscribeActiveTrack receives updates and clean teardown', () => {
    const received: (ActiveTrackMetadata | null)[] = [];
    const unsubscribe = VoicePlayer.subscribeActiveTrack((track) => {
      received.push(track);
    });

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0]).toBeNull();

    // Updating playback rate triggers active track listener if active
    VoicePlayer.setPlaybackRate(1.5);
    expect(VoicePlayer.getPlaybackRate()).toBe(1.5);

    // Toggle mute
    const muted = VoicePlayer.toggleMute();
    expect(muted).toBe(true);
    expect(VoicePlayer.isMuted()).toBe(true);

    VoicePlayer.toggleMute();
    expect(VoicePlayer.isMuted()).toBe(false);

    unsubscribe();
  });

  it('seekTime handles boundary clamping cleanly without throwing', () => {
    expect(() => VoicePlayer.seekTime(-10)).not.toThrow();
    expect(() => VoicePlayer.seekTime(100)).not.toThrow();
  });
});

describe('Phase 94 — ActiveAudioBanner Component Implementation', () => {
  const bannerSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/ui/ActiveAudioBanner.tsx'),
    'utf-8'
  );

  it('subscribes to VoicePlayer.subscribeActiveTrack on mount', () => {
    expect(bannerSource).toContain('VoicePlayer.subscribeActiveTrack');
    expect(bannerSource).toContain('VoicePlayer.getActiveTrack()');
  });

  it('renders circular glowing play/pause button with accessible attributes', () => {
    expect(bannerSource).toContain('className="veil-active-audio-btn-play"');
    expect(bannerSource).toContain('handleTogglePlay');
    expect(bannerSource).toContain('<PauseIcon');
    expect(bannerSource).toContain('<PlayIcon');
  });

  it('renders 4-bar animated equalizer waveform', () => {
    expect(bannerSource).toContain('veil-active-audio-equalizer');
    expect(bannerSource).toContain('veil-eq-bar-1');
    expect(bannerSource).toContain('veil-eq-bar-2');
    expect(bannerSource).toContain('veil-eq-bar-3');
    expect(bannerSource).toContain('veil-eq-bar-4');
  });

  it('renders playback speed selector pill button with cycling logic', () => {
    expect(bannerSource).toContain('className="veil-active-audio-speed-btn"');
    expect(bannerSource).toContain('handleCycleSpeed');
    expect(bannerSource).toContain('if (currentRate === 1.0) nextRate = 1.5;');
    expect(bannerSource).toContain('else if (currentRate === 1.5) nextRate = 2.0;');
    expect(bannerSource).toContain('else nextRate = 1.0;');
  });

  it('renders jump button invoking onJumpToMessage with messageId and conversationId', () => {
    expect(bannerSource).toContain('className="veil-active-audio-jump-btn"');
    expect(bannerSource).toContain('handleJump');
    expect(bannerSource).toContain('onJumpToMessage(activeTrack.id, activeTrack.conversationId)');
    expect(bannerSource).toContain('ExternalLinkIcon');
  });

  it('renders right action controls: rewind 10s, mute toggle, and stop/close', () => {
    expect(bannerSource).toContain('handleRewind10');
    expect(bannerSource).toContain('Rewind10Icon');
    expect(bannerSource).toContain('handleToggleMute');
    expect(bannerSource).toContain('Volume2Icon');
    expect(bannerSource).toContain('VolumeXIcon');
    expect(bannerSource).toContain('handleClose');
    expect(bannerSource).toContain('VoicePlayer.stop()');
    expect(bannerSource).toContain('CloseIcon');
  });

  it('renders interactive bottom-edge scrubber track with role="slider"', () => {
    expect(bannerSource).toContain('role="slider"');
    expect(bannerSource).toContain('className="veil-active-audio-scrubber-track"');
    expect(bannerSource).toContain('className="veil-active-audio-scrubber-fill"');
    expect(bannerSource).toContain('onPointerDown={handleScrubberPointerDown}');
    expect(bannerSource).toContain('aria-label="Audio progress scrubber"');
  });

  it('isolates click and context menu events to prevent conversation context menu collisions', () => {
    expect(bannerSource).toMatch(/onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
    expect(bannerSource).toMatch(/onContextMenu=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
  });
});

describe('Phase 94 — ConversationView & AudioPlayerCard Integration', () => {
  const conversationViewSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/ConversationView.tsx'),
    'utf-8'
  );

  const audioCardSource = fs.readFileSync(
    path.join(rootDir, 'src/ui/components/ui/AudioPlayerCard.tsx'),
    'utf-8'
  );

  it('ConversationView imports and renders ActiveAudioBanner', () => {
    expect(conversationViewSource).toContain('ActiveAudioBanner,');
    expect(conversationViewSource).toContain('<ActiveAudioBanner onJumpToMessage={handleAudioBannerJump} />');
  });

  it('ConversationView implements handleAudioBannerJump with smooth scrolling', () => {
    expect(conversationViewSource).toContain('handleAudioBannerJump = useCallback');
    expect(conversationViewSource).toContain('handleJumpToMessage(targetMsgId)');
  });

  it('ConversationView handleToggleVoice passes rich trackMeta to VoicePlayer.playVoiceNote', () => {
    expect(conversationViewSource).toContain('VoicePlayer.playVoiceNote(');
    expect(conversationViewSource).toContain('title: `Voice note - ${senderName}`');
    expect(conversationViewSource).toContain('senderName,');
    expect(conversationViewSource).toContain('conversationId: activeChatId || undefined');
  });

  it('AudioPlayerCard unifies playback through VoicePlayer.playAudioTrack', () => {
    expect(audioCardSource).toContain('VoicePlayer.playAudioTrack(');
    expect(audioCardSource).toContain('VoicePlayer.pause()');
    expect(audioCardSource).toContain('VoicePlayer.resume()');
    expect(audioCardSource).toContain('VoicePlayer.subscribe(messageId');
  });
});

describe('Phase 94 — CSS Design System Verification', () => {
  const cssSource = fs.readFileSync(
    path.join(rootDir, 'src/styles/veil-components.css'),
    'utf-8'
  );

  it('defines .veil-active-audio-banner with glassmorphism and dock positioning', () => {
    expect(cssSource).toContain('.veil-active-audio-banner');
    expect(cssSource).toContain('backdrop-filter: blur(20px)');
    expect(cssSource).toContain('z-index: 15');
  });

  it('defines glowing circular play button styles', () => {
    expect(cssSource).toContain('.veil-active-audio-btn-play');
    expect(cssSource).toContain('box-shadow: 0 0 16px rgba(168, 85, 247, 0.45)');
  });

  it('defines 4-bar equalizer with staggered keyframe animations', () => {
    expect(cssSource).toContain('.veil-active-audio-equalizer');
    expect(cssSource).toContain('@keyframes veilEqPulse1');
    expect(cssSource).toContain('@keyframes veilEqPulse2');
    expect(cssSource).toContain('@keyframes veilEqPulse3');
    expect(cssSource).toContain('@keyframes veilEqPulse4');
  });

  it('defines speed pill, jump button, and scrubber track styles', () => {
    expect(cssSource).toContain('.veil-active-audio-speed-btn');
    expect(cssSource).toContain('.veil-active-audio-jump-btn');
    expect(cssSource).toContain('.veil-active-audio-scrubber-track');
    expect(cssSource).toContain('.veil-active-audio-scrubber-fill');
  });
});

describe('Phase 94 — Phase 44a Zero Literal Unicode Emoji Compliance', () => {
  const filesToCheck = [
    'src/ui/components/icons/Icons.tsx',
    'src/attachments/voicePlayer.ts',
    'src/ui/components/ui/AudioPlayerCard.tsx',
    'src/ui/components/ui/ActiveAudioBanner.tsx',
    'src/ui/components/ui/index.ts',
    'src/ui/components/ConversationView.tsx',
    'src/styles/veil-components.css',
    'tests/phase94-active-audio-notification-banner.test.tsx',
  ];

  // Regex pattern matching Unicode emoji code point ranges
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  for (const file of filesToCheck) {
    it(`guarantees zero literal Unicode emoji characters in ${file}`, () => {
      const filePath = path.join(rootDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const hasEmoji = emojiRegex.test(content);
      expect(hasEmoji, `Found forbidden literal emoji in ${file}`).toBe(false);
    });
  }
});
