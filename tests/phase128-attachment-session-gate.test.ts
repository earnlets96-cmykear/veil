import { describe, expect, it, vi } from 'vitest';
import { CloudClient } from '../src/network/cloudClient.ts';
import { requireCloudSessionForAttachment } from '../src/network/requireCloudSessionForAttachment.ts';

describe('Phase 128: attachment session gate', () => {
  it('stops before attachment access when session recovery fails', async () => {
    const client = new CloudClient('https://relay.example.test');
    const ensure = vi.fn(async () => false);

    await expect(requireCloudSessionForAttachment(client, ensure)).rejects.toThrow(
      'Cloud authentication is unavailable. Reopen this Space to try again.'
    );
    expect(ensure).toHaveBeenCalledOnce();
    expect(client.hasAuthenticatedSession()).toBe(false);
  });

  it('accepts a refreshed, structurally valid session', async () => {
    const client = new CloudClient('https://relay.example.test');
    const ensure = vi.fn(async () => {
      client.setSession('a'.repeat(64), 'account-1', 'device-1');
      return true;
    });

    await expect(requireCloudSessionForAttachment(client, ensure)).resolves.toBeUndefined();
    expect(client.hasAuthenticatedSession()).toBe(true);
  });
});
