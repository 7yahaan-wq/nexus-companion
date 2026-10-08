# Project status

## Current development: 0.4.0 (2026-10-08)

The source version is now 0.4.0, continuing from the previously released v0.3.1. The main agent is running the full verification harness. Release packaging, final checksums and Git publication must be recorded after that verification; changing the version does not itself mean a release is complete.

### Implemented behavior

- Notes and quick capture retain local drafts. Saving a note selects that note and clears a stale search filter. A note can create a linked task; repeating the action opens the existing task, and the task links back to its source note.
- Home gives today's work, unfinished overdue tasks and the next calendar event priority over the welcome and empty Agent areas. A user explicitly chooses “Move to today” to change a due date. Statistics no longer imply an action with nonfunctional arrows.
- Daily planning stores up to three priorities, available minutes, a workload estimate, start/close state and a reflection for each local date. The review and capacity save automatically. Deleted tasks release priority slots; closing a day does not complete or silently reschedule work.
- Focus can begin from a task or project, remains visible across pages, and supports pause/resume and restart recovery. Completed or stopped sessions credit task time once, in the same SQLite transaction as their receipt and active-state cleanup. Existing manually entered time remains; historic pre-0.4.0 receipts are not backfilled.
- Project details show linked tasks and notes, a resume action and an automatically saved “Next first step”. Writes merge the latest project record so an asynchronous inspection cannot overwrite new text.
- Quick capture offers an explicit idea/task choice and save destination. First use defaults to ideas, later use remembers the last successful type, and TODO/NOTE prefixes still take precedence.
- Task forms fold secondary fields into More options. Forms without automatic drafts protect unsaved edits, and saves prevent duplicate submissions. Calendar task scheduling starts at the next quarter-hour instead of a time already passed.
- Nia supports a saved compact preference; narrow windows reserve a small companion column instead of covering page content. Existing animation states remain available.
- Backups now include daily plans, note/capture drafts and the capture preference, while continuing to exclude runtime state and credentials. Verification uses isolated Codex directories and generated session fixtures.

### Verification in progress

- The current harness schedules three build stages, unit tests and sixteen desktop suites, including notes-flow, focus-flow, planning-flow and workflow.
- The main agent is investigating an E2E calendar drag failure. The full 0.4.0 suite is **not yet recorded as passing**.
- Once corrections are complete, rebuild and rerun affected suites, then perform packaged-runtime, portable, visual and distribution checks as applicable. Do not reuse the historical 0.3.1 results below as evidence for the current code.
- Final evidence belongs in `docs/VERIFICATION.md`, `.test-data/verification.json` and the release-specific report. No 0.4.0 artifact hash is asserted here while that work is in progress.

## Previously released: 0.3.1 (2026-09-21)

These are historical release results:

- Delivered Ideas & notes navigation, homepage View ideas, navigation after saving and one sidebar focus entry, retaining 0.3.0 Nia animation support.
- Its 16 verification stages passed: 20 unit tests, 12 desktop suites and builds. Its packaged runtime passed E2E, usability and Nia checks; the portable executable passed startup and clean-exit checks. The installer was built but not installed into the user's system.
- Its ASAR audit found no user database, sessions, test data or credentials. These checks apply to the old release only.

| Historical artifact                      |     Bytes | SHA-256                                                            |
| ---------------------------------------- | --------: | ------------------------------------------------------------------ |
| `dist/NexusCompanion-Portable-0.3.1.exe` | 102519885 | `4959046e11168e07c098375e22bf0ffd9c85344c19fb1c33a1a9e5e4571f2283` |
| `dist/NexusCompanion-Setup-0.3.1.exe`    | 102729857 | `709f0f735c63ee9bc3876864fb57845de5373eb0a7dce8fe035227aee4ec0ad5` |

Prior release artifacts remain separate from the current source and test evidence.

## Known limitations

- Codex observations come from local files; they cannot guarantee live cross-process state or support stop, retry, approvals or sending prompts. Authentication remains in official Codex products.
- English covers primary controls, while some detailed help and backend diagnostics remain Chinese.
- Four drawn Nia action groups serve eight semantic states. Imported GIF motion is independent of the built-in animation toggle. Preview states do not imply that the local provider can observe every corresponding Agent event.
- Single-occurrence calendar exceptions, Live2D/Spine, external calendars, configurable dashboard widgets and owned App Server session management are not implemented.
- Project deletion does not cascade or unlink all related entities. VS Code discovery still checks default installation locations rather than all custom installations.
- No Windows signing certificate has been supplied. OS notification preferences and Do Not Disturb can suppress actual toast visibility.
- `extract-zip` retains an upstream development-dependency audit advisory. It is not a runtime dependency; build archive extraction remains subject to the official hash check.
- New source features and authored tests require the current run's runtime verification; they are not release-completion claims.

## Documentation

- Usage: `docs/USER_GUIDE.md`
- Developer handoff: `docs/DEVELOPMENT_HANDOFF.md`
- Current release notes: `docs/RELEASE_0.4.0.md`
- Animation and assets: `docs/NIA_ANIMATION.md`
- Architecture: `docs/ARCHITECTURE.md`
- Verification: `docs/VERIFICATION.md`
- Open-source research: `docs/OPEN_SOURCE_RESEARCH.md`
