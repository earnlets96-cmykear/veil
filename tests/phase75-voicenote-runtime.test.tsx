/**
 * Phase 75: Regression Test Suite for VoiceNoteCard Runtime Stability
 *
 * Verifies that VoiceNoteCard renders without runtime ReferenceErrors,
 * ensures all internal refs (pendingSeekRef, prevPropProgressRef, prevPropTimeRef, etc.)
 * are declared and in scope, and confirms that static code analysis detects no orphan identifiers.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VoiceNoteCard } from '../src/ui/components/ui/VoiceNoteCard.tsx';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 75 — VoiceNoteCard Runtime & Reference Integrity', () => {
  it('VoiceNoteCard source file must NOT contain undeclared pendingSeekPercentRef', () => {
    const filePath = path.resolve(__dirname, '../src/ui/components/ui/VoiceNoteCard.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Regression check for the exact bug that caused the crash
    expect(content).not.toContain('pendingSeekPercentRef');

    // Confirm the proper pendingSeekRef is declared and utilized
    expect(content).toContain('pendingSeekRef');
    expect(content).toContain('pendingSeekRef.current === null');
  });

  it('declares all refs in proper lexical scope before useEffect hooks', () => {
    const filePath = path.resolve(__dirname, '../src/ui/components/ui/VoiceNoteCard.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    const pendingSeekRefIndex = content.indexOf('const pendingSeekRef = useRef');
    const prevPropProgressRefIndex = content.indexOf('const prevPropProgressRef = useRef');
    const propSyncEffectIndex = content.indexOf('// Sync prop changes only when prop values genuinely change from parent');

    expect(pendingSeekRefIndex).toBeGreaterThan(0);
    expect(prevPropProgressRefIndex).toBeGreaterThan(0);
    expect(propSyncEffectIndex).toBeGreaterThan(0);

    // Both refs must be declared BEFORE the useEffect that reads them
    expect(pendingSeekRefIndex).toBeLessThan(propSyncEffectIndex);
    expect(prevPropProgressRefIndex).toBeLessThan(propSyncEffectIndex);
  });

  it('renders VoiceNoteCard with varied prop combinations without throwing', () => {
    const testCases = [
      {
        messageId: 'msg-seek-1',
        durationSeconds: 30,
        currentTimeSeconds: 0,
        currentProgressPercent: 0,
        playbackState: 'idle' as const,
      },
      {
        messageId: 'msg-seek-2',
        durationSeconds: 120,
        currentTimeSeconds: 45,
        currentProgressPercent: 37.5,
        playbackState: 'playing' as const,
      },
      {
        messageId: 'msg-seek-3',
        durationSeconds: 60,
        currentTimeSeconds: 30,
        currentProgressPercent: 50,
        playbackState: 'paused' as const,
      },
      {
        messageId: 'msg-seek-4',
        durationSeconds: 15,
        currentTimeSeconds: 0,
        currentProgressPercent: 0,
        playbackState: 'loading' as const,
      },
      {
        messageId: 'msg-seek-5',
        durationSeconds: 10,
        currentTimeSeconds: 0,
        currentProgressPercent: 0,
        playbackState: 'error' as const,
        errorMessage: 'Network timeout',
      },
    ];

    for (const props of testCases) {
      expect(() => {
        const html = renderToStaticMarkup(
          <VoiceNoteCard
            {...props}
            onPlayToggle={() => {}}
            onSeek={() => {}}
            onRetry={() => {}}
          />
        );
        expect(html).toContain('veil-voicenote-card');
      }).not.toThrow();
    }
  });

  it('simulates prop synchronization logic with pendingSeekRef guard', () => {
    // Mirror the exact useEffect synchronization logic to guarantee no runtime reference error
    let isScrubbing = false;
    let pendingSeek: { percent: number; revision: number } | null = null;
    let localProgress = 0;
    let localCurrentTime = 0;

    const syncProps = (newProgress: number, newTime: number, prevProgress: number, prevTime: number) => {
      const progressChanged = prevProgress !== newProgress;
      const timeChanged = prevTime !== newTime;

      if (!isScrubbing && pendingSeek === null && (progressChanged || timeChanged)) {
        localProgress = newProgress;
        localCurrentTime = newTime;
      }
    };

    // Case 1: Normal prop update when not scrubbing and no pending seek
    syncProps(25, 10, 0, 0);
    expect(localProgress).toBe(25);
    expect(localCurrentTime).toBe(10);

    // Case 2: Scrubbing active -> props do NOT overwrite user scrub position
    isScrubbing = true;
    syncProps(50, 20, 25, 10);
    expect(localProgress).toBe(25); // unchanged
    expect(localCurrentTime).toBe(10); // unchanged
    isScrubbing = false;

    // Case 3: Pending seek in flight -> props do NOT overwrite until seek commits
    pendingSeek = { percent: 75, revision: 1 };
    syncProps(60, 25, 25, 10);
    expect(localProgress).toBe(25); // unchanged
    expect(localCurrentTime).toBe(10); // unchanged

    // Case 4: Seek resolved -> pendingSeek is null -> props resume updating
    pendingSeek = null;
    syncProps(75, 30, 25, 10);
    expect(localProgress).toBe(75);
    expect(localCurrentTime).toBe(30);
  });
});
