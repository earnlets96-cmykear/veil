/**
 * Single Deterministic Back Button Coordinator for VEIL.
 *
 * Implements a centralized priority-ordered dispatch for `veil:backbutton`.
 *
 * Priority Hierarchy:
 * 50: Media Viewer
 * 40: Context Menu
 * 30: Emoji / Sticker Drawer OR Media Picker
 * 20: Conversation Overlays (Forwarding, Delete Confirm, Search in Chat, Selection Mode)
 * 10: App-Level Modals (Settings, Profile, etc. in AppState)
 *  0: Normal Conversation Navigation / Exit (in AppState)
 *
 * When a hardware back button or swipe-back occurs:
 * - Only the highest active priority handler is executed.
 * - Calling event.preventDefault() and event.stopImmediatePropagation() ensures
 *   no other handler or listener executes on the same back press.
 */

export type BackButtonHandler = () => boolean; // Return true if the handler consumed/dismissed an overlay

export interface BackButtonRegistration {
  id: string;
  priority: number;
  handler: BackButtonHandler;
}

class BackButtonCoordinator {
  private handlers: BackButtonRegistration[] = [];
  private isListening = false;

  public register(id: string, priority: number, handler: BackButtonHandler): () => void {
    // Remove existing if re-registering same id
    this.handlers = this.handlers.filter((h) => h.id !== id);
    this.handlers.push({ id, priority, handler });
    // Keep sorted descending by priority
    this.handlers.sort((a, b) => b.priority - a.priority);

    this.ensureGlobalListener();

    return () => {
      this.handlers = this.handlers.filter((h) => h.id !== id);
    };
  }

  private ensureGlobalListener(): void {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;
    window.addEventListener('veil:backbutton', this.handleEvent);
  }

  private handleEvent = (e: Event): void => {
    // Run handlers from highest priority to lowest
    for (const reg of this.handlers) {
      try {
        const handled = reg.handler();
        if (handled) {
          e.preventDefault();
          if (typeof (e as any).stopImmediatePropagation === 'function') {
            (e as any).stopImmediatePropagation();
          }
          return;
        }
      } catch (_err) {
        // Continue to next handler if error
      }
    }
  };

  /**
   * For testing or manual dispatch
   */
  public trigger(): boolean {
    for (const reg of this.handlers) {
      try {
        const handled = reg.handler();
        if (handled) return true;
      } catch (_err) {}
    }
    return false;
  }

  public clear(): void {
    this.handlers = [];
  }
}

export const BackButtonManager = new BackButtonCoordinator();
