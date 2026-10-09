import type { CloudClient } from './cloudClient.ts';

/** Ensures attachment UI never starts a cloud request without a valid session. */
export async function requireCloudSessionForAttachment(
  cloudClient: CloudClient,
  ensureCloudSession: () => Promise<boolean | void>,
): Promise<void> {
  if (cloudClient.hasAuthenticatedSession()) return;

  let restored: boolean | void = false;
  try {
    restored = await ensureCloudSession();
  } catch {
    // Keep credential and backend details out of user-facing attachment errors.
  }
  if (restored === false || !cloudClient.hasAuthenticatedSession()) {
    throw new Error('Cloud authentication is unavailable. Reopen this Space to try again.');
  }
}
