/**
 * Username Validation & Canonicalization for VEIL.
 *
 * Implements strict, security-hardened validation rules for globally unique usernames.
 * Protects against homoglyph attacks, control characters, spoofing, and ambiguity.
 */

export interface UsernameValidationResult {
  valid: boolean;
  canonical?: string;
  error?: string;
}

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
const USERNAME_REGEX = /^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/;

/**
 * Canonicalizes a raw username string:
 * - Strips leading '@' if present
 * - Normalizes via Unicode NFKC (and rejects any non-ASCII characters)
 * - Converts to lowercase and trims whitespace
 */
export function canonicalizeUsername(rawUsername: string): string {
  if (!rawUsername) return '';
  let cleaned = rawUsername.trim();
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned.normalize('NFKC').toLowerCase().trim();
}

/**
 * Validates a username string against strict safety invariants:
 * 1. Must be between 3 and 32 characters long.
 * 2. Allowed characters: lowercase a-z, digits 0-9, single underscore '_', single hyphen '-'.
 * 3. Must start and end with an alphanumeric character (a-z, 0-9).
 * 4. No consecutive punctuation ('--', '__', '-_', '_-').
 * 5. Strictly ASCII only (rejects Unicode homoglyphs and zero-width spaces).
 */
export function validateUsername(rawUsername: string): UsernameValidationResult {
  if (!rawUsername || typeof rawUsername !== 'string') {
    return { valid: false, error: 'Username cannot be empty' };
  }

  // Check if raw input contains non-ASCII characters, homoglyphs, or control chars
  let stripped = rawUsername.trim();
  if (stripped.startsWith('@')) stripped = stripped.slice(1);
  if (!/^[a-zA-Z0-9_-]+$/.test(stripped)) {
    return {
      valid: false,
      error: 'Username may only contain letters (a-z), numbers (0-9), hyphens (-), and underscores (_)',
    };
  }

  const canonical = canonicalizeUsername(rawUsername);

  if (canonical.length < USERNAME_MIN_LENGTH) {
    return { valid: false, error: `Username must be at least ${USERNAME_MIN_LENGTH} characters long` };
  }

  if (canonical.length > USERNAME_MAX_LENGTH) {
    return { valid: false, error: `Username must not exceed ${USERNAME_MAX_LENGTH} characters` };
  }

  // Reject consecutive separators
  if (canonical.includes('--') || canonical.includes('__') || canonical.includes('-_') || canonical.includes('_-')) {
    return { valid: false, error: 'Username cannot contain consecutive hyphens or underscores' };
  }

  if (!USERNAME_REGEX.test(canonical)) {
    return {
      valid: false,
      error: 'Username may only contain letters (a-z), numbers (0-9), hyphens (-), and underscores (_), and must start and end with a letter or number',
    };
  }

  return { valid: true, canonical };
}
