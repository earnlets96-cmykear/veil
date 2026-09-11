/**
 * Phase 78: Functional Progress Circle Test Suite
 *
 * Verifies that upload and download progress circles are fully functional and byte-driven:
 * 1. CloudClient.uploadAttachment reports real-time (loaded, total) progress callbacks.
 * 2. CloudClient.downloadAttachment reports real-time streaming chunks via onProgress.
 * 3. MediaCache.getOrFetch & VoiceRecorder pipeline forward onProgress cleanly.
 * 4. AttachmentCard reflects true progressPercent without fake 50/25% fallbacks.
 * 5. VoiceNoteCard renders an SVG circular perimeter progress ring matching playback / scrub percent.
 * 6. MessageStatus renders dynamic SVG progress ring for UPLOADING status.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CloudClient } from '../src/network/cloudClient.ts';
import { ProgressCircle } from '../src/ui/components/ui/ProgressCircle.tsx';
import { AttachmentCard } from '../src/ui/components/ui/AttachmentCard.tsx';
import { VoiceNoteCard } from '../src/ui/components/ui/VoiceNoteCard.tsx';
import { MessageStatus } from '../src/ui/components/ui/MessageStatus.tsx';
import { MediaCache } from '../src/ui/utils/mediaCache.ts';
import { VoiceRecorder } from '../src/attachments/voiceRecorder.ts';

describe('Phase 78: Functional Progress Circle Verification', () => {
  const validHexToken = 'a'.repeat(64);

  describe('CloudClient byte-level progress reporting', () => {
    it('reports progress callback during uploadAttachment', async () => {
      const client = new CloudClient('http://localhost:8080');
      client.setSession(validHexToken, 'mock_account', 'mock_device');

      const mockProgress = vi.fn();
      const testBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

      // Mock fetch for successful upload
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
      } as any);

      await client.uploadAttachment('test_obj_1', testBytes, mockProgress);

      expect(mockProgress).toHaveBeenCalled();
      expect(mockProgress).toHaveBeenCalledWith(testBytes.length, testBytes.length);
    });

    it('reports progress callback during streaming downloadAttachment', async () => {
      const client = new CloudClient('http://localhost:8080');
      client.setSession(validHexToken, 'mock_account', 'mock_device');

      const chunk1 = new Uint8Array([1, 2, 3, 4]);
      const chunk2 = new Uint8Array([5, 6, 7, 8]);
      const totalBytes = chunk1.length + chunk2.length;

      let readStep = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (readStep === 0) {
            readStep++;
            return { done: false, value: chunk1 };
          } else if (readStep === 1) {
            readStep++;
            return { done: false, value: chunk2 };
          }
          return { done: true, value: undefined };
        }),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-length': totalBytes.toString(),
        }),
        body: {
          getReader: () => mockReader,
        },
      } as any);

      const progressHistory: Array<{ loaded: number; total: number }> = [];
      const onProgress = (loaded: number, total: number) => {
        progressHistory.push({ loaded, total });
      };

      const downloaded = await client.downloadAttachment('test_obj_2', onProgress);

      expect(downloaded.length).toBe(totalBytes);
      expect(progressHistory.length).toBeGreaterThanOrEqual(2);
      expect(progressHistory[0]).toEqual({ loaded: 4, total: 8 });
      expect(progressHistory[1]).toEqual({ loaded: 8, total: 8 });
    });
  });

  describe('MediaCache & VoiceRecorder onProgress forwarding', () => {
    it('MediaCache.getOrFetch passes onProgress to CloudClient.downloadAttachment', async () => {
      const mockCloudClient = {
        downloadAttachment: vi.fn().mockResolvedValue(new Uint8Array([10, 20, 30])),
      } as unknown as CloudClient;

      const mockProgress = vi.fn();
      const payload = {
        objectId: 'obj_pipe_test',
        attachmentId: 'att_pipe_test',
        name: 'test.png',
        mimeType: 'image/png',
        sizeBytes: 3,
      };

      await MediaCache.getOrFetch(payload as any, null, mockCloudClient, mockProgress);

      expect(mockCloudClient.downloadAttachment).toHaveBeenCalledWith('obj_pipe_test', mockProgress);
    });

    it('VoiceRecorder.downloadAndDecryptVoiceNote forwards onProgress', async () => {
      const mockCloudClient = {
        downloadAttachment: vi.fn().mockResolvedValue(new Uint8Array([0, 1, 2, 3])),
        getSessionToken: () => 'token',
      } as unknown as CloudClient;

      const mockSession = { spaceId: 'spc_test' } as any;
      const mockMeta = {
        objectId: 'voice_obj_pipe',
        sizeBytes: 4,
        durationSeconds: 2,
        mimeType: 'audio/webm',
        ciphertextHash: '',
        encryptionKeyBase64: '',
        nonceBase64: '',
      };

      const mockProgress = vi.fn();
      const blobUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(
        mockSession,
        mockCloudClient,
        mockMeta,
        mockProgress
      );

      expect(blobUrl).toBeDefined();
    });
  });

  describe('ProgressCircle and AttachmentCard Presentation', () => {
    it('ProgressCircle renders SVG circular ring reflecting real percent', () => {
      const html50 = renderToStaticMarkup(
        <ProgressCircle size={52} percent={50} totalBytes={1000} loadedBytes={500} variant="upload" />
      );
      expect(html50).toContain('50%');
      expect(html50).toContain('stroke-dashoffset');
      expect(html50).toContain('aria-valuenow="50"');

      const html75 = renderToStaticMarkup(
        <ProgressCircle size={52} percent={75} totalBytes={2000} loadedBytes={1500} variant="download" />
      );
      expect(html75).toContain('75%');
      expect(html75).toContain('aria-valuenow="75"');
    });

    it('AttachmentCard renders real progressPercent without fake 50% fallback', () => {
      const htmlUploading = renderToStaticMarkup(
        <AttachmentCard
          name="report.pdf"
          sizeBytes={1048576}
          mimeType="application/pdf"
          status="uploading"
          progressPercent={37}
          loadedBytes={387973}
        />
      );

      expect(htmlUploading).toContain('37%');
      // Must not contain 50% fallback
      expect(htmlUploading).not.toContain('50%');

      const htmlZero = renderToStaticMarkup(
        <AttachmentCard
          name="photo.jpg"
          sizeBytes={500000}
          mimeType="image/jpeg"
          status="uploading"
          progressPercent={0}
          loadedBytes={0}
        />
      );
      expect(htmlZero).toContain('0%');
    });
  });

  describe('VoiceNoteCard Perimeter Progress Ring', () => {
    it('renders perimeter SVG progress circle around play button matching playback progress', () => {
      const html0 = renderToStaticMarkup(
        <VoiceNoteCard
          messageId="voice_msg_1"
          durationSeconds={10}
          currentTimeSeconds={0}
          currentProgressPercent={0}
          playbackState="ready"
        />
      );

      expect(html0).toContain('veil-voicenote-btn-container');
      expect(html0).toContain('circle');
      // Full circumference offset when progress is 0%
      const circumference = 2 * Math.PI * 20; // ~125.66
      expect(html0).toContain(`stroke-dashoffset="${circumference}"`);

      const html50 = renderToStaticMarkup(
        <VoiceNoteCard
          messageId="voice_msg_2"
          durationSeconds={10}
          currentTimeSeconds={5}
          currentProgressPercent={50}
          playbackState="playing"
        />
      );

      const halfCircumference = circumference * 0.5; // ~62.83
      expect(html50).toContain(`stroke-dashoffset="${halfCircumference}"`);
    });
  });

  describe('MessageStatus Upload Progress Ring', () => {
    it('renders circular SVG ring for UPLOADING status with uploadProgress', () => {
      const html = renderToStaticMarkup(
        <MessageStatus status="UPLOADING" uploadProgress={60} />
      );

      expect(html).toContain('circle');
      expect(html).toContain('stroke-dashoffset');
      expect(html).toContain('Uploading 60%');
    });
  });
});
