import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VoiceNoteCard } from '../src/ui/components/ui/VoiceNoteCard.tsx';
import { MessageComposer } from '../src/ui/components/MessageComposer.tsx';
import { AppProvider } from '../src/ui/app/AppState.tsx';

import { ToastProvider } from '../src/ui/components/ui/Toast.tsx';

describe('Phase 37 — Mobile Layout & Component Architecture', () => {
  it('should render VoiceNoteCard with animated waveform, play/pause controls, and duration', () => {
    const idleHtml = renderToStaticMarkup(
      <VoiceNoteCard
        durationSeconds={45}
        playbackState="idle"
        currentProgressPercent={0}
        onPlayToggle={() => {}}
        onSeek={() => {}}
      />
    );

    expect(idleHtml).toContain('veil-voicenote-card');
    expect(idleHtml).toContain('0:45');
    expect(idleHtml).toContain('Play voice message');
    expect(idleHtml).toContain('veil-waveform-container');

    const playingHtml = renderToStaticMarkup(
      <VoiceNoteCard
        durationSeconds={45}
        playbackState="playing"
        currentProgressPercent={50}
        onPlayToggle={() => {}}
        onSeek={() => {}}
      />
    );

    expect(playingHtml).toContain('Pause voice message');
    expect(playingHtml).toContain('veil-waveform-bar active');
  });

  it('should render MessageComposer with sleek circular send button and auto-expanding input', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <AppProvider>
          <MessageComposer conversationId="conv_test_123" />
        </AppProvider>
      </ToastProvider>
    );

    expect(html).toContain('veil-composer');
    expect(html).toContain('veil-composer-input');
    expect(html).toContain('veil-btn-composer-send');
    expect(html).toContain('Type an encrypted message...');
    expect(html).toContain('Attach Encrypted File');
    expect(html).toContain('Record Voice Note');
  });
});
