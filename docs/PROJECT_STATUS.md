# Project status

## Current release: 0.5.2 (2026-10-24)

This release improves daily task creation, retained filters, accessible status changes and atomic board moves. The current source harness, archive audit, packaged desktop journeys and actual portable EXE checks have passed.

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

An independent agent used isolated multi-project fixtures and native mouse dragging. It reproduced project-filtered creation hiding the new task, task/idea round trips losing all filters, automatic-sort dragging changing the hidden manual order without visual feedback, and filtered moves creating duplicate manual order values. Evidence is local under `.test-data/ux-review-20261024-round2/`. The observed hidden tasks retained their relative order; no data loss was established by this baseline.

Two paths were selected before implementation: filtered task work and reliable task movement. A read-only review then identified explicit capture navigation and committed-move/list-refresh failure boundaries; both were added to the fixed regression. Acceptance is documented in [DEVELOPMENT_LOOP.md](DEVELOPMENT_LOOP.md). Existing regression assertions remain intact; the Harness coverage assertion adds the new tasks-flow suite.

## Current verification

| Check                     | Status / evidence                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Full source Harness       | Passed: 87 unit tests; all 26 stages including 20 desktop suites; .test-data/verification.json                             |
| Resume                    | Executed 26, reused 0: version/source changes invalidated old passes; current run passed first try                         |
| Independent review        | UI navigation, failure/retry, strict move validation and transaction reviewed                                              |
| Package/archive audit     | Passed: 40 application files match the ASAR; 4,580 archive entries inspected; .test-data/release-audit.json                |
| Packaged desktop/portable | Passed: all 13 stages executed, including 11 desktop suites and actual portable EXE; .test-data/packaged-verification.json |
| Installer wizard          | Not installed or checked                                                                                                   |

Baseline 0.5.1 reports are retained under `.test-data/iteration-2026-10-24-round2/baseline-0.5.1-*`. This release retains the existing conservative dependency fingerprints, fixed bounds and explicit --resume behavior. It does not treat changed sources or a new version as already verified.

Current Windows x64 artifacts were built and checked on 2026-10-24 (Asia/Shanghai). Final SHA-256 values also appear in `dist/SHA256SUMS-0.5.2.txt`:

| Artifact                          |     Bytes | SHA-256                                                            |
| --------------------------------- | --------: | ------------------------------------------------------------------ |
| NexusCompanion-Portable-0.5.2.exe | 137625443 | `2114ce0864e5543694bfaea612ceef1437c00b9c91bc00ec2be60010d7889cfd` |
| NexusCompanion-Setup-0.5.2.exe    | 137835407 | `d31760a8469789e9e15df8581e7cea0ad7f6be8ca500638e34cd471ff9952fd4` |

## Known limits and next candidates

- Local Codex observations have bounded history and cannot guarantee real-time state, stop/retry, approvals or prompt delivery. Owned App Server sessions would require a separate design.
- Seven candidate animations still need visual acceptance. Frame counts, hashes, anchor metrics and source uploads cannot establish facial quality. Imported GIF motion is independent of the built-in animation toggle.
- Calendar single-occurrence exceptions, external calendars, configurable dashboard widgets and Live2D/Spine are not implemented. Daily calendar capacity summaries remain a future candidate.
- Project deletion does not cascade or unlink all related entities. VS Code discovery checks default installation locations and may miss custom installs. Task movement is now transactional; broader targeted background refresh remains a candidate.
- Daily reflections are saved but not yet included in the generated daily report. Project details show a limited recent task list without a dedicated show-all action. Both remain future candidates.
- Some detailed help and backend diagnostics remain Chinese. Settings navigation can be simplified without removing useful controls.
- Windows executables are unsigned. OS notification settings can suppress toasts. The development-only `extract-zip` dependency retains an upstream advisory; Electron archives are checked against the official hash before extraction.

See [USER_GUIDE.md](USER_GUIDE.md), [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md), [START_ON_NEW_PC.md](START_ON_NEW_PC.md), [VERIFICATION.md](VERIFICATION.md), [RELEASE_0.5.2.md](RELEASE_0.5.2.md) and [NIA_ANIMATION.md](NIA_ANIMATION.md). The source-only frame-inspection tool is `docs/NIA_REVIEW.html`; open it from a source checkout with its `public/` artwork, not from the packaged documentation.
