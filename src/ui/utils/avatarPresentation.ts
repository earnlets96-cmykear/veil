/** Choose the freshest known avatar for a direct chat, or its canonical group image. */
export function resolveConversationAvatar(
  conversation: { type?: 'direct' | 'group'; avatar?: string; avatarUrl?: string } | null | undefined,
  contactAvatar?: string | null
): string | undefined {
  if (!conversation) return contactAvatar || undefined;
  if (conversation.type === 'group') return conversation.avatarUrl || conversation.avatar || undefined;
  return contactAvatar || conversation.avatarUrl || conversation.avatar || undefined;
}

/** A freshly fetched peer profile supersedes the possibly stale local contact photo. */
export function resolvePeerProfileAvatar(profileAvatar?: string | null, contactAvatar?: string | null): string | undefined {
  return profileAvatar || contactAvatar || undefined;
}

/** Ignore a cached peer profile as soon as the profile viewer targets another identity. */
export function resolvePeerProfileDocument<T>(
  cached: { key: string; document: T } | null | undefined,
  currentKey: string
): T | null {
  return cached?.key === currentKey ? cached.document : null;
}

/** Never apply directory profile data to a different locally selected identity. */
export function isPeerProfileForIdentity(
  profile: { identityId?: string } | null | undefined,
  expectedIdentityId?: string | null
): boolean {
  return Boolean(profile && (!expectedIdentityId || profile.identityId === expectedIdentityId));
}
