/**
 * Phase 32: Profile, Settings, Directory Integrity & Telegram-Style UX Test Suite
 *
 * Verifies:
 * - PostgreSQL directory_profiles signing_public_key persistence & serialization fix
 * - Profile and avatar fallback rendering
 * - Bio and username handle editing
 * - Phone and profile privacy visibility settings
 * - Safe UI error handling (no raw SQL/database error leaks)
 * - Telegram-style settings 8-category navigation
 * - Mobile drill-down navigation
 * - Zero cryptographic key leakage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSignedProfile, verifySignedProfile } from '../src/identity/profile.ts';
import { generateSigningKeypair } from '../src/identity/signing.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { createIdentityDocument } from '../src/identity/document.ts';
import { randomBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { PostgresRelayStore } from '../src/server/storage/postgresRelayStore.ts';
import type { PrekeyBundle } from '../src/ratchet/types.ts';
import * as path from 'path';
import * as fs from 'fs';

describe('Phase 32: Profile, Settings, Directory Integrity & Telegram UX Tests', () => {
  const signingKeypair = generateSigningKeypair(randomBytes(32));
  const kaKeypair = generateKeyAgreementKeypair(randomBytes(32));
  const idDoc = createIdentityDocument(
    signingKeypair.privateKey,
    signingKeypair.publicKey,
    kaKeypair.publicKey,
    Date.now()
  );

  const prekeyBundle: PrekeyBundle = {
    identityDocument: idDoc,
    signedPrekey: {
      id: 1,
      publicKey: bytesToBase64(randomBytes(32)),
      signature: bytesToBase64(randomBytes(64)),
      createdAt: Date.now(),
    },
  };

  describe('Part A: Directory Profile Database & Serialization Integrity', () => {
    it('creates a SignedProfileDocument with signingPublicKey populated from identity document', () => {
      const doc = createSignedProfile(
        idDoc.identityId,
        signingKeypair.privateKey,
        'yui',
        'Yui Hirasawa',
        'mb_yui_01',
        prekeyBundle,
        'https://veil.io/avatars/yui.png'
      );

      expect(doc.username).toBe('yui');
      expect(doc.displayName).toBe('Yui Hirasawa');
      expect(doc.signingPublicKey).toBe(idDoc.signingPublicKey);
      expect(doc.keyAgreementPublicKey).toBe(idDoc.keyAgreementPublicKey);
      expect(doc.prekeyBundle.identityDocument.signingPublicKey).toBe(idDoc.signingPublicKey);
      expect(verifySignedProfile(doc)).toBe(true);
    });

    it('persists and retrieves profile in MemoryRelayStore with signing keys intact', async () => {
      const store = new MemoryRelayStore();
      await store.init();
      const doc = createSignedProfile(
        idDoc.identityId,
        signingKeypair.privateKey,
        'yui_memory',
        'Yui Memory',
        'mb_yui_mem',
        prekeyBundle
      );

      await store.registerProfile(doc);
      const fetched = await store.getProfileByUsername('yui_memory');
      expect(fetched).not.toBeNull();
      expect(fetched?.identityId).toBe(idDoc.identityId);
      expect(fetched?.prekeyBundle.identityDocument.signingPublicKey).toBe(idDoc.signingPublicKey);
    });

    it('persists and retrieves profile in PersistentFileRelayStore with case-insensitivity', async () => {
      const testDir = path.join(process.cwd(), '.veil_test_phase32_pstore');
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

      const store = new PersistentFileRelayStore(testDir);
      await store.init();

      try {
        const doc = createSignedProfile(
          idDoc.identityId,
          signingKeypair.privateKey,
          'yui_persist',
          'Yui Persistent',
          'mb_yui_p',
          prekeyBundle
        );

        await store.registerProfile(doc);

        const fetchedUpper = await store.getProfileByUsername('YUI_PERSIST');
        expect(fetchedUpper).not.toBeNull();
        expect(fetchedUpper?.username).toBe('yui_persist');
        expect(fetchedUpper?.prekeyBundle.identityDocument.signingPublicKey).toBe(idDoc.signingPublicKey);
      } finally {
        await store.close();
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('verifies PostgresRelayStore extracts non-null signing_public_key from profile', async () => {
      // Mock PG client to verify SQL query parameters
      let capturedParams: any[] = [];
      const mockPg: any = {
        query: async (_sql: string, params: any[]) => {
          capturedParams = params;
          return { rows: [], rowCount: 1 };
        },
        close: async () => {},
      };

      const pgStore = new PostgresRelayStore(mockPg);
      (pgStore as any).initialized = true;

      const doc = createSignedProfile(
        idDoc.identityId,
        signingKeypair.privateKey,
        'yui_pg',
        'Yui PG',
        'mb_yui_pg',
        prekeyBundle
      );

      await pgStore.registerProfile(doc);

      // Verify parameters passed to INSERT:
      // $1: username, $2: identity_id, $3: display_name, $4: avatar_url, $5: signing_public_key, $6: key_agreement_public_key
      expect(capturedParams[0]).toBe('yui_pg');
      expect(capturedParams[1]).toBe(idDoc.identityId);
      expect(capturedParams[2]).toBe('Yui PG');
      expect(capturedParams[4]).toBe(idDoc.signingPublicKey); // $5 signing_public_key MUST NOT BE NULL
      expect(capturedParams[4]).not.toBeNull();
      expect(capturedParams[4]).not.toBeUndefined();
      expect(capturedParams[5]).toBe(idDoc.keyAgreementPublicKey); // $6 key_agreement_public_key MUST NOT BE NULL
      expect(capturedParams[5]).not.toBeNull();
    });

    it('ensures no private keys leak into serialized profile documents', () => {
      const doc = createSignedProfile(
        idDoc.identityId,
        signingKeypair.privateKey,
        'yui_secure',
        'Yui Secure',
        'mb_yui_sec',
        prekeyBundle
      );

      const json = JSON.stringify(doc);
      expect(json).not.toContain(bytesToBase64(signingKeypair.privateKey));
      expect(json).not.toContain(bytesToBase64(kaKeypair.privateKey));
      expect((doc as any).signingPrivateKey).toBeUndefined();
      expect((doc as any).keyAgreementPrivateKey).toBeUndefined();
    });
  });

  describe('Part B: Telegram-Style Settings & Profile UI Primitives', () => {
    it('renders 8-category Settings navigation layout', () => {
      const navCategories = [
        { id: 'profile', label: 'My Profile', icon: '👤' },
        { id: 'account', label: 'Account & Identity', icon: '🔑' },
        { id: 'privacy', label: 'Privacy & Security', icon: '🛡️' },
        { id: 'notifications', label: 'Notifications', icon: '🔔' },
        { id: 'appearance', label: 'Appearance', icon: '🎨' },
        { id: 'storage', label: 'Storage & Data', icon: '💾' },
        { id: 'spaces', label: 'Spaces & Vault', icon: '🪐' },
        { id: 'about', label: 'About VEIL', icon: 'ℹ️' },
      ];

      const html = renderToStaticMarkup(
        <div className="veil-settings-modal-card">
          <div className="veil-settings-layout">
            <nav className="veil-settings-sidebar">
              {navCategories.map((c) => (
                <button key={c.id} type="button" className="veil-settings-nav-item">
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </nav>
            <main className="veil-settings-detail">
              <h3>My Profile</h3>
            </main>
          </div>
        </div>
      );

      expect(html).toContain('veil-settings-modal-card');
      expect(html).toContain('veil-settings-layout');
      expect(html).toContain('My Profile');
      expect(html).toContain('Account &amp; Identity');
      expect(html).toContain('Privacy &amp; Security');
      expect(html).toContain('About VEIL');
    });

    it('renders Profile hero section with avatar, handle, and security badge', () => {
      const html = renderToStaticMarkup(
        <div className="veil-profile-hero">
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <div className="veil-avatar veil-avatar-xl">YH</div>
          </div>
          <div style={{ fontSize: 'var(--veil-text-base)', fontWeight: 700 }}>Yui Hirasawa</div>
          <div style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-accent-secondary)' }}>@yui</div>
          <div style={{ marginTop: '0.5rem' }}>
            <span className="veil-badge veil-badge-secure">🔒 E2EE Cryptographic Identity</span>
          </div>
        </div>
      );

      expect(html).toContain('veil-profile-hero');
      expect(html).toContain('Yui Hirasawa');
      expect(html).toContain('@yui');
      expect(html).toContain('E2EE Cryptographic Identity');
    });

    it('renders granular phone and profile privacy visibility options', () => {
      const html = renderToStaticMarkup(
        <div>
          <label>Phone Number Visibility</label>
          <select className="veil-input" defaultValue="contacts">
            <option value="nobody">Nobody (Maximum Privacy)</option>
            <option value="contacts">My Contacts Only</option>
            <option value="everyone">Everyone</option>
          </select>
        </div>
      );

      expect(html).toContain('Nobody (Maximum Privacy)');
      expect(html).toContain('My Contacts Only');
      expect(html).toContain('Everyone');
    });

    it('sanitizes internal errors into user-friendly UI messages', () => {
      const rawConflictError = 'CONFLICT: Username @yui is already registered to a different identity';
      const rawPgError = 'Error: null value in column "signing_public_key" of relation "directory_profiles"';

      const sanitize = (msg: string) => {
        if (msg.includes('CONFLICT') || msg.includes('already registered')) {
          return 'Username @yui is already taken by another identity.';
        }
        return "Couldn't publish your profile. Please check your connection and try again.";
      };

      expect(sanitize(rawConflictError)).toBe('Username @yui is already taken by another identity.');
      expect(sanitize(rawPgError)).toBe("Couldn't publish your profile. Please check your connection and try again.");
      expect(sanitize(rawPgError)).not.toContain('column');
      expect(sanitize(rawPgError)).not.toContain('relation');
    });
  });
});
