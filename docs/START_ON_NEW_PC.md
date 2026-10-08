# 在另一台 Windows 电脑继续开发（0.4.1）

仓库：[7yahaan-wq/nexus-companion](https://github.com/7yahaan-wq/nexus-companion)（Private）。本页和根目录的 `AGENTS.md` 一起维护项目规则；当前行为以 `docs/PROJECT_STATUS.md` 和 `docs/NIA_ANIMATION.md` 为准。`docs/DEVELOPMENT_HANDOFF.md` 已更新 0.4.1 工作流和播放器说明，但其中本机工具链路径仍是历史环境记录，不能直接用于另一台电脑。

## 拉取与验证

准备 Windows 10/11 x64、Git、Node.js 24+（自带 npm）。在已获该私有仓库访问权限的 GitHub 账号下运行：

```powershell
git clone https://github.com/7yahaan-wq/nexus-companion.git
cd nexus-companion
git switch main
git pull --ff-only
node --version
npm ci
npm run harness
```

`npm ci` 严格安装 `package-lock.json` 的版本；`npm run harness` 检查环境、资源契约、当前全部单元测试、TypeScript、界面构建和 Nia 桌面播放。仓库包含 `res/Nia.png`、悠闲原画、七组当前候选源页、168 张完整候选帧、生产图集、立绘、脚本和规则，不依赖旧电脑的 `.test-data`。如果 Electron 下载受网络影响，请查看 `scripts/download-electron.cjs` 和 `docs/DEVELOPMENT_HANDOFF.md` 的校验下载说明。

开发时设置 `$env:NEXUS_DATA_DIR = Join-Path (Get-Location) '.test-data\development'`，再用 `npm start` 启动 Electron，避免写入日常数据库。修改后运行 `npm run harness`，发布前运行 `npm run harness -- --full`（含 `verify`）与 `npm run package`。当前完整回归为 Codex 设置隔离目录，需要会话内容的套件生成受控样例，不要求复制个人真实会话；实际产品集成检查仍需新电脑有自己的本地会话。重新生成美术时才需要 Python 及 `pip install -r scripts/requirements-nia.txt`；日常前端和 Electron 开发不需要 Python。

打包只删除名称被识别为旧版生成物的文件，不递归清空 `dist` 或其他目录。随后运行 `npm run verify:packaged` 验证打包桌面流程和新便携包；除非实际执行安装向导并核对，否则不能声称安装器已安装验收。源码 push 不包含 EXE；上传私有 Release 资源要遵循当前任务授权。

## 哪些东西不会随 Git 走

- `dist/` 是本机打包输出。若已授权上传，可从私有 GitHub Release 下载安装版和便携版；也可以运行 `npm run package` 在新电脑重建。当前配套文档统一放在 `dist/docs/`，入口是 `dist/README.md`。
- `node_modules/`、`build/`、`.test-data/` 是依赖、构建和隔离测试数据，重新生成即可。
- 真实使用数据（项目、任务、笔记、日历、图片、设置、备份）存在本机 AppData 或用户自选目录，不进入源码仓库。若想在另一台机器继续**使用**同一份数据，请先在旧电脑“设置 → 数据与恢复”导出 `.nexus` 备份，再在新电脑导入；直接拉 Git 不会同步个人数据。
- Codex 登录和会话也不随 Nexus 仓库转移。新电脑要在官方 Codex 中登录并产生本地记录，再在 Nexus 的“设置 → Codex 连接”检查会话目录。
- 已确认不用的旧衍生素材与历史报告从现行目录清理，源代码历史通过 Git 标签查阅。原始参考与 `art/nia-source/` 保留。当前播放器只使用 `public/assets/nia/animations/idle.png` 与 `public/assets/nia/animations-hires/`；它们的源文件、提示词和校验清单都在 Git 中。

## 接续约束

先读 `AGENTS.md`，检查 `git status` 和当前版本。`res/Nia.png`、`public/assets/nia/calm.png`、`art/nia-source/` 与已接受的悠闲源帧/图集受保护；七组当前候选表情仍**待用户视觉接受**。不要把自动测试、上传或预发布标记当作美术验收结论。修改数据模型要同时检查旧数据库与 `.nexus` 备份兼容，保留每日计划、草稿和自定义角色包。开发测试只使用 `.test-data` 下的隔离数据目录。
