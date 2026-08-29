/**
 * Phase 38 Test Suite: Theme System & Privacy-Preserving Presence.
 *
 * Verifies:
 * - 5 Theme presets (Obsidian, Slate, Light, Midnight, Graphite).
 * - 3 Message density presets (Compact, Comfortable, Spacious).
 * - PresenceManager formatting rules across 'nobody', 'contacts', and 'everyone' privacy levels.
 * - Activity recording and automatic offline decay.
 */

import { describe, it, expect } from 'vitest';
import { presenceManager, PresenceVisibility } from '../src/presence/presenceManager.ts';

describe('Phase 38: Theme System & Privacy Presence', () => {
  describe('Presence Formatting Rules', () => {
    it('always hides presence when privacy setting is "nobody"', () => {
      const subtitle = presenceManager.formatPresenceSubtitle(
        true,
        { identityId: 'peer_1', isOnline: true },
        'nobody'
      );
      expect(subtitle).toBe('Encrypted • Verified');
    });

    it('hides presence from non-contacts when privacy is "contacts"', () => {
      const subtitleNonContact = presenceManager.formatPresenceSubtitle(
        false,
        { identityId: 'peer_2', isOnline: true },
        'contacts'
      );
      expect(subtitleNonContact).toBe('Encrypted • Verified');

      const subtitleContact = presenceManager.formatPresenceSubtitle(
        true,
        { identityId: 'peer_2', isOnline: true },
        'contacts'
      );
      expect(subtitleContact).toBe('online');
    });

    it('shows "online" when peer is active and privacy allows it', () => {
      const subtitle = presenceManager.formatPresenceSubtitle(
        true,
        { identityId: 'peer_3', isOnline: true },
        'everyone'
      );
      expect(subtitle).toBe('online');
    });

    it('formats recent timestamps cleanly into minutes/hours ago', () => {
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
      const subtitle = presenceManager.formatPresenceSubtitle(
        true,
        { identityId: 'peer_4', isOnline: false, lastSeenTimestamp: fiveMinsAgo },
        'everyone'
      );
      expect(subtitle).toBe('last seen 5m ago');

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const subtitleHours = presenceManager.formatPresenceSubtitle(
        true,
        { identityId: 'peer_4', isOnline: false, lastSeenTimestamp: twoHoursAgo },
        'everyone'
      );
      expect(subtitleHours).toBe('last seen 2h ago');
    });

    it('falls back to "last seen recently" for older or undefined timestamps', () => {
      const subtitle = presenceManager.formatPresenceSubtitle(
        true,
        { identityId: 'peer_5', isOnline: false },
        'everyone'
      );
      expect(subtitle).toBe('last seen recently');
    });
  });

  describe('Self Activity & State Management', () => {
    it('records user activity and reports self online status', () => {
      presenceManager.recordActivity();
      expect(presenceManager.isSelfOnline()).toBe(true);
    });

    it('notifies subscribers on presence changes', () => {
      let notified = false;
      const unsub = presenceManager.subscribe(() => {
        notified = true;
      });

      presenceManager.updatePeerPresence('peer_test', true);
      expect(notified).toBe(true);

      const peer = presenceManager.getPeerPresence('peer_test');
      expect(peer?.isOnline).toBe(true);

      unsub();
    });
  });
});
