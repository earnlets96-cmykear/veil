/**
 * UI State Manager for VEIL Phase 7.
 *
 * Tracks sensitive UI components and memory caches (messages, drafts,
 * media previews, search indexes, clipboard data) and securely clears them
 * upon Quick Lock or Panic Lock.
 */

import { SensitiveContentType, SensitiveContentEntry } from './types.ts';

export class UIStateManager {
  private sensitiveEntries = new Map<string, SensitiveContentEntry>();
  private activeClipboardContent: { text: string; spaceId: string; copiedAt: number } | null = null;
  private searchIndexes = new Map<string, Set<string>>(); // spaceId -> search keywords

  /**
   * Registers a piece of sensitive UI content.
   */
  public registerSensitiveContent(spaceId: string, contentId: string, type: SensitiveContentType): void {
    const key = `${spaceId}:${contentId}`;
    this.sensitiveEntries.set(key, {
      contentId,
      spaceId,
      type,
      registeredAt: Date.now(),
    });
  }

  /**
   * Tracks clipboard content copied within a Space.
   */
  public trackClipboard(spaceId: string, text: string): void {
    this.activeClipboardContent = {
      text,
      spaceId,
      copiedAt: Date.now(),
    };
  }

  /**
   * Indexes a search keyword for the current Space only.
   */
  public indexSearchKeyword(spaceId: string, keyword: string): void {
    if (!this.searchIndexes.has(spaceId)) {
      this.searchIndexes.set(spaceId, new Set());
    }
    this.searchIndexes.get(spaceId)!.add(keyword.toLowerCase());
  }

  /**
   * Searches keywords within the active Space only.
   * Enforces zero cross-Space search disclosure.
   */
  public searchKeywords(activeSpaceId: string, query: string): string[] {
    const spaceIndex = this.searchIndexes.get(activeSpaceId);
    if (!spaceIndex) return [];

    const lower = query.toLowerCase();
    return Array.from(spaceIndex).filter(k => k.includes(lower));
  }

  /**
   * Returns whether any sensitive content exists for a given Space.
   */
  public isContentExposed(spaceId: string): boolean {
    for (const entry of this.sensitiveEntries.values()) {
      if (entry.spaceId === spaceId) return true;
    }
    if (this.activeClipboardContent && this.activeClipboardContent.spaceId === spaceId) {
      return true;
    }
    return false;
  }

  /**
   * Clears all sensitive UI content, drafts, previews, and search indexes for a specific Space.
   */
  public clearSensitiveContent(spaceId: string): void {
    for (const [key, entry] of this.sensitiveEntries.entries()) {
      if (entry.spaceId === spaceId) {
        this.sensitiveEntries.delete(key);
      }
    }

    if (this.activeClipboardContent && this.activeClipboardContent.spaceId === spaceId) {
      this.activeClipboardContent = null;
    }

    this.searchIndexes.delete(spaceId);
  }

  /**
   * Clears ALL sensitive UI content across ALL Spaces (for Panic Lock).
   */
  public clearAllSensitiveContent(): void {
    this.sensitiveEntries.clear();
    this.activeClipboardContent = null;
    this.searchIndexes.clear();
  }

  /**
   * Returns count of active sensitive UI entries for a Space.
   */
  public getSensitiveCount(spaceId: string): number {
    let count = 0;
    for (const entry of this.sensitiveEntries.values()) {
      if (entry.spaceId === spaceId) count++;
    }
    return count;
  }
}
