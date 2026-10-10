import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sidebar = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/Sidebar.tsx'), 'utf8');

describe('sidebar swipe target handling', () => {
  it('does not treat a swipe starting on a custom chat button as a filter-tab swipe', () => {
    const start = sidebar.indexOf('const handleTabSwipeStart');
    const end = sidebar.indexOf('const handleTabSwipeMove', start);
    const handler = sidebar.slice(start, end);

    expect(handler).toMatch(/closest\([^)]*\[role="button"\]/);
  });
});
