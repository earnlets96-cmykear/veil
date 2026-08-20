/**
 * Production PostgreSQL-Backed Relay Store for VEIL Relay Server.
 *
 * Implements IRelayStore on top of Supabase / PostgreSQL, providing genuine,
 * durable persistence for blind mailboxes, encrypted envelopes, and directory profiles across server restarts.
 */

import { PostgresClient } from '../cloud/database/postgresClient.ts';
import type { IRelayStore } from './relayStore.ts';
import type { RelayEnvelope, MailboxRecord, DirectorySearchResult } from '../types.ts';
import type { SignedProfileDocument } from '../../identity/profile.ts';

export class PostgresRelayStore implements IRelayStore {
  private pg: PostgresClient;
  private initialized = false;

  constructor(connectionStringOrClient: string | PostgresClient) {
    if (typeof connectionStringOrClient === 'string') {
      this.pg = new PostgresClient(connectionStringOrClient);
    } else {
      this.pg = connectionStringOrClient;
    }
  }

  public async init(): Promise<void> {
    await this.pg.init();
    this.initialized = true;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async createMailbox(record: MailboxRecord): Promise<void> {
    this.assertInit();
    const sql = `
      INSERT INTO relay_mailboxes (mailbox_id, capability_hash, created_at, expires_at, last_active_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (mailbox_id) DO UPDATE SET
        capability_hash = EXCLUDED.capability_hash,
        expires_at = EXCLUDED.expires_at,
        last_active_at = EXCLUDED.last_active_at
    `;
    await this.pg.query(sql, [
      record.mailboxId,
      record.capabilityHash,
      record.createdAt,
      record.expiresAt,
      record.lastActiveAt,
    ]);
  }

  public async getMailbox(mailboxId: string): Promise<MailboxRecord | null> {
    this.assertInit();
    const sql = `
      SELECT mailbox_id as "mailboxId", capability_hash as "capabilityHash",
             created_at as "createdAt", expires_at as "expiresAt", last_active_at as "lastActiveAt"
      FROM relay_mailboxes
      WHERE mailbox_id = $1
    `;
    const res = await this.pg.query<MailboxRecord>(sql, [mailboxId]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      mailboxId: r.mailboxId,
      capabilityHash: r.capabilityHash,
      createdAt: Number(r.createdAt),
      expiresAt: Number(r.expiresAt),
      lastActiveAt: Number(r.lastActiveAt),
    };
  }

  public async deleteMailbox(mailboxId: string): Promise<boolean> {
    this.assertInit();
    const sql = `DELETE FROM relay_mailboxes WHERE mailbox_id = $1`;
    const res = await this.pg.query(sql, [mailboxId]);
    return (res.rowCount ?? 0) > 0;
  }

  public async saveEnvelope(envelope: RelayEnvelope): Promise<void> {
    this.assertInit();
    const sql = `
      INSERT INTO relay_envelopes (envelope_id, mailbox_id, payload, size_bytes, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (envelope_id) DO NOTHING
    `;
    await this.pg.query(sql, [
      envelope.envelopeId,
      envelope.mailboxId,
      envelope.payload,
      envelope.sizeBytes,
      envelope.createdAt,
      envelope.expiresAt,
    ]);

    // Update last_active_at on mailbox
    await this.pg.query(
      `UPDATE relay_mailboxes SET last_active_at = $1 WHERE mailbox_id = $2`,
      [Date.now(), envelope.mailboxId]
    );
  }

  public async getEnvelope(mailboxId: string, envelopeId: string): Promise<RelayEnvelope | null> {
    this.assertInit();
    const sql = `
      SELECT envelope_id as "envelopeId", mailbox_id as "mailboxId",
             payload, size_bytes as "sizeBytes", created_at as "createdAt", expires_at as "expiresAt"
      FROM relay_envelopes
      WHERE mailbox_id = $1 AND envelope_id = $2
    `;
    const res = await this.pg.query<any>(sql, [mailboxId, envelopeId]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      protocolVersion: 1,
      envelopeId: r.envelopeId,
      mailboxId: r.mailboxId,
      payload: r.payload,
      sizeBytes: Number(r.sizeBytes),
      createdAt: Number(r.createdAt),
      expiresAt: Number(r.expiresAt),
    };
  }

  public async listEnvelopes(mailboxId: string, limit: number): Promise<RelayEnvelope[]> {
    this.assertInit();
    const sql = `
      SELECT envelope_id as "envelopeId", mailbox_id as "mailboxId",
             payload, size_bytes as "sizeBytes", created_at as "createdAt", expires_at as "expiresAt"
      FROM relay_envelopes
      WHERE mailbox_id = $1 AND expires_at > $2
      ORDER BY created_at ASC
      LIMIT $3
    `;
    const res = await this.pg.query<any>(sql, [mailboxId, Date.now(), limit]);
    return res.rows.map((r) => ({
      protocolVersion: 1,
      envelopeId: r.envelopeId,
      mailboxId: r.mailboxId,
      payload: r.payload,
      sizeBytes: Number(r.sizeBytes),
      createdAt: Number(r.createdAt),
      expiresAt: Number(r.expiresAt),
    }));
  }

  public async deleteEnvelopes(mailboxId: string, envelopeIds: string[]): Promise<number> {
    this.assertInit();
    if (!envelopeIds || envelopeIds.length === 0) return 0;
    const sql = `
      DELETE FROM relay_envelopes
      WHERE mailbox_id = $1 AND envelope_id = ANY($2::text[])
    `;
    const res = await this.pg.query(sql, [mailboxId, envelopeIds]);
    return res.rowCount ?? 0;
  }

  public async countEnvelopes(mailboxId: string): Promise<number> {
    this.assertInit();
    const sql = `
      SELECT COUNT(*) as count
      FROM relay_envelopes
      WHERE mailbox_id = $1 AND expires_at > $2
    `;
    const res = await this.pg.query<{ count: string | number }>(sql, [mailboxId, Date.now()]);
    return Number(res.rows[0]?.count || 0);
  }

  public async sweepExpired(now: number): Promise<{ expiredMailboxes: number; expiredEnvelopes: number }> {
    this.assertInit();
    const delEnvSql = `DELETE FROM relay_envelopes WHERE expires_at <= $1`;
    const envRes = await this.pg.query(delEnvSql, [now]);

    const delMbSql = `DELETE FROM relay_mailboxes WHERE expires_at <= $1`;
    const mbRes = await this.pg.query(delMbSql, [now]);

    return {
      expiredEnvelopes: envRes.rowCount ?? 0,
      expiredMailboxes: mbRes.rowCount ?? 0,
    };
  }

  // ===========================================================================
  // DIRECTORY & PROFILES
  // ===========================================================================

  public async registerProfile(profile: SignedProfileDocument): Promise<void> {
    this.assertInit();
    const existing = await this.getProfileByUsername(profile.username);
    if (existing && existing.identityId !== profile.identityId) {
      throw new Error(`CONFLICT: Username @${profile.username} is already registered to a different identity`);
    }

    const sql = `
      INSERT INTO directory_profiles (
        username, identity_id, display_name, avatar_url,
        signing_public_key, key_agreement_public_key, mailbox_id,
        prekey_bundle_json, signature, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (username) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        signing_public_key = EXCLUDED.signing_public_key,
        key_agreement_public_key = EXCLUDED.key_agreement_public_key,
        mailbox_id = EXCLUDED.mailbox_id,
        prekey_bundle_json = EXCLUDED.prekey_bundle_json,
        signature = EXCLUDED.signature,
        updated_at = EXCLUDED.updated_at
    `;

    await this.pg.query(sql, [
      profile.username.toLowerCase(),
      profile.identityId,
      profile.displayName || null,
      profile.avatarUrl || null,
      profile.signingPublicKey,
      profile.keyAgreementPublicKey,
      profile.mailboxId,
      profile.prekeyBundle ? JSON.stringify(profile.prekeyBundle) : null,
      profile.signature,
      profile.createdAt,
      profile.updatedAt,
    ]);
  }

  public async getProfileByUsername(canonicalUsername: string): Promise<SignedProfileDocument | null> {
    this.assertInit();
    const sql = `
      SELECT username, identity_id as "identityId", display_name as "displayName",
             avatar_url as "avatarUrl", signing_public_key as "signingPublicKey",
             key_agreement_public_key as "keyAgreementPublicKey", mailbox_id as "mailboxId",
             prekey_bundle_json as "prekeyBundleJson", signature,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM directory_profiles
      WHERE username = $1
    `;
    const res = await this.pg.query<any>(sql, [canonicalUsername.toLowerCase()]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      version: 1,
      username: r.username,
      identityId: r.identityId,
      displayName: r.displayName || undefined,
      avatarUrl: r.avatarUrl || undefined,
      signingPublicKey: r.signingPublicKey,
      keyAgreementPublicKey: r.keyAgreementPublicKey,
      mailboxId: r.mailboxId,
      prekeyBundle: r.prekeyBundleJson ? JSON.parse(r.prekeyBundleJson) : undefined,
      signature: r.signature,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    };
  }

  public async getProfileByIdentity(identityId: string): Promise<SignedProfileDocument | null> {
    this.assertInit();
    const sql = `
      SELECT username, identity_id as "identityId", display_name as "displayName",
             avatar_url as "avatarUrl", signing_public_key as "signingPublicKey",
             key_agreement_public_key as "keyAgreementPublicKey", mailbox_id as "mailboxId",
             prekey_bundle_json as "prekeyBundleJson", signature,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM directory_profiles
      WHERE identity_id = $1
    `;
    const res = await this.pg.query<any>(sql, [identityId]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      version: 1,
      username: r.username,
      identityId: r.identityId,
      displayName: r.displayName || undefined,
      avatarUrl: r.avatarUrl || undefined,
      signingPublicKey: r.signingPublicKey,
      keyAgreementPublicKey: r.keyAgreementPublicKey,
      mailboxId: r.mailboxId,
      prekeyBundle: r.prekeyBundleJson ? JSON.parse(r.prekeyBundleJson) : undefined,
      signature: r.signature,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    };
  }

  public async searchProfiles(query: string, limit: number): Promise<DirectorySearchResult[]> {
    this.assertInit();
    const prefix = query.toLowerCase().replace(/[%_]/g, '');
    const sql = `
      SELECT username, display_name as "displayName", avatar_url as "avatarUrl",
             signing_public_key as "signingPublicKey", key_agreement_public_key as "keyAgreementPublicKey"
      FROM directory_profiles
      WHERE username LIKE $1 OR LOWER(display_name) LIKE $1
      ORDER BY username ASC
      LIMIT $2
    `;
    const res = await this.pg.query<any>(sql, [`${prefix}%`, Math.min(limit, 50)]);
    return res.rows.map((r) => ({
      username: r.username,
      displayName: r.displayName || undefined,
      avatarUrl: r.avatarUrl || undefined,
      signingPublicKey: r.signingPublicKey,
      keyAgreementPublicKey: r.keyAgreementPublicKey,
    }));
  }

  public async deleteProfile(identityId: string): Promise<boolean> {
    this.assertInit();
    const sql = `DELETE FROM directory_profiles WHERE identity_id = $1`;
    const res = await this.pg.query(sql, [identityId]);
    return (res.rowCount ?? 0) > 0;
  }

  public async close(): Promise<void> {
    this.initialized = false;
    await this.pg.close();
  }

  public async destroyStore(): Promise<void> {
    this.assertInit();
    await this.pg.query(`DELETE FROM relay_envelopes`);
    await this.pg.query(`DELETE FROM relay_mailboxes`);
    await this.pg.query(`DELETE FROM directory_profiles`);
  }

  private assertInit(): void {
    if (!this.initialized) {
      throw new Error('PostgresRelayStore is not initialized');
    }
  }
}
