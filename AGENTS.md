# Nexus Companion repository rules

This file is versioned with the project. Read it before making changes on any machine. User instructions in the current task take precedence.

## Product boundaries

- Windows Electron desktop app. Local SQLite is the source of truth. Codex integration reads local session records; do not present it as account login or live session control.
- Keep user data isolated during development with NEXUS_DATA_DIR under .test-data. Do not test against the real user database.
- Preserve existing records, settings, backup format and imported Avatar Packs when changing UI or assets.

## Protected source material

- res/Nia.png is the user's Nia character design reference. It is project input, not generated output. Never delete, overwrite, rename or clean res/ automatically.
- res/Nia.png and public/assets/nia/calm.png remain protected references. The older art/nia-source/ sheets are preserved for provenance but are not the current animation inputs.
- ONLY `art/nia-classic-frames/idle/` and `public/assets/nia/animations/idle.png` are user-accepted Nia animation artwork. Preserve all 24 idle source cels, the idle atlas hash, frame order [0,2,...,22], first duration 700ms and remaining durations 115ms exactly. Older non-idle face atlases were rejected, including 0.3.9's even frames; they are not approved references or current runtime inputs.
- Seven non-idle states have independent 24-cel sequences, pending user visual acceptance. Sources: `art/nia-state-hires/pages/`, individual cels: `art/nia-state-hires/frames/`, runtime: `public/assets/nia/animations-hires/`. Use `scripts/prepare-nia-states.py` to crop and uniformly register whole cels. Never patch faces, warp regions, interpolate poses, cross-fade, or repeatedly resample an already transformed cel. Idle remains untouched.
- The new generation prompts and provenance are saved in `art/nia-state-hires/prompts.json`; hashes/registration are in its manifest. Source-grid counts and anchor metrics do NOT certify face quality or visual acceptance. Inspect all cels and page joins at display size. Preserve the single-cel renderer and load/decode before advancing the timeline.
- `art/nia-reference-manifest.json` pins only the accepted idle animation's source-cel and atlas hashes, plus protected original input hashes for `res/Nia.png`, `public/assets/nia/calm.png` and `art/nia-source/`. Seven current non-idle candidate sequences have their separate `art/nia-state-hires/manifest.json`. Never substitute hashing or fixed-anchor tests for visual acceptance; only idle is accepted.
- `scripts/build-nia-24.py` packs only the idle full-frame PNGs by default. Do not reintroduce rejected face-patching or interpolated derivatives from Git history. Do not recursively delete workspace directories. Releases follow the user's authorization in the current session.
- Cleanup authorization (2026-10-08): the user requested removal of old-version clutter. Remove only the confirmed 175 obsolete derived PNGs: 24 numbered cels in each of `art/nia-classic-frames/{working,thinking,happy,warning,error,sleepy,celebrate}/` and the seven matching `public/assets/nia/animations/<state>.png` files. Their provenance remains in Git history; they need not be retained or required by the current contract. This authorization does not include the protected originals, accepted idle, current hires pages/frames/manifests, portraits, user data or the active fallback `public/assets/nia.png`.
- `art/nia-portraits/` holds eight full-body state portraits based on `res/Nia.png`; production copies live at `public/assets/nia/portraits/`. Preserve correct two-arm/two-leg anatomy and the protected character reference. The upper-right display switch persists `avatarDisplay` as animation or portrait; custom packs and Core remain supported.
- State triggers, durations and loop policy live in `src/domain/avatar.ts`. Continuous idle/working/thinking/sleepy states loop; completion/alert reactions play once and hold. Honor reduced motion and hidden-window pause. Desktop tests check all 24 preserved cels, curated playback, stable anchor, transparent edges, all eight portraits, the mode switch and persistence.
- Inspect generated frames and portraits visually in addition to automated checks. Do not copy third-party art. Never equate uploading source or a prerelease with visual acceptance.

## Development harness

1. Inspect git status and package version. Do not reset or delete user changes.
2. Run npm ci when dependencies are missing or dependency entries in the lockfile changed. A version-only update does not require reinstalling dependencies. Use Node 24+ on Windows.
3. Run npm run harness for environment, asset contracts, unit tests, build and Nia desktop checks. Run npm run harness -- --full for the broader desktop suite before a release. Use isolated Codex directories and controlled session fixtures; real personal sessions are not test fixtures.
4. Package with npm run package. It builds the current Windows installer and portable executable, updates companion documents under dist/docs and SHA256SUMS, audits archive/source agreement, then removes recognized old Nexus versioned files and replaced flat documentation from dist after success.
5. Run npm run verify:packaged for the packaged desktop journeys and the actual portable EXE smoke check. The installer must not be described as installed unless it was actually installed and checked.
6. Update docs/USER_GUIDE.md, docs/NIA_ANIMATION.md, docs/PROJECT_STATUS.md and the current release note when behavior changes.

## Release and cleanup

- Dist is ignored by Git. GitHub source push does not include EXEs; upload them as private Release assets only when requested or previously authorized.
- Keep only the current version's installer, portable EXE, blockmap, checksum and matching companion docs in dist. Never recursively delete dist or any workspace directory.
- Keep current release documentation in docs; historical release notes and removed derivatives remain available through Git tags. Do not claim old test results validate a new build.
- Before deletion, list exact targets and verify they are known generated files inside dist. Never treat an untracked directory as disposable just because Git does not track it.
