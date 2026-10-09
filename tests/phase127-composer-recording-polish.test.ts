import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const composer = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/MessageComposer.tsx'), 'utf8');
const sidebar = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/Sidebar.tsx'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '../src/styles/veil-components.css'), 'utf8');

describe('Phase 127 composer and conversation row polish', () => {
  it('exposes one cancel action and explicit lock control in recording mode', () => {
    const recordingBranch = composer.slice(composer.indexOf('className="veil-recording-pill"'), composer.indexOf('/* Standard Message & Attachment Controls'));
    expect(recordingBranch.match(/className="veil-recording-trash-btn"/g)).toHaveLength(1);
    expect(recordingBranch).toContain('aria-label={isLocked ? \'Unlock recording\' : \'Lock recording\'}');
  });

  it('starts recording from tap and keeps send as a separate explicit action', () => {
    const micButton = composer.slice(composer.indexOf('className="veil-btn-composer-send veil-btn-composer-mic"'), composer.indexOf('</button>', composer.indexOf('className="veil-btn-composer-send veil-btn-composer-mic"')));
    expect(micButton).toContain('onClick={handleStartVoice}');
    expect(micButton).not.toMatch(/on(?:TouchStart|MouseDown)=/);
    expect(composer).toContain('aria-label="Send voice recording"');
  });

  it('does not retain drag-to-record or drag-to-cancel gesture state', () => {
    expect(composer).not.toContain('handleMicTouchMove');
    expect(composer).not.toContain('--record-drag-x');
    expect(styles).not.toContain('.veil-recording-pill.is-dragging');
  });

  it('keeps recording motion restrained and honors reduced-motion preferences', () => {
    const reducedMotion = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g)?.join('\n') ?? '';
    expect(reducedMotion).toContain('.veil-recording-dot');
    expect(reducedMotion).toContain('.veil-soundwave-bar');
    expect(styles).not.toContain('.veil-lock-arrow-bounce {\n  animation: veilLockArrowCue');
  });

  it('keeps conversation timestamps and actions on the row trailing edge', () => {
    expect(sidebar).toContain('className="veil-conversation-time"');
    expect(sidebar).toContain('className={`veil-conversation-item ${isSelected ? \'active\' : \'\'}`}');
    expect(styles).toContain('padding: 10px 2px 10px 8px !important;');
    expect(styles).toMatch(/\.veil-sidebar \.veil-conversation-time\s*\{[^}]*margin-left:\s*auto/s);
  });
});
