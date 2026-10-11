import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const componentSource = readFileSync(`${process.cwd()}/src/ui/components/ui/SocialVideoPreviewCard.tsx`, 'utf8');

describe('TikTok player readiness recovery', () => {
  it('keeps a slow TikTok iframe mounted when no ready message has arrived', () => {
    expect(componentSource).toContain('TIKTOK_PLAYER_READY_TIMEOUT_MS');
    expect(componentSource).toContain("event.data.type === 'onPlayerReady'");
    expect(componentSource).toContain('setPlayerStalled(true)');
    expect(componentSource).toContain('TikTok hasn’t confirmed the player is ready');
    expect(componentSource).toMatch(/playerError\s*\?\s*\(/);
    expect(componentSource).not.toContain('if (!playerReady) setPlayerError(true)');
    expect(componentSource).toContain('Open original');
  });
});
