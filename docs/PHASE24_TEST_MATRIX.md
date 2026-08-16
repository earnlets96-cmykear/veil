# VEIL — Phase 24 Repeatable Real-Device Test Matrix

| ID | Test Scenario | Device A Action | Device B Action | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T01** | User Search | Types `@phone2` in search modal | N/A | Finds Phone 2 public profile | PASS |
| **T02** | Contact Request | Clicks "+ Add Contact", adds greeting | N/A | Status becomes OUTGOING_PENDING | PASS |
| **T03** | Inbound Request | N/A | Syncs / receives push | Badge appears on Contacts tab with greeting | PASS |
| **T04** | Acceptance | N/A | Clicks "✓ Accept" | Address book entry created; response dispatched | PASS |
| **T05** | Recipient Convergence | Syncs response envelope | N/A | Status becomes ACCEPTED; prekeys loaded | PASS |
| **T06** | Initial E2EE Message | Sends "Hello from Phone 1" | Receives and decrypts | Text matches; verified sender badge displayed | PASS |
| **T07** | Bidirectional Reply | Receives reply | Sends "Hello back from Phone 2" | Double Ratchet ratchets forward; reply renders | PASS |
| **T08** | 20 Message Burst | Sends 20 messages | Receives all 20 | All 20 delivered in order with zero duplicates | PASS |
| **T09** | Offline Queueing | Sends while disconnected | Offline | Messages sit in local encrypted queue | PASS |
| **T10** | Reconnection Flush | Reconnects to network | Reconnects | Outbound queue flushes automatically | PASS |
| **T11** | Cold Restart | Process killed and restarted | Process killed and restarted | Unlocks space; complete history intact | PASS |
| **T12** | Username Update | N/A | Renames to `@phone2_v2` | Directory updated; conversation thread un-split | PASS |
| **T13** | Block User | Blocks Phone 2 | Sends spam message | Message dropped; zero alerts/notifications | PASS |
| **T14** | Unblock User | Unblocks Phone 2 | Sends new message | Messaging resumes normally | PASS |
| **T15** | Large Attachment | Sends 1 MiB binary | Downloads & decrypts | SHA-256 verified; byte-for-byte exact | PASS |
