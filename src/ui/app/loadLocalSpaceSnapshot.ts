import type { SpaceSession } from '../../spaces/session.ts';

/**
 * Read the independent, encrypted local records needed to paint the app after
 * unlock as one batch. Remote authentication/sync stays outside this helper.
 */
export async function loadLocalSpaceSnapshot(
  session: SpaceSession,
  store: { getAsync<T>(session: SpaceSession, key: string): Promise<T | null> },
  contactManager: { listContacts(session: SpaceSession): Promise<any[]> },
  contactRequestManager: { listRequests(session: SpaceSession): Promise<any[]> }
) {
  const [
    recoverySecurity,
    contacts,
    conversations,
    contactRequests,
    profile,
    privacySettings,
    muteSettings,
    messages,
  ] = await Promise.all([
    store.getAsync<{ recoveryPasswordChangeRequired?: boolean }>(session, 'veil:account:recovery_security'),
    contactManager.listContacts(session),
    store.getAsync<any[]>(session, 'veil:ui:conversations'),
    contactRequestManager.listRequests(session),
    store.getAsync<any>(session, 'veil:user:profile'),
    store.getAsync<any>(session, 'veil:user:privacy_settings'),
    store.getAsync<Record<string, boolean>>(session, 'veil:contacts:mute_settings'),
    store.getAsync<Record<string, any[]>>(session, 'veil:ui:messages'),
  ]);

  return {
    recoverySecurity,
    contacts,
    conversations: conversations || [],
    contactRequests,
    profile: profile || null,
    privacySettings: privacySettings || {
      phoneVisibility: 'contacts' as const,
      profileVisibility: 'everyone' as const,
    },
    muteSettings: muteSettings || {},
    messages: messages || {},
  };
}
