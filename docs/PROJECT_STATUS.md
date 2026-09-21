# Project status

## Current release: 0.3.0 (2026-09-21)

- Delivered homepage inspiration capture, a transparent 16-frame Nia atlas with four drawn action groups mapped to eight states, expression previews, persistent animation settings, reduced-motion support and hidden-window pause/resume. Old failures no longer hold Nia in an error state indefinitely.
- All 16 verification stages passed: 20 unit tests and 12 desktop suites, plus builds. Doctor and source formatting checks passed. Reports: `.test-data/verification.json` and `.test-data/release-verification.json`.
- The packaged 0.3.0 runtime passed complete E2E, usability and Nia suites. The actual portable executable passed self-extract, startup, bridge, onboarding and clean-exit smoke tests. The installer was built but was not installed into the user's system.
- ASAR audit: 4559 entries; no user database, sessions, test data or credentials bundled. Packaged version is 0.3.0, and the atlas matches the source SHA-256 `4f4c00192f430d729777e34ed4b627091805935b4c508734619a2c030123bf6b`.
- Visual review covered the homepage, idle/typing/thinking/sleepy poses, light/dark themes and the minimum-width English layout. Research and asset provenance are documented in OPEN_SOURCE_RESEARCH.md and NIA_ANIMATION.md.

## Release artifacts

| Artifact                                 |     Bytes | SHA-256                                                            |
| ---------------------------------------- | --------: | ------------------------------------------------------------------ |
| `dist/NexusCompanion-Portable-0.3.0.exe` | 102519979 | `d9e1c3f7230a85d5544aeb0e6af401a15138350198140971e199fdbea96d0945` |
| `dist/NexusCompanion-Setup-0.3.0.exe`    | 102729923 | `89d05f315ddf1b63c0115d9e626b3865b3a9f5f18ad5c7714fc8b7f0d6ee61e7` |

Companion files: `dist/README.md`, `dist/RELEASE_0.3.0.md`, `dist/RELEASE_STATUS.md`, `dist/USER_GUIDE.md` and `dist/SHA256SUMS-0.3.0.txt`. Source and tests remain in the workspace. All tests use isolated local data directories. Prior 0.2.0 artifacts are retained separately.

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
- Release notes: `docs/RELEASE_0.3.0.md`
- Animation and assets: `docs/NIA_ANIMATION.md`
- Architecture: `docs/ARCHITECTURE.md`
- Verification: `docs/VERIFICATION.md`
- Open-source research: `docs/OPEN_SOURCE_RESEARCH.md`
