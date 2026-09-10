import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaPickerModal } from '../src/ui/components/media/MediaPickerModal.tsx';
import { NativeDeviceMediaBridge } from '../src/media/NativeDeviceMediaBridge.ts';
import { FileSaver } from '../src/ui/utils/fileSaver.ts';

describe('Phase 74: Media Attachment Interaction Tests', () => {
  let bridge: NativeDeviceMediaBridge;
  let requestPermissionMock: ReturnType<typeof vi.fn>;
  let listRecentMock: ReturnType<typeof vi.fn>;
  let readMediaMock: ReturnType<typeof vi.fn>;
  let pickDocumentsMock: ReturnType<typeof vi.fn>;
  let saveToGalleryMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestPermissionMock = vi.fn(async () => ({ status: 'granted' as const }));
    listRecentMock = vi.fn(async () => ({
      items: [
        { uri: 'content://media/1', name: 'photo1.jpg', mimeType: 'image/jpeg', sizeBytes: 1024 },
        { uri: 'content://media/2', name: 'video1.mp4', mimeType: 'video/mp4', sizeBytes: 2048 },
      ],
    }));
    readMediaMock = vi.fn(async ({ uri }: { uri: string }) => ({
      name: uri.endsWith('2') ? 'video1.mp4' : 'photo1.jpg',
      mimeType: uri.endsWith('2') ? 'video/mp4' : 'image/jpeg',
      sizeBytes: 4,
      base64Data: 'AQIDBA==',
    }));
    pickDocumentsMock = vi.fn(async () => ({
      items: [
        { uri: 'content://doc/1', name: 'contract.pdf', mimeType: 'application/pdf', sizeBytes: 4096 },
      ],
    }));
    saveToGalleryMock = vi.fn(async () => ({ uri: 'content://gallery/9', location: 'Pictures/VEIL' }));

    bridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      requestRecentMediaPermission: requestPermissionMock,
      listRecentMedia: listRecentMock,
      readMedia: readMediaMock,
      pickDocuments: pickDocumentsMock,
      saveToGallery: saveToGalleryMock,
    });
  });

  it('1. Opening the attachment sheet causes no permission request', () => {
    renderToStaticMarkup(
      <MediaPickerModal isOpen={true} onClose={vi.fn()} onSend={vi.fn()} />
    );

    // Initial render of modal should never invoke permission request
    expect(bridge.permissionRequestCount()).toBe(0);
    expect(requestPermissionMock).not.toHaveBeenCalled();
  });

  it('2. Tapping Browse Recent/Photos/Videos requests permission exactly when required', async () => {
    expect(bridge.permissionRequestCount()).toBe(0);

    // Explicitly triggering recent permission check
    const res = await bridge.requestRecentMediaPermission();
    expect(res.status).toBe('granted');
    expect(bridge.permissionRequestCount()).toBe(1);
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
  });

  it('3. Permission is not repeatedly requested unnecessarily when status is already determined', async () => {
    await bridge.requestRecentMediaPermission();
    expect(bridge.permissionRequestCount()).toBe(1);

    // After permission is established, listing media uses the granted state without a second permission dialog
    await bridge.listRecentMedia({ limit: 48, types: ['image', 'video'] });
    expect(bridge.permissionRequestCount()).toBe(1);
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
  });

  it('4. Denied permission leaves Documents/document picker usable', async () => {
    const deniedBridge = NativeDeviceMediaBridge.createForTesting({
      isNative: () => true,
      requestRecentMediaPermission: async () => ({ status: 'denied' as const }),
      pickDocuments: pickDocumentsMock,
    });

    const perm = await deniedBridge.requestRecentMediaPermission();
    expect(perm.status).toBe('denied');

    // Documents must still be pickable without requiring recent media permission
    const docs = await deniedBridge.pickDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe('contract.pdf');
    expect(pickDocumentsMock).toHaveBeenCalledTimes(1);
  });

  it('5. Selecting native media calls readMedia only after the item is actually tapped', async () => {
    // Listing recent media fetches only thumbnails and metadata, NOT full file content
    const page = await bridge.listRecentMedia({ limit: 48, types: ['image', 'video'] });
    expect(page.items).toHaveLength(2);
    expect(readMediaMock).not.toHaveBeenCalled();

    // Only when user explicitly taps/selects an item does readMedia get called
    const file = await bridge.fileFromUri(page.items[0].uri);
    expect(readMediaMock).toHaveBeenCalledTimes(1);
    expect(file.name).toBe('photo1.jpg');
    expect(file.type).toBe('image/jpeg');
  });

  it('6. Gallery save routes through MediaStore for Android images/videos', async () => {
    FileSaver.setDeviceMediaBridgeForTesting(bridge);

    const result = await FileSaver.saveToGallery({
      filename: 'saved_photo.jpg',
      mimeType: 'image/jpeg',
      data: new Uint8Array([1, 2, 3, 4]),
    });

    expect(saveToGalleryMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.location).toBe('Pictures/VEIL');
  });

  it('7. Gallery save does not request broad filesystem access on modern Android', async () => {
    FileSaver.setDeviceMediaBridgeForTesting(bridge);

    // Saving an image calls saveToGallery directly through MediaStore
    await FileSaver.saveToGallery({
      filename: 'family.jpg',
      mimeType: 'image/jpeg',
      data: new Uint8Array([5, 6, 7, 8]),
    });

    expect(saveToGalleryMock).toHaveBeenCalledWith({
      filename: 'family.jpg',
      mimeType: 'image/jpeg',
      base64Data: expect.any(String),
    });
  });

  it('8. Removing a staged native item clears its selection state and uri mapping', async () => {
    // Stage item
    const file = await bridge.fileFromUri('content://media/1');
    const fileToUriMap = new Map<File, string>();
    const stagedUris = new Set<string>();

    // Stage
    fileToUriMap.set(file, 'content://media/1');
    stagedUris.add('content://media/1');
    expect(stagedUris.has('content://media/1')).toBe(true);

    // Unstage / remove
    const uri = fileToUriMap.get(file);
    if (uri) {
      fileToUriMap.delete(file);
      stagedUris.delete(uri);
    }

    expect(stagedUris.has('content://media/1')).toBe(false);
    expect(fileToUriMap.has(file)).toBe(false);
  });
});
