/** Choose the freshest known avatar for a direct chat, or its canonical group image. */
export function resolveConversationAvatar(
  conversation: { type?: 'direct' | 'group'; avatar?: string; avatarUrl?: string } | null | undefined,
  contactAvatar?: string | null
): string | undefined {
  if (!conversation) return contactAvatar || undefined;
  if (conversation.type === 'group') return conversation.avatarUrl || conversation.avatar || undefined;
  return contactAvatar || conversation.avatarUrl || conversation.avatar || undefined;
}
