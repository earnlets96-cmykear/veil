/**
 * Runtime Forensic Diagnostics Subsystem for VEIL.
 *
 * Provides structured, deterministic telemetry for media pipeline, wire payload isolation,
 * video/audio playback, account recovery, and state-machine transitions.
 *
 * HARD SECURITY RULES:
 * - NEVER log plaintext passwords or credentials.
 * - NEVER log private signing or key-agreement keys.
 * - NEVER log ephemeral symmetric media encryption keys.
 * - NEVER log plaintext message contents or raw decrypted media buffers.
 * - Strip or disable in production builds.
 */

export type DiagnosticCategory =
  | 'MEDIA'
  | 'UPLOAD'
  | 'WIRE'
  | 'RECEIVE'
  | 'DOWNLOAD'
  | 'DECRYPT'
  | 'VIDEO'
  | 'AUDIO'
  | 'RECOVERY'
  | 'TIMEOUT';

export interface DiagnosticEvent {
  category: DiagnosticCategory;
  tag: string;
  data: Record<string, any>;
  timestamp?: number;
}

class RuntimeDiagnosticsSubsystem {
  private enabled: boolean = true;
  private history: DiagnosticEvent[] = [];
  private readonly MAX_HISTORY = 500;

  constructor() {
    // Automatically disable in production builds unless explicitly enabled for debugging
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      this.enabled = false;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public clearHistory(): void {
    this.history = [];
  }

  public getHistory(category?: DiagnosticCategory): DiagnosticEvent[] {
    if (category) {
      return this.history.filter((e) => e.category === category);
    }
    return [...this.history];
  }

  /**
   * Sanitizes payload data to guarantee zero secret leakage.
   */
  private sanitizeValue(value: any, key = ''): any {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('privatekey') ||
      lowerKey.includes('masterkey') ||
      lowerKey.includes('encryptionkey') ||
      lowerKey.includes('sessiontoken') ||
      lowerKey.includes('token') ||
      lowerKey.includes('accountid') ||
      lowerKey.includes('identityid') ||
      lowerKey.includes('deviceid') ||
      lowerKey.includes('bloburl') ||
      lowerKey.includes('plaintext') ||
      lowerKey.includes('ciphertext') ||
      lowerKey.includes('kek')
    ) return '[REDACTED]';
    if (value instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))) {
      return `[BinaryBuffer: ${value.length} bytes]`;
    }
    if (Array.isArray(value)) return value.map((item) => this.sanitizeValue(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, this.sanitizeValue(childValue, childKey)]));
    }
    return value;
  }

  private sanitize(data: Record<string, any>): Record<string, any> {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      const lowerKey = k.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('privatekey') ||
        lowerKey.includes('masterkey') ||
        lowerKey.includes('encryptionkey') ||
        lowerKey.includes('kek') ||
        lowerKey.includes('plaintext')
      ) {
        clean[k] = '[REDACTED]';
      } else {
        clean[k] = this.sanitizeValue(v, k);
      }
    }
    return clean;
  }

  public log(category: DiagnosticCategory, tag: string, data: Record<string, any>): void {
    const sanitized = this.sanitize(data);
    const event: DiagnosticEvent = {
      category,
      tag,
      data: sanitized,
      timestamp: Date.now(),
    };

    if (this.history.length >= this.MAX_HISTORY) {
      this.history.shift();
    }
    this.history.push(event);

    if (this.enabled && typeof console !== 'undefined') {
      const prefix = `[VEIL ${category}]`;
      const lines = Object.entries(sanitized)
        .map(([k, v]) => `  ${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n');
      console.log(`${prefix} ${tag}\n${lines}`);
    }
  }

  // Category-specific helper methods
  public media(tag: string, data: Record<string, any>): void {
    this.log('MEDIA', tag, data);
  }

  public upload(tag: string, data: Record<string, any>): void {
    this.log('UPLOAD', tag, data);
  }

  public wire(tag: string, data: Record<string, any>): void {
    this.log('WIRE', tag, data);
  }

  public receive(tag: string, data: Record<string, any>): void {
    this.log('RECEIVE', tag, data);
  }

  public download(tag: string, data: Record<string, any>): void {
    this.log('DOWNLOAD', tag, data);
  }

  public decrypt(tag: string, data: Record<string, any>): void {
    this.log('DECRYPT', tag, data);
  }

  public video(tag: string, data: Record<string, any>): void {
    this.log('VIDEO', tag, data);
  }

  public audio(tag: string, data: Record<string, any>): void {
    this.log('AUDIO', tag, data);
  }

  public recovery(tag: string, data: Record<string, any>): void {
    this.log('RECOVERY', tag, data);
  }

  public timeout(tag: string, data: Record<string, any>): void {
    this.log('TIMEOUT', tag, data);
  }
}

export const RuntimeDiagnostics = new RuntimeDiagnosticsSubsystem();
