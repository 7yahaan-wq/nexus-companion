> 0.3.11 当前状态：悠闲保持原样，其余七种状态改为独立 24 帧表情动画；图集预解码和首帧切换修复。旧版本中“全部共用 idle”的说明已被本次实现替代。当前源码已获用户授权上传私有 GitHub；Nia 新美术仍待人工验收。跨机器开发见 [START_ON_NEW_PC.md](START_ON_NEW_PC.md)，本次体验检查见 [UX_REVIEW_2026-09-24.md](UX_REVIEW_2026-09-24.md)。

# Project status

## Current local build: 0.3.11, awaiting user acceptance

Idle artwork, frame order and timing are unchanged. Seven independent 24-cel expression sequences replace the shared-idle workaround. Sources, prompts and registration manifest live in `art/nia-state-hires`. Playback starts from the first cel and waits for decoded sheets. No facial patches, morphing or frame blending.

Core harness and full verify passed: 20 unit tests and all desktop suites. The actual 0.3.11 portable EXE passed isolated startup/exit. The packaged Windows app passed the Nia suite, including independent sheet binding, relative sharpness, transparent borders, weighted anchor drift, first-frame switching, reduced motion and hidden-window pause. The installer was built but not installed through its wizard. The user subsequently authorized a private GitHub upload; visual acceptance remains pending.

Local builds: `dist/NexusCompanion-Setup-0.3.11.exe` and `dist/NexusCompanion-Portable-0.3.11.exe`; checksums in `dist/SHA256SUMS-0.3.11.txt`. Recognized 0.3.10 release files were removed by the package script. Historical rejected sources remain inactive. Visual acceptance is still pending; numerical alignment does not certify every head/hair stroke.

## Known boundaries

- Codex integration reads local sessions. It does not log into accounts or control another app's live sessions.
- Some local records do not expose STARTING, WAITING or WAITING_APPROVAL; previewing those moods does not imply live approval support.
- Imported GIF motion is independent of the built-in Nia animation toggle.
- Single-occurrence calendar exceptions, Live2D/Spine, external calendars and owned App Server session management are not implemented.
- Installer binaries are unsigned. OS notification preferences determine toast visibility.

## Reference

- Developer rules and harness: `AGENTS.md`
- User guide: `docs/USER_GUIDE.md`
- Nia assets and animation: `docs/NIA_ANIMATION.md`
- Open-source research: `docs/OPEN_SOURCE_RESEARCH.md`
- Current release note: `docs/RELEASE_0.3.11.md`


本轮验证：harness 与完整 verify 通过（20 项单元测试及全部桌面套件）。检查了 168 张完整候选帧；定位徽标横向跨度最高 0.365px、纵向最高 1.05px（362px 原格）。这些数据不代表所有笔触完全固定。新图脸部线条指标约为悠闲的 79%–99%；人工画风验收仍待进行。可打开 docs/NIA_REVIEW.html 暂停并逐帧比较。
