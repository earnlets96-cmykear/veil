import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { IndexedDBStorageAdapter } from '../src/storage/indexedDbAdapter.ts';
import { StorageUnavailableError, StorageQuotaError } from '../src/storage/types.ts';

describe('VEIL Phase 11: Fail-Closed & Storage Error Containment Tests', () => {
  it('FAIL CLOSED: Throws StorageUnavailableError when IndexedDB factory is missing (no silent memory fallback)', async () => {
    // Instantiate adapter with null factory to simulate unsupported/disabled IndexedDB
    const adapter = new IndexedDBStorageAdapter('test_db', 1, null as any);

    await expect(adapter.init()).rejects.toThrow(StorageUnavailableError);
    await expect(adapter.init()).rejects.toThrow(/IndexedDB is not available/);
    expect(adapter.isInitialized()).toBe(false);
  });

  it('FAIL CLOSED: Calling operations on uninitialized adapter throws StorageUnavailableError', async () => {
    const adapter = new IndexedDBStorageAdapter('test_uninit');
    expect(adapter.isInitialized()).toBe(false);

    await expect(adapter.getEnvelope('any_id')).rejects.toThrow(StorageUnavailableError);
    await expect(adapter.listEnvelopes()).rejects.toThrow(StorageUnavailableError);
    await expect(adapter.getRecord('space_1', 'key_1')).rejects.toThrow(StorageUnavailableError);
  });

  it('QUOTA ERROR HANDLING: Maps DOMException QuotaExceededError to StorageQuotaError', () => {
    const adapter = new IndexedDBStorageAdapter('test_quota');
    const fakeQuotaError = new DOMException('The quota has been exceeded.', 'QuotaExceededError');

    // Test error wrapper
    const wrapped = (adapter as any).wrapError(fakeQuotaError);
    expect(wrapped).toBeInstanceOf(StorageQuotaError);
    expect(wrapped.message).toContain('quota has been exceeded');
  });
});
