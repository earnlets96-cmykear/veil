# UX_DESIGN_SYSTEM.md — VEIL Design System & User Experience Architecture

## 1. UX Philosophy & Visual Identity

VEIL delivers the intuitive simplicity and visual elegance of world-class messaging apps, completely shielding the user from underlying cryptographic complexity.

### Core UX Rules
1. **Zero Cryptographic Jargon in Primary Flows**: Users create profiles, add contacts, and send messages—they never configure curves, ratchets, or KDF rounds.
2. **Instant Familiarity**: Standard layout paradigms (Chat List, Active Conversation, Contact Cards, Settings Drawer).
3. **Speed & Responsiveness**: Sub-100ms UI transitions, optimistic message rendering, fluid animations.
4. **Target Onboarding**: 1 to 2 minutes from installation to first encrypted message.

---

## 2. Design Tokens (Vanilla CSS Architecture)

The VEIL Design System is implemented as standard CSS custom properties in `src/styles/veil-design-system.css`.

### 1. Color Palette (Dark & Privacy-Centric Theme)

```css
:root {
  /* Surface Colors */
  --veil-bg-base: #0a0d14;
  --veil-bg-surface: #121824;
  --veil-bg-surface-elevated: #1a2233;
  --veil-bg-glass: rgba(18, 24, 36, 0.75);
  --veil-border: rgba(255, 255, 255, 0.08);
  --veil-border-focus: #6366f1;

  /* Accent & Brand Colors */
  --veil-accent-primary: #6366f1;       /* Indigo 500 */
  --veil-accent-primary-hover: #4f46e5; /* Indigo 600 */
  --veil-accent-secondary: #06b6d4;     /* Cyan 500 */
  --veil-accent-glow: rgba(99, 102, 241, 0.25);

  /* Functional Colors */
  --veil-success: #10b981;              /* Emerald 500 */
  --veil-warning: #f59e0b;              /* Amber 500 */
  --veil-danger: #ef4444;               /* Red 500 */
  --veil-panic-bg: #450a0a;             /* Deep red panic background */

  /* Typography Colors */
  --veil-text-primary: #f8fafc;
  --veil-text-secondary: #94a3b8;
  --veil-text-muted: #64748b;
  --veil-text-inverse: #0a0d14;

  /* Space Identity Accents (Configurable per Space) */
  --veil-space-main: #6366f1;           /* Indigo for Main Space */
  --veil-space-work: #0ea5e9;           /* Sky for Work Space */
  --veil-space-private: #8b5cf6;        /* Purple for Private Space */
  --veil-space-decoy: #10b981;          /* Green for Decoy Space */
}
```

### 2. Typography & Scale
- **Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif`
- **Scale**:
  - Display Title: `1.75rem (28px)` / `700 weight`
  - Screen Header: `1.25rem (20px)` / `600 weight`
  - Body Regular: `0.9375rem (15px)` / `400 weight`
  - Message Text: `0.9375rem (15px)` / `400 weight`
  - Caption / Metadata: `0.75rem (12px)` / `500 weight`

### 3. Glassmorphism & Elevation Tokens
- `--veil-glass-blur: blur(16px);`
- `--veil-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);`
- `--veil-shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5);`
- `--veil-radius-sm: 8px;`
- `--veil-radius-md: 14px;`
- `--veil-radius-lg: 20px;`
- `--veil-radius-full: 9999px;`

---

## 3. Core Component Primitives

1. **`VeilButton`**: Primary, Secondary, Ghost, Danger, Panic Lock variants with smooth hover scale (`1.02`) and focus rings.
2. **`VeilInput`**: Floating label or clean inline icon inputs with masked password toggles and error hints.
3. **`SpaceIndicator`**: Subtle, elegant badge displaying the current active Space name and accent tint.
4. **`ChatBubble`**:
   - Outgoing: `--veil-accent-primary` gradient bubble with delivery timestamp & double-check indicators.
   - Incoming: `--veil-bg-surface-elevated` bubble with sender avatar / name.
5. **`ContactCard`**: Avatar with presence indicator, safety number preview, and action buttons.
6. **`PanicButton`**: Always-available quick lock / emergency trigger.

---

## 4. Key User Journeys

### Journey 1: First-Time Onboarding (1-2 min)
```
[Welcome Screen] 
       ↓ (Tap "Get Started")
[Create Main Space] → Enter Profile Name + Choose Password
       ↓ (Auto-derives Argon2id envelope & generates Ed25519 identity)
[Ready!] → Lands immediately on empty Chats screen with "+ New Message"
```

### Journey 2: Credential-Selected Unlock
```
[Locked Screen]
       ↓ (User enters Password)
[Unlock Validation]
       ↓ (Matches Candidate Envelope A, B, or C)
[Direct Entry into Target Space]
```

### Journey 3: Creating an Additional Space (e.g. Private Space)
```
[Settings] → [Spaces] → [Create New Space]
       ↓
Enter Space Name (e.g. "Private Space") + Unique Password
       ↓
Space Created! Unlocked seamlessly or switchable via credential.
```
