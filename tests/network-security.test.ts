import { describe, it, expect } from 'vitest';
import { HttpTransport } from '../src/network/httpTransport.ts';
import { TlsRequiredError, ProtocolVersionMismatchError } from '../src/network/errors.ts';
import { DEFAULT_NETWORK_CONFIG } from '../src/network/types.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceSession } from '../src/spaces/session.ts';


describe('VEIL Phase 13: Network Security & TLS Enforcement Tests', () => {
  it('TLS ENFORCEMENT: Rejects insecure HTTP relay URL when enforceTls is true', () => {
    expect(() => {
      new HttpTransport({
        ...DEFAULT_NETWORK_CONFIG,
        httpUrl: 'http://example.com:8080',
        enforceTls: true,
      });
    }).toThrow(TlsRequiredError);
  });

  it('LOCKED SPACE PROTECTION: NetworkManager operations throw if SpaceSession is locked', async () => {
    const store = new EncryptedSpaceStore();
    const netManager = new NetworkManager(store);

    const lockedSession = new SpaceSession('dummy_space', 'Dummy', false, new Uint8Array(32));
    lockedSession.destroy(); // Mark locked/destroyed

    await expect(netManager.getOrCreateMailbox(lockedSession)).rejects.toThrow(/locked or destroyed/);
    await expect(netManager.sendEnvelope(lockedSession, 'mb_1', 'payload')).rejects.toThrow(/locked or destroyed/);
  });

});
