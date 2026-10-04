# 第四阶段互动追加修订

2026-10-03。第四阶段独立互动追加修订已完成并停止，第五阶段未授权。新完整 50/50 浏览器检查（桌面/手机各 25，无失败或重试拼接）通过，39 个页面 HTTP 200；四个用户素材原始字节/hash 一致。当前 44 条主要要求为 38 verified、6 verified-with-override，12 截图项仍通过。原基线 34/34 浏览器与 21/21 后端资料保留为历史，不能冒充本轮新证明。 停点见 phase-state.json，逐条新证据见 interaction-acceptance.json。

## 本轮逐项核对

| 项 | 实际实现 | 证据入口 |
| --- | --- | --- |
| IR001 临时信息卡删除 | 删除蓝色辅助卡和复制/回填/重新生成按钮；虚构用户名/口令只在原字段占用提示中显示，手动输入可完成 | phase4.spec.mjs 的 `Temporary card and helpers are absent`、`Manually retyping` |
| IR002 原窗口互动和光学操纵 | 标题/局部控件可真拖动、关闭、抽搐、复位；光学盘实际旋转 Three 对象，发射 GPU 波纹，真实射线拾取及轻量门户响应 | interaction-*-windows.json / gpu.json |
| IR003 瞬移随机 5–30 次 | 每轮 crypto 随机整数次数；接近时逃开，到数后点击能关闭；复位允许新一轮 | interaction-*-teleport.json |
| IR004 持续变速变向 | 不设自动停止时限；方向/速度持续随机变动；关闭退场、后台/系统减少动画暂停，恢复后仍继续 | interaction-*-continuous.json |
| IR005 两张小图藏在按钮里 | `/maze/cache/l1/l2/` 附件按钮第一次点击才创建两张 img 并发请求，最大 132×164px，正放；关闭/重开复用 | interaction-*-attachments.json |
| IR006 老吴 | `/maze/empty/` 显眼按钮，原 GIF 居中大图显示 12 秒；无 ×/Escape 关闭，活动期间重复点击不延时；减少动画显示静态帧，出口仍可用 | interaction-*-laowu.json |
| IR007 区别对待 | 各窗口新增 0–2 个控件；部分只用原标题/原 ×/撤销/矩阵格。天气、旧通知自己持续移动；空框、确认、频谱、轻量通知自己间歇抽搐 | interaction-*-personalities.json |
| IR008 最新主页图 | `c (4).avif` 直接放进主页新框，120px 宽、正放，标题可拖、原 × 可关、复位恢复；扉页不展开 | interaction-*-home-image.json |

JSON 证据的 `*` 是 desktop 或 mobile。本轮最终原始浏览器报告与各证明文件位于本地运行目录的 `reports/interaction-delivery/`；不会提交实际缓存或测试临时产物。

## 当前源图与保留关系

- `config/apps/portal/src/aaa/a.js` / `1.css`：固定窗口记录、差异控件、主动运动、拖动/关闭/复位、四条连线与八个复用闪光。每个窗口只保留一条当前抽搐动画。
- `lens.astro`：光学盘与固定恢复入口。恢复窗口不停止已启动的持续运动，没有“停止乱动”按钮。
- `反应堆.js` / `光场.js` / `没有开门的大厅/light.js`：保留原两层渲染，加真实手动旋转、有限波纹/扩散。手动形态选择不会被焦点滚动或布局延迟清掉；实际滚动/导航意图恢复章节自动变形。
- `cache.astro` / `laowu.astro` / `img.astro`：三个独立素材入口，原字节、hash、尺寸及待审许可在 user-supplied-assets.json。
- `没有开门的大厅/identity.js` / `pages/identity/[mode].astro`：原输入现场清空，不发送、不保存；仅显示本地虚构身份，后端账号路由依旧从不注册。

原双层光场、全部失修碎片、迷宫和门户继续挂载；旧“临时信息”辅助卡与同一排四按钮的源代码分别留在 historical 的停用目录。原早期梗图合集、React/Angular 全套 UI 仍停用。最新只重新授权四个单独素材，不把原合集全恢复。

## 证据和限制

新完整 50/50 通过，8 项最新要求逐条实测；39 个 HTTP 页面、8 次账号 GET/POST 全为 404、真实 PostgreSQL 三张停用账号表均为空，17 个新增/修改应用源文件没有本机绝对路径。完整原始证明另存 interaction-acceptance.json。专项 6/6 和旧失败报告独立保留，本轮采用一份全新完整通过报告。

仅六个 core 健康，容器 caps 1728 MiB；3 GiB builder 已停止。最后 Docker/WSL 工作集采样 2905.3 MiB，非长期峰值保证。本轮新依赖零，实际工具/缓存/临时产物继续在本地依赖目录；阶段九公开部署/干净 clone/多平台与素材再分发许可审计待办。

冷页面实际 JS 字节：经典 750943，统一 29036，轻量 999958；轻量版确实最大，不凭命名或装包判定。原后端 21 项/true-flag 探测为历史基线，本轮未改后端且未虚报重新执行该 21 项。

较早的 interaction-initial 7/12、interaction 40/46、interaction-final 46/48 都留在各自目录。原窗口新增互动后确实遮住了旧测试目标，改用真实键盘/关闭/拖动路径。CSS 无变换既可序列化为 `none`，也可为单位矩阵；不以字符串差异冒充画面问题。旧形态选择出现焦点/布局滚动竞态，源码已改为保持手动选择直到实际滚动/导航意图。

GIF 曾错误地用 canvas 抽帧判断动画；改为捕捉实际 img 的不同像素帧，因为 drawImage 对动画图像使用默认帧。[WHATWG Canvas 规范](https://html.spec.whatwg.org/multipage/canvas.html#image-sources-for-2d-rendering-contexts)。较早手机的重复点击检查也曾排在慢截图之后，已超过真实 12 秒截止；改为在截图前核对活动期不续时，不改变实际显示时长。

本轮没有新依赖，F: Docker 实盘确认后才构建，只更新 portal，顺序构建的 3 GiB builder 完毕停止；可选基础设施不启动。持续运动使用固定节点/资源池，页面离开回收、后台暂停、减少动画保留静态互动。软件 GPU 证据不能视为流畅度保证，故意遮挡和手机裁切仍按用户要求保留。

A164/A165 的可选辅助按钮按最新要求停用；A289 的两三次停止被最新 5–30 次/持续移动要求覆盖。732 条原文、行号/hash、146 原技术和 34 来源分类不改。阶段八其余互动/历史构建仍 planned。阶段九 public release portability audit、干净 clone、多平台部署和素材公开再分发许可仍待办，不用本机通过替代公开发布证据。
