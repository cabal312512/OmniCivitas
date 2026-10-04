# OmniCivitas：零上下文接手入口

先读本文，再读 AGENTS.md、PHASES.md、PROGRESS.md、DECISIONS.md 与账本。用户最新消息优先于原始两个提示词。不要仅凭目录名判断文件是否废弃。

## 停在哪里

第三阶段已验收：77 条阶段要求加跨阶段 A042，共 78 条；71 项前端技术有真实用途及运行证据。原报告 PHASE-3-ACCEPTANCE.md / phase-3-acceptance.json 必须保留。

用户随后授权一次独立视觉大改，并要求本文。此修订的当前状态以 phase-state.json 的 activeRevision 和 PHASE-3-VISUAL-REVISION.md 为准。它不是第四阶段授权，也不是第八阶段整体完成。没有用户明确继续，完成本次验收后停止。

九阶段：1 基建账本；2 后端/基础设施；3 前端技术；4 三门户/导航/搜索/虚构身份；5 文本开发数学转换；6 文件图片时间学习科学；7 游戏奇葩工具生成器；8 剩余交互视觉历史配置；9 全量独立审计与 public release portability audit。不要另拆出第十阶段。

## 用户到底想要什么

这是可运行的荒谬技术展览。所有原始点逐条保留、最后逐条核对；允许原创发挥；只有真矛盾或导致无法运行的要求才做有记录的权衡。文件、目录、命名故意混乱，下面的地图必须维护。

最新视觉方向已覆盖早期整站复古方案：现代科技官网的精密主体、金属/玻璃/干净排版，与丑乱梗图、局部旧窗口、异常比例共存。区域大块划分，各模块材质、大小、配色、年代不同；多层路由、左右滚动、上下长卷、重叠错位、局部乱飞。不要整站橙色锅壁纸，不要全变同款玻璃卡片，不要所有文案语无伦次，不要堆解释性套话。用户给的 kinetic typography、mask reveal、粒子、shader noise、磁吸、倾斜、横向章节、叠卡等是灵感；本轮实现记录见视觉报告，未提供视频，不冒称已实现视频/3D 无缝切换。

用户删除了可见“停止乱动”按钮；不得加回。继续尊重系统 prefers-reduced-motion、保持导航与按钮可操作。装饰不抢指针，漂浮碎片最多 8 个，渲染画布最长边 640 像素，约 30 FPS 上限，离开视口/页面隐藏时休息。不能靠泄露真实密码、无限调用、破坏数据或错误导出来制造屎山。

第四阶段身份页还没有实现：外观较正常，参照 docs/assets/reference-registration.jpg。第一次输入后仅浏览器内现场随机生成虚构的“已占用”用户名/密码；用户把新生成的这组填进去就能进入。人机验证只是画样子。原始输入的密码绝不发请求、记录、持久化；真实账户 API 从未挂载。不要把这些虚构提示写成真实用户信息。

## 账本，不允许凭存在即验收

- PROJECT_SPEC.txt：381 条 A；AI写的提示词.txt：351 条 B。两个原文及 hash 保持不动。
- docs/requirements.json / REQUIREMENTS.md：732 条编号原文、阶段、状态、证据及未编号来源项。
- docs/technologies.json / TECHNOLOGIES.md：146 项技术，含 34 个原始分类；活跃技术必须真实调用，休眠遗迹不必安装编译器。
- docs/screenshot-requirements.json：截图的 12 条行为要求。
- docs/public-release-requirements.json / PUBLIC-RELEASE.md：用户追加的 12 条公开部署约束。
- `pnpm ledger:check` 只证明账本完整性，不证明业务全部实现。不要为了过审给未实现条目贴 verified。
- `scripts/record-phase3.mjs` 是旧阶段收官工具，不要对已完成阶段再次运行并覆盖历史验收。

## 真实文件地图

| 文件/目录 | 实际职责 |
| --- | --- |
| config/apps/portal/src/pages/index.astro | 当前首页拼装及核心验收表单；实际 Astro 总壳 |
| config/apps/portal/public/bureau.css | 首页和 Next 共用品牌头、导航、基础样式 |
| config/apps/portal/src/components/Loading.astro | 科技首屏、金属环画布、重力/投掷控件及卫星梗图 |
| config/apps/portal/src/js/g.js | WebGL raymarch/noise、粒子、鼠标照明/角色、磁吸、tilt、滚动字体、mask、scramble、odometer、路径描线、暂停/恢复/回收；window.__ocvScene 只给诊断 |
| config/apps/portal/src/styles/main.css | 新首页视觉与响应式；必须在旧 Tailwind/Less 后加载 |
| config/apps/portal/src/components/Base.astro | 大区地图、iframe 套窗、36 段长卷 |
| config/apps/portal/src/components/Table.astro | 横向章节、滚动路径、叠卡 |
| config/apps/portal/src/components/Assets.astro | 原图通用组件，运行时减少动画的画布替身 |
| config/apps/portal/src/data/路过的十六位.json | 16 张原图清单，原名、相对 URL、尺寸、大小、SHA256 |
| config/apps/portal/public/memes | 16 张用户原始字节，不依赖原来 D 盘目录 |
| config/apps/portal/src/ui | 真 Vue / Svelte / Solid 小岛，不能误认为示例死文件 |
| config/apps/portal/src/js/client.js | Lit、Alpine、htmx、jQuery、校验、日期、跨标签、存储功能 |
| config/apps/portal/src/js/db.mjs | 真 IndexedDB、拆碎对象重组、CSV Cache Storage、WorkerManagerFactory |
| config/apps/portal/src/styles/top.css | 现在只给深层走廊；旧整站复古样式已经撤换 |
| config/apps/portal/src/pages/corridors | 厨房、仓库、横向地下长廊、打印裸页嵌套路由 |
| config/apps/portal/public/lost-css/receipt.css | 有效 CSS，打印裸页故意 media=print；别“修好”这个指定笑点 |
| config/apps/web2/app/layout.tsx / main.scss | Next 共用导航与自己的纸面材质；修改前读该目录 AGENTS.md 和已安装 Next 指南 |
| config/apps/web2/tmp/index.tsx | 真 React 多状态/UI/表单/缓存，文件名不是废弃文件 |
| config/apps/web2/app/next-api/receipt/route.ts | Next → Nest 有限中转；没有账户接口 |
| config/apps/ng/src/main.ts | 真独立 Angular CLI 小窗，严格同源父子消息 |
| scripts/copy-angular.mjs | Angular 静态产物进入 Astro public；不需要常驻 Angular 服务 |
| services/gateway/src/main.ts | Nest 核心/API/健康入口 |
| services/gateway/src/备份_别删/a_final.ts | 真后端盖章编排，不是假备份 |
| compose.yaml / infra / services | 24 服务完整配置与语言代码；其余地图见 docs/烂摊子地图.md |

## 入口与实际服务

默认网站 http://127.0.0.1:8080。首页 `/`，Next `/borrowed`，状态 `/status`；嵌套分支 `/corridors/canteen/line/0`、`/corridors/warehouse/door/inside`、`/corridors/error/another-floor/tape`、`/corridors/archive/print-preview/receipt`。Angular `/ng/` 为静态包。Nginx 代理 `/api` 到 Nest，`/next-api` 与 `/_next` 到 Next。不要接入真实账号采集。

默认 core 六个服务：edge、portal、next、gateway、postgres、redis，限制共 1728 MiB。数据库真实运行，optional 未启动时返回有限失败而不是阻塞主站。24 个服务配置均保留，全部 caps 共 7840 MiB；完整组稳定性取决于主机，按需分批。不能因 memory fallback 返回成功就说 PostgreSQL/Redis 验证过。

## 本机 E/F 与公开版必须分清

这台 Windows 主机 24 GB RAM。源码/配置/交付在 E:\OmniCivitas；依赖、工具、下载、缓存、临时文件和运行数据在 F:\OCVdeps。每条 PowerShell 项目命令先 dot-source `scripts/Enter-OcvEnvironment.ps1`，或用 `ocv.ps1`。不要用 C 盘旧 pnpm / npm 全局工具，不要全量补装无用遗迹。

WSL 日常 9 GiB，maximum 11 GiB，Docker Desktop 合计计划不长期超过约 12 GB。builder 实际 cap 3 GiB，重型镜像顺序构建，完成后停 builder。Docker 主配置 named volumes，实际 VHDX 放 F 的事实必须由 Confirm-DockerStorage.ps1 检查后才准 pull/build。设置里写了 F 不等于实际 VHDX 已搬走。

本机标准用法：

```powershell
cd E:\OmniCivitas
. .\scripts\Enter-OcvEnvironment.ps1
pnpm ledger:check
pnpm dev
```

Docker 占用 8080 时，不要同时把 dev 开在 8080。临时原生 dev 可设置 OCV_WEB_PORT=8090、OCV_PORTAL_PORT=4330、OCV_NEXT_PORT=3210、OCV_GATEWAY_PORT=3010。启动器默认 8080/4321/3200/3000；没有数据库环境变量就是有限内存模式，不能当真实库测试。

只重建本轮前端并恢复 core：

```powershell
. .\scripts\Enter-OcvEnvironment.ps1
node scripts/rebuild-phase3.mjs portal next
```

该本机 helper 先执行 F: 实盘确认，确认只有 core/有宿主机余量，再顺序构建，finally 停 builder，重新拉起 portal/next/edge。只改 Astro 可仅传 portal。不要无故 build maximum，不要清卷。

公开 GitHub 仓库不能依赖本机盘符/用户名/24 GB。新应用、Dockerfile、Compose 主配置、普通启动入口不写绝对本机路径；本机 bind mount 只放 local override。缓存位置只是本地优化。仓库只交 .env.example，不交真实 .env/token/证书/数据库数据。pnpm install/dev/build 和 docker compose up 是公开目标。

已知旧耦合仍有 preinstall guard/.npmrc/Nx 缓存等，记在 PUBLIC-RELEASE.md；不要声称干净 clone 或 Windows/Linux/macOS 全部测试通过。第九阶段独立搜路径、用户名、host/port、volumes、env/secrets/gitignore，然后干净环境从零安装启动。当前开发例外不自动等于公开版需求。

用户已接受 Windows 系统组件/Windows Installer 维护缓存例外，目录见 C-DRIVE-EXCEPTIONS.md。清理通常正常删除；自动审批拒绝后用户偏好尝试回收站，但仍必须遵守审批本身的边界，不能绕过拒绝。不要为了找回数 GB 空间清不明日志/数据/虚拟磁盘。

## 验证方法与证据

```powershell
. .\scripts\Enter-OcvEnvironment.ps1
pnpm exec playwright test -c playwright.visual.config.mjs
pnpm ledger:check
```

visual config 包含原第三阶段 8 用例与新增 4 组动效用例，桌面/手机共 24 项，实际结果见视觉验收报告。覆盖原框架交互、IndexedDB 本地保密/迁移下载、Worker/广播、React 状态与表单、真 PG/Redis、Angular 同源、日期降级、裸页/多层路线，并新验 16 图解码、WebGL、8 碎片上限、离屏休息、减少动画、CSS fallback、横向导航/odometer。截图与 JSON 在 F:\OCVdeps\runtime\reports，文件前缀 phase3-visual，原 phase3 档案不覆盖。

原 `playwright.phase3.config.mjs` 是旧前端测试；`playwright.config.mjs` 是最早 core 回归。不要随意重跑 17 项 Java/MySQL 批次然后宣称只用 core：真正跑语言链要明确启动所需 profiles 并恢复。

如果页面仍旧：浏览器硬刷新；确认 8080 对应本轮镜像而非另一进程，核对 actual HTML 的 launch-title 和 js hash。改源码不等于容器网站更新。先看 pageerror、图片 decode、computed style、画布 renderer，不能只看构建成功。

本轮 Windows 原生 Astro build 曾在输出编译日志前停滞，已终止该自建进程树；以 Linux 容器真实构建验证此轮源码，不能把原生这次失败藏成通过。既有第三阶段原生 pnpm dev 的历史验收仍保留，但不冒充此轮重测。

## 接手后的动作

先确认 phase-state.json 与最新用户授权；若视觉修订已验收，停住等第四阶段。下一阶段严格按 PHASES 与账本补门户/导航/搜索/截图身份，不能拿这次装饰区当完整工具菜单。之后每阶段增量记录证据，最后独立回源 732 条逐项审计。所有剩余功能都必须留账，不因“看起来东西很多”认定完成。
