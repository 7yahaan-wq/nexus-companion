# 开源参考与当前落地

本页收敛已有研究中仍适用于当前版本的设计原则。来源为项目官方仓库和文档；未复制其代码或角色素材，也没有因此引入同步服务、模型调用或新依赖。旧版本失败方案和逐版修改过程由 Git 历史保留，不作为当前实现指南。

## 工作流与本地数据

| 来源                                                                                                                                                                                                                                                                                                       | 借鉴点                                     | 当前落地与边界                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [Super Productivity](https://github.com/super-productivity/super-productivity/blob/master/README.md)、[Task Attributes](https://github.com/super-productivity/super-productivity/wiki/4.09-Task-Attributes)、[First Steps](https://github.com/super-productivity/super-productivity/wiki/1.01-First-Steps) | 任务、时间跟踪、每日负荷与逐步展开的表单   | 任务实际用时联动、每日三件事、时间预算、任务进入专注及完成后选择；事务与重试去重按 Nexus 单库模型自行实现 |
| [Super Productivity 用户数据说明](https://github.com/super-productivity/super-productivity/blob/master/docs/wiki/3.06-User-Data.md)                                                                                                                                                                        | 用户掌握数据位置与备份恢复                 | 可选数据目录、重启迁移、目标覆盖拒绝、原目录保留，以及 SHA-256 备份和事务恢复                             |
| [Joplin Note History](https://joplinapp.org/help/apps/note_history/)                                                                                                                                                                                                                                       | 内容可恢复性与用户信任                     | 本地草稿、明确丢弃和保存失败保护；没有把草稿称为完整版本历史                                              |
| [CodexMonitor](https://github.com/Dimillian/CodexMonitor)                                                                                                                                                                                                                                                  | 区分历史记录与受控会话，置顶及窗口返回刷新 | 会话去重、秒/毫秒时间戳、用户角色、置顶、Provider 能力提示；只读本地会话不等于实时控制                    |
| [AionUi assistant guide](https://github.com/iOfficeAI/AionUi/wiki/Assistant-Configuration-Guide)                                                                                                                                                                                                           | 展示身份与底层 Agent 分离                  | Programmer/QA/Art 等为用户标注，不凭猜测确定模型或 Agent 身份                                             |

Codex 登录在官方应用、IDE 或 CLI 中完成，参见 [官方认证文档](https://developers.openai.com/codex/auth)。Nexus 不读取或保存凭据，不提供账号登录或实时停止、重试、审批。当前 App Server 接入仅限用户手动读取当前账号的额度及用量；管理自有会话仍是单独的未来能力。

## Codex 用量与账号额度

[官方 App Server 文档](https://learn.chatgpt.com/docs/app-server) 区分账号信息、额度窗口和用量查询。Nexus 将这些数据与本地会话状态分开：卡片显示 Codex 报告的会话累计 tokens，详情同时保留最近请求和缺失字段；账号共享额度独立显示来源、观测时间和重置时间。累计事件不重复相加，分叉会话不叠加来源会话计数，过期窗口也不推算为满额。

手动按钮经本机官方 CLI 查询当前套餐或所选会话。任务估算字段按本机 CLI 生成的协议定义适配；服务合法返回无任务估算时显示尚未提供，不使用本地 tokens 猜算。当前 CLI 账号不等于历史日志的确定归属。CLI 可能联网并刷新自身 OAuth，Nexus 不读取或保存凭据，不自动登录、轮询官方账户或执行模型任务。

[官方 tokens / Credits 说明](https://learn.chatgpt.com/docs/pricing) 将 Credits 与套餐包含的使用限制分开说明。当前界面只展示服务返回的任务 `estimatedCredits`，不按价格表本地估算，不把 Credits 换算为订阅扣减百分点或美元。界面提供真实零值、缺失、失败、过期与部分账号/会话暂不支持等状态。

## 角色与帧动画

| 来源                                                                                                                                                                                                                                                                                                      | 保留的设计原则                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [VS Code Pets 状态实现](https://github.com/tonybaloney/vscode-pets/blob/main/src/panel/states.ts)                                                                                                                                                                                                         | 状态语义与帧序列、时长分离；过期状态规则可以独立测试           |
| [VS Code Chat Pet 制作规范](https://github.com/microsoft/vscode/blob/main/.github/skills/chat-pet-sprite-creation/SKILL.md)                                                                                                                                                                               | 固定帧尺寸、身体基线和锚点；检查静态代表帧、透明边缘与完整序列 |
| [eSheep 图集说明](https://adrianotiger.github.io/desktopPet/2019/07/02/sprite-sheets.html)、[Desktop Pet](https://github.com/Adrianotiger/desktopPet)、[vscode-codex-pet](https://github.com/Dinohouse-Digital-LLC/vscode-codex-pet)                                                                      | 透明图集、按动作定义帧数、速度及循环策略                       |
| [Aseprite 图集](https://github.com/aseprite/docs/blob/main/sprite-sheet.md)、[动画](https://github.com/aseprite/docs/blob/main/animation.md)、[序列导出](https://github.com/aseprite/docs/blob/main/exporting.md)、[导出 API](https://github.com/aseprite/api/blob/main/api/command/ExportSpriteSheet.md) | 独立 cel、编号 PNG、固定格子/边距、逐格时长与完整帧导出        |
| [Godot SpriteFrames](https://github.com/godotengine/godot/blob/master/doc/classes/SpriteFrames.xml)                                                                                                                                                                                                       | 分离帧内容、时长和循环定义；没有引入游戏引擎依赖               |
| [Phaser 帧动画](https://docs.phaser.io/phaser/concepts/animations)、[AnimationFrame](https://docs.phaser.io/api-documentation/class/animations-animationframe)                                                                                                                                            | 帧数与时长分别配置，一次性反应可在末帧停留                     |

Nia 当前只渲染一个完整格子，加载解码后才开始计时，遵循隐藏窗口暂停和减少动态效果。禁止脸部补丁、局部形变、光流补帧、交叉淡化及重复重采样。上述文档只能指导资源组织和播放器，不能证明生成原画的脸部、比例或笔触已经自然。

只有 idle 动画已获用户视觉接受；七组 hires 动画仍为候选。角色原始参考、accepted idle 和当前来源清单依 [AGENTS.md](../AGENTS.md) 保护，技术入口见 [NIA_ANIMATION.md](NIA_ANIMATION.md)。

## Harness 与下一步

`scripts/harness.cjs` 统一跨机器前置条件、素材契约与桌面验证；完整回归使用隔离数据库和受控 Codex 样例，打包后再验实际 EXE。账号查询使用受控 CLI 响应测试，不以个人会话作为测试夹具。草稿、计时、计划、备份、用量与布局的验证范围见 [VERIFICATION.md](VERIFICATION.md)，当前结果见 [PROJECT_STATUS.md](PROJECT_STATUS.md)。

日历当前时间定位和 Agent 空状态指引已在 0.5.1 实施。后续仍可评估设置分组、程序路径发现和批量保存。完整候选及代码入口保留在 [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md#9-后续优化候选)，不把研究方向写成已经接入的能力。

## 2026-10-23 体验优化采用的参考

[Super Productivity 固定提交的日历实现](https://github.com/super-productivity/super-productivity/blob/dee0b6d20ca11926b4488fc237470efe580ee55b/src/app/features/schedule/schedule/schedule.component.ts) 将当前时段定位与周期更新时间分开，避免用户阅读时反复跳动。Nexus 借鉴这一原则：首次进入及点击“今天”定位，数据/时间线刷新不抢滚动；今天新建从下一刻度开始。

[CodexMonitor 固定提交的侧栏](https://github.com/Dimillian/CodexMonitor/blob/dd61b9abd37de5ded86e82b9fe8a83fd49d46fa5/src/features/app/components/Sidebar.tsx) 区分搜索无结果、未添加工作区和没有会话。[其搜索栏](https://github.com/Dimillian/CodexMonitor/blob/dd61b9abd37de5ded86e82b9fe8a83fd49d46fa5/src/features/app/components/SidebarSearchBar.tsx) 提供清除操作。Nexus 结合只读目录来源，进一步区分暂停和读取异常，提供清除筛选、启用和直达连接设置。

上述为源码观察和本产品适配判断。独立智能体在隔离数据上实际复现了两类卡点后才选择实施，未复制上游代码或素材，未引入新依赖。容量摘要暂缓，继续复用已有每日计划。开发及证据复用流程见 [DEVELOPMENT_LOOP.md](DEVELOPMENT_LOOP.md)。
