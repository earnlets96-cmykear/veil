import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const composer = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/MessageComposer.tsx'), 'utf8');
const sidebar = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/Sidebar.tsx'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '../src/styles/veil-components.css'), 'utf8');

describe('Phase 127 composer and conversation row polish', () => {
  it('exposes one cancel action in recording mode, including after the gesture locks', () => {
    const recordingBranch = composer.slice(composer.indexOf('className={`veil-recording-pill'), composer.indexOf('/* Standard Message & Attachment Controls'));
    expect(recordingBranch.match(/className="veil-recording-trash-btn"/g)).toHaveLength(1);
    expect(recordingBranch).not.toContain('aria-label="Cancel Voice Recording"');
  });

  it('keeps cancel and send taps from bubbling into the hold-to-send gesture handler', () => {
    const recordingBranch = composer.slice(composer.indexOf('className={`veil-recording-pill'), composer.indexOf('/* Standard Message & Attachment Controls'));
    expect(recordingBranch.match(/onTouchEnd=\{\(event\) => event\.stopPropagation\(\)\}/g)).toHaveLength(2);
    expect(recordingBranch.match(/onMouseUp=\{\(event\) => event\.stopPropagation\(\)\}/g)).toHaveLength(2);
  });

  it('coalesces recording drag visuals to animation frames instead of rerendering per pointer event', () => {
    expect(composer).toContain('requestAnimationFrame(');
    expect(composer).toContain('--record-drag-x');
    expect(composer).not.toContain('setDragOffset');
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
