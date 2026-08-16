import { describe, it, expect } from 'vitest';
import { validateUsername, canonicalizeUsername } from '../src/identity/username.ts';

describe('VEIL Phase 23: Username Validation & Canonicalization Tests', () => {
  it('accepts valid usernames and canonicalizes correctly', () => {
    const validCases = [
      { raw: 'alice', expected: 'alice' },
      { raw: '@bob', expected: 'bob' },
      { raw: '@Phone_2', expected: 'phone_2' },
      { raw: '  @Veil-User-123  ', expected: 'veil-user-123' },
      { raw: 'user_name_test', expected: 'user_name_test' },
      { raw: 'dagmawi54', expected: 'dagmawi54' },
    ];

    for (const { raw, expected } of validCases) {
      const canonical = canonicalizeUsername(raw);
      expect(canonical).toBe(expected);

      const res = validateUsername(raw);
      expect(res.valid).toBe(true);
      expect(res.canonical).toBe(expected);
      expect(res.error).toBeUndefined();
    }
  });

  it('rejects usernames violating length boundaries', () => {
    // Too short (< 3 characters)
    expect(validateUsername('').valid).toBe(false);
    expect(validateUsername('a').valid).toBe(false);
    expect(validateUsername('@ab').valid).toBe(false);

    // Too long (> 32 characters)
    const longName = 'a'.repeat(33);
    expect(validateUsername(longName).valid).toBe(false);
    expect(validateUsername(longName).error).toMatch(/exceed 32 characters/i);
  });

  it('rejects invalid characters, punctuation and consecutive delimiters', () => {
    const invalidCases = [
      'user name', // whitespace
      'user@name', // internal @
      'user#name', // special char
      'user$123',  // dollar
      '-leading',  // leading hyphen
      '_leading',  // leading underscore
      'trailing-', // trailing hyphen
      'trailing_', // trailing underscore
      'user--name', // consecutive hyphens
      'user__name', // consecutive underscores
      'user-_name', // mixed consecutive
      'user_-name', // mixed consecutive
    ];

    for (const raw of invalidCases) {
      const res = validateUsername(raw);
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  it('rejects Unicode homoglyphs, non-ASCII characters, and control characters', () => {
    const homoglyphCases = [
      'аlice',      // Cyrillic 'а' (U+0430)
      'bоb',        // Cyrillic 'о' (U+043E)
      'user\u200Bname', // zero-width space
      'user\u0000name', // null byte
      'Ｕｓｅｒ',   // fullwidth ASCII
      'éve_user',   // accented character
    ];

    for (const raw of homoglyphCases) {
      const res = validateUsername(raw);
      expect(res.valid).toBe(false);
    }
  });
});
