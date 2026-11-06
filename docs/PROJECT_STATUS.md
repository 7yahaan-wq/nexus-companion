# Project status

## Current release 0.5.4 (2026-11-07)

This release revises three Nia animation candidates for daily use. Use the settings preview to watch the working loop, warning reaction and celebration at their actual display size.

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

## Animation review

Each of the three revised actions uses all 24 of its original full cels. The six source pages are unchanged. The working loop now lasts 4,748 ms (previously 3,520 ms), with its six closed-eye cels visible for 220 ms in total (previously 660 ms).

Across the transition from playback positions 11 to 12 (zero-based), the top of the visible artwork moved 10 pixels in the old warning and celebration atlases. In the new warning atlas the top moves from y=29 to 30, and in celebration from y=30 to 29. These measurements use the original 362-pixel cel and alpha above 140. They measure a specific jump. Visual review also covers expression, the working loop boundary and the final held poses of the two reactions. Only idle has user visual acceptance. [Local source and review workflow](NIA_ANIMATION.md)

An independent reviewer compared anonymized old and new sequences at 255 pixels. They selected B for working, B for warning and A for celebration. All three choices were 0.5.4 after unblinding. The observed working blink lasted about 219 ms (formerly 663 ms). The warning and celebration head-top jumps measured about 0.7 screen pixels each (formerly 7). The reviewer still saw a 1–2-pixel shift at the laptop edges and small robot in both reactions, and a brief change in the mouth and eye line at celebration frame 10. These details remain open for user review.

## Current verification

- The full source Harness passed in one run on 0.5.4. It executed 27 stages and reused zero. All 100 unit tests passed.
- Repeating the selected-state art export reused all three states after verifying their inputs and output hashes. It skipped rendering 72 cels and three runtime atlases.
- The release audit matched 40 source files to the packaged application and inspected 4,580 archive entries. On the packaged Windows desktop app reporting 0.5.4, an independent user walkthrough saw all three 24-cel atlases at 2,172 × 1,448 pixels. The measured blink was 225 ms over a 4.74-second working cycle. Warning and celebration each held the last cel during an additional 850 ms of observation. The walkthrough recorded no page errors.
- The packaged Harness passed all 14 stages. It executed 14 and reused zero. The actual portable EXE reached its SQLite bridge and exited with code 0. The installer was built and hashed. The installer wizard was not run.

### Windows artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `NexusCompanion-Portable-0.5.4.exe` | 137,641,530 | `82f38b1ace941d980dbfd012c148f718c26329c83e1a992c633d88898d6ef5ec` |
| `NexusCompanion-Setup-0.5.4.exe` | 137,851,501 | `2095da979ea0d16209ffa06841715dc8dc9b93b521ba1e74cc65527d74b69798` |

`dist/` retains the current 0.5.4 release and the verified 0.5.3 rollback.

### Cleanup

After verification, this round removed 29 files totaling 297,564,017 bytes (283.78 MiB). Twelve intermediate images and one-off scripts from the anonymized walkthrough accounted for 12,371,979 bytes. Twelve baseline boards, old atlas copies and temporary comparison pages/keys accounted for 9,582,611 bytes. Five obsolete 0.5.2 release files, including its executables and release note, accounted for 275,609,427 bytes. The intermediate review media have been cleaned up.

The compact before/after comparison remains at `.test-data/nia-art-20261107/art-comparison.jpg` in the local workspace. The source review page, isolated databases, fixtures and verification logs are retained, along with both 0.5.3 executables, matching release files and three rollback verification records.

## Known limits and next candidates

- Local Codex observations have bounded history and cannot guarantee real-time state, stop/retry, approvals or prompt delivery. Owned App Server sessions would require a separate design.
- Seven candidate animations still need visual acceptance. Frame counts, hashes, anchor metrics and source uploads cannot establish facial quality. Imported GIF motion is independent of the built-in animation toggle.
- Calendar single-occurrence exceptions, external calendars, configurable dashboard widgets and Live2D/Spine are not implemented. Daily calendar capacity summaries remain a future candidate.
- Project deletion does not cascade or unlink all related entities. VS Code discovery checks default installation locations and may miss custom installs. Task movement is now transactional; broader targeted background refresh remains a candidate.
- Reflection drafts whose saves fail are retryable on Home; leaving the page before a successful save is not a draft-recovery guarantee. Report priority labels use current task names, not historical name snapshots.
- Markdown soft line breaks in a reflection render as a paragraph; copy/export preserve the exact multiline text. Some detailed help and backend diagnostics remain Chinese. Settings navigation can be simplified without removing useful controls.
- Windows executables are unsigned. OS notification settings can suppress toasts. The development-only `extract-zip` dependency retains an upstream advisory; Electron archives are checked against the official hash before extraction.

See [USER_GUIDE.md](USER_GUIDE.md), [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md), [START_ON_NEW_PC.md](START_ON_NEW_PC.md), [VERIFICATION.md](VERIFICATION.md), [RELEASE_0.5.4.md](RELEASE_0.5.4.md) and [NIA_ANIMATION.md](NIA_ANIMATION.md). The source-only frame-inspection tool is `docs/NIA_REVIEW.html`; open it from a source checkout with its `public/` artwork, not from the packaged documentation.
