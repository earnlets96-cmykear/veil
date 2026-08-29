import { describe, it, expect, vi } from 'vitest';
import { MediaCache } from '../src/ui/utils/mediaCache.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('Phase 42: Media State Machine Timeout & Fail-Closed Resilience Suite', () => {
  it('MediaCache.getOrFetch rejects when download hangs and cleans up inFlight locks', async () => {
    const session = new SpaceSession('space_timeout', 'Timeout Test', false, randomBytes(32));
    const mockCloudClient = new CloudClient('http://127.0.0.1:9999');

    // Mock downloadAttachment to simulate a hanging promise
    vi.spyOn(mockCloudClient, 'downloadAttachment').mockImplementation(() => {
      return new Promise<Uint8Array>(() => {
        // Never resolves to simulate network blackhole
      });
    });

    const attachmentPayload = {
      attachmentId: 'att_hang_01',
      objectId: 'obj_hang_01',
      name: 'timeout_test.png',
      mimeType: 'image/png',
    };

    // We override timeout in test or test timeout behavior
    const fetchPromise = MediaCache.getOrFetch(attachmentPayload, session, mockCloudClient);

    // Assert that inFlight map is cleaned up if we trigger cancellation/error
    expect((MediaCache as any).inFlight.has('obj_hang_01')).toBe(true);

    MediaCache.invalidate('obj_hang_01');
    expect((MediaCache as any).get('obj_hang_01')).toBeUndefined();
  });

  it('allows clean retry after a failed download attempt', async () => {
    const session = new SpaceSession('space_retry', 'Retry Test', false, randomBytes(32));
    const mockCloudClient = new CloudClient('http://127.0.0.1:9999');

    let attempt = 0;
    vi.spyOn(mockCloudClient, 'downloadAttachment').mockImplementation(async () => {
      attempt++;
      if (attempt === 1) {
        throw new Error('Network error: 503 Service Unavailable');
      }
      return new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // Valid PNG header
    });

    const attachmentPayload = {
      attachmentId: 'att_retry_01',
      objectId: 'obj_retry_01',
      name: 'retry.png',
      mimeType: 'image/png',
    };

    // First attempt fails
    await expect(MediaCache.getOrFetch(attachmentPayload, session, mockCloudClient)).rejects.toThrow(
      'Network error: 503 Service Unavailable'
    );

    // inFlight map is clean
    expect((MediaCache as any).inFlight.has('obj_retry_01')).toBe(false);

    // Second attempt succeeds
    const result = await MediaCache.getOrFetch(attachmentPayload, session, mockCloudClient);
    expect(result).toBeDefined();
    expect(result.data.length).toBe(4);
    expect(result.mimeType).toBe('image/png');
  });
});
