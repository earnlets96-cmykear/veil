/**
 * Centralized Error Normalization Utility for VEIL.
 *
 * Ensures that no raw JavaScript objects, error maps, or unformatted exceptions
 * ever leak as '[object Object]' or unhandled structures into the UI.
 */

export function getErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred.'): string {
  if (!error) return fallbackMessage;

  if (error instanceof Error) {
    if (error.message && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
  }

  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (trimmed && trimmed !== '[object Object]') {
      return trimmed;
    }
  }

  if (typeof error === 'object') {
    const candidate = error as {
      message?: unknown;
      error?: unknown;
      detail?: unknown;
      reason?: unknown;
    };

    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message.trim();
    }
    if (typeof candidate.error === 'string' && candidate.error.trim()) {
      return candidate.error.trim();
    }
    if (typeof candidate.detail === 'string' && candidate.detail.trim()) {
      return candidate.detail.trim();
    }
    if (typeof candidate.reason === 'string' && candidate.reason.trim()) {
      return candidate.reason.trim();
    }

    if (candidate.error && typeof candidate.error === 'object') {
      return getErrorMessage(candidate.error, fallbackMessage);
    }
  }

  return fallbackMessage;
}
