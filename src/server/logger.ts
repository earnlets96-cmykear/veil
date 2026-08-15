/**
 * Privacy-Preserving Structured Logger for VEIL Relay Server.
 *
 * Enforces strict redaction of sensitive credentials, capability secrets,
 * private keys, master keys, and message payload ciphertexts.
 */

export class PrivacyLogger {
  private level: 'debug' | 'info' | 'warn' | 'error' | 'none';

  constructor(level: 'debug' | 'info' | 'warn' | 'error' | 'none' = 'info') {
    this.level = level;
  }

  public setLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'none'): void {
    this.level = level;
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.writeLog('DEBUG', message, context);
    }
  }

  public info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.writeLog('INFO', message, context);
    }
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.writeLog('WARN', message, context);
    }
  }

  public error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      this.writeLog('ERROR', message, context);
    }
  }

  private writeLog(severity: string, message: string, context?: Record<string, unknown>): void {
    const sanitizedContext = context ? this.sanitizeContext(context) : undefined;
    const entry = {
      timestamp: new Date().toISOString(),
      severity,
      message,
      ...(sanitizedContext ? { context: sanitizedContext } : {}),
    };

    const formatted = JSON.stringify(entry);
    if (severity === 'ERROR') {
      console.error(formatted);
    } else if (severity === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Deeply sanitizes any object, redacting sensitive fields.
   */
  public sanitizeContext(obj: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('pass') ||
        lowerKey.includes('cap') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('key') ||
        lowerKey.includes('token') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('payload') ||
        lowerKey.includes('ciphertext') ||
        lowerKey.includes('plaintext')
      ) {
        clean[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        clean[key] = this.sanitizeContext(value as Record<string, unknown>);
      } else {
        clean[key] = value;
      }
    }

    return clean;
  }

  private shouldLog(targetLevel: 'debug' | 'info' | 'warn' | 'error'): boolean {
    if (this.level === 'none') return false;
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentIdx = levels.indexOf(this.level);
    const targetIdx = levels.indexOf(targetLevel);
    return targetIdx >= currentIdx;
  }
}
