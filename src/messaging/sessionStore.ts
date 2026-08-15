/**
 * Encrypted Ratchet Session Store for VEIL.
 *
 * Persists DoubleRatchetSession states in the Space's EncryptedSpaceStore
 * partition under the Space's StorageKey.
 */

import { DoubleRatchetSession } from '../ratchet/ratchet.ts';
import { PersistedRatchetState } from '../ratchet/types.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';

const SESSION_STORE_PREFIX = 'veil:ratchet:session:';

export class RatchetSessionStore {
  private store: EncryptedSpaceStore;

  constructor(store: EncryptedSpaceStore) {
    this.store = store;
  }

  /**
   * Saves an active DoubleRatchetSession encrypted in the Space store.
   */
  public saveSession(session: SpaceSession, ratchetSession: DoubleRatchetSession): void {
    this.assertSession(session);
    const key = `${SESSION_STORE_PREFIX}${ratchetSession.peerIdentityId}`;
    const serialized = ratchetSession.serialize();
    this.store.set(session, key, serialized);
  }

  /**
   * Loads and deserializes a DoubleRatchetSession from encrypted storage.
   */
  public loadSession(
    session: SpaceSession,
    peerIdentityId: string
  ): DoubleRatchetSession | null {
    this.assertSession(session);
    const key = `${SESSION_STORE_PREFIX}${peerIdentityId}`;
    const state = this.store.get<PersistedRatchetState>(session, key);
    if (!state) return null;

    return DoubleRatchetSession.deserialize(state);
  }

  /**
   * Deletes a session from encrypted storage.
   */
  public deleteSession(session: SpaceSession, peerIdentityId: string): boolean {
    this.assertSession(session);
    const key = `${SESSION_STORE_PREFIX}${peerIdentityId}`;
    return this.store.delete(session, key);
  }

  /**
   * Lists all peer identity IDs with active persisted sessions.
   */
  public listSessionPeerIds(session: SpaceSession): string[] {
    this.assertSession(session);
    const keys = this.store.listKeys(session);
    return keys
      .filter(k => k.startsWith(SESSION_STORE_PREFIX))
      .map(k => k.slice(SESSION_STORE_PREFIX.length));
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('SessionStore rejected: Space session is locked or destroyed');
    }
  }
}
