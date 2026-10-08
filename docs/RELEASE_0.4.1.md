# Nexus Companion 0.4.1

日期：2026-10-08。此次为清理维护版本，保留现有产品功能和数据兼容性。

## 清理范围

- 移除旧版发布说明、已被当前说明替代的实施计划、历史体验报告与截图，开发过程可通过 Git 标签查阅。
- 移除不参与当前播放器的旧非 idle classic 衍生帧和图集，以及逐项确认的旧生成物；不以目录未跟踪为删除依据。
- 发布说明统一为 `dist/README.md`、`dist/AGENTS.md` 与 `dist/docs/`，清理根目录重复副本和旧文档副本。
- 当前文档集中说明真实功能、源码入口、机器工具链、验证方式、未来候选和开源参考，避免旧版结论与当前状态混淆。

## 保留的功能和材料

灵感/快速记录草稿、保存定位、灵感转任务及来源链接、每日三件事和收工回顾、项目下一步、任务日程安排、跨页专注及实际用时联动均继续保留。备份继续包含每日计划与草稿，并排除运行状态和凭据。当前功能 harness 与源码/打包版回归入口继续使用。

保护 `res/Nia.png`、`public/assets/nia/calm.png`、`art/nia-source/`、accepted idle 源格/图集/序列/时长。当前 hires 候选源页、独立帧、提示词、manifest、运行图集和八状态立绘保留。单格预解码播放、动画/立绘选择、紧凑栏、Core 和自定义 Avatar Pack 不变。

只有 idle 已获用户视觉接受，七组非 idle 动画仍是候选；清理、测试和上传均不代表它们获得视觉接受。用户数据库、导入资产、个人备份与 Codex 会话不在清理范围。

## 验证与分发

清理后的完整 harness 已通过：37 项单元测试、21 个 verify 阶段（含 16 组桌面回归）；七组打包桌面流程及实际便携 EXE 验收通过。包内 38 个应用文件与源码一致，4,578 条归档项完成审计，七张旧图集未进入新包。便携版比 0.4.0 小 6,082,451 字节。实际状态、首次拖放超时记录和哈希见 [PROJECT_STATUS.md](PROJECT_STATUS.md)，范围见 [VERIFICATION.md](VERIFICATION.md)。

当前 `dist/` 提供 `NexusCompanion-Setup-0.4.1.exe`、`NexusCompanion-Portable-0.4.1.exe` 和 `SHA256SUMS-0.4.1.txt`，旧 0.4.0 产物已清理。安装器构建不等于已执行安装向导；安装文件未签名，上传 Release 资源按当前用户授权执行。

操作说明见 [USER_GUIDE.md](USER_GUIDE.md)，继续开发见 [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md) 和 [START_ON_NEW_PC.md](START_ON_NEW_PC.md)。
