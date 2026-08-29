/**
 * Session Controller for VEIL Application Shell.
 *
 * Coordinates Space authentication, credential-selected unlocking,
 * auto-lock inactivity timers, and immediate Panic Lock wiping.
 *
 * CRITICAL INVARIANT:
 * - Switching Spaces immediately destroys the previous SpaceSession and clears in-memory state.
 * - Panic Lock immediately zeroizes keys, destroys the session, and halts networking.
 */

import { SpaceVaultManager } from '../../spaces/vault.ts';
import { EncryptedSpaceStore } from '../../storage/spaceStore.ts';
import { IStorageAdapter } from '../../storage/types.ts';
import { SpaceSession } from '../../spaces/session.ts';
import { SpaceIdentityManager } from '../../identity/manager.ts';
import { NetworkManager } from '../../network/networkManager.ts';
import { LockManager } from '../../privacy/lockManager.ts';
import { UIStateManager } from '../../privacy/uiStateManager.ts';

export class SessionController {
  private vault: SpaceVaultManager;
  private store: EncryptedSpaceStore;
  private storageAdapter: IStorageAdapter;
  private idMgr: SpaceIdentityManager;
  private netManager: NetworkManager;
  private lockManager: LockManager;
  private uiStateManager: UIStateManager;

  private activeSession: SpaceSession | null = null;
  private autoLockMinutes = 5;
  private autoLockTimer?: NodeJS.Timeout;
  private onLockCallbacks: (() => void)[] = [];

  constructor(
    vault: SpaceVaultManager,
    store: EncryptedSpaceStore,
    storageAdapter: IStorageAdapter,
    idMgr: SpaceIdentityManager,
    netManager: NetworkManager
  ) {
    this.vault = vault;
    this.store = store;
    this.storageAdapter = storageAdapter;
    this.idMgr = idMgr;
    this.netManager = netManager;
    this.uiStateManager = new UIStateManager();
    this.lockManager = new LockManager(vault, this.uiStateManager);
  }

  public getActiveSession(): SpaceSession | null {
    return this.activeSession && this.activeSession.isActive() ? this.activeSession : null;
  }

  public onLock(cb: () => void): () => void {
    this.onLockCallbacks.push(cb);
    return () => {
      this.onLockCallbacks = this.onLockCallbacks.filter(c => c !== cb);
    };
  }

  /**
   * Unlocks a Space using credential-selected envelope authentication.
   */
  public async unlock(passphrase: string): Promise<SpaceSession> {
    // 1. Unlock session via SpaceVaultManager (async to keep UI responsive)
    const session = await this.vault.unlockSpaceAsync(passphrase);

    // 2. Load persisted encrypted partition from storage adapter
    await this.store.loadPartitionFromStorage(session);

    // 3. Ensure Identity document exists
    let identity = this.idMgr.loadIdentity(session, this.store);
    if (!identity) {
      this.idMgr.createIdentity(session, this.store);
    }

    this.activeSession = session;
    this.resetAutoLockTimer();
    return session;
  }

  /**
   * Creates a new isolated Space and persists its envelope to storage.
   */
  public async createSpace(name: string, passphrase: string, isDecoy = false): Promise<{ spaceId: string }> {
    const envelope = this.vault.createSpace({ name, password: passphrase, isDecoy });
    await this.vault.saveEnvelopeToStorage(envelope, this.storageAdapter);
    return { spaceId: envelope.spaceId };
  }

  /**
   * Switches to a new Space, ensuring the previous Space is completely locked and wiped.
   */
  public async switchSpace(newPassphrase: string): Promise<SpaceSession> {
    this.lock();
    return this.unlock(newPassphrase);
  }

  /**
   * Locks the active Space and halts networking.
   */
  public lock(): void {
    if (this.activeSession) {
      this.netManager.stopListening(this.activeSession);
      this.lockManager.quickLock(this.activeSession.spaceId);
      this.activeSession = null;
    }
    this.clearAutoLockTimer();
    this.notifyLock();
  }

  /**
   * Instant Panic Lock: destroys all active sessions, halts networking, and triggers UI purge.
   */
  public panicLock(): void {
    if (this.activeSession) {
      this.netManager.stopListening(this.activeSession);
    }
    this.lockManager.panicLock();
    this.activeSession = null;
    this.clearAutoLockTimer();
    this.notifyLock();
  }

  public setAutoLockMinutes(minutes: number): void {
    this.autoLockMinutes = minutes;
    this.resetAutoLockTimer();
  }

  public recordUserActivity(): void {
    if (this.activeSession) {
      this.resetAutoLockTimer();
    }
  }

  private resetAutoLockTimer(): void {
    this.clearAutoLockTimer();
    if (this.autoLockMinutes > 0 && this.activeSession) {
      this.autoLockTimer = setTimeout(() => {
        this.lock();
      }, this.autoLockMinutes * 60 * 1000);
      if (this.autoLockTimer.unref) {
        this.autoLockTimer.unref();
      }
    }
  }

  private clearAutoLockTimer(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = undefined;
    }
  }

  private notifyLock(): void {
    for (const cb of this.onLockCallbacks) {
      try {
        cb();
      } catch (_e) {}
    }
  }
}
