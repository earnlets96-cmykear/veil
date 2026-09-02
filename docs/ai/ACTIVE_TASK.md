# ACTIVE_TASK.md — Active Work Tracker

## Active Phase: PHASE 56 (Profile Persistence, Telegram-Grade Profile UI, and Video Upload Performance Optimization)
- **Status**: **COMPLETE & VERIFIED 100%**
- **Branch**: `main`
- **Output Report**: `docs/PHASE56_UI_UX_PROFILE_MEDIA_REPORT.md`

### Completed Phase 56 Tasks
- [x] **P0-1: Root-Cause Profile Persistence Across Reload, Login & Cloud Sync**:
  - Corrected parameter ordering bug in `AppState.tsx` line 470 where `bio` was passed as `avatar` and `avatar` was passed as `expiresInSeconds`.
  - Added support for `src` alias and numeric pixel sizes in `src/ui/components/ui/Avatar.tsx`.
  - Fixed avatar deletion and tombstone tracking under `'veil:avatar:tombstone'` so deleted avatars do not resurrect while offline nodes do not accidentally erase valid avatars.
  - Verified with automated tests in `tests/phase56-profile-media-perf.test.ts`.

- [x] **P0-2: Telegram-Grade Profile Modal Redesign**:
  - Rebuilt `src/ui/components/ProfileModal.tsx` into a modern, responsive profile hub.
  - Added 88px Avatar with camera upload overlay button for instant photo selection.
  - Added client-side WebP compression (<32 KB), auto-signing, directory publication, and recovery snapshot update.
  - Added dedicated "Remove Photo" button with tombstone recording.
  - Implemented clean 3-button peer action bar (`Message`, `Mute / Unmute`, `Safety Number`).
  - Added 12-block formatted fingerprint card with one-click copy and trust toggle.
  - Enforced strict SVG policy (zero raw Unicode emoji controls).

- [x] **P0-3: UI/UX Whole-App Polish**:
  - Added `BellOffIcon` to muted conversations in `Sidebar.tsx` and styled muted unread pills.
  - Refined delivery checks in `MessageStatus.tsx` (`CheckIcon` for relay, `CheckCheckIcon` for recipient delivered, colored for read).
  - Polished conversation view bubbles and tails.

- [x] **P0-4: Video Upload Performance Optimization**:
  - Implemented bounded adaptive chunk sizing (`getOptimalChunkSize`): 64 KiB ($\le 1\text{ MB}$), 256 KiB ($1-10\text{ MB}$), 512 KiB ($10-50\text{ MB}$), 1 MiB ($> 50\text{ MB}$).
  - Fixed chunk slice boundary bug in `AttachmentPipeline.chunkAndEncrypt`.
  - Benchmarked 2MB, 10MB, 50MB, and 100MB payloads: achieved 16x chunk reduction, relieved memory pressure, and exceeded 55 MB/s reassembly throughput with byte-for-byte SHA-256 integrity.

### Verification Results
- Phase 56 Test Suite: **100% PASS** (`tests/phase56-profile-media-perf.test.ts` 7/7 tests passing).
- Phase 55 Regression Suite: **100% PASS** (`tests/phase55-forensic-p0.test.ts` 7/7 tests passing).
- Production Web Build: **PASS (`npm run build` in 1.81s)**.
- Android Capacitor Sync: **PASS (`npm run android:sync` in 0.16s)**.
- Android Debug APK Build: **PASS (`gradlew.bat assembleDebug` BUILD SUCCESSFUL in 18s)**.
- Live Render Production Probe: **PASS (`scratch/verify_phase56_prod.ts` 6/6 tests passing against `https://veil-rga0.onrender.com`)**.
- Android Hardware Runtime: **`UNTESTED`** (honestly reported per Rule 4, no physical device or emulator connected on host).
