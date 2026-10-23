# Project status

## Current release: 0.5.1 (2026-10-24)

This release improves recovery from empty Agent results, calendar navigation to the current time, and bounded resumable verification. The current source harness, archive audit, packaged desktop journeys and actual portable EXE checks have passed.

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

## Independent experience and selected improvements

An independent agent exercised the application with isolated data and reproduced generic empty-state feedback, midnight calendar entry at 21:17, and past-time event defaults. The baseline report and screenshots are local under `.test-data/ux-review-20261023/`. One stale screenshot was excluded from visual evidence; the baseline DOM geometry and other screenshots establish the calendar issue.

Two user paths were selected before implementation: Agent recovery and calendar current-time navigation. Acceptance is fixed in [DEVELOPMENT_LOOP.md](DEVELOPMENT_LOOP.md); implementation does not change existing regression assertions. Official pinned source references and adaptation rationale are in [OPEN_SOURCE_RESEARCH.md](OPEN_SOURCE_RESEARCH.md).

## Current verification

| Check                     | Status / evidence                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Full source Harness       | Passed: 79 unit tests, 25 stages including 19 desktop suites; .test-data/verification.json                                 |
| Actual resume             | Passed: executed 5, reused 20; original successful timestamps/logs retained                                                |
| Independent review        | Product interactions, cache failure protection and optional environment inputs reviewed                                    |
| Package/archive audit     | Passed: 40 application files match the ASAR; 4,580 archive entries inspected; .test-data/release-audit.json                |
| Packaged desktop/portable | Passed: all 12 stages executed, including 10 desktop suites and actual portable EXE; .test-data/packaged-verification.json |
| Installer wizard          | Not installed or checked                                                                                                   |

The first current-executor source run stopped at the existing workflow's dialog-readiness race. A diagnostic trace established that its original wait could precede native dialog opening. Synchronization was strengthened without removing assertions; resume kept 20 unaffected passes and completed the remaining stages. Initial failure evidence is retained in .test-data/verification-initial-0.5.1.json.

An earlier real resume exposed the volatile CODEX_TOOL_CALL_ID fingerprint issue. The exact invocation metadata is now removed from the child environment; other environment values remain validated. Separate real npm invocations demonstrated one executed probe followed by zero executed and one reused. Cache entries from old executor versions were not migrated.

Current Windows x64 artifacts were built and checked on 2026-10-24 (Asia/Shanghai). Final SHA-256 values also appear in `dist/SHA256SUMS-0.5.1.txt`:

| Artifact                          |     Bytes | SHA-256                                                            |
| --------------------------------- | --------: | ------------------------------------------------------------------ |
| NexusCompanion-Portable-0.5.1.exe | 137625927 | `040fd9b8d790425fe75f1590891a2ce2eb4855424fbcc33bf76ebff581b88c38` |
| NexusCompanion-Setup-0.5.1.exe    | 137835895 | `19630debb0b3fe571f4e9a64b6291e09df54da9164180819a0c0e8529e990ee9` |

## Known limits and next candidates

- Local Codex observations have bounded history and cannot guarantee real-time state, stop/retry, approvals or prompt delivery. Owned App Server sessions would require a separate design.
- Seven candidate animations still need visual acceptance. Frame counts, hashes, anchor metrics and source uploads cannot establish facial quality. Imported GIF motion is independent of the built-in animation toggle.
- Calendar single-occurrence exceptions, external calendars, configurable dashboard widgets and Live2D/Spine are not implemented. Daily calendar capacity summaries remain a future candidate.
- Project deletion does not cascade or unlink all related entities. VS Code discovery checks default installation locations and may miss custom installs. Batched task sorting and targeted background refresh are further development candidates.
- Some detailed help and backend diagnostics remain Chinese. Settings navigation can be simplified without removing useful controls.
- Windows executables are unsigned. OS notification settings can suppress toasts. The development-only `extract-zip` dependency retains an upstream advisory; Electron archives are checked against the official hash before extraction.

See [USER_GUIDE.md](USER_GUIDE.md), [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md), [START_ON_NEW_PC.md](START_ON_NEW_PC.md), [VERIFICATION.md](VERIFICATION.md), [RELEASE_0.5.1.md](RELEASE_0.5.1.md) and [NIA_ANIMATION.md](NIA_ANIMATION.md). The source-only frame-inspection tool is `docs/NIA_REVIEW.html`; open it from a source checkout with its `public/` artwork, not from the packaged documentation.
