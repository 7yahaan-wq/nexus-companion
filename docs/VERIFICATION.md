# Verification

## Harness

`npm run doctor` checks Node, pinned Electron runtime, assets and lockfile. `npm run verify` builds, runs all domain tests, then launches real Electron windows through Playwright for milestones 1–8 and the full user journey. Every test uses isolated data directories. Reports: `.test-data/verification.json`.

## 0.3.1 verification (2026-09-21)

All 16 harness stages passed again: 20 unit tests and 12 real desktop suites. Nia regression checks now verify automatic navigation after saving an idea, cancel staying on the homepage, the renamed notes navigation, homepage View ideas in Chinese/English, reopening saved ideas after restart, and a single visible sidebar focus entry that opens focus mode. Home screenshots were reviewed in dark and light/narrow layouts. The packaged 0.3.1 runtime passed E2E, usability and Nia suites; the actual portable executable passed its smoke test. Archive audit verified version/assets and excluded private files. Hashes are recorded in PROJECT_STATUS.md.

## 0.3.0 verification (2026-09-21)

- Environment checks passed with Node 24.19.0 and Electron 39.8.10. TypeScript and Vite production builds passed.
- All 16 harness stages passed: 3 build stages, 20 unit tests, and 12 desktop suites (`desktop`, `m2`–`m8`, `e2e`, `polish`, `usability`, `nia`). The runtime test uses the installed Electron binary and isolated application data.
- Four new unit tests cover stale failures/live observations, completion expiry, invalid/future timestamps, nighttime/focus priority, and the shipped RGBA atlas/frame metadata contract.
- The new Nia desktop suite saves a note from the homepage and checks it after restart; previews all eight semantic states; checks real frame advancement; pauses for reduced motion, window hide and disabled animation; restores playback on show; checks persistent settings, light/dark themes, English and a 1060-pixel-wide window. No renderer exceptions occurred.
- Screenshots of idle, working, thinking and sleepy artwork and the homepage were visually reviewed. Per-frame clipping removes neighbouring atlas fragments; namespaced mood classes avoid the application's global error styling.
- Source formatting checks passed. The settings preview deliberately keeps displaying Nia when the companion uses Core or a custom pack; existing pack/Core tests now scope their assertions to the companion rail.
- Final packaged runtime passed E2E, usability and Nia suites. The 0.3.0 portable EXE passed direct startup/bridge/onboarding/clean-exit smoke checks. Archive inspection verified version 0.3.0, the exact atlas hash and absence of private data across 4559 entries; both release executable hashes are recorded in PROJECT_STATUS.md.

The generated art contains four drawn action groups / 16 frames, reused across eight semantic states. Imported GIF playback is not controlled by the animation toggle. The installer installation flow is not executed during validation. Packaged runtime results and artifact hashes are recorded in [PROJECT_STATUS.md](PROJECT_STATUS.md).

Desktop tests require a normal Windows desktop process. The restricted execution environment crashed Electron; the same checks passed in the approved unrestricted environment. Some existing suites read real local Codex sessions, so the full harness is not entirely machine-independent. Test data and screenshots stay under `.test-data` and are excluded from Git and release archives.

## Verified before packaging

- SQLite CRUD/reopen; backups preserve unrelated records, verify content hashes and restore in one transaction; SQLite quick_check.
- Calendar validation, daily/weekly/monthly recurrence boundaries, month end, overlapping lanes and overnight segments.
- Codex explicit/stale/missing states, Unix-second timestamps, real desktop PascalCase file events; real local session listing and virtualized logs.
- Focus pause/restart/exact-once completion; native notification API and deduplication across restart.
- Real desktop onboarding, project directory import, task CRUD/completion, drag task → calendar, all three calendar views, Markdown notes/reports, image background and Avatar Pack import, light/dark appearance, command palette, global capture and persistence after restart.
- Window close hides to tray; restore returns to the same window. In v0.2 validation the user's running portable instance already owned the global shortcut; the second instance correctly logged a conflict and its in-window shortcut fallback was verified. Windows reports native notifications supported; OS-level toast visibility depends on notification/Do Not Disturb preferences.
- Zero renderer exceptions in the end-to-end path. Invalid IPC methods, invalid record states and pack path traversal rejected.

## Scope and limits

Historical v0.2 verification added two storage migration tests and a real Electron usability suite: close/escape welcome and task dialogs, leave focus without stopping the timer, Chinese/English navigation, Morning text contrast, pause Codex reads, migrate on restart while preserving notes/timer/settings and the old database. All 15 stages (including 16 unit tests) passed on 2026-09-20; these checks remain in the 0.3.0 harness.

External editor/engine/terminal launch depends on installed programs. Git inspection is read-only. No live approval/stop/retry capability is claimed for the local Codex provider. Local observations have bounded history. Task and event drag tests verify actual UI behavior, not just helper code. First-party UI is loaded locally under CSP; renderer has no Node integration.

The build is unsigned. Final installer and portable artifact hashes are recorded in PROJECT_STATUS.md and the versioned `dist/SHA256SUMS-<version>.txt`. Packaged applications are checked separately from source tests. The actual portable self-extracting executable has a startup/bridge/onboarding/clean-exit smoke test. Producing the installer does not install it into the user's system.

An additional desktop polish suite verifies task-board dragging, local backup export/preview/restore, and real-session role labels/pinning. A restore navigation issue found by this suite was fixed: only same-entry-page reloads are allowed, while external navigation remains blocked.
