/**
 * Privacy-Aware In-Memory Search Engine for VEIL.
 *
 * Scoped strictly to the currently unlocked Space. The index exists exclusively
 * in volatile memory and is purged instantaneously on lock, switch, or panic.
 */

import { SearchResult } from './types.ts';
import { Contact } from '../contacts/types.ts';
import { UIConversation, UIMessage } from '../ui/app/types.ts';

export class LocalSearchEngine {
  private contacts: Contact[] = [];
  private conversations: UIConversation[] = [];
  private messages: Record<string, UIMessage[]> = {};

  /**
   * Updates the in-memory index with active Space data.
   */
  public updateIndex(
    contacts: Contact[],
    conversations: UIConversation[],
    messages: Record<string, UIMessage[]>
  ): void {
    this.contacts = [...contacts];
    this.conversations = [...conversations];
    this.messages = { ...messages };
  }

  /**
   * Searches the active Space memory index.
   */
  public search(query: string): SearchResult[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: SearchResult[] = [];

    // 1. Search Contacts
    for (const c of this.contacts) {
      if (c.name.toLowerCase().includes(q) || c.identityId.toLowerCase().includes(q)) {
        results.push({
          id: c.identityId,
          type: 'contact',
          title: c.name,
          subtitle: `ID: ${c.identityId.slice(0, 12)}...`,
          conversationId: c.identityId,
        });
      }
    }

    // 2. Search Conversations (Groups & Chats)
    for (const conv of this.conversations) {
      if (conv.name.toLowerCase().includes(q)) {
        results.push({
          id: conv.id,
          type: conv.type === 'group' ? 'group' : 'contact',
          title: conv.name,
          subtitle: conv.type === 'group' ? 'Encrypted Group' : 'Direct E2EE Chat',
          conversationId: conv.id,
        });
      }
    }

    // 3. Search Decrypted Messages
    for (const [convId, msgList] of Object.entries(this.messages)) {
      const conv = this.conversations.find((c) => c.id === convId);
      const convName = conv?.name || 'Conversation';

      for (const msg of msgList) {
        if (msg.text.toLowerCase().includes(q)) {
          results.push({
            id: msg.id,
            type: 'message',
            title: convName,
            matchSnippet: msg.text,
            conversationId: convId,
            timestamp: msg.timestamp,
          });
        }
      }
    }

    return results;
  }

  /**
   * Immediately clears the volatile in-memory index.
   */
  public clear(): void {
    this.contacts = [];
    this.conversations = [];
    this.messages = {};
  }
}
