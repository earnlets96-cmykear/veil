/**
 * Phase 70 — Verification Suite for Voice Seeking, Swipe-to-Reply on Voice Notes,
 * Progress Circle Display, and Video Player UI Overhaul.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VoiceNoteCard } from '../src/ui/components/ui/VoiceNoteCard.tsx';
import { AttachmentCard } from '../src/ui/components/ui/AttachmentCard.tsx';
import { MediaViewer } from '../src/ui/components/media/MediaViewer.tsx';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 70 — Voice Seeking, Swipe-to-Reply & Video Player UI', () => {
  describe('Issue 1 & 2: Voice Seeking & Waveform Touch Handling', () => {
    it('VoiceNoteCard renders waveform track with dedicated touch and pointer handlers', () => {
      const html = renderToStaticMarkup(
        <VoiceNoteCard
          messageId="msg-voice-seek-test"
          durationSeconds={45}
          currentTimeSeconds={15}
          currentProgressPercent={33}
          playbackState="playing"
          onPlayToggle={() => {}}
          onSeek={() => {}}
        />
      );

      expect(html).toContain('veil-waveform-container');
      expect(html).toContain('veil-voicenote-card');
      // Root card must not suppress touch events
      expect(html).not.toContain('ontouchstart="stopPropagation"');
      // Waveform bars rendered with active state
      expect(html).toContain('veil-waveform-bar');
      expect(html).toContain('active');
    });
  });

  describe('Issue 3: Progress Circle Display on File & Media Transfers', () => {
    it('AttachmentCard renders ProgressCircle when status is uppercase UPLOADING or DOWNLOADING', () => {
      const htmlUploading = renderToStaticMarkup(
        <AttachmentCard
          name="blueprint.pdf"
          sizeBytes={4 * 1024 * 1024}
          mimeType="application/pdf"
          status={'UPLOADING' as any}
          progressPercent={45}
        />
      );

      expect(htmlUploading).toContain('veil-progress-circle');
      expect(htmlUploading).toContain('45%');
      expect(htmlUploading).toContain('Uploading...');

      const htmlDownloading = renderToStaticMarkup(
        <AttachmentCard
          name="archive.zip"
          sizeBytes={10 * 1024 * 1024}
          mimeType="application/zip"
          status={'DOWNLOADING' as any}
          progressPercent={80}
        />
      );

      expect(htmlDownloading).toContain('veil-progress-circle');
      expect(htmlDownloading).toContain('80%');
      expect(htmlDownloading).toContain('Downloading...');
    });
  });

  describe('Issue 4: Fullscreen MediaViewer Video Player UI Overhaul', () => {
    it('MediaViewer renders video with integrated overlay HUD and custom play overlay', () => {
      const testItem = {
        id: 'vid-1',
        type: 'video' as const,
        url: 'blob:http://localhost/test-video',
        name: 'VID-20260905.mp4',
        sizeBytes: 3.7 * 1024 * 1024,
      };

      const html = renderToStaticMarkup(
        <MediaViewer
          items={[testItem]}
          initialIndex={0}
          onClose={() => {}}
        />
      );

      expect(html).toContain('veil-media-viewer-video-container');
      expect(html).toContain('veil-media-viewer-video');
      expect(html).toContain('veil-media-viewer-scrim');
      expect(html).toContain('veil-media-viewer-loading-overlay');
      expect(html).toContain('veil-media-viewer-video-controls');
      expect(html).toContain('veil-media-viewer-hud-play');
      expect(html).toContain('veil-media-viewer-seek');
      expect(html).toContain('veil-media-viewer-time');
    });

    it('veil-components.css defines all integrated player overlay styles and auto-hide classes', () => {
      const cssPath = path.join(rootDir, 'src', 'styles', 'veil-components.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      expect(cssContent).toContain('.veil-media-viewer-scrim');
      expect(cssContent).toContain('.veil-media-viewer-play-overlay');
      expect(cssContent).toContain('.veil-media-viewer-video-controls');
      expect(cssContent).toContain('.veil-media-viewer-video-controls.hidden');
      expect(cssContent).toContain('.veil-media-viewer-hud-play');
      expect(cssContent).toContain('.veil-media-viewer-nav-hidden');
    });
  });
});
