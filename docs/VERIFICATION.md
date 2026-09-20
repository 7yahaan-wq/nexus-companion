# Verification

## Harness

`npm run doctor` checks Node, pinned Electron runtime, assets and lockfile. `npm run verify` builds, runs all domain tests, then launches real Electron windows through Playwright for milestones 1–8 and the full user journey. Every test uses isolated data directories. Reports: `.test-data/verification.json`.

## Verified before packaging

- SQLite CRUD/reopen; backups preserve unrelated records, verify content hashes and restore in one transaction; SQLite quick_check.
- Calendar validation, daily/weekly/monthly recurrence boundaries, month end, overlapping lanes and overnight segments.
- Codex explicit/stale/missing states, Unix-second timestamps, real desktop PascalCase file events; real local session listing and virtualized logs.
- Focus pause/restart/exact-once completion; native notification API and deduplication across restart.
- Real desktop onboarding, project directory import, task CRUD/completion, drag task → calendar, all three calendar views, Markdown notes/reports, image background and Avatar Pack import, light/dark appearance, command palette, global capture and persistence after restart.
- Window close hides to tray; restore returns to the same window. In v0.2 validation the user's running portable instance already owned the global shortcut; the second instance correctly logged a conflict and its in-window shortcut fallback was verified. Windows reports native notifications supported; OS-level toast visibility depends on notification/Do Not Disturb preferences.
- Zero renderer exceptions in the end-to-end path. Invalid IPC methods, invalid record states and pack path traversal rejected.

## Scope and limits

v0.2 adds two storage migration tests and a real Electron usability suite: close/escape welcome and task dialogs, leave focus without stopping the timer, Chinese/English navigation, Morning text contrast, pause Codex reads, migrate on restart while preserving notes/timer/settings and the old database. `npm run verify` passed all 15 harness stages (including 16 unit tests) on 2026-09-20.

External editor/engine/terminal launch depends on installed programs. Git inspection is read-only. No live approval/stop/retry capability is claimed for the local Codex provider. Local observations have bounded history. Task and event drag tests verify actual UI behavior, not just helper code. First-party UI is loaded locally under CSP; renderer has no Node integration.

The build is unsigned. Final installer and portable artifact hashes are recorded in PROJECT_STATUS.md / dist/SHA256SUMS.txt. The packaged application passed the full E2E test. The actual portable self-extracting executable passed startup/bridge/onboarding/clean-exit smoke verification. The installer was produced without installing it into the user's system.

An additional desktop polish suite verifies task-board dragging, local backup export/preview/restore, and real-session role labels/pinning. A restore navigation issue found by this suite was fixed: only same-entry-page reloads are allowed, while external navigation remains blocked.
