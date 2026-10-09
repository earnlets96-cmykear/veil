import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('native notification privacy contract', () => {
  it('uses the same generic private notification channel from local and Firebase paths', () => {
    const local = readFileSync('android/app/src/main/java/chat/veil/app/VeilNotificationsPlugin.kt', 'utf8');
    const remote = readFileSync('android/app/src/main/java/chat/veil/app/VeilFirebaseMessagingService.kt', 'utf8');

    for (const source of [local, remote]) {
      expect(source).toContain('"veil_messages"');
      expect(source).toContain('"VEIL messages"');
      expect(source).toContain('"Alerts for incoming messages. Lock screen content stays private."');
      expect(source).toContain('NotificationCompat.VISIBILITY_PRIVATE');
    }
    expect(remote).toContain('.setContentTitle("VEIL")');
    expect(remote).toContain('.setContentText("New encrypted message received")');
    expect(remote).not.toMatch(/message\.data\[[^\]]+\].*(title|body|text)/i);
  });
});
