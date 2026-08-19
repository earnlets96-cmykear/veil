/**
 * Standalone Production Relay Server for VEIL.
 *
 * Implements HTTP control/data endpoints, WebSocket real-time delivery,
 * blind capability mailboxes, TTL garbage collection, and bounded rate limiting.
 *
 * SECURITY & PRIVACY INVARIANTS:
 * - Untrusted Blind Relay: Operates on opaque ciphertexts and random identifiers only.
 * - Zero Plaintext Access: Never parses or decrypts client message payloads.
 * - One-Way Capability Storage: Stores only SHA-256 hashes of client capability tokens.
 * - Privacy Logging: Redacts capability tokens, passwords, keys, and payloads.
 */

import http, { IncomingMessage, ServerResponse, Server } from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import { randomBytes, bytesToHex } from '../crypto/utils.ts';
import { sha256 } from '@noble/hashes/sha2.js';
import type { IRelayStore } from './storage/relayStore.ts';
import { MemoryRelayStore } from './storage/memoryRelayStore.ts';
import { WebSocketDeliveryHandler } from './wsHandler.ts';
import { RateLimiter } from './rateLimiter.ts';
import { PrivacyLogger } from './logger.ts';
import { DEFAULT_RELAY_CONFIG, type RelayServerConfig } from './config.ts';
import {
  RELAY_PROTOCOL_VERSION,
  type RelayEnvelope,
  type MailboxRecord,
  type CreateMailboxRequest,
  type CreateMailboxResponse,
  type SendEnvelopeRequest,
  type SendEnvelopeResponse,
  type FetchEnvelopesRequest,
  type FetchEnvelopesResponse,
  type AckEnvelopesRequest,
  type AckEnvelopesResponse,
  type RelayErrorCode,
  type RegisterProfileRequest,
  type RegisterProfileResponse,
  type DirectorySearchResponse,
  type DirectoryProfileResponse,
} from './types.ts';
import { verifySignedProfile } from '../identity/profile.ts';
import { validateUsername } from '../identity/username.ts';
import type { ICloudDatabase } from './cloud/database/types.ts';
import { MemoryCloudDatabase } from './cloud/database/memoryCloudDatabase.ts';
import type { IObjectStorage } from './cloud/storage/types.ts';
import { LocalDiskObjectStorage } from './cloud/storage/localDiskObjectStorage.ts';
import { CloudHandler } from './cloud/cloudHandler.ts';

export class RelayServer {
  private config: RelayServerConfig;
  private store: IRelayStore;
  private cloudDb: ICloudDatabase;
  private objectStorage: IObjectStorage;
  private cloudHandler: CloudHandler;
  private logger: PrivacyLogger;
  private rateLimiter: RateLimiter;
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private wsHandler: WebSocketDeliveryHandler | null = null;
  private cleanupTimer?: NodeJS.Timeout;
  private startTime: number = Date.now();
  private isShuttingDown = false;

  constructor(
    config: Partial<RelayServerConfig> = {},
    store?: IRelayStore,
    cloudDb?: ICloudDatabase,
    objectStorage?: IObjectStorage
  ) {
    this.config = { ...DEFAULT_RELAY_CONFIG, ...config };
    this.store = store || new MemoryRelayStore();
    this.cloudDb = cloudDb || new MemoryCloudDatabase();
    this.objectStorage = objectStorage || new LocalDiskObjectStorage();
    this.cloudHandler = new CloudHandler(this.cloudDb, this.objectStorage);
    this.logger = new PrivacyLogger(this.config.logLevel);
    this.rateLimiter = new RateLimiter(this.config.rateLimitWindowMs, this.config.maxRequestsPerWindow);
  }

  /**
   * Starts the HTTP and WebSocket relay server.
   */
  public async start(): Promise<{ port: number; host: string }> {
    await this.store.init();
    await this.cloudDb.init();
    await this.objectStorage.init();

    this.server = http.createServer((req, res) => this.handleHttpRequest(req, res));
    this.wss = new WebSocketServer({ server: this.server, path: '/v1/ws' });
    this.wsHandler = new WebSocketDeliveryHandler(this.wss, this.store, this.config, this.logger);

    // Setup periodic TTL cleanup
    this.cleanupTimer = setInterval(() => this.runTtlCleanup(), this.config.cleanupIntervalMs);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        const addr = this.server!.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : this.config.port;
        this.logger.info(`VEIL Relay Server started on ${this.config.host}:${actualPort} [Protocol ${RELAY_PROTOCOL_VERSION}]`);
        resolve({ port: actualPort, host: this.config.host });
      });

      this.server!.on('error', (err) => {
        this.logger.error('HTTP server startup error', { message: err.message });
        reject(err);
      });
    });
  }

  /**
   * Gracefully shuts down the server, closing connections and releasing storage.
   */
  public async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    this.logger.info('Shutting down VEIL Relay Server...');

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.rateLimiter.close();

    if (this.wsHandler) {
      this.wsHandler.closeAll();
    }

    if (this.wss) {
      await new Promise<void>((resolve) => this.wss!.close(() => resolve()));
      this.wss = null;
    }

    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }

    await this.store.close();
    await this.cloudDb.close();
    await this.objectStorage.close();
    this.logger.info('VEIL Relay Server shutdown complete');
  }

  public getStore(): IRelayStore {
    return this.store;
  }

  public getCloudDb(): ICloudDatabase {
    return this.cloudDb;
  }

  public getObjectStorage(): IObjectStorage {
    return this.objectStorage;
  }

  public getConfig(): RelayServerConfig {
    return this.config;
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Add security and CORS headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (this.isShuttingDown) {
      this.sendError(res, 'STORAGE_UNAVAILABLE', 'Server is shutting down', 503);
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

    // Rate Limiting Check
    if (!this.rateLimiter.isAllowed(ip)) {
      this.sendError(res, 'RATE_LIMITED', 'Too many requests. Please retry later.', 429);
      return;
    }

    const url = req.url?.split('?')[0] || '/';
    const method = req.method;

    try {
      if (method === 'GET' && url === '/healthz') {
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: 'ok',
          protocolVersion: RELAY_PROTOCOL_VERSION,
          uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        }));
        return;
      }

      if (method === 'GET' && url === '/readyz') {
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: 'ready',
          store: 'ok',
          cloudDb: 'ok',
          objectStorage: 'ok',
          protocolVersion: RELAY_PROTOCOL_VERSION,
        }));
        return;
      }

      if (method === 'POST' && url === '/v1/mailboxes') {
        const body = await this.readJsonBody<CreateMailboxRequest>(req);
        await this.handleCreateMailbox(body, res);
        return;
      }

      if (method === 'POST' && url === '/v1/envelopes') {
        const body = await this.readJsonBody<SendEnvelopeRequest>(req);
        await this.handleSendEnvelope(body, res);
        return;
      }

      if (method === 'POST' && url === '/v1/envelopes/fetch') {
        const body = await this.readJsonBody<FetchEnvelopesRequest>(req);
        await this.handleFetchEnvelopes(body, res);
        return;
      }

      if (method === 'POST' && url === '/v1/envelopes/ack') {
        const body = await this.readJsonBody<AckEnvelopesRequest>(req);
        await this.handleAckEnvelopes(body, res);
        return;
      }

      // Directory endpoints
      if (method === 'POST' && url === '/v1/directory/register') {
        const body = await this.readJsonBody<RegisterProfileRequest>(req);
        await this.handleRegisterProfile(body, res);
        return;
      }

      if (method === 'POST' && url === '/v1/directory/update') {
        const body = await this.readJsonBody<RegisterProfileRequest>(req);
        await this.handleUpdateProfile(body, res);
        return;
      }

      if (method === 'GET' && url === '/v1/directory/search') {
        const rawUrl = req.url || '';
        const queryParams = new URL(rawUrl, `http://${this.config.host}`).searchParams;
        const q = queryParams.get('q') || '';
        await this.handleDirectorySearch(q, res);
        return;
      }

      if (method === 'GET' && url.startsWith('/v1/directory/profile/')) {
        const username = decodeURIComponent(url.slice('/v1/directory/profile/'.length));
        await this.handleGetProfile(username, res);
        return;
      }

      // Check Cloud & Account API routes
      const cloudHandled = await this.cloudHandler.handleRequest(req, res);
      if (cloudHandled) {
        return;
      }

      // Serve static frontend assets if built
      if (method === 'GET') {
        const distDir = path.resolve(process.cwd(), 'dist');
        if (fs.existsSync(distDir)) {
          let reqPath = url === '/' ? '/index.html' : url;
          let filePath = path.join(distDir, reqPath);
          if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            filePath = path.join(distDir, 'index.html');
          }
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.html': 'text/html; charset=utf-8',
              '.js': 'application/javascript; charset=utf-8',
              '.css': 'text/css; charset=utf-8',
              '.json': 'application/json',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.svg': 'image/svg+xml',
              '.ico': 'image/x-icon',
              '.woff2': 'font/woff2',
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.statusCode = 200;
            res.end(fs.readFileSync(filePath));
            return;
          }
        }
      }

      this.sendError(res, 'NOT_FOUND', `Cannot ${method} ${url}`, 404);
    } catch (err: any) {
      if (err.message === 'PAYLOAD_TOO_LARGE') {
        this.sendError(res, 'PAYLOAD_TOO_LARGE', 'Request body exceeds maximum allowed size', 413);
      } else if (err instanceof SyntaxError) {
        this.sendError(res, 'BAD_REQUEST', 'Malformed JSON body', 400);
      } else {
        this.logger.error('Unhandled request error', { message: err.message });
        this.sendError(res, 'INTERNAL_ERROR', 'An internal server error occurred', 500);
      }
    }
  }

  private async handleCreateMailbox(body: CreateMailboxRequest, res: ServerResponse): Promise<void> {
    const now = Date.now();
    const ttlMs = body?.ttlSeconds ? body.ttlSeconds * 1000 : this.config.defaultMailboxTtlMs;
    const boundedTtl = Math.min(ttlMs, this.config.maxMailboxTtlMs);
    const expiresAt = now + boundedTtl;

    // Generate random 256-bit opaque mailbox identifier
    const mailboxId = bytesToHex(randomBytes(32));
    // Generate random 256-bit secret capability token
    const capabilityToken = bytesToHex(randomBytes(32));
    // Store only the one-way SHA-256 hash
    const capabilityHash = bytesToHex(sha256(new TextEncoder().encode(capabilityToken)));

    const record: MailboxRecord = {
      mailboxId,
      capabilityHash,
      createdAt: now,
      expiresAt,
      lastActiveAt: now,
    };

    await this.store.createMailbox(record);

    const response: CreateMailboxResponse = {
      protocolVersion: RELAY_PROTOCOL_VERSION,
      mailboxId,
      capabilityToken,
      expiresAt,
    };

    res.statusCode = 201;
    res.end(JSON.stringify(response));
  }

  private async handleSendEnvelope(body: SendEnvelopeRequest, res: ServerResponse): Promise<void> {
    if (!body || !body.mailboxId || typeof body.payload !== 'string') {
      this.sendError(res, 'BAD_REQUEST', 'Missing mailboxId or payload in request body', 400);
      return;
    }

    const payloadBytes = Buffer.byteLength(body.payload, 'utf8');
    if (payloadBytes > this.config.maxEnvelopeSizeBytes) {
      this.sendError(res, 'PAYLOAD_TOO_LARGE', `Envelope payload (${payloadBytes} bytes) exceeds maximum of ${this.config.maxEnvelopeSizeBytes} bytes`, 413);
      return;
    }

    const mailbox = await this.store.getMailbox(body.mailboxId);
    if (!mailbox) {
      this.sendError(res, 'NOT_FOUND', 'Target mailbox not found or expired', 404);
      return;
    }

    const currentCount = await this.store.countEnvelopes(body.mailboxId);
    if (currentCount >= this.config.maxMailboxEnvelopes) {
      this.sendError(res, 'FORBIDDEN', 'Target mailbox queue is full', 403);
      return;
    }

    const now = Date.now();
    const requestedTtlMs = body.ttlSeconds ? body.ttlSeconds * 1000 : this.config.defaultEnvelopeTtlMs;
    const boundedTtl = Math.min(requestedTtlMs, this.config.maxEnvelopeTtlMs);
    const expiresAt = Math.min(now + boundedTtl, mailbox.expiresAt);

    const envelope: RelayEnvelope = {
      protocolVersion: RELAY_PROTOCOL_VERSION,
      envelopeId: bytesToHex(randomBytes(16)),
      mailboxId: body.mailboxId,
      payload: body.payload,
      createdAt: now,
      expiresAt,
      sizeBytes: payloadBytes,
    };

    await this.store.saveEnvelope(envelope);

    // Notify active WebSocket subscribers for near-real-time delivery
    if (this.wsHandler) {
      this.wsHandler.pushEnvelope(envelope);
    }

    const response: SendEnvelopeResponse = {
      protocolVersion: RELAY_PROTOCOL_VERSION,
      envelopeId: envelope.envelopeId,
      mailboxId: envelope.mailboxId,
      expiresAt: envelope.expiresAt,
      sizeBytes: envelope.sizeBytes,
    };

    res.statusCode = 201;
    res.end(JSON.stringify(response));
  }

  private async handleFetchEnvelopes(body: FetchEnvelopesRequest, res: ServerResponse): Promise<void> {
    if (!body || !body.mailboxId || !body.capabilityToken) {
      this.sendError(res, 'BAD_REQUEST', 'Missing mailboxId or capabilityToken in request body', 400);
      return;
    }

    const mailbox = await this.store.getMailbox(body.mailboxId);
    if (!mailbox) {
      this.sendError(res, 'NOT_FOUND', 'Mailbox not found or expired', 404);
      return;
    }

    // Verify capability token via one-way SHA-256 hash
    const tokenHash = bytesToHex(sha256(new TextEncoder().encode(body.capabilityToken)));
    if (tokenHash !== mailbox.capabilityHash) {
      this.sendError(res, 'UNAUTHORIZED', 'Invalid capability token for requested mailbox', 401);
      return;
    }

    const limit = Math.min(body.limit || this.config.maxEnvelopesPerFetch, this.config.maxEnvelopesPerFetch);
    const envelopes = await this.store.listEnvelopes(body.mailboxId, limit);
    const totalPending = await this.store.countEnvelopes(body.mailboxId);

    const response: FetchEnvelopesResponse = {
      protocolVersion: RELAY_PROTOCOL_VERSION,
      mailboxId: body.mailboxId,
      envelopes,
      hasMore: totalPending > envelopes.length,
    };

    res.statusCode = 200;
    res.end(JSON.stringify(response));
  }

  private async handleAckEnvelopes(body: AckEnvelopesRequest, res: ServerResponse): Promise<void> {
    if (!body || !body.mailboxId || !body.capabilityToken || !Array.isArray(body.envelopeIds)) {
      this.sendError(res, 'BAD_REQUEST', 'Missing mailboxId, capabilityToken, or envelopeIds array', 400);
      return;
    }

    const mailbox = await this.store.getMailbox(body.mailboxId);
    if (!mailbox) {
      this.sendError(res, 'NOT_FOUND', 'Mailbox not found', 404);
      return;
    }

    // Verify capability token
    const tokenHash = bytesToHex(sha256(new TextEncoder().encode(body.capabilityToken)));
    if (tokenHash !== mailbox.capabilityHash) {
      this.sendError(res, 'UNAUTHORIZED', 'Invalid capability token', 401);
      return;
    }

    const count = await this.store.deleteEnvelopes(body.mailboxId, body.envelopeIds);

    const response: AckEnvelopesResponse = {
      protocolVersion: RELAY_PROTOCOL_VERSION,
      mailboxId: body.mailboxId,
      acknowledgedCount: count,
    };

    res.statusCode = 200;
    res.end(JSON.stringify(response));
  }

  private async handleRegisterProfile(body: RegisterProfileRequest, res: ServerResponse): Promise<void> {
    if (!body?.profile) {
      this.sendError(res, 'BAD_REQUEST', 'Missing profile document', 400);
      return;
    }

    const profile = body.profile;
    const validation = validateUsername(profile.username);
    if (!validation.valid || validation.canonical !== profile.username) {
      this.sendError(res, 'BAD_REQUEST', `Invalid username format: ${validation.error}`, 400);
      return;
    }

    // Verify signature against identity public key
    const isValidSignature = verifySignedProfile(profile);
    if (!isValidSignature) {
      this.sendError(res, 'FORBIDDEN', 'Invalid or forged profile signature', 403);
      return;
    }

    try {
      await this.store.registerProfile(profile);
      const response: RegisterProfileResponse = {
        protocolVersion: RELAY_PROTOCOL_VERSION,
        success: true,
        username: profile.username,
        identityId: profile.identityId,
      };
      res.statusCode = 201;
      res.end(JSON.stringify(response));
    } catch (err: any) {
      if (err.message?.includes('CONFLICT')) {
        this.sendError(res, 'CONFLICT', 'Username is already registered by another identity', 409);
      } else {
        this.sendError(res, 'INTERNAL_ERROR', err.message, 500);
      }
    }
  }

  private async handleUpdateProfile(body: RegisterProfileRequest, res: ServerResponse): Promise<void> {
    if (!body?.profile) {
      this.sendError(res, 'BAD_REQUEST', 'Missing profile document', 400);
      return;
    }

    const profile = body.profile;
    const existing = await this.store.getProfileByIdentity(profile.identityId);
    if (!existing) {
      this.sendError(res, 'NOT_FOUND', 'Identity not found in directory', 404);
      return;
    }

    const isValidSignature = verifySignedProfile(profile);
    if (!isValidSignature) {
      this.sendError(res, 'FORBIDDEN', 'Invalid profile signature', 403);
      return;
    }

    try {
      await this.store.registerProfile(profile);
      const response: RegisterProfileResponse = {
        protocolVersion: RELAY_PROTOCOL_VERSION,
        success: true,
        username: profile.username,
        identityId: profile.identityId,
      };
      res.statusCode = 200;
      res.end(JSON.stringify(response));
    } catch (err: any) {
      if (err.message?.includes('CONFLICT')) {
        this.sendError(res, 'CONFLICT', 'Username is already registered by another identity', 409);
      } else {
        this.sendError(res, 'INTERNAL_ERROR', err.message, 500);
      }
    }
  }

  private async handleDirectorySearch(query: string, res: ServerResponse): Promise<void> {
    const q = query.trim();
    if (!q || q.length < 3) {
      this.sendError(res, 'BAD_REQUEST', 'Search query must be at least 3 characters long', 400);
      return;
    }

    const results = await this.store.searchProfiles(q, 10);
    const response: DirectorySearchResponse = {
      protocolVersion: RELAY_PROTOCOL_VERSION,
      results,
      query: q,
    };

    res.statusCode = 200;
    res.end(JSON.stringify(response));
  }

  private async handleGetProfile(rawUsername: string, res: ServerResponse): Promise<void> {
    const canonical = rawUsername.toLowerCase().trim().replace(/^@/, '');
    if (!canonical) {
      this.sendError(res, 'BAD_REQUEST', 'Username required', 400);
      return;
    }

    const profile = await this.store.getProfileByUsername(canonical);
    if (!profile) {
      this.sendError(res, 'NOT_FOUND', `User @${canonical} not found in directory`, 404);
      return;
    }

    const response: DirectoryProfileResponse = {
      protocolVersion: RELAY_PROTOCOL_VERSION,
      profile,
    };

    res.statusCode = 200;
    res.end(JSON.stringify(response));
  }

  private async runTtlCleanup(): Promise<void> {
    try {
      const now = Date.now();
      const result = await this.store.sweepExpired(now);
      if (result.expiredMailboxes > 0 || result.expiredEnvelopes > 0) {
        this.logger.debug('Completed TTL expiration sweep', result as Record<string, unknown>);
      }
    } catch (err: any) {
      this.logger.error('Error during TTL cleanup sweep', { message: err.message });
    }
  }

  private readJsonBody<T>(req: IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      let data = '';
      let totalBytes = 0;
      const maxLimit = this.config.maxEnvelopeSizeBytes * 2; // Maximum body size

      req.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxLimit) {
          reject(new Error('PAYLOAD_TOO_LARGE'));
          req.destroy();
          return;
        }
        data += chunk.toString('utf8');
      });

      req.on('end', () => {
        if (!data) {
          return resolve({} as T);
        }
        try {
          resolve(JSON.parse(data) as T);
        } catch (err) {
          reject(err);
        }
      });

      req.on('error', (err) => reject(err));
    });
  }

  private sendError(res: ServerResponse, code: RelayErrorCode, message: string, status: number): void {
    res.statusCode = status;
    res.end(JSON.stringify({
      error: {
        code,
        message,
        status,
      },
    }));
  }
}
