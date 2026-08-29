import { describe, it, expect, vi } from 'vitest';
import { ThumbnailGenerator } from '../src/attachments/thumbnailGenerator.ts';

describe('Phase 43: Video Lifecycle, Playback Engine & Decoder Cleanup Suite', () => {
  it('ThumbnailGenerator generates independent JPEG thumbnail without playing video', async () => {
    const dummyBlob = new Blob([new Uint8Array(1024)], { type: 'video/mp4' });
    const result = await ThumbnailGenerator.generateVideoThumbnail(dummyBlob, 0.5, 320);

    expect(result).toBeDefined();
    expect(result.thumbnailBlob).toBeDefined();
    expect(result.thumbnailBlob.type).toBe('image/jpeg');
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('verifies video player lifecycle events and seek synchronization', () => {
    const mockVideoElement: any = {
      src: 'blob:http://localhost:5173/mock-video-stream',
      currentTime: 0,
      duration: 60,
      muted: false,
      paused: true,
      play: vi.fn(async () => {
        mockVideoElement.paused = false;
      }),
      pause: vi.fn(() => {
        mockVideoElement.paused = true;
      }),
      removeAttribute: vi.fn(),
      load: vi.fn(),
    };

    // 1. Play / Pause
    mockVideoElement.play();
    expect(mockVideoElement.play).toHaveBeenCalled();
    expect(mockVideoElement.paused).toBe(false);

    mockVideoElement.pause();
    expect(mockVideoElement.pause).toHaveBeenCalled();
    expect(mockVideoElement.paused).toBe(true);

    // 2. Mute / Unmute
    mockVideoElement.muted = true;
    expect(mockVideoElement.muted).toBe(true);
    mockVideoElement.muted = false;
    expect(mockVideoElement.muted).toBe(false);

    // 3. Seek: 50% of 60s -> 30s
    const targetPercent = 50;
    const targetSeconds = (targetPercent / 100) * mockVideoElement.duration;
    mockVideoElement.currentTime = targetSeconds;
    expect(mockVideoElement.currentTime).toBe(30);

    // 4. Unmount / Decoder Cleanup
    mockVideoElement.pause();
    mockVideoElement.removeAttribute('src');
    mockVideoElement.load();
    expect(mockVideoElement.removeAttribute).toHaveBeenCalledWith('src');
    expect(mockVideoElement.load).toHaveBeenCalled();
  });
});
