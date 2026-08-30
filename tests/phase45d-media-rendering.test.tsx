import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaCache } from '../src/ui/utils/mediaCache.ts';

describe('Phase 45D: Media Rendering & Cache Management', () => {
  it('1. MediaCache stores and retrieves in-memory decrypted media items', () => {
    const mockData = new Uint8Array([1, 2, 3, 4, 5]);
    MediaCache.set('obj_test_1', {
      id: 'obj_test_1',
      blobUrl: 'blob:http://localhost/test-1',
      data: mockData,
      mimeType: 'image/png',
      name: 'photo.png',
      sizeBytes: 5,
    });

    const retrieved = MediaCache.get('obj_test_1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('obj_test_1');
    expect(retrieved?.data).toEqual(mockData);
    expect(retrieved?.blobUrl).toBe('blob:http://localhost/test-1');
  });

  it('2. MediaCache invalidation removes item and cleans up references', () => {
    MediaCache.set('obj_test_2', {
      id: 'obj_test_2',
      blobUrl: 'blob:http://localhost/test-2',
      data: new Uint8Array([9, 8, 7]),
      mimeType: 'video/mp4',
      name: 'clip.mp4',
      sizeBytes: 3,
    });

    expect(MediaCache.get('obj_test_2')).toBeDefined();
    MediaCache.invalidate('obj_test_2');
    expect(MediaCache.get('obj_test_2')).toBeUndefined();
  });

  it('3. MediaCache clear purges all items from RAM', () => {
    MediaCache.set('obj_a', {
      id: 'obj_a',
      blobUrl: 'blob:http://localhost/a',
      data: new Uint8Array([1]),
      mimeType: 'image/jpeg',
      name: 'a.jpg',
      sizeBytes: 1,
    });
    MediaCache.set('obj_b', {
      id: 'obj_b',
      blobUrl: 'blob:http://localhost/b',
      data: new Uint8Array([2]),
      mimeType: 'image/jpeg',
      name: 'b.jpg',
      sizeBytes: 1,
    });

    expect(MediaCache.get('obj_a')).toBeDefined();
    expect(MediaCache.get('obj_b')).toBeDefined();

    MediaCache.clear();

    expect(MediaCache.get('obj_a')).toBeUndefined();
    expect(MediaCache.get('obj_b')).toBeUndefined();
  });
});
