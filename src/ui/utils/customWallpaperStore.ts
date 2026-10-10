const STORE_NAME = 'wallpapers';
const RECORD_KEY = 'active';

export class CustomWallpaperStore {
  private database: Promise<IDBDatabase> | null = null;

  constructor(private readonly databaseName = 'veil_appearance') {}

  private open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Local wallpaper storage is unavailable.'));
    if (!this.database) {
      this.database = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Local wallpaper storage could not be opened.'));
        request.onblocked = () => reject(new Error('Local wallpaper storage is busy.'));
      });
    }
    return this.database;
  }

  async save(blob: Blob): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(blob, RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('The wallpaper could not be saved on this device.'));
      transaction.onabort = () => reject(new Error('The wallpaper could not be saved on this device.'));
    });
  }

  async load(): Promise<Blob | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(new Error('The saved wallpaper could not be read.'));
    });
  }

  async remove(): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('The saved wallpaper could not be removed.'));
      transaction.onabort = () => reject(new Error('The saved wallpaper could not be removed.'));
    });
  }
}

export const customWallpaperStore = new CustomWallpaperStore();
