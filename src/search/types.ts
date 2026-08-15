/**
 * Privacy-Aware Local Search Types for VEIL.
 */

export interface SearchResult {
  id: string;
  type: 'contact' | 'message' | 'group';
  title: string;
  subtitle?: string;
  matchSnippet?: string;
  conversationId?: string;
  timestamp?: number;
}
