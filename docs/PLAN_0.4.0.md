# 0.4.0 实施与验收计划

日期：2026-10-08。本机起点：0.3.1 / 82ddc2e。发布前获取并整合远端 0.3.11 / c1a7d42，保留新 Nia 素材、立绘切换及跨机器 harness。依据：真实桌面产品体验与用户授权继续开发。

## 交付范围

1. 笔记草稿持久化、保存后定位、灵感转任务保留来源且避免重复。
2. 专注记录与任务实际用时可靠联动、跨页面计时、完成后的明确选择。
3. 首页优先展示今日/逾期工作；每日三件事、时间预算、开工/收工；项目下一步与相关灵感。
4. 统一快速记录类型、任务表单渐进展开、合理日程默认时间、窄窗口伙伴不遮挡、可读时间线和首次引导。
5. 补充回归 harness、打包验证、更新版本与文档，并按已有授权同步 Git。

保留 Electron/React/SQLite 与本地优先设计；不引入云服务、付费调用或新依赖。不迁移旧数据结构；新字段兼容现有记录。

## 文件责任与接口

- notes_flow：Notes、EntityForm、草稿辅助逻辑、notes.css、笔记回归。NoteEditor.onSaved(saved)，Notes.selectedNoteId/onSelectNote/onTask；Field.advanced。
- focus_flow：Focus、focus.css、专注服务和必要的存储事务、专注回归。Focus.initialTaskId；FocusBar/FocusCompletion 由 App 挂载。
- workbench_flow：Home/home.css、Projects、planning.css、计划逻辑与回归。Home/Projects 提供 onTask/onNote/onFocus 回调。
- 主代理：App 集成、快速记录、任务入口、日程、伙伴布局、首次引导、时间线、统一测试与发布。共享文件单一所有者。

各节点最多两轮针对性复查；发现新问题根据证据修正。子代理检查不代替主代理集成验收。

## 验收标准

- 未保存笔记在 Esc、重新打开、重启后可恢复；保存成功清草稿，失败保留；旧笔记选择不影响新笔记定位。
- 同一笔记重复转任务不会生成重复项；原文保留，可回到来源并安排/专注。
- 逾期未完成任务可见；重新安排是明确用户操作；今日计划跨重启保留且最多三件事。
- 专注暂停时间不计入，完成/提前结束准确记时，重试不重复累加，不自动完成任务。
- 1060×720 与 1366×900、深浅主题下关键内容可用；伙伴不盖住内容，保存动作可见。
- TypeScript、构建、单元测试、现有桌面验收与新增工作流 harness 通过；打包版单独复查。
- 使用独立 NEXUS_DATA_DIR 与 CODEX_HOME，真实个人数据不作为测试夹具；记录实际通过项和限制。

## 完成记录

2026-10-08：范围内功能已实现，整合远端 0.3.11；完整 harness 的 21 阶段通过（35 项单元测试、16 组桌面套件），打包版七组桌面流程与实际便携 EXE 通过，45 个应用文件与 ASAR 一致。开发交接、用户手册、发布说明与校验值已更新。具体证据及限制见 VERIFICATION.md、PROJECT_STATUS.md。角色原图和图集未重新生成；远端候选艺术的视觉验收状态保留。

## 开源参考

- Super Productivity：https://github.com/super-productivity/super-productivity — 任务与时间跟踪统一，借鉴交互原则，不复制架构或代码。
- Joplin：https://joplinapp.org/help/apps/note_history/ — 本地记录的可恢复性与用户信任；本轮实现轻量草稿保护，不冒称完整版本历史。
