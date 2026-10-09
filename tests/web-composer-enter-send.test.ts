import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composer = fs.readFileSync(path.join(rootDir, 'src/ui/components/MessageComposer.tsx'), 'utf8');

describe('web message composer keyboard behavior', () => {
  it('sends on Enter at every viewport width and leaves Shift+Enter to insert a newline', () => {
    const keyHandler = composer.match(/const handleKeyDown = \(e: KeyboardEvent<HTMLTextAreaElement>\) => \{([\s\S]*?)\n  \};/)?.[1];

    expect(keyHandler).toBeDefined();
    expect(keyHandler).toMatch(/e\.key === 'Enter' && !e\.shiftKey/);
    expect(keyHandler).toMatch(/e\.preventDefault\(\);\s*handleSend\(\);/);
    expect(keyHandler).not.toMatch(/window\.innerWidth/);
  });
});
