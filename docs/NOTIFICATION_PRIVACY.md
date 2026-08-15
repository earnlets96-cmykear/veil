# NOTIFICATION_PRIVACY.md — Privacy-Preserving Notification Policies

## 1. Notification Policy Modes

1. **`HIDDEN`**:
   - Header: `"VEIL"`
   - Body: `"New encrypted message received"`
   - Completely conceals sender identity and message contents.

2. **`SENDER_ONLY` (Default)**:
   - Header: `"VEIL"`
   - Body: `"New message from Alice"` (or `"New message from Alpha Group"`)
   - Reveals conversation source without disclosing message plaintext.

3. **`FULL_OBFUSCATED`**:
   - Header: `"Alice"`
   - Body: Truncated message text (max 25 characters)
   - Available for low-risk environments.

---

## 2. Lock & Inactivity Invariants

When a Space is locked or Panic Lock is active, `NotificationDispatcher.setLocked(true)` suppresses all notifications to prevent shoulder-surfing.
