import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sidebar = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/Sidebar.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('conversation category navigation work', () => {
  it('sorts the conversation source list once per data change, then filters for the active tab', () => {
    const sorted = sidebar.slice(sidebar.indexOf('const pinnedAndRecentConversations'), sidebar.indexOf('const filteredConversations'));
    const filtered = sidebar.slice(sidebar.indexOf('const filteredConversations'), sidebar.indexOf('const handleSelectConversation'));

    expect(sorted).toContain('conversations.slice().sort(');
    expect(sorted).not.toContain('activeChip');
    expect(filtered).toContain('pinnedAndRecentConversations.filter(');
    expect(filtered).not.toContain('.sort(');
  });

  it('routes both taps and horizontal swipes through the same transition update', () => {
    expect(sidebar).toContain('transitionToTab(tabs[nextIndex])');
    expect(sidebar).toContain('onClick={() => transitionToTab(tab)}');
    expect(sidebar).toContain('React.startTransition(() => setActiveChip(tab))');
  });
});
