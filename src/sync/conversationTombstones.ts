/** Per-Space deletion markers prevent stale recovery snapshots restoring old chats. */
export interface ConversationTombstone {
  conversationId: string;
  deletedAt: number;
}

export function mergeConversationTombstones(
  local: ConversationTombstone[],
  remote: ConversationTombstone[]
): ConversationTombstone[] {
  const newest = new Map<string, number>();
  for (const item of [...local, ...remote]) {
    if (!item?.conversationId) continue;
    const deletedAt = Number(item.deletedAt) || 0;
    newest.set(item.conversationId, Math.max(newest.get(item.conversationId) || 0, deletedAt));
  }
  return [...newest].map(([conversationId, deletedAt]) => ({ conversationId, deletedAt }));
}

export function isConversationDeletedAt(tombstone: ConversationTombstone, timestamp: number): boolean {
  return Number(timestamp) <= tombstone.deletedAt;
}
