import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const modalSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/ui/components/ui/Modal.tsx'),
  'utf8'
);

describe('Modal focus lifecycle', () => {
  it('uses the latest close callback without restarting focus management on rerenders', () => {
    expect(modalSource).toMatch(/onCloseRef\.current\s*=\s*onClose/);
    expect(modalSource).toMatch(/onCloseRef\.current\(\)/);
    expect(modalSource).toMatch(/\}, \[isOpen, closeOnEscape\]\);/);
  });
});
