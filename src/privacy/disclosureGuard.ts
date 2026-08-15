/**
 * Disclosure Guard & Error Sanitizer for VEIL Phase 7.
 *
 * Ensures errors and user-facing text never leak Space existence,
 * password mappings, or unsupported security marketing claims.
 */

export const GENERIC_UNLOCK_ERROR = 'Unable to unlock.';

export const PROHIBITED_MARKETING_TERMS = [
  'military-grade',
  'military grade',
  '100% anonymous',
  'unhackable',
  'untraceable',
  'forensic-proof',
  'completely invisible',
  'secret space',
  'real account',
  'fake account',
];

export class DisclosureGuard {
  /**
   * Sanitizes an error so that authentication and envelope errors
   * NEVER disclose Space names, Space existence, or specific failure reasons.
   */
  public static sanitizeError(error: unknown): string {
    if (!error) return GENERIC_UNLOCK_ERROR;

    const message = error instanceof Error ? error.message : String(error);

    // Authentication or decryption failures always collapse to generic error
    if (
      message.toLowerCase().includes('password') ||
      message.toLowerCase().includes('credential') ||
      message.toLowerCase().includes('space') ||
      message.toLowerCase().includes('decrypt') ||
      message.toLowerCase().includes('envelope') ||
      message.toLowerCase().includes('argon2id') ||
      message.toLowerCase().includes('aead')
    ) {
      return GENERIC_UNLOCK_ERROR;
    }

    return message;
  }

  /**
   * Validates user-facing text to prevent prohibited security theater
   * and disclosive labels.
   */
  public static validateUserFacingText(text: string): { isValid: boolean; violation?: string } {
    const lower = text.toLowerCase();
    for (const term of PROHIBITED_MARKETING_TERMS) {
      if (lower.includes(term)) {
        return {
          isValid: false,
          violation: `Prohibited term detected: "${term}". Use neutral, accurate privacy language instead.`,
        };
      }
    }
    return { isValid: true };
  }
}
