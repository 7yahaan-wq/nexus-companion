# 同类开源项目学习与落地

研究日期：2026-09-20。来源为项目官方 GitHub 仓库及文档。以下为设计学习；未复制其源代码或素材。

本页按版本保留学习与实现演进，后续记录延续至 0.4.0。0.3.x 的叠图、光流、脸部贴片及共用 idle 替代方案均是历史过程，不是当前实现建议。当前契约以根 `AGENTS.md` 为准：只有 idle 动画已被接受，七组独立 24 格新动画仍是候选；单格渲染和工程测试不能替代用户视觉接受。

| 来源                                                                                                 | 可学习的设计                                                                          | Nexus 落地                                                                        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [CodexMonitor](https://github.com/Dimillian/CodexMonitor)                                            | 多工作区会话管理、置顶和窗口聚焦时刷新；区分历史 CLI 会话与当前 app-server 的流式状态 | 会话去重、Unix 秒/毫秒标准化、置顶、返回窗口刷新、Provider 能力提示、用户角色标注 |
| [Super Productivity](https://github.com/super-productivity/super-productivity/blob/master/README.md) | Timeboxing、时间记录、工作汇总和用户控制的数据备份                                    | 可恢复的专注计时、任务拖入日历、完成后休息提醒、SHA-256 本地备份与事务恢复        |
| [AionUi assistant guide](https://github.com/iOfficeAI/AionUi/wiki/Assistant-Configuration-Guide)     | Assistant 的展示名称/角色与 backend agent 分离                                        | 会话的 Programmer/QA/Art 等角色是用户标注，不把猜测当作真实 Provider 信息         |

## 不直接照搬的内容

本产品首版保持本地只读监控和个人工作管理，不增加账号、远程守护进程、云同步或自动执行代码。CodexMonitor 的独立 app-server 可以管理其自身线程；这不证明可以直接观测另一个桌面进程的所有实时状态。

## Harness

从远端引入的 `AGENTS.md`、`scripts/harness.cjs` 和资源契约脚本将跨机器前置检查与正式发布回归分开。0.4.0 保留这些入口，同时为工作流增加草稿、计时、计划和布局验收，并将会话测试改为隔离样例。美术契约只验证保护与运行边界，不能宣布候选画面已获用户接受。

## v0.2 用户反馈改进

再次查阅 [Super Productivity 用户数据文档](https://github.com/super-productivity/super-productivity/blob/master/docs/wiki/3.06-User-Data.md)，借鉴可定位的数据目录与明确的备份恢复入口：新增用户选择数据目录、重启迁移、目标冲突拒绝与原目录保留。借鉴 [CodexMonitor](https://github.com/Dimillian/CodexMonitor) 对工作区/连接状态的明确区分，新增独立连接设置，显示来源路径、扫描结果与暂停读取操作。

依据 [官方认证文档](https://developers.openai.com/codex/auth)，账号登录在官方 Codex 中完成（CLI 可使用 `codex login`）。Nexus 的本地只读适配器不读取凭据、不代表账号登录、不支持实时控制。界面提供官方登录说明入口，避免将发现会话记录误报为已登录。

此次还增加可持久化语言选项、中文导航/任务状态/日历视图、语义化浅色配色、专注返回按钮、Esc 和点击外部关闭交互。新增桌面 usability 验收覆盖数据迁移、专注离页、弹窗关闭、主题对比度、语言切换和连接暂停。

`npm run verify` 执行 TypeScript/Vite 构建、领域/存储单元测试和 Electron 桌面验收。所有测试使用独立 `.test-data` 目录，不写用户正式数据。`npm run doctor` 输出环境和构建前置检查。每次发现的数据格式错误加入回归样例；测试不会使用伪造 Agent 作为产品数据。

## v0.3 角色动画与主页入口（历史，2026-09-21）

查阅了以下项目的一手源码和文档，借鉴组织方式，未复制代码或角色素材：

| 来源                                                                                                                                                     | 实际学习点                                             | Nexus 落地                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| [VS Code Pets 状态实现](https://github.com/tonybaloney/vscode-pets/blob/main/src/panel/states.ts)                                                        | 状态与 spriteLabel、holdTime、nextFrame 等渲染节奏分开 | 独立的状态解析、每状态帧序列和时长；可测试的过期状态规则；设置页主动预览   |
| [eSheep sprite sheet 文档](https://adrianotiger.github.io/desktopPet/2019/07/02/sprite-sheets.html) / [仓库](https://github.com/Adrianotiger/desktopPet) | 用透明图集组织帧动画，通过不同帧表达动作               | 自有 Nia 16 帧图集、每帧位置与轮廓、定时播放；窗口隐藏与减少动态效果时暂停 |

该历史版本的主页「记录灵感」沿用笔记编辑与保存流程，八种状态复用四组动作。此素材布局已被后续版本替换；当前实现见 [素材与动作说明](NIA_ANIMATION.md)。当时新增四项状态/素材单测和 Nia 桌面套件，覆盖保存、重启、帧推进、暂停、主题和布局。

## v0.3.3 独立序列帧修复（2026-09-23）

参考 [VS Code Chat Pet 精灵制作规范](https://github.com/microsoft/vscode/blob/main/.github/skills/chat-pet-sprite-creation/SKILL.md) 对固定帧尺寸、稳定基线、静态代表帧、逐帧时长以及一次性动作与循环动作的区分；参考 [Desktop Pet/eSheep](https://github.com/Adrianotiger/desktopPet) 的透明图集组织；参考 [vscode-codex-pet](https://github.com/Dinohouse-Digital-LLC/vscode-codex-pet) 的每动作帧数、播放速度和循环元数据。落地时改为 Nia 自有八张 4×3 图集、每状态 12 张独立画面和单帧裁剪播放，删除透明叠图。以上仅学习组织与播放原则，没有复制开源项目的代码或人物素材。

上一版 0.3.2 的透明叠图虽然提供 12 个显示步骤，但角色边缘产生闪烁，不能等同于新增独立美术帧。0.3.3 以新绘制图集替换；保留 res/Nia.png 作为用户设定图，并在 AGENTS.md 与可执行 harness 中固化跨机器资源与验证规则。

## v0.3.4 锚点与美术质量修复（2026-09-23）

[VS Code Chat Pet 精灵制作规范](https://github.com/microsoft/vscode/blob/main/.github/skills/chat-pet-sprite-creation/SKILL.md) 强调从同一身体基准绘制、保持底线与锚点，动作帧表达姿态变化而空间位移由运行时控制，播放调度应依据实际经过时间。其规范还提醒逐帧检查边界、静态代表姿态和首尾衔接。[Aseprite 图集说明](https://github.com/aseprite/docs/blob/main/sprite-sheet.md) 将固定帧格与间距作为图集导出要素；其 [导出 API](https://github.com/aseprite/api/blob/main/api/command/ExportSpriteSheet.md) 也区分 borderPadding 和 extrude。这里只借鉴原则，没有复制代码或角色素材。

落实到 Nia：重新制作八组胸像序列，电脑遮挡双手与腿部以消除生成式美术中的第三只手及错位手臂；保留每组 12 张独立画面。标准化脚本按电脑蓝色三角校准各帧，将不规则源图裁为固定 362 像素格，并加入透明边距。播放器改为按实际经过时间选择帧，减少计时延迟带来的不均匀节奏。桌面验收增加边界透明和锚点范围检查。

## v0.3.5 30 帧与静态立绘（2026-09-23）

再次学习 [VS Code Chat Pet 的 sprite 规范](https://github.com/microsoft/vscode/blob/main/.github/skills/chat-pet-sprite-creation/SKILL.md)：共用身体基线、角色位置和代表帧；学习 [Aseprite 图集导出文档](https://github.com/aseprite/docs/blob/main/sprite-sheet.md) 的固定格子与边距；参考 [Practical-RIFE](https://github.com/hzwer/Practical-RIFE) 的中间帧思路。Nexus 未复制这些项目的代码或素材，也未声称使用 RIFE 模型。我们用 OpenCV 光流只在校准后的面部与机器人屏幕局部补帧，身体、笔记本和透明轮廓逐帧复制同一基准，最终每状态 30 个不同格子。八张静态立绘沿用 `res/Nia.png` 的角色设定，右上角切换保存在本地设置。

## v0.3.6 清晰 24 帧序列（2026-09-23）

用户验收指出 0.3.5 的双向光流混合令眼睛和面部产生重影、鬼畜感。重新学习 [VS Code Chat Pet sprite 规范](https://github.com/microsoft/vscode/blob/main/.github/skills/chat-pet-sprite-creation/SKILL.md) 对清晰关键姿态、固定身体基准、每帧时长与按经过时间调度的要求；参考 [Aseprite 图集文档](https://github.com/aseprite/docs/blob/main/sprite-sheet.md) 的等格图集与帧顺序；参考 [Godot SpriteFrames 资源](https://github.com/godotengine/godot/blob/master/doc/classes/SpriteFrames.xml) 把帧内容、帧时长和循环策略分开的做法。这里仅借鉴方法，没有复制其代码或素材。

落地为 6×4、24 格 RGBA 图集：每张中间帧只从相邻关键姿态的一侧取眼、嘴和机器人屏幕，做局部小幅变形；没有两张面部图片的透明叠加。眨眼回程经过已有半睁眼姿态，身体和电脑逐帧固定。动作段约 24 帧/秒，待机和困倦在首帧停顿。桌面 harness 新增眼部清晰度下限和实际播放帧推进检查，防止旧式重影实现回流。

## v0.3.7 跨状态统一底图（2026-09-23）

用户指出 0.3.6 只有「悠闲陪伴」清爽，后面的状态变糊和变形。复查生成器发现每个状态虽然逐帧固定，却使用了该状态自身的整张底图；原始状态图的造型和光照差异因此直接进入成品。遵循 [VS Code Chat Pet 的精灵制作规范](https://github.com/microsoft/vscode/blob/main/.github/skills/chat-pet-sprite-creation/SKILL.md) 中从同一个 idle 身体出发、只更换必要动作部位并保持锚点的原则，改成八种状态共用 idle 完整画面，只让配准后的眼、嘴和机器人屏幕局部变化。仍沿用 [Aseprite 图集说明](https://github.com/aseprite/docs/blob/main/sprite-sheet.md) 的等格透明图集原则。桌面验收新增跨全部状态和帧的像素比较，防止头发、身体、光照和电脑再随状态劣化。没有复制第三方代码或美术。

## v0.3.8 独立绘制图集与逐帧时长（2026-09-23）

用户指出 0.3.7 的局部光流补帧和脸部贴片仍有变形，42 毫秒一帧显得鬼畜。参考 [Aseprite 动画文档](https://github.com/aseprite/docs/blob/main/animation.md) 的独立 cel、逐帧时长与循环工作流，以及 [Aseprite 序列导出说明](https://github.com/aseprite/docs/blob/main/exporting.md) 的编号 PNG 流程；也参考 [VS Code Chat Pet 精灵规范](https://github.com/microsoft/vscode/blob/main/.github/skills/chat-pet-sprite-creation/SKILL.md) 对同一角色、固定锚点、透明边界和首尾衔接的要求。落地为八套新绘制的 24 格透明素材、192 张独立帧 PNG、整张画面的刚性配准和纯图集打包，删除光流、局部贴片及合成中间帧。普通帧延长到 100 毫秒，待机/困倦首帧停留 900 毫秒。没有复制第三方代码或素材。

## v0.3.9 参考画风回归与逐格节奏（2026-09-24）

用户指定早期 Nia 对照图作为美术标准。0.3.8 的新生成画面虽然独立成格，但颜色、反光和脸型偏离标准。当前版本直接恢复旧版完整画面，不再生成新风格；结合已记录的 Aseprite 单格与逐帧时长工作流，只播放通过目检的关键格，并通过时长控制停顿。固定电脑区域逐像素一致，避免角色位置随状态变化。

## 0.3.10 用户验收纠正

0.3.9 对旧素材筛选的结论不成立：用户仅认可 idle，其余状态仍然有脸部形变。0.3.10 当时停止加载七套不同脸部素材，仅从 accepted idle 完整画面选择状态时间轴；这个临时方案随后被 0.3.11 的七组完整候选序列替换。固定锚点、哈希和构建测试不能替代脸部及画风人工验收。

## 0.3.11 复查

参考 Phaser 的 [帧动画文档](https://docs.phaser.io/phaser/concepts/animations) 与 [AnimationFrame](https://docs.phaser.io/api-documentation/class/animations-animationframe)：帧数量和播放时间应分开配置，每帧可以独立停留；角色反应可以一次播放后停留。[Sprite 示例](https://phaser.io/examples-show/338) 使用固定帧尺寸与 origin。这里采用完整格子、固定显示框和独立时长，不引入引擎依赖或第三方美术。文档只能指导播放器，无法消除生成原画自身的笔触和比例差异。

## v0.4 工作流（2026-10-08）

- 查阅 [Super Productivity Task Attributes](https://github.com/super-productivity/super-productivity/wiki/4.09-Task-Attributes) 与 [First Steps](https://github.com/super-productivity/super-productivity/wiki/1.01-First-Steps)，采用任务与实际用时联动、先简后繁的表单、每日负荷估算思路；根据 Nexus 的单库架构实现自己的事务和去重机制。
- 查阅 [Joplin Note History](https://joplinapp.org/help/apps/note_history/)，重视用户内容的可恢复性。本轮实现本地草稿与明确丢弃，不把草稿冒称完整版本历史。
- 未复制开源代码或素材，未引入外部同步服务或新依赖。新增四组桌面流程覆盖草稿、计时、计划与布局；旧 Agent 验收改用隔离 JSONL 文件夹，避免依赖个人会话。
