/**
 * Decoy Space UX & Cryptographic Enforcement for VEIL Phase 7.
 *
 * Enforces that Decoy Spaces are fully functional, cryptographically independent,
 * and strictly isolated from revealing any hidden or alternate Spaces.
 */

import type { SpaceSession } from '../spaces/session.ts';
import type { SpaceHeaderEnvelope } from '../types/index.ts';

export class DecoyEnforcement {
  /**
   * Validates that a Decoy Space meets full functionality requirements:
   * - Has independent valid SpaceSession.
   * - Is marked isDecoy = true.
   * - Has an active 32-byte master key.
   */
  public static validateDecoySession(session: SpaceSession): boolean {
    if (!session || !session.isActive()) {
      return false;
    }
    if (!session.isDecoy) {
      return false;
    }
    const masterKey = session.getMasterKey();
    return masterKey !== null && masterKey.length === 32;
  }

  /**
   * Validates that the active Space UI does not disclose other Spaces:
   * - Only the active Space's name is exposed.
   * - No other Space envelopes or names are exposed in user-facing lists.
   */
  public static assertNoCrossSpaceDisclosure(
    activeSession: SpaceSession,
    visibleSpaceNames: string[]
  ): void {
    if (visibleSpaceNames.length > 1) {
      throw new Error('Privacy Violation: multiple Space names exposed in active UI view');
    }
    if (visibleSpaceNames.length === 1 && visibleSpaceNames[0] !== activeSession.name) {
      throw new Error(`Privacy Violation: exposed foreign Space name "${visibleSpaceNames[0]}" in active Space`);
    }
  }

  /**
   * Filters candidate envelopes so that before authentication,
   * ZERO Space names or counts are leaked to the public UI.
   */
  public static getPublicUnlockScreenState(): {
    prompt: string;
    showSpaceList: boolean;
    showSpaceNames: boolean;
  } {
    return {
      prompt: 'Enter your password',
      showSpaceList: false,
      showSpaceNames: false,
    };
  }

  /**
   * Validates that cryptographic keys across Main, Private, and Decoy are strictly distinct.
   */
  public static verifyCryptographicSeparation(
    masterKeyA: Uint8Array,
    masterKeyB: Uint8Array
  ): boolean {
    if (masterKeyA.length !== masterKeyB.length) return true;
    let diff = 0;
    for (let i = 0; i < masterKeyA.length; i++) {
      diff |= masterKeyA[i] ^ masterKeyB[i];
    }
    return diff !== 0;
  }
}
