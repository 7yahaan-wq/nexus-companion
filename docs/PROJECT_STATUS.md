# Project status

## Current release: 0.3.1 (2026-09-21)

- Delivered clear inspiration discovery: renamed Ideas & notes navigation, homepage View ideas, automatic navigation after saving, and a single sidebar focus entry. The 0.3.0 Nia animations and settings remain available.
- All 16 verification stages passed: 20 unit tests and 12 desktop suites, plus builds. Doctor and source formatting checks passed. Reports: `.test-data/verification.json` and `.test-data/release-verification.json`.
- The packaged 0.3.1 runtime passed complete E2E, usability and Nia suites. The actual portable executable passed self-extract, startup, bridge, onboarding and clean-exit smoke tests. The installer was built but was not installed into the user's system.
- ASAR audit: 4559 entries; no user database, sessions, test data or credentials bundled. Packaged version is 0.3.1, and the atlas matches the source SHA-256 `4f4c00192f430d729777e34ed4b627091805935b4c508734619a2c030123bf6b`.
- Visual review covered the new homepage entries, renamed notes navigation, removed right-side focus button, and light/dark minimum-width English layout. Research and asset provenance are documented in OPEN_SOURCE_RESEARCH.md and NIA_ANIMATION.md.

## Release artifacts

| Artifact                                 |     Bytes | SHA-256                                                            |
| ---------------------------------------- | --------: | ------------------------------------------------------------------ |
| `dist/NexusCompanion-Portable-0.3.1.exe` | 102519885 | `4959046e11168e07c098375e22bf0ffd9c85344c19fb1c33a1a9e5e4571f2283` |
| `dist/NexusCompanion-Setup-0.3.1.exe`    | 102729857 | `709f0f735c63ee9bc3876864fb57845de5373eb0a7dce8fe035227aee4ec0ad5` |

Companion files: `dist/README.md`, `dist/RELEASE_0.3.1.md`, `dist/RELEASE_STATUS.md`, `dist/USER_GUIDE.md` and `dist/SHA256SUMS-0.3.1.txt`. Source and tests remain in the workspace. All tests use isolated local data directories. Prior 0.2.0 and 0.3.0 artifacts are retained separately.

## Known limitations

- Codex local observations cannot guarantee cross-process live state or support stop/retry.
- Nexus does not provide an integrated account login; authentication remains in the official Codex app, CLI or IDE extension.
- English covers the primary UI, while some detailed help remains Chinese.
- Four drawn action groups are reused across eight semantic states. Imported GIF animation is independent of the character animation toggle. Current local Codex records do not guarantee STARTING/WAITING/WAITING_APPROVAL observations; these states can be previewed without claiming live approval support.
- Single-occurrence calendar exceptions, Live2D/Spine, external calendars and owned App Server session management are not implemented.
- A Windows signing certificate has not been supplied.
- The installer was built and its packaged runtime tested, but no unattended installation was performed. The portable executable was directly executed and verified.
- Windows notification API support/calls were tested; OS Do Not Disturb and notification preferences determine actual toast visibility.
- `extract-zip` retains an upstream development-dependency audit advisory. It is not a runtime application dependency, and the build script only extracts Electron archives that match the official hash.

## Documentation

- User documentation: `docs/USER_GUIDE.md`
- Release notes: `docs/RELEASE_0.3.1.md`
- Animation and assets: `docs/NIA_ANIMATION.md`
- Architecture: `docs/ARCHITECTURE.md`
- Verification: `docs/VERIFICATION.md`
- Open-source research: `docs/OPEN_SOURCE_RESEARCH.md`
