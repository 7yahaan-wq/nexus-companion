# Project status

## Current release: 0.5.3 (2026-10-28)

This release connects saved daily reflections to report viewing/copy/export and projects to complete scoped task boards. Current source, packaged desktop and actual portable EXE verification have passed.

Source is private at [7yahaan-wq/nexus-companion](https://github.com/7yahaan-wq/nexus-companion). Generated EXEs live in ignored `dist/`; pushing source does not upload release binaries.

## Current product

- Notes and quick capture keep local drafts across closing and restart. Saving selects the note and clears stale filters, including when renaming the selected note. Ideas create linked tasks without duplicates; tasks link back to their source.
- Home prioritizes today's work, unfinished overdue tasks and the next calendar event. Daily plans hold up to three priorities, available minutes and a saved reflection; Home waits for the latest save before directly opening the report. Selected-date plans are included in its preview, copy and export. Rescheduling and task completion remain explicit actions.
- Focus starts from tasks or projects and remains visible across pages. Pause/restart recovery, exact-once time credit and manual-time edit receipts protect task totals. Older completed sessions are not backfilled.
- Projects show linked tasks and notes, a resume action, an automatically saved next step and a counted link to the complete project task board. Task forms keep secondary fields under More options and protect unsaved edits. Calendar task scheduling defaults to the next quarter-hour.
- Nia supports compact layout, single-cel playback, eight state portraits and a persistent animation/portrait switch. Only idle animation has user visual acceptance; seven non-idle sequences remain candidates. Core and imported Avatar Packs remain supported.
- Backups include daily plans, drafts and capture preferences. Runtime state and credentials stay excluded. Codex integration observes local files and does not control live sessions.

## Codex usage

- Cards show the latest reported session total. Details separate cumulative and latest-request counters, cached input, cache-write input, output and reasoning output. Unknown fields stay unknown; repeated observations are never added. Forked sessions are not added to their parents.
- Account quota is separate from session tokens. Each limit bucket retains its own observed time, reported window length and reset time. Expired windows remain historical snapshots until refreshed.
- Only manual buttons start the installed Codex CLI for `account/rateLimits/read` or `account/usage/read`. Queries use the selected Codex directory and its current CLI account. Nexus never reads credentials, signs in, submits prompts or controls threads. The CLI may refresh its own authentication. Results stay in renderer memory.
- Official thread Credits, when available, retain microcredit precision and model groups. A valid response without thread usage is explicitly unavailable, never zero. Installed CLI/account compatibility and service availability affect this feature.

## Independent experience and selected improvements

An independent agent reproduced two daily-use gaps on 0.5.2: saved reflection absent from preview/clipboard/export, and nine linked project tasks reduced to five without a full-list entry. Controlled baseline evidence is under .test-data/ux-review-20261028/. The independent agent then authored tests/review-navigation.cjs, covering save/read failures, two response-order races, real Markdown export and 9/0/1-task project navigation.

The static review found no new blocking defect. Its documented limit is that a failed Home reflection is retained for retry while the user remains there; this release does not claim recovery of failed drafts after switching pages or restarting. GitHub source observations and local adaptations are recorded in [OPEN_SOURCE_RESEARCH.md](OPEN_SOURCE_RESEARCH.md).

## Current verification

| Check                 | Result                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Full source Harness   | Passed: 98 unit tests, 27 stages including 21 desktop suites; .test-data/verification.json                |
| Source resume         | Final resume: executed 2 (environment, affected units), reused 25; earlier recovery executed 3, reused 24 |
| Package/archive audit | Passed: 40 source files match app.asar; 4,580 entries inspected                                           |
| Packaged verification | Passed: 14 stages including 12 desktop suites and actual portable EXE; executed 10, reused 4              |
| Installer wizard      | Built but not installed or checked                                                                        |

The first source run passed all 27 stages with 96 units. Release review then added two cleanup regressions. The first packaged run stopped at notes-flow: event traces and the controlled SQLite record proved that automatic text entry raced the editor's initial focus and typed into the title. The test now waits for initial readiness/focus; its persistence assertions are unchanged. Only affected or unfinished checks were executed on resume. Finalization now uses the audit checksum order, so refreshing companion documents preserves the exact verified checksum bytes; the final script change reran units and reused all desktop stages. This is a test synchronization correction, not a claimed product-focus fix.

The independent reviewer inspected both English/light/1060px source screenshots: no clipped or overlapping controls. Current acceptance screenshots are retained. The project image captures inspection in progress, not completed project detection. Focused security review found and then re-reviewed the same-version repackaging cleanup gate: the current report must match the agreement output fingerprint and current executable hashes.

Baseline 0.5.2 reports, first source pass, first packaged failure and diagnostic traces are retained under .test-data/iteration-2026-10-28/ and .test-data/ux-review-20261028/. All tests use controlled profiles/Codex fixtures. No real account queries or personal data were used.

Current Windows x64 artifacts (2026-10-28); matching checksum file: dist/SHA256SUMS-0.5.3.txt.

| Artifact                          |     Bytes | SHA-256                                                            |
| --------------------------------- | --------: | ------------------------------------------------------------------ |
| NexusCompanion-Portable-0.5.3.exe | 137626156 | `cc298e9237b956121c557e3af4837cee39eefb8dff6d8d8894bd8455155286c3` |
| NexusCompanion-Setup-0.5.3.exe    | 137836133 | `e68a4c3cad52399d8ab8fe5eec7d76e71c62b07691d6d13302f51da5c6f4ca66` |

## Cleanup and rollback

Cleanup completed: 3 reviewed baseline screenshots, 1 duplicate controlled export and 1 obsolete source release note removed (5 files, 1,169,147 bytes). Baseline reports explicitly say “媒体已清理”; text, current acceptance media and failure traces remain. The old release note remains in tag v0.5.2 and the rollback companion bundle. Distribution preview/apply found 0 additional obsolete release files. Keep current 0.5.3 and the verified 0.5.2 rollback bundle, including its matching checksum and companion release note. Current verification logs/outputs, test databases/fixtures, dependency/toolchain caches, artwork and the user's pre-existing AGENTS.md edit are protected.

## Known limits and next candidates

- Local Codex observations have bounded history and cannot guarantee real-time state, stop/retry, approvals or prompt delivery. Owned App Server sessions would require a separate design.
- Seven candidate animations still need visual acceptance. Frame counts, hashes, anchor metrics and source uploads cannot establish facial quality. Imported GIF motion is independent of the built-in animation toggle.
- Calendar single-occurrence exceptions, external calendars, configurable dashboard widgets and Live2D/Spine are not implemented. Daily calendar capacity summaries remain a future candidate.
- Project deletion does not cascade or unlink all related entities. VS Code discovery checks default installation locations and may miss custom installs. Task movement is now transactional; broader targeted background refresh remains a candidate.
- Reflection drafts whose saves fail are retryable on Home; leaving the page before a successful save is not a draft-recovery guarantee. Report priority labels use current task names, not historical name snapshots.
- Markdown soft line breaks in a reflection render as a paragraph; copy/export preserve the exact multiline text. Some detailed help and backend diagnostics remain Chinese. Settings navigation can be simplified without removing useful controls.
- Windows executables are unsigned. OS notification settings can suppress toasts. The development-only `extract-zip` dependency retains an upstream advisory; Electron archives are checked against the official hash before extraction.

See [USER_GUIDE.md](USER_GUIDE.md), [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md), [START_ON_NEW_PC.md](START_ON_NEW_PC.md), [VERIFICATION.md](VERIFICATION.md), [RELEASE_0.5.3.md](RELEASE_0.5.3.md) and [NIA_ANIMATION.md](NIA_ANIMATION.md). The source-only frame-inspection tool is `docs/NIA_REVIEW.html`; open it from a source checkout with its `public/` artwork, not from the packaged documentation.
