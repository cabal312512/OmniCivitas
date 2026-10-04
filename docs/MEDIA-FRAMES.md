# 小素材窗与 3D 音乐

2026-10-03，第八阶段追加维护。当前素材已随 portal 更新；HTTP 原字节核对、原生音乐控件与两素材窗专项检查通过。按用户要求只做简短验证，未重跑完整浏览器套件。第九阶段未开始。

## 两个小窗

| 路由 | 内容 | 操作 |
| --- | --- | --- |
| `/maze/display/` | `/forgotten-cache/p2/7.jpg`，176px 宽、摆正的小框 | 点击图片，从 `a0.mp3`–`a4.mp3` 随机选一首，播放一遍；再次点击替换当前播放 |
| `/maze/notifications/unread/` | `/forgotten-cache/p2/8.gif`，同宽小框，保留 GIF 动画 | 独立显示，不播放音频 |

两个框均可拖动、用标题手柄的方向键每次移动16px、叉掉。语音框只复用一个原生 Audio，`preload=none`、`loop=false`；图片出现时不请求或播放语音。关闭时暂停并释放音源，隐藏页面时暂停；实际离开页面清理监听，浏览器页面缓存返回保留框状态但不自动续播。播放失败显示小 `×`，可以再次点击重试。原有首页四曲按钮、春日影、老吴和其他素材入口保持各自行为。

## 七曲游戏音乐

入口 `/functions/3d-world/`。背景音乐默认开启、音量0.32，但在第一次实际游戏操作前不创建 Audio、不播放；原生指针/键盘、全屏或音乐控件触发后才开始。使用一个独立 Audio 按真实 `ended` 事件顺序播放 `1→2→3→4→5→6→7→1`，每个文件自身 `loop=false`。

| 文件 | 曲名 |
| --- | --- |
| `1.ogg` | memory of a dream |
| `2.ogg` | ever and never |
| `3.ogg` | drifting stardust |
| `4.ogg` | between the waves |
| `5.ogg` | like wild horses on the hills |
| `6.ogg` | closer |
| `7.ogg` | in the end, only sorrow |

音乐按钮控制开关，音量滑块范围0–1。关闭保留当前曲目和位置；重新开启续播。音乐滑块独立于程序生成的射击/环境音；全局静音同时静音两路，保留音乐滑块值。暂停游戏、通关窗口、页面隐藏均暂停音乐，恢复须等全部暂停原因解除。退出释放音源和监听，实际页面缓存返回走暂停/恢复分支。播放被拒绝或音频不可用时，游戏仍可运行并允许重试。

这七首音乐来自 Efilheim 的 [anamnesis 官方页面](https://efilheim.itch.io/anamnesis)，作者声明为 Public Domain / [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，署名非强制。本次按用户要求，在小游戏目录 `/functions/games/` 和素材声明 `/legal/` 放置作者、音乐包与 CC0 链接。该说明在100种语言声明正文之外，不改变中文原文、翻译正文或数量；也不把其他未知来源图片、MP3、GIF 或视频标成 CC0。

## 文件地图

下列路径均相对仓库根目录；应用使用本站媒体 URL，不依赖素材原始来源目录。

| 源文件/资产 | 作用 |
| --- | --- |
| `config/apps/portal/src/p2/Frame.astro`、`p2.mjs`、`p2.css` | 两小窗、随机单次语音、拖动/关闭和生命周期 |
| `config/apps/portal/src/pages/maze/[...path].astro` | 仅在上述两个路由挂小窗 |
| `config/apps/portal/public/forgotten-cache/p2/` | `7.jpg`、`8.gif`、五个 `a0.mp3`–`a4.mp3`，保留用户文件原字节 |
| `config/apps/portal/src/3d/music.mjs` | 七曲列表、延迟播放、开关/音量、独立暂停原因和释放 |
| `config/apps/portal/src/3d/main.mjs`、`1.astro`、`1.css` | 游戏操作/生命周期接线和小型音乐控件 |
| `config/apps/portal/public/aero-music/` | 七个 `1.ogg`–`7.ogg` 原文件 |
| `config/apps/portal/src/components/MusicCredit.astro` | 仅游戏音乐的作者/官方包/CC0 链接 |
| `config/apps/portal/src/pages/functions/games.astro`、`pages/legal/index.astro` | 两处音乐引用；语言正文继续由原声明与译文管理 |
| `tests/3d-music.test.mjs` | 八项音乐模型/生命周期测试，Audio 为测试替身 |
| `tests/browser/media-frames.spec.mjs`、`3d-music.spec.mjs` | 原生小窗、五语音、七音乐、关闭/退出及署名范围验收 |

## 验证状态

<!-- media-frames-validation-start -->
最新 portal 已构建186页并按实际 Docker 数据盘保护完成单目标部署。`3d-capital-runtime8.json` 记录九路由 HTTP 200、实际游戏脚本一致、两张图片/五个MP3/七个OGG共14份媒体原字节一致、20份既有代码声明/许可原字节一致。六个 core 健康、容器上限合计1728 MiB，3 GiB builder 已停止；源码与媒体封存见 `3d-capital-source-frozen9.json`。这些报告位于本机依赖根的 runtime/reports，不是网站运行依赖。

音乐8项模型单测包含在 frozen7 的294项整合单测通过记录中，音乐及两小窗应用源码在 frozen9 中保持相同 hash；这不是当前全地图刷怪版本全部功能的完整回归。本轮五项简短浏览器检查首次4/5通过，包括原生音乐开关/音量/全局静音。唯一失败来自小图窗直立样式断言：浏览器实际返回rotate:none及单位变换矩阵，旧断言没有接受这个同样直立的结果。应用未修改，仅修正断言以核对零旋转/实际单位变换；两路由小图窗及原始图片字节这一项独立重跑1/1通过，耗时2.5秒。报告分别为 `3d-capital-brief8/3d-playwright.json`（4通过、1断言失败）及 `3d-capital-brief8-media/3d-playwright.json`（1/1通过）；不将两份报告写成一次完整5/5运行。

保留的浏览器测试还包含七曲顺序、五语音单次播放、关闭/离开清理等更长检查；本轮不运行完整38项套件，也不宣称原生听完七首OGG或逐个验证五个MP3的一整次播放。较长的七曲顺序测试会把实际 Audio seek 到曲尾后观察真实 ended，不能当作完整收听证明。源码实现、模型替身测试、HTTP 资产检查与原生操作证明分别记录，不互相替代。
<!-- media-frames-validation-end -->
