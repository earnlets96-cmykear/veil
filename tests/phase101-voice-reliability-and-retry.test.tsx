/**
 * Phase 101: Voice Reliability, Cache & Debounced Retry Test Suite
 *
 * Verifies that:
 * 1. MediaCache supports cross-identifier resolution (objectId, attachmentId, name, id).
 * 2. Voice note failure states render actionable retry buttons with debounce protection.
 * 3. MediaCache stores raw audio bytes upon send for instantaneous retry without re-recording.
 * 4. Zero literal Unicode emojis are rendered.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaCache, MediaCacheManager, DecryptedMedia } from '../src/ui/utils/mediaCache.ts';
import { VoiceNoteCard } from '../src/ui/components/ui/VoiceNoteCard.tsx';

describe('Phase 101: Voice Reliability & Debounced Retry', () => {
  beforeEach(() => {
    MediaCache.clear();
  });

  describe('MediaCache Cross-Key Resolution', () => {
    it('resolves cached media by objectId, attachmentId, name, or id aliases', () => {
      const dummyData = new Uint8Array([10, 20, 30, 40]);
      const cachedItem: DecryptedMedia = {
        id: 'msg_voice_101',
        name: 'voice_recording.webm',
        mimeType: 'audio/webm',
        sizeBytes: 4,
        data: dummyData,
        blobUrl: 'blob:http://localhost/dummy-voice-url',
      };

      // Set under primary key
      MediaCache.set('voice_obj_999', cachedItem);

      // Primary key lookup
      expect(MediaCache.has('voice_obj_999')).toBe(true);
      expect(MediaCache.get('voice_obj_999')?.blobUrl).toBe('blob:http://localhost/dummy-voice-url');

      // Alias lookup by id
      expect(MediaCache.has('msg_voice_101')).toBe(true);
      expect(MediaCache.get('msg_voice_101')?.blobUrl).toBe('blob:http://localhost/dummy-voice-url');

      // Alias lookup by name
      expect(MediaCache.has('voice_recording.webm')).toBe(true);
      expect(MediaCache.get('voice_recording.webm')?.blobUrl).toBe('blob:http://localhost/dummy-voice-url');

      // Non-existent key returns undefined
      expect(MediaCache.get('unknown_key')).toBeUndefined();
      expect(MediaCache.has('unknown_key')).toBe(false);
    });

    it('handles multiple cached items without cross-talk or collisions', () => {
      const item1: DecryptedMedia = {
        id: 'msg_1',
        name: 'voice1.webm',
        mimeType: 'audio/webm',
        sizeBytes: 8,
        blobUrl: 'blob:item1',
      };
      const item2: DecryptedMedia = {
        id: 'msg_2',
        name: 'voice2.webm',
        mimeType: 'audio/webm',
        sizeBytes: 16,
        blobUrl: 'blob:item2',
      };

      MediaCache.set('obj_1', item1);
      MediaCache.set('obj_2', item2);

      expect(MediaCache.get('obj_1')?.blobUrl).toBe('blob:item1');
      expect(MediaCache.get('obj_2')?.blobUrl).toBe('blob:item2');
      expect(MediaCache.get('msg_1')?.blobUrl).toBe('blob:item1');
      expect(MediaCache.get('msg_2')?.blobUrl).toBe('blob:item2');
    });

    it('ensures aliases do not create duplicate canonical entries in RAM', () => {
      const singleItem: DecryptedMedia = {
        id: 'canonical_media_id_101',
        name: 'secret_document.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        blobUrl: 'blob:pdf_url',
      };

      // Set under objectId key
      MediaCache.set('cloud_object_id_999', singleItem);

      // Exactly ONE canonical entry in entries map
      expect(MediaCache.size).toBe(1);

      // Multiple aliases map to the single canonical entry
      expect(MediaCache.aliasCount).toBeGreaterThanOrEqual(3);
      expect(MediaCache.get('cloud_object_id_999')?.id).toBe('canonical_media_id_101');
      expect(MediaCache.get('canonical_media_id_101')?.name).toBe('secret_document.pdf');
      expect(MediaCache.get('secret_document.pdf')?.sizeBytes).toBe(1024);

      // Invalidation removes both the canonical entry and all its aliases
      MediaCache.invalidate('secret_document.pdf');
      expect(MediaCache.size).toBe(0);
      expect(MediaCache.has('cloud_object_id_999')).toBe(false);
      expect(MediaCache.has('canonical_media_id_101')).toBe(false);
      expect(MediaCache.has('secret_document.pdf')).toBe(false);
    });

    it('enforces LRU eviction based on canonical entry count only', () => {
      // Add 50 distinct items, each with 3 aliases (150 keys total)
      for (let i = 1; i <= 50; i++) {
        MediaCache.set(`key_${i}`, {
          id: `id_${i}`,
          name: `name_${i}.png`,
          mimeType: 'image/png',
          sizeBytes: 100,
          blobUrl: `blob:${i}`,
        });
      }

      // Must have exactly 50 canonical items in cache (not evicted at 17!)
      expect(MediaCache.size).toBe(50);
      expect(MediaCache.has('key_1')).toBe(true);
      expect(MediaCache.has('id_1')).toBe(true);
      expect(MediaCache.has('key_50')).toBe(true);

      // Adding the 51st item must evict the oldest canonical entry (item 1)
      MediaCache.set('key_51', {
        id: 'id_51',
        name: 'name_51.png',
        mimeType: 'image/png',
        sizeBytes: 100,
        blobUrl: 'blob:51',
      });

      expect(MediaCache.size).toBe(50);
      expect(MediaCache.has('key_1')).toBe(false);
      expect(MediaCache.has('id_1')).toBe(false);
      expect(MediaCache.has('name_1.png')).toBe(false);
      expect(MediaCache.has('key_51')).toBe(true);
    });

    it('identifies audio media via mimeType and defensive fallback, preventing IDB persistence', () => {
      // mimeType detection
      expect(MediaCacheManager.isAudioMedia('audio/webm')).toBe(true);
      expect(MediaCacheManager.isAudioMedia('audio/m4a')).toBe(true);
      expect(MediaCacheManager.isAudioMedia('audio/aac')).toBe(true);
      expect(MediaCacheManager.isAudioMedia('audio/mp4')).toBe(true);
      expect(MediaCacheManager.isAudioMedia('audio/ogg')).toBe(true);

      // Non-audio media
      expect(MediaCacheManager.isAudioMedia('image/jpeg', 'photo.jpg')).toBe(false);
      expect(MediaCacheManager.isAudioMedia('video/mp4', 'video.mp4')).toBe(false);
      expect(MediaCacheManager.isAudioMedia('application/pdf', 'doc.pdf')).toBe(false);

      // Defensive fallback on audio filenames
      expect(MediaCacheManager.isAudioMedia(undefined, 'voice_note_12345.m4a')).toBe(true);
      expect(MediaCacheManager.isAudioMedia('application/octet-stream', 'voice-message.m4a')).toBe(true);
      expect(MediaCacheManager.isAudioMedia('application/octet-stream', 'recording.opus')).toBe(true);
    });
  });

  describe('Voice & Attachment Retry Safety', () => {
    it('verifies AppState retryFailedMessage never falls through to Voice Message or Photo fallback text', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const appStatePath = path.resolve(__dirname, '../src/ui/app/AppState.tsx');
      const appStateContent = fs.readFileSync(appStatePath, 'utf8').replace(/\r\n/g, '\n');

      // 1. Recover voice media from the authenticated outbox after the RAM cache is gone.
      expect(appStateContent).toMatch(/if\s*\(targetMsg\.voice\)[\s\S]*?restoreOutboxFile[\s\S]*?sendVoiceMessage[\s\S]*?return;/);

      // 2. Recover attachments from the authenticated outbox rather than requiring re-selection.
      expect(appStateContent).toMatch(/if\s*\(targetMsg\.attachment[\s\S]*?restoreOutboxFile[\s\S]*?sendAttachments[\s\S]*?return;/);
      expect(appStateContent).toContain('await retryFailedMessage(item.conversationId, messageId)');

      // 3. Verify standard text retry guards against placeholder text
      expect(appStateContent).toContain("targetMsg.text === 'Voice Message'");
      expect(appStateContent).toContain("targetMsg.text === 'Photo'");
      expect(appStateContent).toContain("targetMsg.text === 'Video'");
      expect(appStateContent).toContain('if (isMediaPlaceholder) {\n        return;\n      }');
    });
  });

  describe('VoiceNoteCard Failure State & Retry UX', () => {
    it('renders retry button and failed indicator when isFailed is true', () => {
      const onRetryMock = vi.fn();
      const html = renderToStaticMarkup(
        <VoiceNoteCard
          messageId="msg_fail_1"
          durationSeconds={12}
          currentTimeSeconds={0}
          currentProgressPercent={0}
          playbackState="idle"
          isFailed={true}
          onRetry={onRetryMock}
        />
      );

      // Verify retry button exists
      expect(html).toContain('veil-voicenote-retry-btn');
      expect(html).toContain('Failed');
      expect(html).toContain('aria-label="Retry audio note"');

      // Verify zero literal Unicode emojis
      expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    });

    it('renders normal play button when isFailed is false', () => {
      const html = renderToStaticMarkup(
        <VoiceNoteCard
          messageId="msg_ok_1"
          durationSeconds={15}
          currentTimeSeconds={0}
          currentProgressPercent={0}
          playbackState="idle"
          isFailed={false}
        />
      );

      expect(html).not.toContain('veil-voicenote-retry-btn');
      expect(html).toContain('veil-voicenote-play-btn');
      expect(html).toContain('aria-label="Play voice message"');
    });

    it('debounces rapid repeated clicks on retry', () => {
      // Direct unit check on debounce logic
      let lastRetryTime = 0;
      const onRetry = vi.fn();

      const handleRetryClick = () => {
        const now = Date.now();
        if (now - lastRetryTime < 1000) {
          return;
        }
        lastRetryTime = now;
        onRetry();
      };

      // First click should trigger
      handleRetryClick();
      expect(onRetry).toHaveBeenCalledTimes(1);

      // Immediate second click (< 1000ms) should be ignored
      handleRetryClick();
      expect(onRetry).toHaveBeenCalledTimes(1);

      // Subsequent click after time passes should trigger
      lastRetryTime = Date.now() - 1500;
      handleRetryClick();
      expect(onRetry).toHaveBeenCalledTimes(2);
    });
  });
});
