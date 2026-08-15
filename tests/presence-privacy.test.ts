import { describe, it, expect } from 'vitest';
import { PresencePrivacyManager } from '../src/privacy/presencePrivacy.ts';

describe('VEIL Phase 8: Presence, Typing & Read Receipt Privacy Tests', () => {
  it('PRESENCE PRIVACY: Rate-limits typing events and respects receipt settings', () => {
    const presenceMgr = new PresencePrivacyManager({ typingIndicatorsEnabled: true });

    // 1. Initial keystroke emits typing
    const now = 100000;
    expect(presenceMgr.shouldEmitTyping('conv_01', now)).toBe(true);

    // 2. Rapid follow-up keystrokes within 3 seconds are throttled to prevent keystroke timing analysis
    expect(presenceMgr.shouldEmitTyping('conv_01', now + 500)).toBe(false);
    expect(presenceMgr.shouldEmitTyping('conv_01', now + 1500)).toBe(false);

    // 3. Keystroke after 3 seconds is permitted
    expect(presenceMgr.shouldEmitTyping('conv_01', now + 3500)).toBe(true);

    // 4. Read receipts disabled by default -> returns null
    const defaultReceipt = presenceMgr.createReadReceipt('msg_01');
    expect(defaultReceipt).toBeNull();

    // 5. Read receipts enabled -> returns receipt
    presenceMgr.updateSettings({ readReceiptsEnabled: true });
    const receipt = presenceMgr.createReadReceipt('msg_01');
    expect(receipt).not.toBeNull();
    expect(receipt?.type).toBe('read');

    // 6. Last-seen policy 'nobody' -> returns null
    expect(presenceMgr.formatLastSeen(true, Date.now() - 60000)).toBeNull();

    // 7. Last-seen policy 'contacts'
    presenceMgr.updateSettings({ lastSeenPolicy: 'contacts' });
    expect(presenceMgr.formatLastSeen(false, Date.now() - 60000)).toBeNull(); // non-contact
    expect(presenceMgr.formatLastSeen(true, Date.now() - 60000)).toBe('Recently online'); // contact
  });
});
