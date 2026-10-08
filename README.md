> 0.4.1 为清理维护版本：收敛旧版资料与未使用的衍生素材，保留灵感、计划、任务、专注和 Nia 动画／立绘功能。完整 harness、包内源码审计和打包版验收均已通过，实际结果见 [项目状态](docs/PROJECT_STATUS.md)。只有 idle 动画已获用户视觉接受，其余七组仍为候选。开发接续见 [另一台电脑继续开发](docs/START_ON_NEW_PC.md)，素材约束见 [Nia 动画说明](docs/NIA_ANIMATION.md) 和 [AGENTS.md](AGENTS.md)。

# Nexus Companion

一个 Local First 的 Windows 11 桌面工作中枢：项目、任务、日历、Codex 本地观测、专注计时与 Nia 伙伴。

## 直接使用

当前版本的文件位于 `dist/`；该目录不进入 Git。GitHub 上的源码可以重新打包，安装文件作为 Release 资源上传需要相应授权。校验值见 [发布记录](docs/PROJECT_STATUS.md)：

- `NexusCompanion-Setup-0.4.1.exe`：安装版。
- `NexusCompanion-Portable-0.4.1.exe`：免安装启动版，默认使用 AppData，可在设置中选择数据位置。
- `win-unpacked/Nexus Companion.exe`：解包版本，可直接启动；整个目录需要一起保留。

首次启动会引导选择项目目录、主题和角色。没有演示任务或随机 Agent 数据。安装包未签名，Windows 可能显示发布者未验证；目前未提供代码签名证书。

完整的安装、功能和故障排查说明见 [Nexus Companion 0.4.1 使用手册](docs/USER_GUIDE.md)。

## 已实现

当前工作流包含可恢复草稿、灵感转任务、每日三件事与收工回顾、项目下一步、跨页专注计时及任务用时联动。首页突出今日与逾期工作，Nia 在窄窗口下不遮挡内容。图集预解码、单格切换与八状态立绘继续保留；七组非 idle 动画尚待用户视觉验收。详见 [版本说明](docs/RELEASE_0.4.1.md)。

- Home：一键记录和查看灵感、今日任务、最近 Agent 观测、等待处理项、日程、项目进度和真实统计。
- Projects：创建/编辑/删除，Godot/Unity 识别，目录/VS Code/终端/项目启动，重要文档，Git 分支、未提交文件、最近提交（只读）。外部程序未安装时显示错误。
- Tasks：6 种状态，拖拽列与手动排序，优先级、项目、标签、日期、预计/实际时长、关联 Agent，搜索过滤。
- Calendar：月/周/日视图，创建/编辑/删除，任务拖入时间块，拖动日程，拖动底边调整结束时间，每天/周/月重复。跨午夜分段和重叠事件分栏。**编辑、拖动、调整重复日程会修改整个系列**；单次例外编辑尚未提供。
- Agents：只读真实 Codex JSONL，多会话卡片、角色标注、置顶、日志、明确记录的修改文件、目录与 VS Code；长日志读取末尾 2 MB，最多展示 1500 条公开输出并虚拟化渲染。
- Timeline / Daily Report：真实本地操作和 Agent 事件，按日期/项目/Agent/任务过滤，Markdown 复制和导出。
- Notes：轻量 Markdown、项目、标签、搜索；不执行 HTML、不加载远程图片。
- Focus：25/50/自定义 1–480 分钟，暂停/继续/结束，主进程计时、重启恢复、完成通知、每日统计。
- Nia：完整保护已接受的 idle 图集、12 个偶数格顺序与时长；其余七种状态使用独立 24 格候选序列，预解码后一次只显示一个格子，不叠图、不局部变形、不补帧。可切换八状态立绘，设置可预览和关闭动画，遵循减少动态效果及窗口隐藏暂停。Core 和自定义 Avatar Pack 继续支持。
- Appearance：深浅主题、强调色、渐变/纯色/本地图片、模糊/亮度/可见度/面板透明度。
- 全局 `Ctrl + Shift + Space` 快速记录；可选择灵感或任务，记住上次类型并保留草稿；兼容 `TODO 内容` 和 `NOTE 内容`。窗口内 `Ctrl + K` 搜索所有主要实体和命令。
- 托盘：打开、Agent、快速记录、专注、退出。关闭窗口默认隐藏到托盘；计时和监控继续工作。
- 通知：Agent 状态变化、日程即将开始、专注完成，分类开关、去重、不重放历史完成通知。Windows 的勿扰/通知设置仍可能阻止弹出。
- 本地备份：带 SHA-256 校验的 `.nexus` 文件；导入预览、事务合并恢复、恢复前自动快照、SQLite 完整性检查。

## Codex 的真实能力边界

默认只读 `$CODEX_HOME/sessions` 和 `session_index.jsonl`，未设置时为用户目录下 `.codex`。不读取 `auth.json`，不修改 Codex 配置，不发送提示，不启动 Agent，不消耗模型额度。

当前最多发现最近 120 个会话文件，按真实线程 ID 去重。状态来自明确的本地事件；超过两分钟未更新的运行观测会显示 **Unavailable**。它不是 Codex Desktop 进程的实时 API，可能缺少轮次、被截断的历史、审批、错误、进度或长时间无输出的实际运行状态。运行时长只在读取到有效开始与结束事件时计算，秒/毫秒时间戳均会规范化。日志会显示观测时间。

停止、重试和实时审批显示 **Unsupported**。未来可以替换 `AgentProvider`，接入拥有自己会话的 App Server；不会用猜测或随机数冒充这些能力。日报 Agent 数据是可见最近轮次的统计，不能当作完整审计账本。

参考：[OpenAI App Server 官方文档](https://developers.openai.com/zh-Hans/docs/app-server)。

## 数据与隐私

默认目录：`%APPDATA%/Nexus Companion/`。

设置中可选择其他文件夹，下次启动创建 `NexusCompanion-Data` 并迁移数据库/资源/备份/日志。原目录保留，不覆盖已有目标目录。路径配置 `data-location.json` 与 Chromium 缓存仍在系统应用目录。请保持自选数据磁盘可用。

| 内容        | 位置                       |
| ----------- | -------------------------- |
| SQLite 数据 | `nexus.sqlite`（WAL 模式） |
| 应用日志    | `logs/app.log`             |
| 导入图片    | `assets/`，按内容哈希命名  |
| 恢复前快照  | `backups/`                 |

数据默认只存本地。应用没有云上传、遥测或账号系统；点击外部仓库链接时会打开系统浏览器。导出的备份含你的个人内容，请自行保管。直接复制 SQLite 数据前请从托盘退出；日常备份优先使用 Settings 中的导出功能。

## 本地开发

需要 Windows、Node.js 24+、npm。Rust/.NET 不是构建依赖。Git、VS Code、Windows Terminal、Godot/Unity 是对应快捷功能的可选程序。

```powershell
npm ci
npm run harness  # 跨机器核心规则、构建与 Nia 桌面验收
npm run build
npm start
```

开发热更新：一个终端 `npm run dev`；另一个终端设置 `$env:NEXUS_DEV_URL='http://127.0.0.1:5173'` 后运行 `npm start`。生产包不需要开发服务器。`NEXUS_DATA_DIR` 可覆盖数据目录，用于隔离测试。

```powershell
npm test          # 领域 / 存储 / 安全测试
npm run harness -- --full  # 完整桌面回归
npm run package  # 生成并审计 NSIS/portable，成功后清理识别到的旧版生成文件
npm run verify:packaged  # 打包后7组桌面流程 + 便携EXE启动
```

测试仅写 `.test-data/`，可通过 `.test-data/verification.json` 检查每个阶段。截图也在此目录。正式包不会包含测试数据、Codex 记录或个人备份。构建依赖由 `package-lock.json` 固定。

先阅读根目录 `AGENTS.md`。`res/Nia.png`、`public/assets/nia/calm.png` 与已接受的 idle 素材受保护；其他早期图集只能作为历史材料。`npm run harness` 验证环境、资源契约、单元测试、构建和 Nia 桌面行为，`--full` 增加完整回归。当前完整回归使用隔离 Codex 目录和受控会话样例；个人数据库不参与测试。打包脚本不递归删除 `dist` 或工作目录，仅移除已识别的旧版生成文件。

`scripts/download-electron.cjs` 为下载受限环境提供校验下载：优先官方 GitHub，失败后使用镜像，但始终与 Electron npm 包的 SHA-256 校验值比较，不接受未校验的运行时。当前使用 Electron 39.8.10。开发依赖 `extract-zip` 的上游审计警告仍存在；它不包含在应用运行时，构建脚本只解压已通过官方哈希校验的 Electron 压缩包。

## 工程文档

- [另一台电脑继续开发](docs/START_ON_NEW_PC.md)

- [开发接续说明与本机环境](docs/DEVELOPMENT_HANDOFF.md)
- [架构](docs/ARCHITECTURE.md)
- [详细使用手册](docs/USER_GUIDE.md)
- [进度与验收](docs/PROJECT_STATUS.md)
- [Avatar Pack](docs/AVATAR_PACK.md)
- [Nia 动画、素材来源与扩展入口](docs/NIA_ANIMATION.md)
- [开源项目学习与落地](docs/OPEN_SOURCE_RESEARCH.md)
- [测试与交付边界](docs/VERIFICATION.md)

后续可扩展 Live2D/Spine、完整 App Server 管理、外部日历和重复日程的单次例外；这些能力尚未实现，不会显示成已接入。其他体验候选见 [开发接续说明](docs/DEVELOPMENT_HANDOFF.md#9-后续优化候选)。
