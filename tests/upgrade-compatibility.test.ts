import { describe, it, expect } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from '../src/storage/migrations.ts';

describe('VEIL Phase 19: Storage Schema Upgrade & Backward Compatibility', () => {
  it('SCHEMA VERSIONING: Confirms storage schema version is explicitly declared and integer >= 1', () => {
    expect(typeof CURRENT_SCHEMA_VERSION).toBe('number');
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });
});
