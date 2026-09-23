# Nexus Companion repository rules

This file is versioned with the project. Read it before making changes on any machine. User instructions in the current task take precedence.

## Product boundaries

- Windows Electron desktop app. Local SQLite is the source of truth. Codex integration reads local session records; do not present it as account login or live session control.
- Keep user data isolated during development with NEXUS_DATA_DIR under .test-data. Do not test against the real user database.
- Preserve existing records, settings, backup format and imported Avatar Packs when changing UI or assets.

## Protected source material

- res/Nia.png is the user's Nia character design reference. It is project input, not generated output. Never delete, overwrite, rename or clean res/ automatically.
- public/assets/nia/animations contains the eight production Nia sheets. Each sheet is transparent RGBA, 1448x1086, 4 columns by 3 rows, 362x362 per frame. Each state has 12 authored cells.
- Render one sprite cell at a time. Do not blend two cells, repeat a cell inside a 12-frame sequence, or fake character deformation with CSS. CSS may handle layout and positioning.
- State triggers, durations and loop policy live in src/domain/avatar.ts. Continuous idle/working/thinking/sleepy states loop; completion/alert reactions play once and hold. Honor reduced motion and hidden-window pause.
- If replacing sheets, compare with res/Nia.png and the existing atlas, verify common character identity and baseline, then inspect desktop screenshots in both themes. Do not copy third-party art.

## Development harness

1. Inspect git status and package version. Do not reset or delete user changes.
2. Run npm ci when dependencies are missing or the lockfile changed. Use Node 24+ on Windows.
3. Run npm run harness for environment, asset contracts, unit tests, build and Nia desktop checks. Run npm run verify for the broader desktop suite before a release; some integration suites need real local Codex records and must report that dependency honestly.
4. Package with npm run package. It removes only recognized old Nexus versioned files from dist, builds the current Windows installer and portable executable, and writes SHA256SUMS for the current version.
5. Run node tests/portable.cjs against the new EXE. The installer must not be described as installed unless it was actually installed and checked.
6. Update docs/USER_GUIDE.md, docs/NIA_ANIMATION.md, docs/PROJECT_STATUS.md and the current release note when behavior changes.

## Release and cleanup

- Dist is ignored by Git. GitHub source push does not include EXEs; upload them as private Release assets only when requested or previously authorized.
- Keep only the current version's installer, portable EXE, blockmap, checksum and matching companion docs in dist. Never recursively delete dist or any workspace directory.
- Historical source release notes may remain in docs for provenance. Do not claim old test results validate a new build.
- Before deletion, list exact targets and verify they are known generated files inside dist. Never treat an untracked directory as disposable just because Git does not track it.
