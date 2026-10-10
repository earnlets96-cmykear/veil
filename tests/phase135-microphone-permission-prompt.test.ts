import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  acknowledgeMicrophonePermissionExplanation,
  hasAcknowledgedMicrophonePermissionExplanation,
  shouldShowMicrophonePermissionExplanation,
} from '../src/ui/utils/microphonePermission.ts';

describe('Phase 135 microphone permission prompt persistence', () => {
  it('shows the explanation once while permission is still reported as prompt', () => {
    expect(shouldShowMicrophonePermissionExplanation('prompt', false)).toBe(true);
    expect(shouldShowMicrophonePermissionExplanation('prompt', true)).toBe(false);
  });

  it('does not replace granted or denied permission handling with the explanation', () => {
    expect(shouldShowMicrophonePermissionExplanation('granted', false)).toBe(false);
    expect(shouldShowMicrophonePermissionExplanation('denied', false)).toBe(false);
  });

  it('persists the acknowledgement without storing any permission data', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(hasAcknowledgedMicrophonePermissionExplanation(storage)).toBe(false);
    acknowledgeMicrophonePermissionExplanation(storage);
    expect(hasAcknowledgedMicrophonePermissionExplanation(storage)).toBe(true);
    expect(values.size).toBe(1);
    expect([...values.values()]).toEqual(['true']);
  });

  it('uses the persisted acknowledgement in the composer permission flow', () => {
    const composer = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/MessageComposer.tsx'), 'utf8');
    expect(composer).toContain('shouldShowMicrophonePermissionExplanation(');
    expect(composer).toContain('hasAcknowledgedMicrophonePermissionExplanation()');
    expect(composer).toContain('acknowledgeMicrophonePermissionExplanation();');
  });
});
