# Nia 动画与立绘

当前版本 0.4.1 已清理 175 个不再使用的旧衍生文件，保留现行播放器和美术。**只有悠闲 idle 动画已获用户视觉接受；其他七组独立 24 格动画仍是候选。** 本轮素材契约、源码及打包版 Nia 验证均已通过，结果见 [PROJECT_STATUS.md](PROJECT_STATUS.md)；工程检查不能替代用户的视觉验收。

## 素材保留范围

| 路径                                                                    | 用途                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------ |
| `res/Nia.png`、`public/assets/nia/calm.png`                             | 受保护的角色设计与风格参考                       |
| `art/nia-source/`                                                       | 受保护的原始素材来源；不作为当前非 idle 播放输入 |
| `art/nia-classic-frames/idle/`、`public/assets/nia/animations/idle.png` | 已接受的 idle 源格与运行图集                     |
| `art/nia-reference-manifest.json`                                       | 受保护素材校验清单                               |
| `art/nia-state-hires/`                                                  | 七组候选源页、独立帧、提示词及来源/配准 manifest |
| `public/assets/nia/animations-hires/`                                   | 七组当前候选运行图集                             |
| `art/nia-portraits/`、`public/assets/nia/portraits/`                    | 八张完整状态立绘源图及运行资源                   |

未参与现行播放器的非 idle classic 衍生帧/图集属于本轮明确清理对象，不可因此删除原始参考或 accepted idle。规则以根 [AGENTS.md](../AGENTS.md) 为准。

## 生成与播放约束

七组候选原页由 imagegen 基于已认可的悠闲画面生成；每状态两页，每页 4×3，共 24 张完整画面，原页 1536×1024。`scripts/prepare-nia-states.py` 依据 `sourceIndex` 从原格裁切，对整张画面一次等比缩放和平移，使用预乘 alpha 采样处理透明边缘。禁止拼脸、局部变形、叠图、光流补帧及反复重采样。

运行图集为 6×4，每格 362×362，边缘留白至少 8 像素。原页、提示词和 manifest 用于追溯来源；定位点和哈希只证明对应工程性质，不能保证每处笔触一致或脸部自然。

`src/domain/avatar.ts` 定义状态、帧序列、逐格时长和循环策略。idle 使用受保护的 `[0,2,...,22]`，首格 700 ms，其余每格 115 ms。其他动作普通格为 105–160 ms，首格 500 ms、末格 600 ms。idle/working/thinking/sleepy 循环；happy/warning/error/celebrate 播放一次后停留。

播放器先加载并解码图集，再推进时间轴；每次只显示一个完整格子，不交叉淡化。切换图集使用独立 DOM key，避免旧图承接新坐标。隐藏窗口、关闭角色动画或系统减少动态效果时暂停。`scripts/build-nia-24.py` 只负责已接受 idle 的整格打包，不应重新生成或改变其哈希。

## 使用与验收

伙伴栏与设置预览提供“动画／立绘”选择，`avatarDisplay` 保存到本地；收起伙伴保留紧凑偏好，窄窗口使用独立小栏。Core、自定义 Avatar Pack 与对应设置继续支持；导入 GIF 自身的播放不由内置动画开关控制。

在设置预览逐一切换八种状态，检查触发说明、表情、实际显示尺寸的清晰度、页间接缝及动作结束姿态。源码中的 `docs/NIA_REVIEW.html` 支持暂停、拖动帧位置并与 idle 对照；它依赖源码 `public/` 下的图片，只在源码目录使用，不随打包文档复制。

`npm run harness` 检查当前素材契约和播放器，发布前运行 `npm run harness -- --full` 及 `npm run verify:packaged`。新增或修改角色美术还必须人工检查完整序列。来源、自动检查、上传和用户视觉接受是不同结论，应分别记录。
