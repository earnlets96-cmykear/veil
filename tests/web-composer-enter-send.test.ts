import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composer = fs.readFileSync(path.join(rootDir, 'src/ui/components/MessageComposer.tsx'), 'utf8');

describe('web message composer keyboard behavior', () => {
  it('sends on Enter only in desktop browsers and preserves mobile and native newlines', () => {
    const keyHandler = composer.match(/const handleKeyDown = \(e: KeyboardEvent<HTMLTextAreaElement>\) => \{([\s\S]*?)\n  \};/)?.[1];

    expect(keyHandler).toBeDefined();
    expect(composer).toMatch(/import \{ Capacitor \} from '@capacitor\/core';/);
    expect(keyHandler).toMatch(/e\.key === 'Enter' && !e\.shiftKey && typeof window !== 'undefined' && window\.innerWidth > 768 && !Capacitor\.isNativePlatform\(\)/);
    expect(keyHandler).toMatch(/e\.preventDefault\(\);\s*handleSend\(\);/);
  });
});
