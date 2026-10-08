# Project status

## Current release: 0.4.1 (2026-10-08)

This maintenance release removes redundant old release documents, screenshots and unused derived artwork while preserving the complete idea-to-focus workflow. The full harness, current package audit and packaged application journeys passed after cleanup. The evidence below belongs to this 0.4.1 build.

Source is private at [7yahaan-wq/nexus-companion](https://github.com/7yahaan-wq/nexus-companion). Generated EXEs live in ignored `dist/`; pushing source does not upload release binaries.

## Current product

- Notes and quick capture keep local drafts across closing and restart. Saving selects the note and clears stale filters, including when renaming the selected note. Ideas create linked tasks without duplicates; tasks link back to their source.
- Home prioritizes today's work, unfinished overdue tasks and the next calendar event. Daily plans hold up to three priorities, available minutes and a saved reflection. Rescheduling and task completion remain explicit actions.
- Focus starts from tasks or projects and remains visible across pages. Pause/restart recovery, exact-once time credit and manual-time edit receipts protect task totals. Older completed sessions are not backfilled.
- Projects show linked tasks and notes, a resume action and an automatically saved next step. Task forms keep secondary fields under More options and protect unsaved edits. Calendar task scheduling defaults to the next quarter-hour.
- Nia supports compact layout, single-cel playback, eight state portraits and a persistent animation/portrait switch. Only idle animation has user visual acceptance; seven non-idle sequences remain candidates. Core and imported Avatar Packs remain supported.
- Backups include daily plans, drafts and capture preferences. Runtime state and credentials stay excluded. Codex integration observes local files and does not control live sessions.

## Cleanup boundaries

Keep the user reference `res/Nia.png`, `public/assets/nia/calm.png`, original `art/nia-source/` sheets, accepted idle sources/atlas, current hires candidate sources/frames/manifests and all current portraits. Remove only the enumerated unused derivatives and obsolete documentation approved for this cleanup; user databases, imported assets and backups are outside its scope.

Current development instructions, functional tests and release harness stay in place. Historical changes remain discoverable through Git rather than duplicate release notes in the current documentation tree. Release documentation uses `dist/README.md`, `dist/AGENTS.md` and a single current `dist/docs/` directory.

The enumerated cleanup removed 5,833 files (441,085,128 bytes), including 175 inactive derivatives, 20 obsolete source documents/screenshots, 20 duplicate distribution documents, 5,595 older generated test files and 23 obsolete analysis files. After the new archive audit passed, packaging removed five old 0.4.0 release artifacts (287,754,732 bytes). These are deleted-file totals; new binaries and current test evidence also occupy disk space. The current portable EXE is 6,082,451 bytes smaller than 0.4.0.

## Current verification

| Check                                                 | Status / evidence                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Documentation references and protected asset contract | Passed; original inputs, idle and current resources retained                                              |
| `npm run harness -- --full`                           | Passed: 37 unit tests, 21 verify stages including 16 desktop suites; `.test-data/verification.json`       |
| `npm run package` and archive/source audit            | Passed: 38 application source files match, 4,578 archive entries checked; `.test-data/release-audit.json` |
| `npm run verify:packaged`                             | Passed: seven desktop suites and actual portable EXE; `.test-data/packaged-verification.json`             |
| Installer wizard                                      | Not installed or tested by the packaging command                                                          |

The first full run timed out during native mouse task-to-calendar drag. The unchanged E2E case, final full harness and packaged E2E subsequently passed. The first-run record remains locally at `.test-data/verification-first-run-0.4.1.json`; this intermittent test result should be retained for future harness diagnosis.

| Artifact                            |       Bytes | SHA-256                                                            |
| ----------------------------------- | ----------: | ------------------------------------------------------------------ |
| `NexusCompanion-Portable-0.4.1.exe` | 137,612,168 | `cb4bd86bcbe0d08bcc2e6021cd6a689efca39bbd2aba70505654b7c60190318b` |
| `NexusCompanion-Setup-0.4.1.exe`    | 137,822,138 | `85f487a73a6be897bb611cf9983050b4c15cc713f3abad29d842302b04010bcf` |

Both files are in `dist/`; checksums are also recorded in `dist/SHA256SUMS-0.4.1.txt`. Seven unused atlases are absent from the rebuilt archive, which contains no application databases, personal sessions or test data.

## Known limits and next candidates

- Local Codex observations have bounded history and cannot guarantee real-time state, stop/retry, approvals or prompt delivery. Owned App Server sessions would require a separate design.
- Seven candidate animations still need visual acceptance. Frame counts, hashes, anchor metrics and source uploads cannot establish facial quality. Imported GIF motion is independent of the built-in animation toggle.
- Calendar single-occurrence exceptions, external calendars, configurable dashboard widgets and Live2D/Spine are not implemented. Current-time scrolling in the calendar and clearer Agent empty states remain useful UX candidates.
- Project deletion does not cascade or unlink all related entities. VS Code discovery checks default installation locations and may miss custom installs. Batched task sorting and targeted background refresh are further development candidates.
- Some detailed help and backend diagnostics remain Chinese. Settings navigation can be simplified without removing useful controls.
- Windows executables are unsigned. OS notification settings can suppress toasts. The development-only `extract-zip` dependency retains an upstream advisory; Electron archives are checked against the official hash before extraction.

See [USER_GUIDE.md](USER_GUIDE.md), [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md), [START_ON_NEW_PC.md](START_ON_NEW_PC.md), [VERIFICATION.md](VERIFICATION.md), [RELEASE_0.4.1.md](RELEASE_0.4.1.md) and [NIA_ANIMATION.md](NIA_ANIMATION.md). The source-only frame-inspection tool is `docs/NIA_REVIEW.html`; open it from a source checkout with its `public/` artwork, not from the packaged documentation.
