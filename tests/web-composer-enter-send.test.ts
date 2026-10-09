import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composer = fs.readFileSync(path.join(rootDir, 'src/ui/components/MessageComposer.tsx'), 'utf8');

describe('web message composer keyboard behavior', () => {
  it('sends on Enter in browsers only and leaves Shift+Enter and native Enter to insert a newline', () => {
    const keyHandler = composer.match(/const handleKeyDown = \(e: KeyboardEvent<HTMLTextAreaElement>\) => \{([\s\S]*?)\n  \};/)?.[1];

    expect(keyHandler).toBeDefined();
    expect(composer).toMatch(/import \{ Capacitor \} from '@capacitor\/core';/);
    expect(keyHandler).toMatch(/e\.key === 'Enter' && !e\.shiftKey && !Capacitor\.isNativePlatform\(\)/);
    expect(keyHandler).toMatch(/e\.preventDefault\(\);\s*handleSend\(\);/);
    expect(keyHandler).not.toMatch(/window\.innerWidth/);
  });
});
