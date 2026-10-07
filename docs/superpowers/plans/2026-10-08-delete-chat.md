# Delete Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a confirmed row-menu action that deletes a direct or group chat and its local history from the active Space without deleting the contact, group membership, or another participant's copy.

**Architecture:** Store deletion timestamps as encrypted per-Space conversation tombstones. Apply them during recovery snapshot merge so older local/remote chat data cannot resurrect, while allowing later messages to create a new chat. AppState owns durable cleanup; direct/group managers own their own history keys; Sidebar owns the row menu and confirmation flow.

**Tech Stack:** React/TypeScript, `EncryptedSpaceStore`, existing AccountManager snapshot merge, existing `Modal`, Vitest.

---

## File map

- Create `src/sync/conversationTombstones.ts`: merge deletion timestamps and decide if a conversation timestamp predates deletion.
- Modify `src/account/accountManager.ts`: merge tombstone records, filter old UI conversation/message data and direct/group history records during snapshot restore.
- Modify `src/messaging/conversationManager.ts` and `src/group/groupManager.ts`: expose focused encrypted-history deletion methods.
- Modify `src/network/envelopeQueue.ts` and `src/attachments/mediaOutbox.ts`: remove unsent network envelopes and pending encrypted media jobs for a deleted conversation.
- Modify `src/ui/app/AppState.tsx`: expose a durable `deleteConversation` action, update the active UI, search index, tombstone, and encrypted Space snapshot.
- Modify `src/ui/components/Sidebar.tsx`: provide a row overflow menu and confirmation modal.
- Create `tests/phase117-delete-chat.test.ts`: test tombstone merging, deletion persistence, recovery behavior, and failure handling.
- Create `tests/phase117-delete-chat-sidebar.test.tsx`: test menu open, cancel, confirm, and row selection isolation.
- Update `docs/ai/CURRENT_STATE.md`, `docs/ai/ACTIVE_TASK.md`, `docs/ai/CHANGELOG.md`, and `docs/ai/HANDOFF.md` after verification.

### Task 1: Specify tombstone merge behavior

**Files:**
- Create: `src/sync/conversationTombstones.ts`
- Create: `tests/phase117-delete-chat.test.ts`

- [ ] **Step 1: Write failing unit tests** for max-timestamp tombstone merge and the timestamp cutoff:

```ts
expect(mergeConversationTombstones([{ conversationId: 'peer-a', deletedAt: 20 }],
  [{ conversationId: 'peer-a', deletedAt: 15 }, { conversationId: 'group-a', deletedAt: 8 }]))
  .toEqual([{ conversationId: 'peer-a', deletedAt: 20 }, { conversationId: 'group-a', deletedAt: 8 }]);
expect(isConversationDeletedAt({ conversationId: 'peer-a', deletedAt: 20 }, 19)).toBe(true);
expect(isConversationDeletedAt({ conversationId: 'peer-a', deletedAt: 20 }, 21)).toBe(false);
```

- [ ] **Step 2: Run the new test and confirm it fails** with the missing helper import.

Run: `npx vitest run tests/phase117-delete-chat.test.ts`

- [ ] **Step 3: Implement the two pure helpers** in `conversationTombstones.ts` with this API:

```ts
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
    newest.set(item.conversationId, Math.max(newest.get(item.conversationId) || 0, item.deletedAt));
  }
  return [...newest].map(([conversationId, deletedAt]) => ({ conversationId, deletedAt }));
}

export function isConversationDeletedAt(tombstone: ConversationTombstone, timestamp: number): boolean {
  return timestamp <= tombstone.deletedAt;
}
```

- [ ] **Step 4: Run the test and confirm it passes.**

Run: `npx vitest run tests/phase117-delete-chat.test.ts`

### Task 2: Prevent recovery resurrection and remove encrypted histories

**Files:**
- Modify: `src/account/accountManager.ts`
- Modify: `src/messaging/conversationManager.ts`
- Modify: `src/group/groupManager.ts`
- Test: `tests/phase117-delete-chat.test.ts`

- [ ] **Step 1: Add failing snapshot-merge regressions** proving an older conversation, UI message, direct history, and group history are filtered by a tombstone, while later conversation messages survive.
- [ ] **Step 2: Run only those regressions and confirm they fail** against `AccountManager.mergeRecordsForSpace`.
- [ ] **Step 3: Merge `veil:ui:deleted_conversations` deterministically** in `AccountManager`; before record-side selection, collect tombstones from both snapshots. For every branch that emits `veil:ui:conversations`, `veil:ui:messages`, `veil:messages:conv:<id>`, or `veil:group:messages:<id>`, filter matching conversation rows whose `timestamp <= tombstone.deletedAt`; handle one-sided records too. Keep unrelated keys and group membership state.
- [ ] **Step 4: Add the focused history-delete methods** using the existing private prefixes and awaited storage deletion:

```ts
public async deleteConversationHistory(session: SpaceSession, conversationId: string): Promise<void> {
  this.assertSession(session);
  await this.store.deleteAsync(session, `${MESSAGE_HISTORY_PREFIX}${conversationId}`);
}
```

Add the parallel `GroupManager.deleteGroupMessageHistory(session, groupId)` method using `GROUP_MESSAGES_PREFIX`.
- [ ] **Step 5: Run tombstone/recovery and existing account recovery regressions.**

Run: `npx vitest run tests/phase117-delete-chat.test.ts tests/phase29-account-recovery.test.ts tests/phase31-account-recovery.test.ts`

### Task 3: Delete pending local sends and media jobs

**Files:**
- Modify: `src/network/envelopeQueue.ts`
- Modify: `src/attachments/mediaOutbox.ts`
- Test: `tests/phase117-delete-chat.test.ts`

- [ ] **Step 1: Add failing tests** showing only queued envelopes/jobs with the requested `conversationId` are removed and other conversations remain unchanged.
- [ ] **Step 2: Run the focused tests and confirm failure.**
- [ ] **Step 3: Implement queue cleanup methods** that preserve nonmatching records and clear only matching media ciphertext:

```ts
public async removeOutboundForConversation(session: SpaceSession, conversationId: string): Promise<void> {
  const queue = await this.listOutbound(session);
  await this.store.setAsync(session, KEY_OUTBOUND_QUEUE,
    queue.filter((item) => item.conversationId !== conversationId));
}
```

Add `MediaOutbox.removeConversation(session, conversationId)` by finding matching jobs, persisting the filtered outbox, then deleting each removed job's cached ciphertext by its attachment ID.
- [ ] **Step 4: Verify unrelated queue entries survive** and run `npx vitest run tests/phase117-delete-chat.test.ts tests/phase111-sticker-and-outbound-recovery.test.ts`.

### Task 4: Implement durable AppState deletion

**Files:**
- Modify: `src/ui/app/AppState.tsx`
- Test: `tests/phase117-delete-chat.test.ts`

- [ ] **Step 1: Add failing behavior tests** for direct/group deletion, active-chat closure, contact/group preservation, tombstone write failure, encrypted map persistence, and sync scheduling.
- [ ] **Step 2: Implement `deleteConversation(conversationId)`** with the ordered persistence boundary below. Snapshot React values before writing; persist the merged tombstone first, then filtered maps, then history and queue cleanup, then update React/search state and schedule sync:

```ts
const tombstone = { conversationId, deletedAt: Date.now() };
const tombstones = mergeConversationTombstones(
  await store.getAsync<ConversationTombstone[]>(activeSession, 'veil:ui:deleted_conversations') || [],
  [tombstone]
);
await store.setAsync(activeSession, 'veil:ui:deleted_conversations', tombstones);
```

If tombstone persistence fails, leave visible state unchanged. Once it persists, retain deletion in UI even if best-effort record cleanup fails; show an error and let the tombstone suppress old recovered data.
- [ ] **Step 3: Run the focused AppState regressions and existing delete-message/recovery tests.**

Run: `npx vitest run tests/phase117-delete-chat.test.ts tests/critical-stability-p0.test.ts tests/phase29-account-recovery.test.ts`

### Task 5: Add row overflow menu and confirmation

**Files:**
- Modify: `src/ui/components/Sidebar.tsx`
- Create: `tests/phase117-delete-chat-sidebar.test.tsx`

- [ ] **Step 1: Write failing UI tests** proving the row overflow opens actions without selecting the chat, Cancel preserves it, and Delete chat requires confirmation before calling AppState.
- [ ] **Step 2: Implement a separate 44px overflow button** on each row; keep row selection and overflow as separate controls. Use the current icon system and keep Pin/Unpin behavior:

```tsx
<button type="button" aria-label={`More actions for ${conv.name}`} onClick={(event) => {
  event.stopPropagation();
  setMenuConversationId(conv.id);
}}>
  <MoreVerticalIcon size={18} />
</button>
```

- [ ] **Step 3: Reuse `Modal`** for a named confirmation explaining local deletion and recipient-copy limits. Cancel/Escape/backdrop do nothing; confirm awaits `deleteConversation`, closes only on success, and shows a storage error if tombstone persistence fails:

```tsx
<Modal isOpen={!!deleteTarget} onClose={closeDeleteDialog} title="Delete chat">
  <p>Delete the chat with {deleteTarget?.name} and its history from this Space?</p>
  <p>Your contact and other participants’ copies will not be deleted.</p>
  <Button variant="danger" onClick={confirmDeleteChat}>Delete chat</Button>
</Modal>
```
- [ ] **Step 4: Run the Sidebar tests and related mobile sidebar tests.**

Run: `npx vitest run tests/phase117-delete-chat-sidebar.test.tsx tests/phase101-device-simulator-viewports.test.tsx`

### Task 6: Verify, document, and commit

**Files:**
- Modify: `docs/ai/CURRENT_STATE.md`
- Modify: `docs/ai/ACTIVE_TASK.md`
- Modify: `docs/ai/CHANGELOG.md`
- Modify: `docs/ai/HANDOFF.md`

- [ ] Run `npm run typecheck` and the focused tests from Tasks 1–5.
- [ ] Review `git diff --check` and `git status`; preserve all pre-existing unrelated files.
- [ ] Document the implemented behavior, verification, and any environment limitation in project docs.
- [ ] Commit only feature files with message `feat: add confirmed delete chat action`.
