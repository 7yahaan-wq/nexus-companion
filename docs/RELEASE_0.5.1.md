# Nexus Companion 0.5.1

日期：2026-10-24。本次按独立用户体验走查，改善 Agent 恢复路径和日历当下定位，并增加可复用的验证续跑流程。

## 用户可见变化

- Agent 工作台分别说明正在读取、已暂停、目录不可用、尚无会话和筛选无结果。筛选可一键清除，暂停可显式启用，连接问题可直接定位设置中的 Codex 连接区；展示读取目录和扫描时间。
- 日历周/日视图首次打开定位当前时段，并标出当前时间。重复点击“今天”可重新定位，数据刷新不会打断手动滚动。历史日期不显示错误的当下标线。
- 今天新建日程默认使用接下来的 15 分钟刻度，避免晚上仍预填当天 09:00；过去日期保留 09:00 起始，表单仍由用户确认保存。

## 可重复开发流程

默认 Harness 继续完整执行。显式 `--resume` 仅复用最近 24 小时、输入和环境指纹一致、日志和产物仍完整的成功证据，并区分本次执行与复用。失败、缺失产物、输入变化、损坏缓存和旧版无指纹报告不可复用。固定阶段、总期限和单步时限约束执行；遇错停止，不自动重试。

独立体验、参考研究、文件归属、验收锁定、有限修复、续接状态和发布验证的流程见 [DEVELOPMENT_LOOP.md](DEVELOPMENT_LOOP.md)。运行证据只写隔离 `.test-data/`，不进入仓库或发布包。

研究参考为 [Super Productivity 的日历定位](https://github.com/super-productivity/super-productivity/blob/dee0b6d20ca11926b4488fc237470efe580ee55b/src/app/features/schedule/schedule/schedule.component.ts) 和 [CodexMonitor 的空态区分](https://github.com/Dimillian/CodexMonitor/blob/dd61b9abd37de5ded86e82b9fe8a83fd49d46fa5/src/features/app/components/Sidebar.tsx)。只借鉴交互原则，未复制代码、美术或添加依赖。

## 兼容性与验收

保留现有记录、设置、备份格式和导入头像包。会话 tokens、共享套餐快照和手动官方 Credits 估算继续保留；Nexus 不提供账号登录、任务执行或实时控制。

Nia 素材和播放器未修改，只有 idle 动画获用户视觉接受，七组非 idle 动画仍为候选。

当前构建的检查、执行/复用记录和产物哈希见 [PROJECT_STATUS.md](PROJECT_STATUS.md)；验收范围见 [VERIFICATION.md](VERIFICATION.md)。安装器构建不代表安装向导已执行。源码 Git 同步不包含 EXE，历史版本文档通过 Git 标签保留。
