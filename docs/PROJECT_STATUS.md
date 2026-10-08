> 0.4.0 is built and verified, preserving the workflow changes and remote 0.3.11 single-cel renderer, portraits and cross-machine harness. Only idle animation is visually accepted; seven non-idle sequences remain candidates. See [AGENTS.md](../AGENTS.md), [START_ON_NEW_PC.md](START_ON_NEW_PC.md) and [NIA_ANIMATION.md](NIA_ANIMATION.md).

# Project status

## Current release: 0.4.0 (2026-10-08)

Version 0.4.0 integrates the workflow implementation with remote main at `c1a7d42` (0.3.11). The combined code passed the full harness, packaged desktop journeys, portable executable smoke test and archive audit. Source release tag: `v0.4.0`. Binaries are local build artifacts under ignored `dist/`; a Git source push does not upload EXEs.

### Implemented behavior

- Notes and quick capture retain local drafts. Saving a note selects that note and clears a stale search filter. A note can create a linked task; repeating the action opens the existing task, and the task links back to its source note.
- Home gives today's work, unfinished overdue tasks and the next calendar event priority over the welcome and empty Agent areas. A user explicitly chooses “Move to today” to change a due date. Statistics no longer imply an action with nonfunctional arrows.
- Daily planning stores up to three priorities, available minutes, a workload estimate, start/close state and a reflection for each local date. The review and capacity save automatically. Deleted tasks release priority slots; closing a day does not complete or silently reschedule work.
- Focus can begin from a task or project, remains visible across pages, and supports pause/resume and restart recovery. Completed or stopped sessions credit task time once, in the same SQLite transaction as their receipt and active-state cleanup. Existing manually entered time remains; historic pre-0.4.0 receipts are not backfilled.
- Project details show linked tasks and notes, a resume action and an automatically saved “Next first step”. Writes merge the latest project record so an asynchronous inspection cannot overwrite new text.
- Quick capture offers an explicit idea/task choice and save destination. First use defaults to ideas, later use remembers the last successful type, and TODO/NOTE prefixes still take precedence.
- Task forms fold secondary fields into More options. Forms without automatic drafts protect unsaved edits, and saves prevent duplicate submissions. Calendar task scheduling starts at the next quarter-hour instead of a time already passed.
- Nia supports a saved compact preference; narrow windows reserve a small companion column instead of covering content. Remote 0.3.11 contributes seven independent 24-cel candidate sequences, decoded before playback and rendered one whole cel at a time, plus eight state portraits and a persistent animation/portrait switch. Idle source, atlas, sequence `[0,2,...,22]` and 700/115 ms timing stay protected. Core and imported Avatar Packs remain supported.
- Backups now include daily plans, note/capture drafts and the capture preference, while continuing to exclude runtime state and credentials. Verification uses isolated Codex directories and generated session fixtures.

### Integrated verification

- Before the remote merge, the workflow branch passed 35 unit tests and sixteen desktop suites. Those results apply only to its pre-merge checkpoint.
- `npm run harness` checks environment, asset contracts, units, builds and Nia desktop playback. `npm run harness -- --full` runs the broader verification, which now also includes the project contract and the four workflow suites.
- The combined `harness --full` passed on 2026-10-08: verify records 21 stages, including the project contract, builds, 35 unit tests and sixteen desktop suites. Evidence: `.test-data/verification.json`.
- Seven packaged desktop suites and actual portable startup/bridge/onboarding/exit passed; report: `.test-data/packaged-verification.json`. The installer was built but not installed through its wizard.
- Archive audit checked 4,585 entries and matched all 45 application source/build files. Report: `.test-data/release-audit.json`. No application database, personal sessions or test data shipped. Recognized previous top-level generated release files were removed only after the new archive passed audit.

| Current artifact                         |     Bytes | SHA-256                                                            |
| ---------------------------------------- | --------: | ------------------------------------------------------------------ |
| `dist/NexusCompanion-Portable-0.4.0.exe` | 143694619 | `441927dd11c0517d3657e21a834a50d77915787971f7d400a4fbad7f39f93a2b` |
| `dist/NexusCompanion-Setup-0.4.0.exe`    | 143904561 | `189003b3c2c2f992f9ae753fc714732f1a76e5bdb7ead85e0f06cc60ac38d128` |

Release notes: [RELEASE_0.4.0.md](RELEASE_0.4.0.md). Verification scope and limitations: [VERIFICATION.md](VERIFICATION.md). Checksums: `dist/SHA256SUMS-0.4.0.txt`.

## Previously released: 0.3.1 (2026-09-21)

These are historical release results:

- Delivered Ideas & notes navigation, homepage View ideas, navigation after saving and one sidebar focus entry, retaining 0.3.0 Nia animation support.
- Its 16 verification stages passed: 20 unit tests, 12 desktop suites and builds. Its packaged runtime passed E2E, usability and Nia checks; the portable executable passed startup and clean-exit checks. The installer was built but not installed into the user's system.
- Its ASAR audit found no user database, sessions, test data or credentials. These checks apply to the old release only.

| Historical artifact                      |     Bytes | SHA-256                                                            |
| ---------------------------------------- | --------: | ------------------------------------------------------------------ |
| `dist/NexusCompanion-Portable-0.3.1.exe` | 102519885 | `4959046e11168e07c098375e22bf0ffd9c85344c19fb1c33a1a9e5e4571f2283` |
| `dist/NexusCompanion-Setup-0.3.1.exe`    | 102729857 | `709f0f735c63ee9bc3876864fb57845de5373eb0a7dce8fe035227aee4ec0ad5` |

The hashes above are historical provenance, not an assertion that old binaries remain in `dist`. Packaging retains current-version output and removes only recognized older generated release files.

## Remote 0.3.11 provenance

The merged remote documentation records its own core/full harness, portable and packaged Nia checks, and private-source upload authorization. It introduced the whole-cel renderer, predecode/first-frame handling, state portraits, protected idle contract and cross-machine scripts. Its installer was built but not installed through the wizard. These are historical checks, not post-merge 0.4.0 results or visual acceptance of the new art.

## Known limitations

- Codex observations come from local files; they cannot guarantee live cross-process state or support stop, retry, approvals or sending prompts. Authentication remains in official Codex products.
- English covers primary controls, while some detailed help and backend diagnostics remain Chinese.
- Only idle artwork has user visual acceptance. Earlier non-idle face atlases were rejected and remain historical archives; the seven current 24-cel sequences still await acceptance. Source hashes, anchor metrics, frame counts, build success and uploading source cannot certify facial quality. Imported GIF motion is independent of the built-in animation toggle. Preview states do not imply live observability of every Agent event.
- Single-occurrence calendar exceptions, Live2D/Spine, external calendars, configurable dashboard widgets and owned App Server session management are not implemented.
- Project deletion does not cascade or unlink all related entities. VS Code discovery still checks default installation locations rather than all custom installations.
- No Windows signing certificate has been supplied. OS notification preferences and Do Not Disturb can suppress actual toast visibility.
- `extract-zip` retains an upstream development-dependency audit advisory. It is not a runtime dependency; build archive extraction remains subject to the official hash check.
- New source features and authored tests require the current run's runtime verification; they are not release-completion claims.

## Reference

- Developer rules and cross-machine harness: `AGENTS.md`, `docs/START_ON_NEW_PC.md`
- Usage: `docs/USER_GUIDE.md`
- Developer handoff: `docs/DEVELOPMENT_HANDOFF.md`
- Current release notes: `docs/RELEASE_0.4.0.md`
- Animation and assets: `docs/NIA_ANIMATION.md`
- Architecture: `docs/ARCHITECTURE.md`
- Verification: `docs/VERIFICATION.md`
- Open-source research: `docs/OPEN_SOURCE_RESEARCH.md`
- Remote animation provenance: `docs/RELEASE_0.3.11.md`

Art review resources: `docs/NIA_REVIEW.html` supports pausing and comparing candidate cels. Numeric checks reported in the remote release history describe their measured sample only; the combined product still needs runtime verification and separate user visual acceptance.
