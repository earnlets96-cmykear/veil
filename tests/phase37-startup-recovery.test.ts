/**
 * Phase 37 — Startup Recovery & Critical Crash Prevention Test Suite
 *
 * Verifies:
 * 1. UI components (Spinner, Button, IconButton) are defined and exportable without ReferenceError.
 * 2. SpaceVaultManager and SessionController initialize cleanly with memory storage.
 * 3. Corrupted envelope state fails closed without unhandled crash.
 * 4. Wrong password rejection does not crash or corrupt vault state.
 */

import { describe, it, expect } from 'vitest';
import { Spinner } from '../src/ui/components/ui/Spinner.tsx';
import { Button } from '../src/ui/components/ui/Button.tsx';
import { IconButton } from '../src/ui/components/ui/IconButton.tsx';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SessionController } from '../src/ui/app/sessionController.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('Phase 37 — Startup Crash & Recovery Verification', () => {
  it('1.1: Core UI components (Spinner, Button, IconButton) are defined and exportable', () => {
    expect(Spinner).toBeDefined();
    expect(typeof Spinner).toBe('function');
    expect(Button).toBeDefined();
    expect(typeof Button).toBe('function');
    expect(IconButton).toBeDefined();
    expect(typeof IconButton).toBe('function');
  });

  it('1.2: SessionController and SpaceVaultManager initialize cleanly with clean memory adapter', async () => {
    const storage = new MemoryStorageAdapter();
    const vault = new SpaceVaultManager(storage);
    const store = new EncryptedSpaceStore(storage);
    const idMgr = new SpaceIdentityManager();
    const netManager = new NetworkManager();
    const sessionController = new SessionController(vault, store, storage, idMgr, netManager);

    expect(vault.listEnvelopes().length).toBe(0);
    expect(sessionController.getActiveSession()).toBeNull();

    // Create space and ensure unlock works
    const { spaceId } = await sessionController.createSpace('Personal', 'P@ssword123!');
    expect(spaceId).toBeDefined();
    expect(vault.listEnvelopes().length).toBe(1);

    const session = await sessionController.unlock('P@ssword123!');
    expect(session.isActive()).toBe(true);
    expect(session.spaceId).toBe(spaceId);

    sessionController.lock();
    expect(sessionController.getActiveSession()).toBeNull();
  });

  it('1.3: Corrupted envelope state fails closed without throwing unhandled crash', async () => {
    const storage = new MemoryStorageAdapter();
    const vault = new SpaceVaultManager(storage);
    const store = new EncryptedSpaceStore(storage);
    const idMgr = new SpaceIdentityManager();
    const netManager = new NetworkManager();
    const sessionController = new SessionController(vault, store, storage, idMgr, netManager);

    const { spaceId } = await sessionController.createSpace('Secret Space', 'ValidPassphrase123!');
    const envelopes = vault.listEnvelopes();
    expect(envelopes.length).toBe(1);

    // Corrupt ciphertext in envelope
    const env = vault.getEnvelope(spaceId)!;
    env.encryptedMasterKey.ciphertext = 'CORRUPTED_CIPHERTEXT_GARBAGE';

    // Attempting to unlock corrupted envelope throws expected auth error
    expect(() => vault.unlockSpace('ValidPassphrase123!')).toThrow();
  });

  it('1.4: Wrong password rejection does not crash or corrupt vault state', async () => {
    const storage = new MemoryStorageAdapter();
    const vault = new SpaceVaultManager(storage);
    const store = new EncryptedSpaceStore(storage);
    const idMgr = new SpaceIdentityManager();
    const netManager = new NetworkManager();
    const sessionController = new SessionController(vault, store, storage, idMgr, netManager);

    await sessionController.createSpace('Work Space', 'CorrectPassphrase456!');
    await expect(sessionController.unlock('WrongPassphrase789!')).rejects.toThrow();
    expect(sessionController.getActiveSession()).toBeNull();

    // Correct password unlocks immediately afterwards
    const validSession = await sessionController.unlock('CorrectPassphrase456!');
    expect(validSession.isActive()).toBe(true);
    sessionController.lock();
  });
});
