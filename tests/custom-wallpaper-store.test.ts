import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CustomWallpaperStore } from '../src/ui/utils/customWallpaperStore.ts';

describe('custom wallpaper local store', () => {
  let store: CustomWallpaperStore;
  beforeEach(() => { store = new CustomWallpaperStore(`wallpaper-test-${Date.now()}-${Math.random()}`); });

  it('saves, reads, replaces, and removes the app-local photo', async () => {
    await store.save(new Blob(['first'], { type: 'image/webp' }));
    expect(await (await store.load())?.text()).toBe('first');
    await store.save(new Blob(['replacement'], { type: 'image/webp' }));
    expect(await (await store.load())?.text()).toBe('replacement');
    await store.remove();
    expect(await store.load()).toBeNull();
  });
});
