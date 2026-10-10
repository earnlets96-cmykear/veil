import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const appState = fs.readFileSync(path.resolve(__dirname, '../src/ui/app/AppState.tsx'), 'utf8');

describe('smooth message sending', () => {
  it('defers encrypted UI-history persistence until after the optimistic state update', () => {
    const start = appState.indexOf('const sendMessage = useCallback');
    const end = appState.indexOf('const pendingNotificationRepliesRef', start);
    const sendMessage = appState.slice(start, end);

    expect(sendMessage).toContain('queueMessagePersistence()');
    expect(sendMessage).not.toContain("store.setAsync(activeSession, 'veil:ui:messages'");
    expect(sendMessage).not.toContain("store.setAsync(activeSession, 'veil:ui:conversations'");
  });
});
