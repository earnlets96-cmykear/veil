import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const designSystem = fs.readFileSync(path.join(root, 'src/styles/veil-design-system.css'), 'utf8');
const components = fs.readFileSync(path.join(root, 'src/styles/veil-components.css'), 'utf8');
const themes = fs.readFileSync(path.join(root, 'src/styles/themes.css'), 'utf8');
const sidebar = fs.readFileSync(path.join(root, 'src/ui/components/Sidebar.tsx'), 'utf8');
const composer = fs.readFileSync(path.join(root, 'src/ui/components/MessageComposer.tsx'), 'utf8');
const mediaPicker = fs.readFileSync(path.join(root, 'src/ui/components/media/MediaPickerModal.tsx'), 'utf8');

describe('Phase 103: messaging UI system', () => {
  it('defines shared semantic surface, text, accent, focus, spacing, and motion roles', () => {
    for (const token of [
      '--veil-surface-app',
      '--veil-surface-panel',
      '--veil-surface-elevated',
      '--veil-text-primary',
      '--veil-text-secondary',
      '--veil-accent',
      '--veil-focus-ring',
      '--veil-space-2',
      '--veil-radius-md',
      '--veil-motion-fast',
    ]) {
      expect(designSystem, token).toContain(token);
    }
  });

  it('maps semantic roles for both dark and light themes', () => {
    expect(themes).toMatch(/\[data-theme="dark"\]/);
    expect(themes).toMatch(/\[data-theme="light"\]/);
    expect(themes).toContain('--veil-surface-app');
    expect(themes).toContain('--veil-text-primary');
  });

  it('exposes semantic workspace hooks for the responsive conversation list', () => {
    expect(sidebar).toContain('veil-sidebar-search-wrap');
    expect(sidebar).toContain('veil-sidebar-filters');
    expect(sidebar).toContain('veil-conversation-item');
    expect(sidebar).toContain('aria-label="Conversation List"');
  });

  it('defines calm header, timeline, bubble, and composer states without changing behavior owners', () => {
    expect(components).toContain('.veil-chat-header');
    expect(components).toContain('.veil-message-bubble');
    expect(components).toContain('.veil-composer-input-island');
    expect(components).toContain('.veil-btn-composer-send');
    expect(designSystem).toContain('prefers-reduced-motion');
  });

  it('exposes explicit composer and in-app media picker state surfaces', () => {
    expect(composer).toContain('veil-composer-stateful');
    expect(mediaPicker).toContain('veil-attachment-sheet-content');
    expect(mediaPicker).toContain('aria-label="Recent media"');
  });

  it('keeps motion bounded and accessible', () => {
    expect(designSystem).toContain('@media (prefers-reduced-motion: reduce)');
    expect(designSystem).toContain('*:focus-visible');
    expect(components).toContain('var(--veil-motion-fast)');
    expect(components).not.toContain('color-mix(');
  });
});
