import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudClient } from '../src/network/cloudClient.ts';

describe('Phase 45A: attachment authentication security', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an attachment request locally when no authenticated session exists', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const client = new CloudClient('https://relay.example.test');

    await expect(client.downloadAttachment('obj_missing_session')).rejects.toThrow(
      'Authentication required before attachment request'
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects malformed bearer tokens locally without emitting an Authorization header', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const client = new CloudClient('https://relay.example.test');
    client.setSession('not a valid bearer token', 'acc_safe', 'dev_safe');

    await expect(client.uploadAttachment('obj_malformed', new Uint8Array([1]))).rejects.toThrow(
      'Authentication required before attachment request'
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
