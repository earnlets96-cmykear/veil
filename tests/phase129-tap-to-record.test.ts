import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const composer = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/MessageComposer.tsx'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '../src/styles/veil-components.css'), 'utf8');

describe('tap-to-record voice composer', () => {
  it('starts recording only from the mic button click', () => {
    const micButton = composer.slice(composer.indexOf('className="veil-btn-composer-send veil-btn-composer-mic"'), composer.indexOf('</button>', composer.indexOf('className="veil-btn-composer-send veil-btn-composer-mic"')));
    expect(micButton).toContain('onClick={handleStartVoice}');
    expect(micButton).not.toMatch(/on(?:TouchStart|MouseDown|PointerDown)=/);
    expect(micButton).toContain('title="Record a voice note"');
  });

  it('keeps recording cancellation, send, and explicit lock controls available', () => {
    const recordingBranch = composer.slice(composer.indexOf('className="veil-recording-pill"'), composer.indexOf('/* Standard Message & Attachment Controls'));
    expect(recordingBranch).toContain('aria-label="Cancel recording"');
    expect(recordingBranch).toContain('aria-label={isLocked ? \'Unlock recording\' : \'Lock recording\'}');
    expect(recordingBranch).toContain('onClick={handleSendVoice}');
    expect(recordingBranch).not.toContain('Slide left to cancel');
    expect(recordingBranch).not.toContain('Slide up to lock');
  });

  it('removes the drag-only recording visuals', () => {
    expect(composer).not.toContain('--record-drag-x');
    expect(composer).not.toContain('handleMicTouchMove');
    expect(styles).not.toContain('.veil-recording-pill.is-dragging');
  });
});
