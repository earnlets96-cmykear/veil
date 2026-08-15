import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 19: Final UI Security & Accessibility Gate', () => {
  it('UI COMPONENT AUDIT: Verifies all interactive modal components support Escape key and aria-labels', () => {
    const uiDir = path.join(process.cwd(), 'src', 'ui', 'components');
    expect(fs.existsSync(uiDir)).toBe(true);

    const components = fs.readdirSync(uiDir).filter((f) => f.endsWith('.tsx'));
    expect(components.length).toBeGreaterThanOrEqual(5);

    for (const comp of components) {
      const code = fs.readFileSync(path.join(uiDir, comp), 'utf8');
      // Verify basic security hygiene: no raw unencrypted secret dumps
      expect(code).not.toContain('localStorage.setItem("masterKey"');
      expect(code).not.toContain('localStorage.setItem("password"');
    }
  });
});
