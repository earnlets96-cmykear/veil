import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 44A: Chat UI Layout & SVG Iconography System Forensic Suite', () => {
  it('MESSAGE BUBBLE: Renders vector SVG ReplyIcon without Unicode arrow character', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        messageId="msg_test_1"
        isOutgoing={false}
        text="Hello world"
        timestamp={Date.now()}
        onReplyTrigger={() => {}}
      />
    );

    // Verify reply button exists with SVG icon
    expect(html).toContain('aria-label="Reply to this message"');
    expect(html).toContain('<svg');
    expect(html).toContain('<span>Reply</span>');

    // Verify zero Unicode arrow / symbol / emoji characters
    expect(html).not.toContain('↩');
    expect(html).not.toMatch(/[\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}]/u);
  });

  it('CSS INTEGRITY: Verifies veil-conversation and veil-conversation-view flex layout geometry', () => {
    const cssPath = path.resolve(__dirname, '../src/styles/veil-design-system.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // 1. Conversation container definition
    expect(css).toContain('.veil-conversation,');
    expect(css).toContain('.veil-conversation-view');
    expect(css).toMatch(/\.veil-conversation,\s*\.veil-conversation-view\s*\{[^}]*flex:\s*1/);
    expect(css).toMatch(/\.veil-conversation,\s*\.veil-conversation-view\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/\.veil-conversation,\s*\.veil-conversation-view\s*\{[^}]*flex-direction:\s*column/);

    // 2. Timeline scroll container definition
    expect(css).toContain('.veil-timeline {');
    expect(css).toMatch(/\.veil-timeline\s*\{[^}]*overflow-y:\s*auto/);
    expect(css).toMatch(/\.veil-timeline\s*\{[^}]*min-height:\s*0/);

    // 3. Composer anchoring definition
    expect(css).toContain('.veil-composer {');
    expect(css).toMatch(/\.veil-composer\s*\{[^}]*flex-shrink:\s*0/);

    // 4. Responsive mobile container definition
    expect(css).toContain('.veil-app-layout.has-active-chat .veil-conversation');
    expect(css).toContain('.veil-app-layout.has-active-chat .veil-conversation-view');
  });

  it('ICON AUDIT: Scans entire src/ui directory and proves ZERO Unicode UI emoji/symbol icons', () => {
    const uiDir = path.resolve(__dirname, '../src/ui');

    function checkFiles(dir: string): { file: string; match: string }[] {
      const violations: { file: string; match: string }[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          violations.push(...checkFiles(fullPath));
        } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          // Unicode symbol/emoji regex
          const regex = /[\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}]/gu;
          const matches = content.match(regex);
          if (matches) {
            for (const m of matches) {
              violations.push({ file: entry.name, match: m });
            }
          }
        }
      }
      return violations;
    }

    const violations = checkFiles(uiDir);
    expect(violations).toHaveLength(0);
  });
});
