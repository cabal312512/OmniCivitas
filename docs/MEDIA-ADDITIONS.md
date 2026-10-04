# 影音和声明页增补

2026-10-03。本次是用户授权的第八阶段追加维护，不开启第九阶段。最新验收见 `media-additions-acceptance.json`，历史阶段验收和原始要求不重写。

## 入口

- `/legal/`：恰好 100 个不同语言选项，全列在页顶。仅切换声明正文，导航、窗口和站内其他页面保持原语言。中文原文为准，99 种译文为机器译文。
- `/legal/code/`：保留必要代码声明和许可原文；没有语言切换，不翻译许可证。
- `/media/`：大幅右上角背景、原生视频播放、春日影和老吴入口。后两个按钮还在 `/maze/` 和各自原深层路由出现，没有全站铺满。
- `/functions/` 的“开发”分类 → `/functions/sweep/`：扫除霉运。点击才加载指定 GIF，框可拖动、键盘移动和关闭。新的黄色角色图为该页左下角小背景，116×129；不遮拦操作。
- 首页进入扉页之后：右下角小“背景音乐”按钮。单次随机播放四首指定音频之一一遍，再点替换当前播放；不自动播放或循环。主页没有扫除霉运按钮或窗口。
- 原“奇葩”分类及其 19 个工具描述符统一改为“日常”。当前共 110 个工具、13 个分类。网页旧版标题和版权栏里的旧年份已清除。

## 文件地图

| 文件 | 作用 |
| --- | --- |
| `config/apps/portal/src/n9/n9.astro`、`n9.mjs`、`n9.css` | 两声明页与影音/扫除页叠加的真实 Three.js 粒子、轨道、形变线场、波形、路径和玻璃窗口；没有新增图形库 |
| `src/n9/windows.mjs` | 六特效窗及 GIF/视频框的拖动、键盘移动、关闭和特效窗恢复 |
| `src/n9/sound.mjs`、`home.astro` | 点击触发音效与首页角落音乐，原生 Audio、页面离开暂停、播放失败明确显示 |
| `src/n9/sweep.astro`、`2.astro`、`tools.mjs` | 开发工具独立页、描述符、按需 GIF 和小背景；窗口挂在 body，避免父级玻璃滤镜改变 fixed 定位 |
| `src/n9/languages.json`、`languages.mjs`、`public/legal-languages/` | 100 唯一代码/标签、100 份完整十五块正文，构建校验原文 hash；切换只请求本站 JSON，取消过期请求 |
| `scripts/refresh-legal-translations.mjs` | 可选译文更新工具；不是安装、构建或正常运行依赖。缓存和生成报告在本地依赖根，译文 JSON 是提交的源资产 |
| `src/pages/media.astro`、`src/n9/shortcuts.astro`、`src/aaa/cache.astro` | 视频/大背景、少量跨路由入口、原图片按钮附加春日影音效 |
| `public/forgotten-cache/` | 九个新增媒体文件，保留用户文件原字节；应用只使用本站 URL，不依赖用户原目录 |
| `tests/browser/media-additions.spec.mjs`、`playwright.media.config.mjs` | 十五项真实桌面浏览器检查，包括实际点击全部 100 语言、原生音视频、GPU、移动/关闭、分类和角落几何位置 |

表中 `src/`、`public/` 均相对 `config/apps/portal/`。旧 m08 对应现存 `04.jpg`，不添加重复图片。老吴仍保持中央大图、十二秒、没有关闭按钮且重复点击不延长的原约定。

## 验证和边界

最终十五项专项浏览器检查和 210 项合并单测通过；portal 185 静态页面构建、F 盘存储保护后的单目标 Docker 更新、九项新增媒体和二十项原声明/许可 HTTP 字节核对通过。仍只运行六个健康 core，内存 caps 合计 1728 MiB，3 GiB builder 已停止。732 原始编号、原文和 34 技术类别保护检查通过。所有构建 HTML 的显示文字中没有旧年份；原文账本、历史命名记录和第三方 XML/MathML 命名空间保留原样。

实际浏览器验证了帧绘制和音视频解码；BGM 的 native ended 检查通过 seek 到实际音频结尾触发，不是完整听完四首歌。仅桌面专项，没有重跑完整 496 项、干净 clone 或多平台部署。Ruby 可选服务的示例 year 更新仅为源码修改，本次不为它启动额外服务，也不宣称运行验证。公开版可移植性和完整代码许可审计仍在第九阶段。

报告在本地依赖目录 `runtime/reports/media-placement-final-2/`、`media-placement-unit.log`、`media-placement-runtime.json`，首次分类检查失败的报告保留在 `media-placement-final/`。该失败来自旧拖动脚本把标题 aria-label 改为“移动开发”；改为核对 h2 实际标题文本，未改变网页分类来迎合测试。早期音视频、冷加载超时和图片请求观察器失败也记录在验收 JSON，不拼接为最终专项通过。
