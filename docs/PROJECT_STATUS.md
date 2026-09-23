# Project status

## Current local build: 0.3.3 (2026-09-23)

- Nia has eight state-specific, transparent 12-frame sprite sheets made from the project character reference res/Nia.png and prior Nia art. The renderer displays one authored frame at a time; the 0.3.2 transparent cross-fade was removed.
- The expression preview explains each state's real trigger. STARTING, WAITING and WAITING_APPROVAL remain dependent on what the local Codex files expose.
- The repository now includes AGENTS.md and npm run harness to carry product and asset rules across machines. npm run package safely removes recognized older versioned files from dist and produces the current checksums.
- Core harness and full desktop verification passed: 20 unit tests, the desktop suites, and Nia checks. The packaged 0.3.3 runtime passed Nia desktop testing. The actual portable EXE passed startup, bridge, onboarding and clean exit. The installer was built but not installed.
- Source and reference images are in the workspace. The two EXEs are local dist artifacts and have not been uploaded to GitHub.

| Current artifact                       |     Bytes | SHA-256                                                          |
| -------------------------------------- | --------: | ---------------------------------------------------------------- |
| dist/NexusCompanion-Setup-0.3.3.exe    | 121332076 | d61e3c64543226ba08af3d8793ce44359196eafd9cf7142aa2163332c631fc8d |
| dist/NexusCompanion-Portable-0.3.3.exe | 121122104 | d0e713f6f97d46b830dba86abe8b71314aba6b5512aae2a402f740125a292626 |

Only the current version's installer, portable EXE, blockmap, checksum and companion documentation remain in dist. Historical release notes in docs describe previous builds and are not current verification.

## Known boundaries

- Codex integration reads local sessions. It does not log into accounts or control another app's live sessions.
- Some local records do not expose STARTING, WAITING or WAITING_APPROVAL; previewing those moods does not imply live approval support.
- Imported GIF motion is independent of the built-in Nia animation toggle.
- Single-occurrence calendar exceptions, Live2D/Spine, external calendars and owned App Server session management are not implemented.
- Installer binaries are unsigned, and the installer itself was not installed during verification. OS notification preferences determine toast visibility.

## Reference

- Developer rules and harness: AGENTS.md
- User guide: docs/USER_GUIDE.md
- Nia assets and animation: docs/NIA_ANIMATION.md
- Open-source research: docs/OPEN_SOURCE_RESEARCH.md
- Current release note: docs/RELEASE_0.3.3.md
