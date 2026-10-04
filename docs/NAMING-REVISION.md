# 命名调整 / names-1

用户授权的命名调整，属于第八阶段之后的局部修订，第九阶段未开始。去掉解释笑点的文件名，改用短名、备份名、拼错和不一致的存放位置。源码及配置在项目内；现有依赖、缓存和备份仍在本地依赖根，没有新增依赖。

正常入口仍是 pnpm install、pnpm dev、pnpm build 和 docker compose up。工作区、Docker COPY/CMD、相对引用、Vue/Svelte/Solid 入口、TS/JS、CSS、worker、测试和当前需求账本的实现位置一并调整。package.json、page.tsx、layout.tsx、Prisma 已应用的真实时间戳迁移等约定文件名保留。

## 当前文件地图

| 位置 | 作用 |
| --- | --- |
| config/apps/portal | Astro 主应用 |
| config/apps/web2 | Next 应用 |
| config/apps/ng | Angular 应用 |
| pcakage/comon | 共享类型 |
| pcakage/build2 | Gulp/Babel/Webpack 与局部检查 |
| pinia/p.mjs | 匿名页面里程模型及浏览器状态 |
| config/apps/portal/src/aaa | 主页光场、反应堆、叠窗和迷宫 |
| config/apps/portal/src/report | 18 个事故页面及模型/成就 |
| config/apps/portal/src/tool | 101 工具目录与执行器 |
| config/apps/portal/src/δοκιμή | 科学模型与界面 |
| services/archive/src/api/main.mjs | Hono/多协议入口 |
| historical/旧业务 | 原创停用业务 |
| historical/front_old | 旧前端快照 |
| historical/luminous | 上一版光效源码 |
| historical/phase4_临时信息窗已停用 | 保留原名的停用身份窗 |

## 路径转换

旧验收报告的 JSON/Markdown 保留原字节，里面的旧路径是当时的记录，不要替换旧 hash 或冒充新证明。读取旧记录时可调用 scripts/current-paths.mjs 的 currentPath。naming-paths.json 记录逐文件前后 hash 和明确路径对照；本次真实验证单独写 naming-acceptance.json。原 732 条文字、行号、阶段和状态不因改名而改变。原文提到的 login_2019_backup.js 现为 login_bak.js，遵从此次用户命名要求，调用顺序与逻辑保留。

| 原位置 | 当前位置 |
| --- | --- |
| apps | config/apps |
| packages | pcakage |
| packages/shared-types | pcakage/comon |
| packages/stale-build | pcakage/build2 |
| apps/angular-1999 | config/apps/ng |
| apps/next-but-was-excel | config/apps/web2 |
| apps/portal/src/1998 | config/apps/portal/src/js |
| apps/portal/src/事故报告寄错科室 | config/apps/portal/src/report |
| apps/portal/src/旧货进了新仓库 | config/apps/portal/src/old |
| apps/portal/src/光学实验室 | config/apps/portal/src/aaa |
| apps/portal/src/没有开门的大厅 | config/apps/portal/src/main1 |
| apps/portal/src/工具不在货架上 | config/apps/portal/src/tool |
| apps/portal/src/客诉转采购_勿整理 | config/apps/portal/src/ui |
| apps/portal/src/游乐场在消防通道里 | config/apps/portal/src/game |
| apps/portal/src/不该开设的鉴定窗口 | config/apps/portal/src/misc |
| apps/portal/src/审批章盖在反面 | config/apps/portal/src/gen |
| apps/portal/src/钟归另一栋楼管 | config/apps/portal/src/time |
| apps/portal/src/调度中心借了天文台 | config/apps/portal/src/δοκιμή |
| apps/portal/src/图没印在这一面 | config/apps/portal/src/img |
| apps/portal/src/运费其实是计算器 | config/apps/portal/src/math1 |
| apps/portal/src/发错货的文本部 | config/apps/portal/src/text |
| apps/portal/src/文件从打印机背后出来 | config/apps/portal/src/file |
| apps/portal/src/客服转网管_没移交 | config/apps/portal/src/net |
| apps/portal/src/1998/数据库其实是浏览器.mjs | config/apps/portal/src/js/db.mjs |
| apps/portal/src/1998/引力不归物理管.js | config/apps/portal/src/js/g.js |
| apps/portal/src/1998/前端要闻.js | config/apps/portal/src/js/client.js |
| apps/portal/src/事故报告寄错科室/楼层清单.mjs | config/apps/portal/src/report/list.mjs |
| apps/portal/src/事故报告寄错科室/柜台不是同一个柜台.astro | config/apps/portal/src/report/index.astro |
| apps/portal/src/事故报告寄错科室/玻璃割错了一块.css | config/apps/portal/src/report/2.css |
| apps/portal/src/事故报告寄错科室/值班员去买饭了.js | config/apps/portal/src/report/report.js |
| apps/portal/src/事故报告寄错科室/货运费率其实是按钮.mjs | config/apps/portal/src/report/price.mjs |
| apps/portal/src/事故报告寄错科室/奖章不是数据库.js | config/apps/portal/src/report/award.js |
| apps/portal/src/事故报告寄错科室/文明牌匾.astro | config/apps/portal/src/report/badge.astro |
| apps/portal/src/旧货进了新仓库/login_2019_backup.js | config/apps/portal/src/old/login_bak.js |
| apps/portal/src/旧货进了新仓库/订单寄错了.mjs | config/apps/portal/src/old/order.mjs |
| apps/portal/src/旧货进了新仓库/六百行没合并.mjs | config/apps/portal/src/old/switch.mjs |
| apps/portal/src/旧货进了新仓库/配置还在.mjs | config/apps/portal/src/old/config.mjs |
| apps/portal/src/旧货进了新仓库/配置又在这里.json | config/apps/portal/src/old/config.json |
| apps/portal/src/旧货进了新仓库/配置也在这里.yaml | config/apps/portal/src/old/config.yaml |
| apps/portal/src/旧货进了新仓库/枚举_以前.mjs | config/apps/portal/src/old/state_old.mjs |
| apps/portal/src/旧货进了新仓库/枚举_不可删.mjs | config/apps/portal/src/old/state1.mjs |
| apps/portal/src/旧货进了新仓库/枚举_FINAL.mjs | config/apps/portal/src/old/state_final.mjs |
| apps/portal/src/光学实验室/窗口漏电.css | config/apps/portal/src/aaa/1.css |
| apps/portal/src/光学实验室/窗口自己跑了.js | config/apps/portal/src/aaa/a.js |
| apps/portal/src/光学实验室/叠错窗口.astro | config/apps/portal/src/aaa/2.astro |
| apps/portal/src/光学实验室/二级缓存没清干净.astro | config/apps/portal/src/aaa/cache.astro |
| apps/portal/src/光学实验室/主页又多了一张.astro | config/apps/portal/src/aaa/img.astro |
| apps/portal/src/光学实验室/老吴没下班.astro | config/apps/portal/src/aaa/laowu.astro |
| apps/portal/src/光学实验室/补丁还没写完.astro | config/apps/portal/src/aaa/tmp.astro |
| apps/portal/src/光学实验室/没锁住的光学台.astro | config/apps/portal/src/aaa/lens.astro |
| apps/portal/src/光学实验室/旧抽屉换了壳.js | config/apps/portal/src/aaa/b.js |
| apps/portal/src/光学实验室/迷宫图.mjs | config/apps/portal/src/aaa/map.mjs |
| apps/portal/src/没有开门的大厅/功能去向.mjs | config/apps/portal/src/main1/catalogue.mjs |
| apps/portal/src/没有开门的大厅/门户胶水.js | config/apps/portal/src/main1/index.js |
| apps/portal/src/没有开门的大厅/门户贴上去.astro | config/apps/portal/src/main1/index.astro |
| apps/portal/src/没有开门的大厅/门户边框.css | config/apps/portal/src/main1/main.css |
| apps/portal/src/没有开门的大厅/轻量反而很重.js | config/apps/portal/src/main1/light.js |
| apps/portal/src/没有开门的大厅/身份证丢了.mjs | config/apps/portal/src/main1/identity.mjs |
| apps/portal/src/没有开门的大厅/占用者是现场捏的.js | config/apps/portal/src/main1/identity.js |
| apps/portal/src/没有开门的大厅/表单居然很正常.css | config/apps/portal/src/main1/form.css |
| apps/portal/src/工具不在货架上/退货窗口.astro | config/apps/portal/src/tool/Tool.astro |
| apps/portal/src/工具不在货架上/这个柜台还没开.astro | config/apps/portal/src/tool/Stub.astro |
| apps/portal/src/工具不在货架上/目录又印错了.mjs | config/apps/portal/src/tool/data.mjs |
| apps/portal/src/工具不在货架上/柜台宽度没量过.css | config/apps/portal/src/tool/2.css |
| apps/portal/src/工具不在货架上/收据别寄给服务器.js | config/apps/portal/src/tool/run.js |
| apps/portal/src/客诉转采购_勿整理/只写两个字.tsx | config/apps/portal/src/ui/main.tsx |
| apps/portal/src/游乐场在消防通道里/手柄插在打印机上.mjs | config/apps/portal/src/game/game.mjs |
| apps/portal/src/游乐场在消防通道里/规则印在门背面.mjs | config/apps/portal/src/game/model.mjs |
| apps/portal/src/游乐场在消防通道里/挡板宽度忘了算.css | config/apps/portal/src/game/1.css |
| apps/portal/src/不该开设的鉴定窗口/受理单没有结论.mjs | config/apps/portal/src/misc/misc.mjs |
| apps/portal/src/不该开设的鉴定窗口/计算过程没有意义.mjs | config/apps/portal/src/misc/model.mjs |
| apps/portal/src/不该开设的鉴定窗口/窗口尺寸由口头决定.css | config/apps/portal/src/misc/3.css |
| apps/portal/src/审批章盖在反面/理由比正文长.mjs | config/apps/portal/src/gen/gen.mjs |
| apps/portal/src/钟归另一栋楼管/晚点才能报时.mjs | config/apps/portal/src/time/time.mjs |
| apps/portal/src/钟归另一栋楼管/时间表忘了盖章.mjs | config/apps/portal/src/time/model.mjs |
| apps/portal/src/钟归另一栋楼管/钟下面还有半张表.css | config/apps/portal/src/time/clock.css |
| apps/portal/src/调度中心借了天文台/玻璃观测窗.mjs | config/apps/portal/src/δοκιμή/ui.mjs |
| apps/portal/src/调度中心借了天文台/值班表其实是星历.mjs | config/apps/portal/src/δοκιμή/calc.mjs |
| apps/portal/src/图没印在这一面/相纸拿反了.mjs | config/apps/portal/src/img/img.mjs |
| apps/portal/src/图没印在这一面/先量再印.mjs | config/apps/portal/src/img/size.mjs |
| apps/portal/src/发错货的文本部/发票抬头没填.mjs | config/apps/portal/src/text/1.mjs |
| apps/portal/src/文件从打印机背后出来/白纸也要走审批.mjs | config/apps/portal/src/file/pdf.mjs |
| apps/portal/src/客服转网管_没移交/工位隔离.worker.js | config/apps/portal/src/net/w.worker.js |
| apps/portal/src/客服转网管_没移交/工单状态404.mjs | config/apps/portal/src/net/net.mjs |
| apps/portal/src/客服转网管_没移交/正则先去隔壁.mjs | config/apps/portal/src/net/regex.mjs |
| apps/portal/src/客服转网管_没移交/状态码没联网.json | config/apps/portal/src/net/codes.json |
| apps/portal/src/客服转网管_没移交/文件后缀不是鉴定书.json | config/apps/portal/src/net/mime.json |
| apps/portal/src/光学实验室/文明里程不记坐标.mjs | pinia/p.mjs |
| apps/portal/src/components/轨道尽头还有三个窗口.astro | config/apps/portal/src/components/Table.astro |
| apps/portal/src/components/走错地方的壳.astro | config/apps/portal/src/components/Shell.astro |
| apps/portal/src/components/文明加载过头.astro | config/apps/portal/src/components/Loading.astro |
| apps/portal/src/components/层不是图层.astro | config/apps/portal/src/components/Base.astro |
| apps/portal/src/components/不是素材管理员.astro | config/apps/portal/src/components/Assets.astro |
| apps/portal/src/styles/顶楼贴到底楼.css | config/apps/portal/src/styles/top.css |
| apps/portal/src/styles/退回财务.css | config/apps/portal/src/styles/tmp.css |
| apps/portal/src/styles/文明在轨道外.css | config/apps/portal/src/styles/main.css |
| apps/next-but-was-excel/临时仓库_1997 | config/apps/web2/tmp |
| apps/next-but-was-excel/临时仓库_1997/收据其实是页面_FINAL.tsx | config/apps/web2/tmp/index.tsx |
| apps/next-but-was-excel/临时仓库_1997/边框.module.scss | config/apps/web2/tmp/1.module.scss |
| apps/next-but-was-excel/app/票务集团.scss | config/apps/web2/app/main.scss |
| apps/next-but-was-excel/app/样式税.css | config/apps/web2/app/tmp.css |
| services/archive/src/1998电话线未拆 | services/archive/src/api |
| services/archive/src/1998电话线未拆/收据_v0.0007_FINAL.mjs | services/archive/src/api/main.mjs |
| services/gateway/src/备份_别删/发票成功其实是锅_final_FINAL.ts | services/gateway/src/备份_别删/a_final.ts |
| services/gateway/src/上个项目的账号_没接线 | services/gateway/src/old_auth |
| services/spring/src/main/java/ocv/采购部撤销了 | services/spring/src/main/java/ocv/tmp |
| services/spring/src/main/java/ocv/采购部撤销了/backup_tmp_真入口 | services/spring/src/main/java/ocv/tmp/backup |
| historical/门牌还在_业务没了 | historical/旧业务 |
| historical/luminous_白到看不清 | historical/luminous |
| historical/别点_上一版居然能跑 | historical/front_old |
| historical/interaction_统一按钮排已停用 | historical/interaction_old |
| historical/luminous_白到看不清/source/光学实验室 | historical/luminous/source/aaa |
| historical/interaction_统一按钮排已停用/窗口漏电.css | historical/interaction_old/1.css |
| historical/interaction_统一按钮排已停用/窗口自己跑了.js | historical/interaction_old/a.js |
| apps/portal/public/office-1999 | config/apps/portal/public/ng |
| historical/别点_上一版居然能跑/static/office-1999 | historical/front_old/static/ng |
| historical/别点_上一版居然能跑/next/app/票务集团.scss | historical/front_old/next/app/main.scss |
| historical/别点_上一版居然能跑/next/app/样式税.css | historical/front_old/next/app/tmp.css |

rename-workspace.mjs 和 finish-name-paths.mjs 是本次一次性迁移记录，不属于安装/启动步骤，不要对已迁移目录再执行。第九阶段仍需完整独立审计、完整栈按需实测和公开部署审计。

`services/gateway/src/runtime-store.ts` 的配置读取仍使用 `../src/`：运行时 `__dirname` 位于编译后的 `dist`，不能按 TypeScript 源文件的位置改写这一处。改名过程中已通过真实 Nest/Hono/PostgreSQL 配置读取重新验证。

原生开发检查曾因未等 Astro 就绪、在没有 Vue 窗口的首页寻找领票按钮而失败，属于检查脚本的页面与等待条件错误；日志分别保留。本次实际验证 Vue 窗口使用 `/maze/offices/settings/`，不改首页布局来配合检查。

验收完成：命名修订已完成：118 项目录/文件改名，实际移动 302 个文件。apps 在 config/apps，packages 为 pcakage，根目录 pinia/p.mjs 保留真实状态代码；当前文件地图见 docs/NAMING-REVISION.md，完整转换和逐文件 hash 见 naming-paths.json。标准 pnpm build 五目标通过、原生 pnpm dev 八项检查通过、195/195 单测与全新完整 460/460 浏览器检查通过。Docker 四目标顺序构建后仅六健康 core；Hono 128 MiB 分批验证后关闭，builder 已停止。原始文档和旧验收快照保留；第九阶段未授权。

本次 Docker/WSL 工作集 2833.9 MiB（2026-10-03T05:12:01.7832924Z），只作当时采样。详细真实证明见 naming-acceptance.json；旧失败、Docker 未启动导致保护阻止构建的日志均留在本地 runtime/reports，不作为通过证据。
