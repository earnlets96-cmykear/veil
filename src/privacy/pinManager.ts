/**
 * VEIL Multi-Space PIN Manager.
 *
 * Implements the core multi-space access gate:
 * - One neutral PIN screen where distinct PINs silently unlock distinct spaces.
 * - Enforces the PIN collision rule: the same PIN cannot be assigned to two spaces.
 * - Zero plaintext PIN storage: derived via Argon2id with a device-unique salt.
 * - Credentials wrapped with XChaCha20-Poly1305 keyed by kek_pin.
 * - Progressive rate-limiting and lockout protection against brute-force attacks.
 * - Never leaks space names, accounts, or counts on failed PIN entry.
 */

import { deriveKeyArgon2id, deriveKeyArgon2idAsync, DEFAULT_KDF_PARAMS } from '../crypto/kdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { randomBytes, bytesToBase64, base64ToBytes, bytesToHex } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha256.js';
import type { KdfParameters } from '../types/index.ts';

export interface WrappedCredentialsPayload {
  password: string;
  spaceId: string;
  username: string;
  accountId?: string;
}

export interface SpacePinEntry {
  spaceId: string;
  canonicalUsername: string;
  spaceName: string;
  avatar?: string;
  pinLength: 4 | 6;
  wrappedCredentials: {
    algorithm: 'XChaCha20-Poly1305';
    nonce: string;
    ciphertext: string;
    aad: string;
  };
}

export type AutoLockIntervalSetting = 'immediately' | '30s' | '1m' | '5m' | '10m' | 'never';

export interface DevicePinRegistry {
  version: 1;
  deviceSalt: string; // 32-byte Base64 salt
  appLockEnabled: boolean;
  autoLockInterval: AutoLockIntervalSetting;
  lockOnBackground: boolean;
  lockOnScreenOff: boolean;
  biometricsEnabled: boolean;
  failedAttempts: number;
  lockedUntilEpoch: number;
  entries: Record<string, SpacePinEntry>; // Keyed by pinHash
}

const REGISTRY_STORAGE_KEY = 'veil:device_pin_registry';

export class SpacePinManager {
  private registry: DevicePinRegistry;
  private kdfParams: KdfParameters;

  constructor(customKdfParams?: Partial<KdfParameters>) {
    this.kdfParams = {
      ...DEFAULT_KDF_PARAMS,
      ...customKdfParams,
    };
    this.registry = this.loadRegistry();
  }

  /**
   * Initializes or loads the DevicePinRegistry from persistent storage.
   */
  private loadRegistry(): DevicePinRegistry {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === 1 && parsed.deviceSalt && parsed.entries) {
            return parsed;
          }
        }
      } catch (_e) {}
    }

    // Initialize fresh registry with new device-unique salt
    const newSalt = bytesToBase64(randomBytes(32));
    const fresh: DevicePinRegistry = {
      version: 1,
      deviceSalt: newSalt,
      appLockEnabled: true,
      autoLockInterval: '5m',
      lockOnBackground: true,
      lockOnScreenOff: true,
      biometricsEnabled: false,
      failedAttempts: 0,
      lockedUntilEpoch: 0,
      entries: {},
    };
    this.saveRegistry(fresh);
    return fresh;
  }

  private saveRegistry(reg?: DevicePinRegistry): void {
    const toSave = reg ?? this.registry;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(toSave));
      } catch (_e) {}
    }
  }

  /**
   * Derives a 256-bit KEK and an index hash for a given PIN.
   */
  private derivePinKeys(pin: string): { kek: Uint8Array; pinHash: string } {
    const cleanPin = pin.trim();
    if (!/^\d{4,8}$/.test(cleanPin)) {
      throw new Error('PIN must be 4 to 8 digits');
    }

    const saltBytes = base64ToBytes(this.registry.deviceSalt);
    const kek = deriveKeyArgon2id(cleanPin, saltBytes, this.kdfParams);
    const pinHashBytes = hmac(sha256, kek, new TextEncoder().encode('veil-pin-index'));
    const pinHash = bytesToHex(pinHashBytes);

    return { kek, pinHash };
  }

  /**
   * Async derivation for web workers / responsive UI.
   */
  private async derivePinKeysAsync(pin: string): Promise<{ kek: Uint8Array; pinHash: string }> {
    const cleanPin = pin.trim();
    if (!/^\d{4,8}$/.test(cleanPin)) {
      throw new Error('PIN must be 4 to 8 digits');
    }

    const saltBytes = base64ToBytes(this.registry.deviceSalt);
    const kek = await deriveKeyArgon2idAsync(cleanPin, saltBytes, this.kdfParams);
    const pinHashBytes = hmac(sha256, kek, new TextEncoder().encode('veil-pin-index'));
    const pinHash = bytesToHex(pinHashBytes);

    return { kek, pinHash };
  }

  /**
   * Checks if any spaces have registered PINs on this device.
   */
  public hasRegisteredPins(): boolean {
    return Object.keys(this.registry.entries).length > 0;
  }

  /**
   * Returns whether app lock is currently enabled.
   */
  public isAppLockEnabled(): boolean {
    return this.registry.appLockEnabled && this.hasRegisteredPins();
  }

  /**
   * Enables or disables App Lock globally.
   */
  public setAppLockEnabled(enabled: boolean): void {
    this.registry.appLockEnabled = enabled;
    this.saveRegistry();
  }

  /**
   * Sets the auto-lock interval.
   */
  public setAutoLockInterval(interval: AutoLockIntervalSetting): void {
    this.registry.autoLockInterval = interval;
    this.saveRegistry();
  }

  public getAutoLockInterval(): AutoLockIntervalSetting {
    return this.registry.autoLockInterval;
  }

  public setLockOnBackground(enabled: boolean): void {
    this.registry.lockOnBackground = enabled;
    this.saveRegistry();
  }

  public isLockOnBackground(): boolean {
    return this.registry.lockOnBackground;
  }

  public setBiometricsEnabled(enabled: boolean): void {
    this.registry.biometricsEnabled = enabled;
    this.saveRegistry();
  }

  public isBiometricsEnabled(): boolean {
    return this.registry.biometricsEnabled;
  }

  /**
   * Checks if a PIN is available according to the PIN Collision Rule.
   * Rejects if the PIN is already registered to a different space.
   */
  public async isPinAvailable(pin: string, excludeSpaceId?: string): Promise<boolean> {
    try {
      const { kek, pinHash } = await this.derivePinKeysAsync(pin);
      zeroize(kek);

      const existing = this.registry.entries[pinHash];
      if (!existing) return true;
      if (excludeSpaceId && existing.spaceId === excludeSpaceId) return true;
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Synchronous check for fast validation.
   */
  public isPinAvailableSync(pin: string, excludeSpaceId?: string): boolean {
    try {
      const { kek, pinHash } = this.derivePinKeys(pin);
      zeroize(kek);

      const existing = this.registry.entries[pinHash];
      if (!existing) return true;
      if (excludeSpaceId && existing.spaceId === excludeSpaceId) return true;
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Assigns or updates the App PIN for a specific space.
   * Enforces the PIN collision rule: rejects if PIN already belongs to another space.
   */
  public async assignPinToSpace(params: {
    spaceId: string;
    canonicalUsername: string;
    spaceName: string;
    password: string;
    pin: string;
    avatar?: string;
    accountId?: string;
  }): Promise<void> {
    const { spaceId, canonicalUsername, spaceName, password, pin, avatar, accountId } = params;

    const isAvail = await this.isPinAvailable(pin, spaceId);
    if (!isAvail) {
      throw new Error('This PIN is unavailable. Please choose a different PIN.');
    }

    const { kek, pinHash } = await this.derivePinKeysAsync(pin);

    try {
      // Remove any existing PIN entry for this spaceId
      for (const [hash, entry] of Object.entries(this.registry.entries)) {
        if (entry.spaceId === spaceId) {
          delete this.registry.entries[hash];
        }
      }

      // Wrap credentials
      const payload: WrappedCredentialsPayload = {
        password,
        spaceId,
        username: canonicalUsername.trim().toLowerCase().replace(/^@/, ''),
        accountId,
      };

      const aad = new TextEncoder().encode(`veil-pin-cred|space:${spaceId}|ver:1`);
      const { nonce, ciphertext } = encryptXChaCha20Poly1305(
        kek,
        JSON.stringify(payload),
        aad
      );

      const entry: SpacePinEntry = {
        spaceId,
        canonicalUsername: payload.username,
        spaceName,
        avatar,
        pinLength: pin.length === 6 ? 6 : 4,
        wrappedCredentials: {
          algorithm: 'XChaCha20-Poly1305',
          nonce: bytesToBase64(nonce),
          ciphertext: bytesToBase64(ciphertext),
          aad: bytesToBase64(aad),
        },
      };

      this.registry.entries[pinHash] = entry;
      this.registry.appLockEnabled = true;
      this.saveRegistry();
    } finally {
      zeroize(kek);
    }
  }

  /**
   * Changes the PIN of a space after verifying the old PIN.
   */
  public async changePin(params: {
    spaceId: string;
    oldPin: string;
    newPin: string;
  }): Promise<void> {
    const { spaceId, oldPin, newPin } = params;

    // 1. Verify old PIN resolves to this space
    const resolved = await this.verifyAndResolvePin(oldPin);
    if (resolved.spaceId !== spaceId) {
      throw new Error('Incorrect current PIN');
    }

    // 2. Check new PIN availability
    const isAvail = await this.isPinAvailable(newPin, spaceId);
    if (!isAvail) {
      throw new Error('This PIN is unavailable. Please choose a different PIN.');
    }

    // 3. Find current entry metadata
    const spaceMeta = this.getSpaceMetadata(spaceId);
    const spaceName = spaceMeta?.spaceName || 'My Space';
    const avatar = spaceMeta?.avatar;

    // 4. Assign new PIN
    await this.assignPinToSpace({
      spaceId,
      canonicalUsername: resolved.username,
      spaceName,
      password: resolved.password,
      pin: newPin,
      avatar,
      accountId: resolved.accountId,
    });
  }

  /**
   * Removes a space from the PIN registry.
   */
  public removeSpace(spaceId: string): void {
    let changed = false;
    for (const [hash, entry] of Object.entries(this.registry.entries)) {
      if (entry.spaceId === spaceId) {
        delete this.registry.entries[hash];
        changed = true;
      }
    }
    if (changed) {
      this.saveRegistry();
    }
  }

  /**
   * Renames a space in the PIN registry.
   */
  public renameSpace(spaceId: string, newName: string): void {
    for (const entry of Object.values(this.registry.entries)) {
      if (entry.spaceId === spaceId) {
        entry.spaceName = newName;
        this.saveRegistry();
        return;
      }
    }
  }

  /**
   * Updates avatar of a space in the PIN registry.
   */
  public updateSpaceAvatar(spaceId: string, avatar?: string): void {
    for (const entry of Object.values(this.registry.entries)) {
      if (entry.spaceId === spaceId) {
        entry.avatar = avatar;
        this.saveRegistry();
        return;
      }
    }
  }

  /**
   * Verifies the user's PIN and silently resolves to the matching space.
   *
   * Privacy / Security Guarantees:
   * - Never reveals whether a space exists or which space owns the PIN.
   * - Wrong PIN throws generic "Incorrect PIN" with rate-limiting.
   * - Rate-limiting progressively locks out brute-force attempts.
   */
  public async verifyAndResolvePin(pin: string): Promise<WrappedCredentialsPayload> {
    // Check lockout timer
    const now = Date.now();
    if (this.registry.lockedUntilEpoch > now) {
      const waitSec = Math.ceil((this.registry.lockedUntilEpoch - now) / 1000);
      throw new Error(`Too many attempts. Please try again in ${waitSec} seconds.`);
    }

    let kek: Uint8Array | null = null;

    try {
      const res = await this.derivePinKeysAsync(pin);
      kek = res.kek;
      const { pinHash } = res;

      const entry = this.registry.entries[pinHash];
      if (!entry) {
        // PIN does not match any registered space
        this.recordFailedAttempt();
        throw new Error('Incorrect PIN');
      }

      // Unwrap credentials
      const nonce = base64ToBytes(entry.wrappedCredentials.nonce);
      const ciphertext = base64ToBytes(entry.wrappedCredentials.ciphertext);
      const aad = base64ToBytes(entry.wrappedCredentials.aad);

      const decrypted = decryptXChaCha20Poly1305(kek, nonce, ciphertext, aad);
      const parsed: WrappedCredentialsPayload = JSON.parse(new TextDecoder().decode(decrypted));

      // Reset failure counters on successful unlock
      this.registry.failedAttempts = 0;
      this.registry.lockedUntilEpoch = 0;
      this.saveRegistry();

      return parsed;
    } catch (err: any) {
      if (err.message && (err.message.includes('Too many attempts') || err.message === 'Incorrect PIN')) {
        throw err;
      }
      this.recordFailedAttempt();
      throw new Error('Incorrect PIN');
    } finally {
      if (kek) zeroize(kek);
    }
  }

  private recordFailedAttempt(): void {
    this.registry.failedAttempts = (this.registry.failedAttempts || 0) + 1;
    const attempts = this.registry.failedAttempts;

    if (attempts >= 10) {
      this.registry.lockedUntilEpoch = Date.now() + 60000; // 60s lockout
    } else if (attempts >= 5) {
      this.registry.lockedUntilEpoch = Date.now() + 30000; // 30s lockout
    }

    this.saveRegistry();
  }

  /**
   * Returns public space metadata for the authenticated Accounts & Spaces management UI.
   * Does NOT reveal PINs, pin hashes, or passwords.
   */
  public listRegisteredSpaces(): Array<{
    spaceId: string;
    spaceName: string;
    canonicalUsername: string;
    avatar?: string;
    pinLength: 4 | 6;
  }> {
    return Object.values(this.registry.entries).map((entry) => ({
      spaceId: entry.spaceId,
      spaceName: entry.spaceName,
      canonicalUsername: entry.canonicalUsername,
      avatar: entry.avatar,
      pinLength: entry.pinLength,
    }));
  }

  /**
   * Retrieves space metadata by spaceId.
   */
  public getSpaceMetadata(spaceId: string): {
    spaceId: string;
    spaceName: string;
    canonicalUsername: string;
    avatar?: string;
    pinLength: 4 | 6;
  } | null {
    for (const entry of Object.values(this.registry.entries)) {
      if (entry.spaceId === spaceId) {
        return {
          spaceId: entry.spaceId,
          spaceName: entry.spaceName,
          canonicalUsername: entry.canonicalUsername,
          avatar: entry.avatar,
          pinLength: entry.pinLength,
        };
      }
    }
    return null;
  }

  /**
   * Completely resets the PIN registry (e.g. for testing or fresh install wipe).
   */
  public resetRegistry(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(REGISTRY_STORAGE_KEY);
      } catch (_e) {}
    }
    this.registry = this.loadRegistry();
  }
}

// Global Singleton Instance
export const spacePinManager = new SpacePinManager();
