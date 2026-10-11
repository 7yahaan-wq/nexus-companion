# Project status

## Current release: 0.5.0 (2026-10-11)

This release adds local Codex session token details, separate account plan quota snapshots and explicit read-only official CLI queries. A task's estimated Credits are not subscription percentage points or dollar billing. The full harness, archive/source audit and packaged application checks passed for this 0.5.0 build.

Source is private at [7yahaan-wq/nexus-companion](https://github.com/7yahaan-wq/nexus-companion). Generated EXEs live in ignored `dist/`; pushing source does not upload release binaries.

## Current product

- Notes and quick capture keep local drafts across closing and restart. Saving selects the note and clears stale filters, including when renaming the selected note. Ideas create linked tasks without duplicates; tasks link back to their source.
- Home prioritizes today's work, unfinished overdue tasks and the next calendar event. Daily plans hold up to three priorities, available minutes and a saved reflection. Rescheduling and task completion remain explicit actions.
- Focus starts from tasks or projects and remains visible across pages. Pause/restart recovery, exact-once time credit and manual-time edit receipts protect task totals. Older completed sessions are not backfilled.
- Projects show linked tasks and notes, a resume action and an automatically saved next step. Task forms keep secondary fields under More options and protect unsaved edits. Calendar task scheduling defaults to the next quarter-hour.
- Nia supports compact layout, single-cel playback, eight state portraits and a persistent animation/portrait switch. Only idle animation has user visual acceptance; seven non-idle sequences remain candidates. Core and imported Avatar Packs remain supported.
- Backups include daily plans, drafts and capture preferences. Runtime state and credentials stay excluded. Codex integration observes local files and does not control live sessions.

## Codex usage

- Cards show the latest reported session total. Details separate cumulative and latest-request counters, cached input, cache-write input, output and reasoning output. Unknown fields stay unknown; repeated observations are never added. Forked sessions are not added to their parents.
- Account quota is separate from session tokens. Each limit bucket retains its own observed time, reported window length and reset time. Expired windows remain historical snapshots until refreshed.
- Only manual buttons start the installed Codex CLI for `account/rateLimits/read` or `account/usage/read`. Queries use the selected Codex directory and its current CLI account. Nexus never reads credentials, signs in, submits prompts or controls threads. The CLI may refresh its own authentication. Results stay in renderer memory.
- Official thread Credits, when available, retain microcredit precision and model groups. A valid response without thread usage is explicitly unavailable, never zero. Installed CLI/account compatibility and service availability affect this feature.
- An actual read-only check on this machine returned current plan quota successfully. Its latest local session had no official task estimate. No personal account data is used as a test fixture or committed.

## Current verification

| Check                                      | Status / evidence                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Protected assets and project contract      | Passed; original inputs, accepted idle and current candidate resources retained                            |
| `npm run harness -- --full`                | Passed: 63 unit tests, 22 verify stages including 17 desktop suites; `.test-data/verification.json`        |
| `npm run package` and archive/source audit | Passed: 40 application files match, 4,580 archive entries checked; `.test-data/release-audit.json`         |
| `npm run verify:packaged`                  | Passed: eight desktop suites and actual portable EXE, nine stages; `.test-data/packaged-verification.json` |
| Documentation links                        | Passed: 51 local links resolve                                                                             |
| Installer wizard                           | Not installed or tested by the packaging command                                                           |

The complete source harness and packaged verification passed on their first 0.5.0 runs. The new agent-usage journey includes direct IPC validation, paused-connection rejection and connection-generation response isolation. Chinese and narrow English screenshots were visually inspected. The independent review's CLI stream-lifecycle issue was fixed with five regression tests before these runs.

| Artifact                            |       Bytes | SHA-256                                                            |
| ----------------------------------- | ----------: | ------------------------------------------------------------------ |
| `NexusCompanion-Portable-0.5.0.exe` | 137,620,718 | `a7d57722669a147e884556a72b829266b6bab07fc31d9066948200aa8cb101c3` |
| `NexusCompanion-Setup-0.5.0.exe`    | 137,830,659 | `2d9c53ea090a5c572b7b5d5a879afd7b62f43667008beedc3ebe4f8736689fef` |

Files and matching checksums are in `dist/`, including `SHA256SUMS-0.5.0.txt`. Five recognized 0.4.1 release artifacts/documents were removed only after the new archive audit passed. No private database, personal session or test data is included in the archive. Source, installer and portable versions are all 0.5.0.

## Known limits and next candidates

- Local Codex observations have bounded history and cannot guarantee real-time state, stop/retry, approvals or prompt delivery. Owned App Server sessions would require a separate design.
- Seven candidate animations still need visual acceptance. Frame counts, hashes, anchor metrics and source uploads cannot establish facial quality. Imported GIF motion is independent of the built-in animation toggle.
- Calendar single-occurrence exceptions, external calendars, configurable dashboard widgets and Live2D/Spine are not implemented. Current-time scrolling in the calendar and clearer Agent empty states remain useful UX candidates.
- Project deletion does not cascade or unlink all related entities. VS Code discovery checks default installation locations and may miss custom installs. Batched task sorting and targeted background refresh are further development candidates.
- Some detailed help and backend diagnostics remain Chinese. Settings navigation can be simplified without removing useful controls.
- Windows executables are unsigned. OS notification settings can suppress toasts. The development-only `extract-zip` dependency retains an upstream advisory; Electron archives are checked against the official hash before extraction.

See [USER_GUIDE.md](USER_GUIDE.md), [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md), [START_ON_NEW_PC.md](START_ON_NEW_PC.md), [VERIFICATION.md](VERIFICATION.md), [RELEASE_0.5.0.md](RELEASE_0.5.0.md) and [NIA_ANIMATION.md](NIA_ANIMATION.md). The source-only frame-inspection tool is `docs/NIA_REVIEW.html`; open it from a source checkout with its `public/` artwork, not from the packaged documentation.
