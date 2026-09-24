# 在另一台 Windows 电脑继续开发（0.3.11）

仓库：[7yahaan-wq/nexus-companion](https://github.com/7yahaan-wq/nexus-companion)（Private）。本页和根目录的 `AGENTS.md` 一起维护项目规则；当前行为以 `docs/PROJECT_STATUS.md` 和 `docs/NIA_ANIMATION.md` 为准。`docs/DEVELOPMENT_HANDOFF.md` 是 0.3.1 的历史快照，其中机器路径和旧动画信息不能作为当前实现。

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

`npm ci` 严格安装 `package-lock.json` 的版本；`npm run harness` 检查资源契约、20 项单元测试、TypeScript、界面构建和 Nia 桌面播放。仓库包含 `res/Nia.png`、悠闲原画、七组当前候选源页、168 张完整候选帧、生产图集、立绘、脚本和规则，不依赖这台机器的 `.test-data`。如果 Electron 下载受网络影响，请查看 `scripts/download-electron.cjs` 和 `docs/DEVELOPMENT_HANDOFF.md` 的校验下载说明。

开发时用 `npm start` 启动本地 Electron；修改后运行 `npm run harness`，发布前运行 `npm run verify` 与 `npm run package`。完整桌面验收中涉及本地 Codex 记录的场景需要新电脑也有真实会话，因此不应把“没有记录”误报成代码失败。重新生成美术时才需要 Python 及 `pip install -r scripts/requirements-nia.txt`；日常前端和 Electron 开发不需要 Python。

## 哪些东西不会随 Git 走

- `dist/` 是本机打包输出。安装版和便携版可从私有 GitHub Release 下载，也可以运行 `npm run package` 在新电脑重建。
- `node_modules/`、`build/`、`.test-data/` 是依赖、构建和隔离测试数据，重新生成即可。
- 真实使用数据（项目、任务、笔记、日历、图片、设置、备份）存在本机 AppData 或用户自选目录，不进入源码仓库。若想在另一台机器继续**使用**同一份数据，请先在旧电脑“设置 → 数据与恢复”导出 `.nexus` 备份，再在新电脑导入；直接拉 Git 不会同步个人数据。
- Codex 登录和会话也不随 Nexus 仓库转移。新电脑要在官方 Codex 中登录并产生本地记录，再在 Nexus 的“设置 → Codex 连接”检查会话目录。
- 被否定的早期美术实验目录只留在旧机本地，已由 `.gitignore` 排除。当前播放器只使用 `public/assets/nia/animations/idle.png` 与 `public/assets/nia/animations-hires/`；它们的源文件、提示词和校验清单都在 Git 中。

## 接续约束

先读 `AGENTS.md`，检查 `git status` 和当前版本。`res/Nia.png` 与已接受的悠闲图集受保护；其余七组 0.3.11 表情虽已获用户授权上传，仍**待人工视觉验收**。不要把自动测试、上传或预发布标记当作验收结论。修改数据模型要同时检查旧数据库与 `.nexus` 备份兼容。开发测试只使用 `.test-data` 下的隔离数据目录。
