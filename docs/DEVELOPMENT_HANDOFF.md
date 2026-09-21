# 项目开发接续说明

核对日期：2026-09-21。开发起点：`main` / `1eb9364`，当前应用版本 `0.3.0`（版本标签 `v0.3.0`）。工作目录：`D:\ProjectNia\nexus-companion`。

本文基于现有源码、配置、测试和发布文件整理，用于后续在本机继续开发。当前发布验收见 VERIFICATION.md；本次已实现的优化与后续候选项分别记录。修改功能后应同步更新相关说明。

## 1. 产品与当前范围

Nexus Companion 是面向 Windows 的本地桌面工作中枢，组合项目、任务、日历、Codex 会话观测、笔记、日报、专注计时和 Nia 伙伴。

- 应用没有独立账号系统、云同步、遥测或模型请求。外部链接通过系统浏览器打开。
- Codex 集成读取本地会话文件，展示最近观测；没有发送提示、创建会话、停止、重试、实时审批能力。
- 内置 Nia 使用 16 帧透明图集，四组动作表达八种状态，支持预览、动画开关与窗口隐藏暂停；自定义角色包支持八种状态图片。Live2D / Spine 尚未接入。
- 日历支持本地重复系列，不支持单次例外、外部日历同步或显式时区管理。
- 安装版和便携版均以本地数据目录为基础；便携版默认数据并不跟随 EXE 保存。

用户操作见 [USER_GUIDE.md](USER_GUIDE.md)，原架构说明见 [ARCHITECTURE.md](ARCHITECTURE.md)。本文补充源码细节及本机现状。

## 2. 技术栈与目录

`package-lock.json` 锁定的主要版本如下；安装时应使用锁文件，而非根据 `package.json` 的版本范围重新选版本。

| 层次       | 技术 / 锁定版本                           | 主要位置                          |
| ---------- | ----------------------------------------- | --------------------------------- |
| 桌面宿主   | Electron 39.8.10，CommonJS                | `electron/main.cjs`               |
| 界面       | React / React DOM 19.3.0                  | `src/main.tsx`、`src/ui/App.tsx`  |
| 类型与构建 | TypeScript 5.9.3、Vite 6.4.3              | `tsconfig.json`、`vite.config.ts` |
| 数据       | Node 内置 `node:sqlite`，WAL              | `electron/storage/`               |
| 桌面回归   | Playwright 1.63.0                         | `tests/*.cjs`                     |
| 打包       | electron-builder 26.15.3，NSIS / portable | `package.json`                    |
| 文本与图标 | react-markdown、lucide-react              | 各功能组件                        |

源码大致分为：

```text
src/
  main.tsx                 React 入口与全局样式加载顺序
  ui/                      应用外壳、导航、各功能 CSS
  features/                九个业务页面
  components/              弹窗、实体表单、搜索、快速记录、首次引导、日志列表
  domain/                  通用类型、接口、工作区状态、日历算法、日报、翻译
  providers/               Agent 观测状态与轮询
  avatar/                  图集渲染、帧坐标、播放、预览、菜单
electron/
  main.cjs                 生命周期、接口分发、托盘、快捷键、后台调度
  preload.cjs              window.nexus 桥接
  storage/                 数据库线程、输入校验、数据目录迁移
  providers/               Codex 适配器及线程封装
  services/                项目、资源、备份、专注、通知
  generated/calendar.cjs   从领域源码生成的 Node 端日历逻辑
scripts/                   构建、环境检查、验收、Electron 下载与恢复、图标生成
tests/                     单元测试及桌面验收
public/assets/             Nia 图片与应用图标
docs/                      架构、用户手册、发布记录等
```

`build/` 是 Vite 界面产物；`dist/` 是安装包输出；两者不可混淆。`node_modules/`、`build/`、`dist/`、`.test-data/` 均被 Git 忽略。当前仓库未发现 `AGENTS.md`、CI 工作流或独立 lint 配置；已有 Prettier 配置。

## 3. 运行与数据流

```mermaid
flowchart TD
  UI[React 页面与组件] --> Hooks[useWorkspace / useAgents / useFocus]
  Hooks --> API[domain/api.ts]
  API --> Bridge[preload: window.nexus]
  Bridge --> Main[main.cjs: IPC handlers]
  Main --> Store[Store / SQLite worker]
  Store --> DB[(nexus.sqlite)]
  Main --> Provider[ProviderClient / Codex worker]
  Provider --> Logs[只读 sessions 与 session_index.jsonl]
  Main --> Services[专注 / 通知 / 备份 / 资源 / 项目服务]
  Services --> Store
```

### 启动流程

1. 设置应用名及可选 `NEXUS_DATA_DIR`，获取单实例锁。
2. 读取数据位置配置，必要时迁移数据并确定实际数据根目录。
3. 创建 SQLite worker，读取 Codex 连接配置，初始化专注和通知状态。
4. 注册接口，创建带隔离和沙箱的 Electron 窗口。
5. 加载 `NEXUS_DEV_URL` 指向的开发页面，或 `build/index.html`。
6. 正常模式下注册托盘与全局快捷键；关闭窗口时隐藏到托盘，后台调度继续。

### 界面状态

- 页面由 `App.tsx` 的 `page` 状态选择，没有独立路由库或外部状态管理库。
- `useWorkspace` 加载七个集合；每次保存或删除后重新加载全部七个集合。
- 外观配置单独存于 `settings/appearance`，由 `App.tsx` 持有。
- `useAgents` 每轮读取结束后等待 15 秒再读取；窗口聚焦和连接设置变化时强制刷新。主进程也每 15 秒扫描，使用 10 秒缓存与正在执行的请求合并来减少重复读取。
- 专注计时由主进程每秒检查；界面每秒读取状态。计时不依赖页面是否打开。

### 接口约定

渲染端调用 `api(method, ...args)`，经 `window.nexus.call` 进入唯一的 `nexus` IPC 通道。主进程检查发送窗口与方法白名单，返回 `{ ok, data }` 或 `{ ok: false, error }`；`api()` 将失败转换为异常。

| 接口组     | 代表方法                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| 数据       | `list`、`save`、`delete`                                                                                  |
| Agent      | `agents`、`agentLogs`、`connectionInfo`、`configureConnection`                                            |
| 项目与系统 | `projectInspect`、`projectOpen`、`openDocument`、`openUrl`、`chooseDirectory`                             |
| 专注与通知 | `focusState`、`focusStart`、`focusPause`、`focusStop`、`notify`                                           |
| 资源       | `asset`、`importBackground`、`importAvatar`                                                               |
| 数据维护   | `backupExport`、`backupPreview`、`backupRestore`、`integrity`                                             |
| 应用维护   | `info`、`windowVisible`、`chooseDataLocation`、`cancelDataLocation`、`restart`、`openLogs`、`clientError` |

新增系统能力时，入口在主进程白名单与对应服务；React 页面不直接访问文件系统。现有桥接和多数实体仍使用宽泛类型，接口名称、参数和返回值尚未形成完整的静态类型约束。

## 4. 功能修改入口

| 功能          | 主要文件                                                                                       | 需要一起考虑的行为                                                     |
| ------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 工作台        | `src/features/home/Home.tsx`                                                                   | 今日统计、最近 Agent、等待项、任务完成、项目进度                       |
| 项目          | `src/features/projects/Projects.tsx`、`electron/services/projects.cjs`                         | 目录合法性、Godot/Unity 检测、只读 Git、外部程序定位                   |
| 任务          | `src/features/tasks/Tasks.tsx`                                                                 | 六状态、排序、筛选、`completedAt`、安排到日历                          |
| 日历          | `src/features/calendar/Calendar.tsx`、`src/domain/calendar.ts`                                 | 重复展开、月末、跨夜、重叠分栏、拖放、15 分钟步长调整                  |
| Agent         | `src/features/agents/Agents.tsx`、`src/providers/useAgents.ts`、`electron/providers/codex.cjs` | 文件格式、观测时间、缓存、角色与置顶、日志上限                         |
| 时间线 / 日报 | `src/features/timeline/Timeline.tsx`、`src/domain/report.ts`、`electron/main.cjs`              | 事件写入、日期与项目过滤、日报统计范围                                 |
| 笔记          | `src/features/notes/Notes.tsx`                                                                 | Markdown、标签、搜索；禁用 HTML 和图片渲染                             |
| 专注          | `src/features/focus/Focus.tsx`、`electron/services/focus.cjs`                                  | 暂停、期限、重启恢复、完成记录和通知                                   |
| 设置          | `src/features/settings/`                                                                       | 外观、语言、连接、资源导入、备份与数据迁移                             |
| 伙伴          | `src/domain/avatar.ts`、`src/avatar/`、`src/ui/avatar.css`                                     | 状态时效、图集帧序列、播放/暂停、预览、快捷菜单；详见 NIA_ANIMATION.md |
| 通用交互      | `src/components/`                                                                              | Modal 关闭与焦点恢复、EntityForm 时间戳、搜索与快速记录                |

样式在 `src/main.tsx` 按固定顺序导入，`light.css` 最后加载并覆盖部分前面的规则。外观修改需要同时检查深浅主题、背景透明度和较窄窗口。桌面窗口最小尺寸是 1060 × 720；小于 1200 CSS 像素宽度时，伙伴栏转成右下角浮动角色。

## 5. 数据模型与持久化

数据库并非每个业务实体一张表，而是 `records(kind, id, data)` 通用记录表，以 `(kind, id)` 为主键，`data` 保存 JSON。另有 `meta` 表，目前仅初始化 `schema=1`；尚无逐版本迁移执行器。

| 集合       | 内容 / 关系                                                   |
| ---------- | ------------------------------------------------------------- |
| `projects` | `name`、绝对 `projectPath`、引擎、仓库、外观等                |
| `tasks`    | 状态、优先级、日期、排序、分钟时长、`project`、Agent 关联文本 |
| `events`   | `start/end`、重复规则、`project`、`relatedTask`               |
| `notes`    | 标题、Markdown、标签、`project`                               |
| `focus`    | 已结束的专注记录，实际时长以秒保存                            |
| `timeline` | 本地实体操作与已提取的 Agent 活动                             |
| `reports`  | 按日期 ID 保存的日报 Markdown 快照                            |
| `agents`   | 最近扫描结果的持久化副本；界面列表仍来自适配器扫描            |
| `settings` | 外观、连接、角色标注、运行中专注和通知去重状态                |

主要 settings ID：

- `appearance`：主题、语言、图片、Avatar Pack、avatarMotion 动画开关、通知开关、首次引导状态。
- `codex-connection`：读取是否启用、自定义 Codex 根目录。
- `agent-profiles`：按真实会话 ID 保存显示名、角色与置顶。
- `active-focus`：运行中专注状态；不等同于已结束的 `focus` 记录。
- `notification-ledger`：通知去重键，最多保留 1000 个。

关系由 JSON 中的 ID 字段表达，没有数据库外键和级联删除。删除项目目前不会自动删除或解除相关任务、日程、笔记的关联。`EntityForm` 会补充创建/修改时间，但直接调用存储接口的其他路径不统一补充这些字段。

默认数据根目录为 `%APPDATA%\Nexus Companion`，包含数据库、`assets/`、`logs/` 和 `backups/`。`data-location.json` 位于 Electron 的基础 userData 目录，记录 active / pending 路径。迁移复制数据库快照及资源、备份、日志，校验后切换；保留旧目录并拒绝覆盖已存在目标。

备份是带 SHA-256 的 JSON `.nexus` 文件，不是 SQLite 文件副本，也不加密。它包含八类业务集合中的记录、`appearance` / `agent-profiles` 两类设置以及引用到的图片；不导出 `agents` 缓存、Codex 源文件、连接配置、运行中专注状态或通知去重账本。已写入时间线的 Agent 活动仍属于备份内容。恢复时同 ID 覆盖、其他记录保留，数据库合并使用事务，恢复前生成快照。

## 6. 容易误解的实现边界

### Codex 观测

- 路径来自连接设置、`CODEX_HOME` 或用户目录 `.codex`，只读取 `sessions` 和 `session_index.jsonl`。
- 按目录/文件名倒序遍历，最多发现 120 个 JSONL 文件，再按线程 ID 去重、按观测时间排序；并不是遍历全部历史后按修改时间挑选 120 个。
- 每个文件读取头部 256 KB 元数据及尾部 2 MB，按文件大小和修改时间缓存；日志保留末尾 1500 条，活动保留末尾 200 条。
- 当前解析器实际产生 `RUNNING`、`COMPLETED`、`FAILED`、`CANCELLED`、`UNAVAILABLE`。界面和类型中的 WAITING / WAITING_APPROVAL 等预留状态不代表当前适配器已能识别审批。
- 两分钟没有新观测的 RUNNING 降为 UNAVAILABLE；只有同时有有效开始、结束记录才计算时长。日报仅统计可见最近轮次。
- 本地显示名与角色来自 `agent-profiles`，不是底层模型或 Agent 身份的自动识别结果。

### 日历、专注与伙伴

- 日历保存本地日期时间字符串，使用 JavaScript 本地 `Date` 计算；不是携带 IANA 时区的日程模型。
- 修改、移动或调整重复日程会更改整个系列。修改领域算法后应重新生成 `electron/generated/calendar.cjs`，通知服务也依赖它。
- 专注时长支持 1–480 分钟，暂停保存剩余秒数；运行中通过 deadline 恢复。结束记录与任务 `actualTime` 目前没有自动累加联动。
- Nia 状态优先级是失败 → 审批 → 工作/专注 → 等待 → 近期完成 → 深夜 → 空闲。失败状态保留五分钟，活动观测和完成反馈保留两分钟；每 15 秒更新状态，避免旧记录持续影响当前表情。
- `Home.tsx` 中有 WidgetDefinition 和 widgets 声明，但当前布局是固定 JSX，尚无组件排序/显隐设置。
- 快速记录无前缀时固定创建任务；主页「记录灵感」直接进入笔记编辑器，独立于快捷键输入前缀。

## 7. 本机开发环境

| 项目             | 本次检查结果                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------ |
| 仓库             | `D:\ProjectNia\nexus-companion`，初始工作区干净                                            |
| Node             | 当前任务可调用 v24.19.0，来源为 Codex 自带运行时                                           |
| npm              | 系统未安装完整 npm；已校验并准备本项目临时 npm 12.0.2，位于 `.test-data/toolchain/package` |
| 依赖与构建目录   | 已按锁文件安装依赖，Electron 39.8.10 已按官方 SHA-256 校验；构建与发布目录已生成           |
| Git              | `D:\Git\cmd\git.exe` 可用                                                                  |
| VS Code          | `D:\Microsoft VS Code\Code.exe` 存在，`code.cmd` 在 PATH 中                                |
| Windows Terminal | `wt.exe` 启动入口在 PATH 中；未额外测试交互窗口                                            |
| 发布文件         | 0.3.0 安装版、便携版、解包程序和 SHA256SUMS；旧 0.2.0 文件保留                             |

Node 的当前位置为 `C:\Users\123\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`。这是本次任务可用的运行时，不能据此认定用户另开的终端已经具备完整开发环境。

本次没有安装系统级工具。任务中已从官方 npm registry 下载并校验 npm，使用锁文件完成依赖安装，并手动补齐 npm 12 阻止自动执行的构建工具安装步骤。长期开发建议安装完整 Node.js 24+ 与 npm。当前机器也可按下面的临时工具链说明继续开发。

另一个已确认的本机兼容问题：`electron/services/projects.cjs` 的 VS Code 按钮只检查 LocalAppData / Program Files 默认位置，未使用 PATH，也不检查 D 盘；本机两个默认候选都不存在。后续应增加可配置路径或可靠的程序发现方式。

### 当前机器的临时 npm 工具链

以下只影响当前 PowerShell；`.test-data` 被忽略，不会推送到 Git。

```powershell
$env:PATH = (Join-Path (Get-Location) ".test-data\toolchain") + ";C:\Users\123\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;" + $env:PATH
$env:npm_config_cache = Join-Path (Get-Location) ".npm-cache"
npm.cmd --version
npm.cmd run doctor
```

重新安装依赖时若 npm 12 提示阻止安装脚本，可分别运行 `node node_modules/esbuild/install.js`、在 `node_modules/electron-winstaller` 中运行 `node script/select-7z-arch.js`、以及项目根目录的 `node scripts/download-electron.cjs`。仅使用已安装并核对来源的依赖脚本。

### 建议的本地开发启动步骤

准备好 Node / npm 后，在项目根目录运行：

```powershell
npm ci
npm run doctor
npm run build
$env:NEXUS_DATA_DIR = Join-Path (Get-Location) '.test-data\development'
npm start
```

隔离开发数据可避免调试写入日常使用的数据库。上述环境变量只作用于当前终端及其子进程。

需要热更新时，终端 A 运行：

```powershell
npm run dev
```

终端 B 在项目目录运行：

```powershell
$env:NEXUS_DATA_DIR = Join-Path (Get-Location) '.test-data\development'
$env:NEXUS_DEV_URL = 'http://127.0.0.1:5173'
npm start
```

单独打开 Vite 浏览器页面无法访问桌面数据桥接。首次仍建议完成一次 build；修改 Electron 主进程、preload、worker 后需要重启桌面进程，修改界面可使用热更新。

## 8. 验证与打包

| 命令                      | 范围                                                     |
| ------------------------- | -------------------------------------------------------- |
| `npm test`                | 10 个测试文件中的 20 项 Node 单元测试                    |
| `npm run build`           | TypeScript 检查 → Node 日历模块生成 → Vite 构建          |
| `npm run verify`          | 16 阶段：3 个构建阶段、单元测试、12 组桌面测试           |
| `npm run smoke`           | 开发入口的 Electron 隐藏窗口启动检查，前提是已有构建产物 |
| `node tests/portable.cjs` | 直接执行现有 portable EXE，检查页面、桥接、引导和退出    |
| `npm run package`         | 重新构建并生成 NSIS 安装器与 portable EXE                |

`verify` 中的桌面套件为 desktop、m2–m8、e2e、polish、usability、nia。它不包含 `tests/portable.cjs`，也不自动完成安装器安装验收。

`e2e.cjs`、`usability.cjs` 与 `nia.cjs` 可用 `NEXUS_PACKAGED_EXE` 指定已解包的应用测试。`NEXUS_TEST_MODE=1` 仅在未打包应用中用于跳过首次引导；完整用户路径测试保留首次引导。

m4 和 polish 依赖本机确实存在可读 Codex 会话，因此完整验收不是完全独立于机器环境的测试。所有测试使用隔离的 Nexus 数据目录，但部分桌面测试仍读取本机真实 Codex 会话。源码中的 `codex.test.cjs` 有旧的 `D:/friend/...` 不存在目录样例，可在后续测试整理时改为受控临时路径。

Electron 下载异常时，仓库提供从缓存恢复和下载的脚本，两者都校验官方包内的 SHA-256。它们需要 npm 依赖先就绪；不是 npm 缺失时的替代安装方式。当前 `doctor.cjs` 同样预期依赖已经安装。

本机本次打包遇到 GitHub 工具下载等待，使用已安装的 7-Zip 和 electron-builder 的镜像配置完成；哈希校验保持启用。复用已经构建好的程序时可运行：

```powershell
$env:ELECTRON_BUILDER_7ZIP_PATH = Join-Path (Get-Location) 'node_modules\electron-winstaller\vendor\7z-x64.exe'
$env:ELECTRON_BUILDER_CACHE = Join-Path (Get-Location) '.test-data\builder-cache'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
node node_modules/electron-builder/out/cli/cli.js --win nsis portable --prepackaged dist/win-unpacked
```

`--prepackaged` 只封装指定目录；修改源码后应先正常运行 `npm run package` 生成新程序，不能直接拿旧目录代替重建。

本次实际验证（2026-09-21）：

- doctor 环境检查通过；完整自主 harness 的 16 个阶段全部通过，包括 20 项单元测试和 12 组桌面测试。
- Nia 专项覆盖主页笔记保存/重启、八状态预览、帧推进、系统减少动态效果、窗口隐藏恢复、动画开关持久化、深浅主题、英文和最小宽度布局。验收截图保存在 .test-data。
- 受限执行环境会导致 Electron 渲染进程崩溃，真实桌面验收使用获准的非受限执行；数据仍隔离在 .test-data。
- 最终打包复测及文件哈希以 [VERIFICATION.md](VERIFICATION.md) / [PROJECT_STATUS.md](PROJECT_STATUS.md) 为准。安装器不会在验收中自动安装。
- 直接加载领域 TypeScript 单测时有 Node 模块类型提示，不影响结果。角色素材和实现详见 [NIA_ANIMATION.md](NIA_ANIMATION.md)。

## 9. 后续优化候选

以下按继续开发时的依赖顺序整理，不代表已经修复，也不替用户决定下一个功能目标。

| 方向           | 已观察到的实现                                                                                             | 后续处理入口                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 开发环境复现   | 已补齐项目工具链并通过完整桌面回归；系统 npm 仍未安装                                                      | 长期开发准备完整 Node/npm，可进一步建立 CI              |
| 本机程序发现   | VS Code 安装在 D 盘，应用只检查两个默认位置                                                                | `electron/services/projects.cjs`                        |
| 后台数据刷新   | Agent 扫描会写数据库时间线，但 `useWorkspace` 只在初次加载和自身增删改后刷新；打开时间线页面也没有额外刷新 | 主进程变更通知或有针对性的刷新策略                      |
| Agent 详情更新 | 详情页保存打开时的 run 对象，日志仅在打开时读取；列表更新不会自动更新已有详情                              | `Agents.tsx` 的选择状态与日志刷新                       |
| 看板批量写入   | 一次拖动逐条保存整列任务，每条都刷新七个集合并写入时间线                                                   | 批量事务、一次刷新、区分排序与业务活动                  |
| 项目关联一致性 | 主进程 Agent→项目匹配只转小写，项目页还会统一斜杠；删除不清理引用                                          | 统一路径规范化及关联处理规则                            |
| 角色动画扩展   | 四组绘制动作复用于八种语义状态；旧失败时效已修正                                                           | 增加独立的庆祝/提醒动作，更新图集和帧坐标               |
| 类型与数据演进 | 通用 Entity / IPC 大量使用 any，数据库只有 schema 标记                                                     | 按功能逐步定义实体/接口，新增字段时考虑旧数据和备份兼容 |
| 国际化与外观   | 仍有中文硬编码；浅色 CSS 覆盖部分透明度规则                                                                | 翻译覆盖、CSS 变量与视觉回归                            |
| 测试可复现性   | 部分套件依赖真实会话；portable 已从 package.json 读取版本                                                  | 分离固定样例与真实集成测试                              |

功能扩展如重复日程单次例外、可自定义工作台、Live2D / Spine、外部日历、可管理自有会话的 Agent 后端，均应作为独立需求设计，不应将当前预留接口或状态当作已接入功能。

## 10. 后续接续阅读顺序

1. 先检查 Git 当前状态，再读本文中的本机现状与验证范围。
2. 依据需求定位第 4 节的功能入口，沿界面 → API → handler → 服务/存储查阅。
3. 数据变化同时考虑校验、旧数据、关联字段、备份和迁移；日历变化记得重生成 Node 端模块。
4. 使用隔离数据目录进行有针对性的验证；发布前执行完整验收及现有打包程序检查。
5. 更新相关文档，明确区分本机验证、历史记录和仍未覆盖的行为。
