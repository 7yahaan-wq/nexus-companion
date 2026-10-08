# 同类开源项目学习与落地

研究日期：2026-09-20。来源为项目官方 GitHub 仓库及文档。以下为设计学习；未复制其源代码或素材。

| 来源                                                                                                 | 可学习的设计                                                                          | Nexus 落地                                                                        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [CodexMonitor](https://github.com/Dimillian/CodexMonitor)                                            | 多工作区会话管理、置顶和窗口聚焦时刷新；区分历史 CLI 会话与当前 app-server 的流式状态 | 会话去重、Unix 秒/毫秒标准化、置顶、返回窗口刷新、Provider 能力提示、用户角色标注 |
| [Super Productivity](https://github.com/super-productivity/super-productivity/blob/master/README.md) | Timeboxing、时间记录、工作汇总和用户控制的数据备份                                    | 可恢复的专注计时、任务拖入日历、完成后休息提醒、SHA-256 本地备份与事务恢复        |
| [AionUi assistant guide](https://github.com/iOfficeAI/AionUi/wiki/Assistant-Configuration-Guide)     | Assistant 的展示名称/角色与 backend agent 分离                                        | 会话的 Programmer/QA/Art 等角色是用户标注，不把猜测当作真实 Provider 信息         |

## 不直接照搬的内容

本产品首版保持本地只读监控和个人工作管理，不增加账号、远程守护进程、云同步或自动执行代码。CodexMonitor 的独立 app-server 可以管理其自身线程；这不证明可以直接观测另一个桌面进程的所有实时状态。

## Harness

## v0.2 用户反馈改进

再次查阅 [Super Productivity 用户数据文档](https://github.com/super-productivity/super-productivity/blob/master/docs/wiki/3.06-User-Data.md)，借鉴可定位的数据目录与明确的备份恢复入口：新增用户选择数据目录、重启迁移、目标冲突拒绝与原目录保留。借鉴 [CodexMonitor](https://github.com/Dimillian/CodexMonitor) 对工作区/连接状态的明确区分，新增独立连接设置，显示来源路径、扫描结果与暂停读取操作。

依据 [官方认证文档](https://developers.openai.com/codex/auth)，账号登录在官方 Codex 中完成（CLI 可使用 `codex login`）。Nexus 的本地只读适配器不读取凭据、不代表账号登录、不支持实时控制。界面提供官方登录说明入口，避免将发现会话记录误报为已登录。

此次还增加可持久化语言选项、中文导航/任务状态/日历视图、语义化浅色配色、专注返回按钮、Esc 和点击外部关闭交互。新增桌面 usability 验收覆盖数据迁移、专注离页、弹窗关闭、主题对比度、语言切换和连接暂停。

`npm run verify` 执行 TypeScript/Vite 构建、领域/存储单元测试和 Electron 桌面验收。所有测试使用独立 `.test-data` 目录，不写用户正式数据。`npm run doctor` 输出环境和构建前置检查。每次发现的数据格式错误加入回归样例；测试不会使用伪造 Agent 作为产品数据。

## v0.3 角色动画与主页入口（2026-09-21）

查阅了以下项目的一手源码和文档，借鉴组织方式，未复制代码或角色素材：

| 来源                                                                                                                                                     | 实际学习点                                             | Nexus 落地                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| [VS Code Pets 状态实现](https://github.com/tonybaloney/vscode-pets/blob/main/src/panel/states.ts)                                                        | 状态与 spriteLabel、holdTime、nextFrame 等渲染节奏分开 | 独立的状态解析、每状态帧序列和时长；可测试的过期状态规则；设置页主动预览   |
| [eSheep sprite sheet 文档](https://adrianotiger.github.io/desktopPet/2019/07/02/sprite-sheets.html) / [仓库](https://github.com/Adrianotiger/desktopPet) | 用透明图集组织帧动画，通过不同帧表达动作               | 自有 Nia 16 帧图集、每帧位置与轮廓、定时播放；窗口隐藏与减少动态效果时暂停 |

主页「记录灵感」沿用现有笔记编辑与保存流程。八种状态并不对应八组独立绘制动作：开心和庆祝复用笑脸帧，提醒和错误复用思考帧，见 [素材与动作说明](NIA_ANIMATION.md)。新增四项状态/素材单测和 Nia 桌面套件，覆盖保存、重启、帧推进、暂停、主题和布局。

## v0.4 工作流（2026-10-08）

- 查阅 [Super Productivity Task Attributes](https://github.com/super-productivity/super-productivity/wiki/4.09-Task-Attributes) 与 [First Steps](https://github.com/super-productivity/super-productivity/wiki/1.01-First-Steps)，采用任务与实际用时联动、先简后繁的表单、每日负荷估算思路；根据 Nexus 的单库架构实现自己的事务和去重机制。
- 查阅 [Joplin Note History](https://joplinapp.org/help/apps/note_history/)，重视用户内容的可恢复性。本轮实现本地草稿与明确丢弃，不把草稿冒称完整版本历史。
- 未复制开源代码或素材，未引入外部同步服务或新依赖。新增四组桌面流程覆盖草稿、计时、计划与布局；旧 Agent 验收改用隔离 JSONL 文件夹，避免依赖个人会话。
