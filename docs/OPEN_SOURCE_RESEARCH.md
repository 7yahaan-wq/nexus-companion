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

Codex 登录在官方应用、IDE 或 CLI 中完成，参见 [官方认证文档](https://developers.openai.com/codex/auth)。Nexus 不读取凭据，不提供账号登录或实时停止、重试、审批。将来接入可管理自有会话的 App Server，需要单独明确授权、状态和隐私边界。

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

`scripts/harness.cjs` 统一跨机器前置条件、素材契约与桌面验证；完整回归使用隔离数据库和受控 Codex 样例，打包后再验实际 EXE。草稿、计时、计划、备份和布局的验证范围见 [VERIFICATION.md](VERIFICATION.md)，当前结果见 [PROJECT_STATUS.md](PROJECT_STATUS.md)。

后续仍可评估日历当前时间定位、Agent 空状态指引、设置分组、程序路径发现和批量保存。完整候选及代码入口保留在 [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md#9-后续优化候选)，不把研究方向写成已经接入的能力。
