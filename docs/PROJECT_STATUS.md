# Project status

## Current release: 0.2.0 (2026-09-20)

- Delivered six feedback areas: selectable data location with restart migration, dismissible dialogs and focus return, persisted language setting with Chinese navigation/statuses, Morning contrast fixes, visible read-only Codex connection settings, and research-driven data/connection usability improvements.
- All 15 verification stages passed: 16 unit tests and 11 desktop suites, plus builds. The running user portable app owned the global shortcut; conflict logging and in-window fallback were verified without stopping that instance.
- Final packaged runtime passed usability and complete E2E suites. Actual portable 0.2.0 passed self-extract/startup/bridge/onboarding/clean-exit smoke test. Installer was built, not installed into the user's system.
- ASAR audit: 4557 entries; no user database, sessions, test-data or credentials bundled.
- Installer: `dist/NexusCompanion-Setup-0.2.0.exe`, 97797650 bytes, SHA256 `de6c1f848047a4f690778b84e7fda0834d099381c2bcebad8a64307fd4b50910`.
- Portable: `dist/NexusCompanion-Portable-0.2.0.exe`, 97587541 bytes, SHA256 `c117acb40c9c02a007256cb6761933de29bcf8f9dda4dc3e7d817ee1ceb07a64`.
- Remaining boundaries: no integrated account login or live Codex task control; English covers primary UI but some help remains Chinese; packages remain unsigned. See RELEASE_0.2.0.md.

## Previous release: 0.1.0

## Completed
- Environment inspected; architecture and integration boundaries selected.
- M1 passed: TypeScript/Vite build, SQLite persistence test, real Electron launch/navigation/theme persistence. Screenshot: `.test-data/m1-desktop.png`.
- M2 passed: project creation and directory validation, task create/edit/complete with SQLite persistence, accessible form labels. Desktop test: `tests/m2.cjs`.
- M3 passed: recurrence/month-end validation tests and real Electron Month/Week/Day event rendering. Screenshot: `.test-data/m3-calendar.png`.
- M4 passed: 20 real local Codex sessions discovered; detail logs render; unsupported stop/retry disabled. Parser tests verify stale observations and unavailable directories. Screenshot: `.test-data/m4-agents.png`.
- M5 passed: real note creation/Markdown rendering, timeline and report generation in Electron; report date/runtime tests.
- M6 passed: Nia image loaded, avatar menu and renderer switching verified in Electron; appearance and safe pack import implemented. Screenshot: `.test-data/m6-avatar.png`.
- M7 passed: quick-capture keyboard flow, global entity search, focus start/pause/stop persistence in Electron. Focus unit test covers restart and exact-once completion.
- M8 passed on Electron 39.8.10 (SHA-256 verified): global shortcut registered, window close hides to tray, restore works, Windows Notification reports supported. Deduplication/restart tests pass. Codex parsing moved to worker.

## In progress
- None for the delivered local-first v0.1.0 release.

## Latest verification
- M9 passed: 14 unit tests and 9 desktop suites. Actual task-to-calendar drag, onboarding, background/pack import, report export, restart persistence, no renderer exceptions.
- GitHub research implemented: role labels/pinning, focus refresh, checksummed local backup and transactional restore. Sources documented in OPEN_SOURCE_RESEARCH.md.
- Real-data fixes: Unix-second timestamps normalized, repeated thread rollouts deduplicated, PascalCase file-change events supported. Current local discovery: 18 unique sessions.
- Additional desktop suite passed: task-board drag, backup export/preview/restore, real-session role labels and pinning. Total: 14 domain/storage tests and 10 desktop suites.
- M10 complete: NSIS installer + portable produced with Electron 39.8.10. App icon/version metadata applied; code signing intentionally absent (no certificate supplied).
- Final packaged `win-unpacked/Nexus Companion.exe` passed the complete E2E flow, including restart persistence and zero renderer errors.
- Actual `NexusCompanion-Portable-0.1.0.exe` launched from its self-extracting package, rendered onboarding/bridge and exited with code 0. Screenshot: `.test-data/portable-smoke.png`.
- ASAR contents audited: no test-data directory, auth.json, session_index or user SQLite databases bundled.

## Final artifacts
| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `dist/NexusCompanion-Portable-0.1.0.exe` | 97582587 | `d4f78af1f586c61122811fca2be938cd2e20a050a756c8c56b40e6dd3628c085` |
| `dist/NexusCompanion-Setup-0.1.0.exe` | 97792565 | `ecff73ba3153b538b61b72e21f6a0eb67d576173d4f1391770aed05cbd9b2546` |

Companion files: `dist/README.md`, `dist/SHA256SUMS.txt`. Source and tests remain in the workspace. All tests use isolated local data directories.

## Next
- Optional second phase: owned App Server session management, single-occurrence calendar exceptions, Live2D/Spine and external calendars. These are not presented as supported in v0.1.0.

## Known limitations
- Codex local observations cannot guarantee cross-process live state or support stop/retry.
- Windows signing certificate is not supplied.
- Installer was built and its packaged runtime tested, but no unattended installation was performed into the user's system. Portable exe was directly executed and verified.
- Windows notification API support/calls tested; OS Do Not Disturb and notification preferences determine actual toast visibility.
- `extract-zip` remains an upstream development-dependency audit advisory; only verified official-hash archives are extracted. It is not a runtime application dependency.
