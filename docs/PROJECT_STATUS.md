# Project status

## Current release 0.5.5 (2026-11-07)

This release refines the laptop and small robot in Nia’s warning and celebration reactions. Both can be replayed in the settings preview.

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

Warning and celebration each use their 24 original full cels. The source pages and durations are preserved. The changed ordering and whole-cel registration target the transition between slots 11 and 12 (zero-based). Only idle has user visual acceptance. [Local art and review workflow](NIA_ANIMATION.md)

An independent reviewer watched the two reactions at the 255-pixel sidebar size. Warning B and celebration A were selected before unblinding. Both were 0.5.5. The measurements below refer to the visible page join, with values in sidebar pixels.

| Visible movement at the join | Warning, 0.5.4 → 0.5.5 | Celebration, 0.5.4 → 0.5.5 |
| --- | --- | --- |
| Laptop left edge | 1.69 → 1.41 | 2.11 → 1.41 |
| Laptop right edge | 1.13 → 1.13 | 1.83 → 1.13 |
| Robot left shell edge | 1.55 → 0.70 | 1.27 → 0.42 |
| Top of the hair | 0.70 → 0.70 | 0.70 → 0.70 |

The warning antenna texture still flickers slightly. The celebration robot still dips by about two sidebar pixels. These observations remain available for the user's visual review.

A separate check measures the 362-pixel source cels. Across all 23 adjacent transitions of each revised reaction, the maximum horizontal change at either laptop edge is one source pixel on the scanline at y=297 (alpha above 180). At the single page join, the two-dimensional displacement of the blue robot shell's centroid fell from 0.870 to 0.122 source pixels in warning and from 2.917 to 2.096 in celebration. The centroid measures a different feature from the visible left edge in the table.

## Current verification

- The 0.5.5 full source Harness executed 27 stages and reused zero. All 100 unit tests passed. The desktop Nia regression checks both props throughout the two reactions.
- The two trials supplied all 48 cels and both atlases to the production export. Their bytes and hashes matched. Isolated trials rejected altered registration inputs, damaged output and out-of-range offsets while preserving the destination. Zero vertical offset retained eligibility for the existing raster cache.

- The release audit matched all 40 expected files to the packaged application and checked 4,580 archive entries. The packaged Harness executed all 14 stages and reused zero. The portable EXE started, reached the SQLite bridge and exited with code 0. Installer verification covered the built file and its checksum.

### Windows artifacts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `NexusCompanion-Portable-0.5.5.exe` | 137,606,518 | `e70f492683cbac3fc87cfdf60bb39c06a4a00960229780aab7a28e51c32b7ee8` |
| `NexusCompanion-Setup-0.5.5.exe` | 137,816,610 | `12b86bd72a876d9adf3c1abfb01aefcde6b6154a4d07b22e9eda1b727a5b290c` |

The verified rollback is 0.5.4. The local before/after animation is retained at `.test-data/props-055/nia-props-comparison.webp`.

### Cleanup

After verification, this round removed 120 files totaling 303,382,981 bytes (289.33 MiB) and 16 empty trial directories.

| Removed files | Count | Bytes |
| --- | ---: | ---: |
| Warning trial | 36 | 7,343,379 |
| Celebration art trials | 36 | 6,452,657 |
| Isolated export checks | 33 | 5,869,381 |
| Temporary user-review media | 5 | 2,205,989 |
| Old atlas copies and temporary blind-review tools | 5 | 5,901,233 |
| Superseded 0.5.3 distribution | 5 | 275,610,342 |

Intermediate review media were cleaned up. The real-time before/after animation, compact measurements, verification logs and isolated data remain available, along with the complete 0.5.4 rollback bundle.

## Known limits and next candidates

- Local Codex observations have bounded history and cannot guarantee real-time state, stop/retry, approvals or prompt delivery. Owned App Server sessions would require a separate design.
- Seven candidate animations still need visual acceptance. Frame counts, hashes, anchor metrics and source uploads cannot establish facial quality. Imported GIF motion is independent of the built-in animation toggle.
- Calendar single-occurrence exceptions, external calendars, configurable dashboard widgets and Live2D/Spine are not implemented. Daily calendar capacity summaries remain a future candidate.
- Project deletion does not cascade or unlink all related entities. VS Code discovery checks default installation locations and may miss custom installs. Task movement is now transactional; broader targeted background refresh remains a candidate.
- Reflection drafts whose saves fail are retryable on Home; leaving the page before a successful save is not a draft-recovery guarantee. Report priority labels use current task names, not historical name snapshots.
- Markdown soft line breaks in a reflection render as a paragraph; copy/export preserve the exact multiline text. Some detailed help and backend diagnostics remain Chinese. Settings navigation can be simplified without removing useful controls.
- Windows executables are unsigned. OS notification settings can suppress toasts. The development-only `extract-zip` dependency retains an upstream advisory; Electron archives are checked against the official hash before extraction.

See [USER_GUIDE.md](USER_GUIDE.md), [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md), [START_ON_NEW_PC.md](START_ON_NEW_PC.md), [VERIFICATION.md](VERIFICATION.md), [RELEASE_0.5.5.md](RELEASE_0.5.5.md) and [NIA_ANIMATION.md](NIA_ANIMATION.md). The source-only frame-inspection tool is `docs/NIA_REVIEW.html`; open it from a source checkout with its `public/` artwork, not from the packaged documentation.
