# PHASE 07: Privacy UX, App Lock, Notifications, Panic Lock & Decoy Space

## Objective
Implement user-facing privacy controls, configurable notifications per Space, auto-lock timers, instant Panic Lock, and optional Decoy Space.

## Requirements
1. **Design System Adherence**: Build all UI views using the Vanilla CSS Design System (`src/styles/veil-design-system.css`).
2. **Notification Privacy**: Configure notification previews per Space (Full, Sender Only, Redacted "New Message").
3. **App Lock & Idle Timeout**: Auto-lock after configurable inactive durations (30s, 1m, 5m, immediate backgrounding).
4. **Panic Lock Trigger**: Emergency button / shortcut that immediately zeroizes in-memory keys and returns to the lock screen.
5. **Decoy Space Implementation**: Alternative configured password unlocks a decoy vault with no error prompts or hints of other Spaces.

## Definition of Done
- Complete UI flow tested across Onboarding, Unlock, Chats, Space Switcher, and Privacy Settings.
- Panic lock and Decoy space transitions verified.
