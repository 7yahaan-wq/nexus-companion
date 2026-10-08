# Nexus Companion 0.3.3

本版本修复 0.3.2 动画透明叠图造成的闪烁。

- Nia 的八种状态各有独立的 12 帧透明序列图。新帧基于 res/Nia.png 设定图和原始图集制作，播放器每次只显示一张完整帧。
- 空闲、工作、思考和困倦状态循环；完成与提醒类动作播放一次后保持末帧。设置中的表情预览继续说明真实触发条件。
- 仓库新增 AGENTS.md 和 npm run harness，记录跨机器资源保护、测试与发布规则。
- npm run package 自动清理 dist 中识别出的旧版 Nexus 文件，生成当前版安装器、便携版和 SHA-256 校验文件。

原始数据格式与自定义 Avatar Pack 不变。Windows x64 安装包未签名。验收详情见 PROJECT_STATUS.md。
