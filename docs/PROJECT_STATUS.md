# Project status

## Current release: 0.2.0 (2026-09-20)

- Delivered selectable data location with restart migration, dismissible dialogs and focus return, a persisted language setting with Chinese navigation/statuses, Morning contrast fixes, visible read-only Codex connection settings, and research-driven data/connection usability improvements.
- All 15 verification stages passed: 16 unit tests and 11 desktop suites, plus builds. A running portable instance owned the global shortcut during validation; conflict logging and the in-window fallback were verified without stopping it.
- The final packaged runtime passed the usability and complete E2E suites. The actual portable 0.2.0 executable passed self-extract, startup, bridge, onboarding and clean-exit smoke tests. The installer was built but was not installed into the user's system.
- ASAR audit: 4557 entries; no user database, sessions, test data or credentials bundled.

## Release artifacts

| Artifact                                 |    Bytes | SHA-256                                                            |
| ---------------------------------------- | -------: | ------------------------------------------------------------------ |
| `dist/NexusCompanion-Portable-0.2.0.exe` | 97587541 | `c117acb40c9c02a007256cb6761933de29bcf8f9dda4dc3e7d817ee1ceb07a64` |
| `dist/NexusCompanion-Setup-0.2.0.exe`    | 97797650 | `de6c1f848047a4f690778b84e7fda0834d099381c2bcebad8a64307fd4b50910` |

Companion files: `dist/README.md`, `dist/RELEASE_0.2.0.md`, `dist/RELEASE_STATUS.md`, `dist/USER_GUIDE.md` and `dist/SHA256SUMS-0.2.0.txt`. Source and tests remain in the workspace. All tests use isolated local data directories.

## Known limitations

- Codex local observations cannot guarantee cross-process live state or support stop/retry.
- Nexus does not provide an integrated account login; authentication remains in the official Codex app, CLI or IDE extension.
- English covers the primary UI, while some detailed help remains Chinese.
- Single-occurrence calendar exceptions, Live2D/Spine, external calendars and owned App Server session management are not implemented.
- A Windows signing certificate has not been supplied.
- The installer was built and its packaged runtime tested, but no unattended installation was performed. The portable executable was directly executed and verified.
- Windows notification API support/calls were tested; OS Do Not Disturb and notification preferences determine actual toast visibility.
- `extract-zip` retains an upstream development-dependency audit advisory. It is not a runtime application dependency, and the build script only extracts Electron archives that match the official hash.

## Documentation

- User documentation: `docs/USER_GUIDE.md`
- Release notes: `docs/RELEASE_0.2.0.md`
- Architecture: `docs/ARCHITECTURE.md`
- Verification: `docs/VERIFICATION.md`
- Open-source research: `docs/OPEN_SOURCE_RESEARCH.md`
