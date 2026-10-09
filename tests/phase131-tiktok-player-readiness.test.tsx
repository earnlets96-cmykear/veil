import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const componentSource = readFileSync(`${process.cwd()}/src/ui/components/ui/SocialVideoPreviewCard.tsx`, 'utf8');

describe('TikTok player readiness recovery', () => {
  it('shows recovery when TikTok never reports that its iframe player is ready', () => {
    expect(componentSource).toContain('TIKTOK_PLAYER_READY_TIMEOUT_MS');
    expect(componentSource).toContain("event.data.type === 'onPlayerReady'");
    expect(componentSource).toContain('setPlayerError(true)');
    expect(componentSource).toContain('Retry video');
    expect(componentSource).toContain('Open original');
  });
});
