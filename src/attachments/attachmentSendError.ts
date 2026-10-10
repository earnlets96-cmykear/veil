/** Maps internal attachment failures to concise messages safe for the composer UI. */
export function attachmentSendFailureMessage(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();

  if (message.includes('auth') || message.includes('unauthorized')) {
    return 'Cloud session unavailable. Reopen and unlock this Space, then retry.';
  }
  if (message.includes('selected media') || message.includes('read selected file')) {
    return 'Could not read the selected file. Remove it and select it again.';
  }
  if (message.includes('connect') || message.includes('network') || message.includes('fetch failed')) {
    return 'Could not reach attachment storage. Check your connection and retry.';
  }

  return 'Sending failed. Your selected files are still here; please try again.';
}
