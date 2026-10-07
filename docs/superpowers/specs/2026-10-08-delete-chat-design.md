# Delete Chat — Design

## Goal

Let a user remove a direct or group conversation from their VEIL chat list and clear that conversation's local history, without changing the contact, group membership, or another participant's copy.

## User experience

- Each conversation row gets an accessible overflow button with a 44px minimum touch target.
- The row menu contains the existing Pin/Unpin action and a destructive **Delete chat** action.
- Selecting Delete chat opens the existing accessible confirmation modal. The copy names the chat and explains that the conversation and its local history will be removed from this Space; the contact, group membership, and other participants' copies remain.
- Cancel, Escape, or backdrop dismissal leaves all data unchanged. Confirm removes the item and returns to the chat list if it was open.

## Data and behavior

- Deletion is scoped to the active Space and should remain deleted when that Space's encrypted recovery snapshot is merged or restored. An encrypted conversation tombstone records the deletion time so older conversation/message records cannot resurrect the chat; later messages may create a fresh chat entry.
- It removes the matching UI conversation, UI message map entry, direct conversation history, and group message history from the Space's encrypted store. It removes local search results and related queued media/network sends that have not yet reached the relay.
- Already-relayed envelopes cannot be recalled from the other participant. Persist the tombstone and cleaned maps before scheduling the existing encrypted Space snapshot sync.
- For group conversations, it does not leave the group or change membership; a later incoming message may recreate the chat entry.
- It does not delete the contact or ratchet/session keys, send a delete-for-everyone protocol message, or modify the other participant's history.
- If writing the deletion tombstone fails, leave the chat visible and report the failure. After the tombstone is stored, it is authoritative for hiding old history even if physical record cleanup needs retry.

## Implementation boundaries

- `SidebarConversationItem` owns the row overflow control and menu. Its selected-chat area remains a separate button so the menu button is not nested inside an element with button semantics.
- `Sidebar` coordinates menu state, confirmation, and the AppState deletion action.
- AppState owns per-Space persistence and cleanup; `ConversationManager` and `GroupManager` expose focused history-delete methods rather than broad store access from the UI. Snapshot merge/restore must honor conversation tombstones to prevent resurrection.
- Reuse the existing `Modal` and icon system; preserve current row styling and Pin/Unpin behavior.

## Verification

- Add behavior tests for direct and group deletion, tombstone persistence and snapshot merge, later-message recreation, active-chat closure, contact/group preservation, cancellation, and storage failure.
- Add a Sidebar interaction regression for opening the row menu and confirming deletion without triggering chat selection.
- Run focused tests and TypeScript validation. Physical device verification should confirm touch target and menu placement.
