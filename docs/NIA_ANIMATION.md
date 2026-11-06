# Nia 动画与立绘

0.5.4 集中调整专心工作、温柔提醒与庆祝完成三种候选动作。只有悠闲 idle 动画已获用户视觉接受，其他七种动画均待用户审阅。[当版验收记录](PROJECT_STATUS.md)

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

未参与现行播放器的旧非 idle classic 衍生帧/图集已按此前授权移除，不能因此删除原始参考或 accepted idle。规则以根 [AGENTS.md](../AGENTS.md) 为准。

## 生成与播放约束

七组候选原页由 imagegen 基于已认可的悠闲画面生成；每状态两页，每页 4×3，共 24 张完整画面，原页 1536×1024。`scripts/prepare-nia-states.py` 依据 `sourceIndex` 从原格裁切，对整张画面一次等比缩放和平移，使用预乘 alpha 采样处理透明边缘。禁止拼脸、局部变形、叠图、光流补帧及反复重采样。

运行图集为 6×4，每格 362×362，边缘留白至少 8 像素。原页、提示词和 manifest 用于追溯来源；定位点和哈希只证明对应工程性质，不能保证每处笔触一致或脸部自然。

`src/domain/avatar.ts` 定义状态、静止姿势和循环策略。idle 使用受保护的 `[0,2,...,22]`，首格 700 ms，其余每格 115 ms。专注、提醒和庆祝共用 `art/nia-state-hires/choreography.json` 中的编排：`sourceOrder` 将两页里的 24 个源格各用一次，`durations` 是播放顺序中每格的毫秒数，`scalePermille` 是可选的按源格编号设置的整格缩放千分比。idle/working/thinking/sleepy 循环，happy/warning/error/celebrate 播放一次后停留。

播放器先加载并解码图集，再推进时间轴；每次只显示一个完整格子，不交叉淡化。切换图集使用独立 DOM key，避免旧图承接新坐标。隐藏窗口、关闭角色动画或系统减少动态效果时暂停。`scripts/build-nia-24.py` 只负责已接受 idle 的整格打包，不应重新生成或改变其哈希。

## 在本机修改一个动作

1. 打开该状态的两张源页，先挑出准备、主要动作和收势。修改编排时，一直用原始完整画面，保留头发、衣服、手和道具之间的关系。专注动作需要跨末帧和首帧检查，提醒和庆祝需要让最终停留的姿势单独也能读懂。
2. 在项目根目录使用已装有 `scripts/requirements-nia.txt` 所列 Pillow、NumPy 的 Python 环境。只重导本次改动的状态，例如 `python scripts/prepare-nia-states.py --state working`。一次选择多个状态可重复 `--state`。试做时，同时指定 `--frames .test-data/nia-trial/frames --output .test-data/nia-trial/atlases`，试做清单将写入 `.test-data/nia-trial/manifest.json`。
3. 导出器按状态比对源页、参考图、源格顺序、比例、环境和已有输出哈希。再次运行相同的导出命令时，符合条件的状态显示 `reused`。单改 `durations` 时播放器直接读取新时长，在项目根目录运行 `node scripts/sync-nia-review.mjs` 即可同步离线验收页，无需重新生成图片。
4. 在源码目录打开 `docs/NIA_REVIEW.html` 逐格定位眼睛、发顶及电脑边缘，再到设置的「认识更多面的 Nia」按实际尺寸看完整动作。以同一处过渡做修改前后的比较，在项目状态里分别记录工程检查、独立体验及用户验收结果。[本轮参考的桌宠项目](OPEN_SOURCE_RESEARCH.md)

## 使用与验收

伙伴栏与设置预览提供“动画／立绘”选择，`avatarDisplay` 保存到本地；收起伙伴保留紧凑偏好，窄窗口使用独立小栏。Core、自定义 Avatar Pack 与对应设置继续支持；导入 GIF 自身的播放不由内置动画开关控制。

在设置预览逐一切换八种状态，检查触发说明、表情、实际显示尺寸的清晰度、页间接缝及动作结束姿态。源码中的 `docs/NIA_REVIEW.html` 支持暂停、拖动帧位置并与 idle 对照；它依赖源码 `public/` 下的图片，只在源码目录使用，不随打包文档复制。

`npm run harness` 检查当前素材契约和播放器。发布用 `npm run harness -- --full --resume`，打包后用 `npm run verify:packaged -- --resume` 核验本次构建。报告将本次实际执行的阶段与按输入指纹复用的成功阶段分开记录。
