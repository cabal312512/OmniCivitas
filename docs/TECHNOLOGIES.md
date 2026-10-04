<!-- DECISIONS 30–31: old frontend verification is historical. Current runtime notes are in the JSON ledgers; previous UI is retained dormant. -->

# 技术用途与验收账本

<!-- phase7-accepted-start -->
第七阶段完成：Canvas/SVG/CSS/单调时间/Web Crypto 实际用于 47 新工具，无新增第三方包。372/372 新完整浏览器检查（本阶段 160＋前阶段回归 212），168/168 合并单测（本阶段 78＋前阶段 90）通过；原 146 技术、34 类别和阶段五/六库用途元数据完整，十份原许可/公开归属声明逐字节 HTTP 核对。旧阶段运行说明仅代表历史；第八阶段未授权，阶段九全栈/公开部署审计待办。
<!-- phase7-accepted-end -->

<!-- phase6-technologies-start -->
第六阶段已完成：CropperJS 真拖动裁剪、qrcode 真编码、jsQR 真识别和 pdf-lib 真单页结构/下载均有桌面/手机证明。212/212 新完整浏览器检查（本阶段 78＋第五阶段回归 84＋原页面回归 50），90/90 合并单测（本阶段 47＋第五阶段 43）通过，详见 phase-6-acceptance.json；currentPhase6 只追加四个新库与实际用途，原 146 技术、34 来源类别及第五阶段元数据保留。十份原许可/公开归属声明实际 HTTP 200、原字节/hash 一致，见 PHASE-6-SOURCES.md。只跑六 core，没有据装包宣称其他栈重新运行；第七阶段未授权，阶段九全面审计仍待办。以下旧阶段说明为历史。
<!-- phase6-technologies-end -->

第五阶段已完成：实际 Math.js 计算/矩阵、marked＋DOMPurify Markdown 预览、PapaParse CSV 解析和可终止正则 Worker 已验证；43/43 算法单测与 134/134 新完整浏览器检查通过，见 phase-5-acceptance.json。三个新包的真实 F: 安装目录、固定版本及当前用途记录在 technologies.json 的 currentPhase5，原 146 技术/34 类别保留；旧 UI 的历史角色说明只指旧源码，不能抹去新工具中的真实用途。来源与六份公开原许可字节/hash 看 PHASE-5-SOURCES.md，均实际 HTTP 200 核对，阶段九全面审计仍待办。

第四阶段及本轮互动修订新增依赖零。既有 Three/GSAP 和 Vue/Svelte/Solid/Lit 仍真实使用，手动 GPU 旋转/波纹/射线拾取、章节扩散及冷页面 JS 比较重新实测；最新证据 interaction-acceptance.json（50/50），旧基线 phase-4-acceptance.json 保留。React/Angular 早期完整 UI 继续停用，不据旧包或旧验收声称重新挂载；原 146 技术条目保留，阶段九仍须独立审计。

最新 DECISIONS 32–35：原光场继续活跃，新增 Three.js 0.186.1 / GSAP 3.15.0 与 27 路由迷宫；旧 Vue/Pinia/Element Plus、Svelte store、Solid signal、Lit、浏览器 IndexedDB/Cache/Worker 已在新壳中实际运行。新证据看 reactor-acceptance.json / REACTOR-REVISION.md；其余旧技术不能仅据历史记录冒称当前仍挂载。原 146 技术/34 来源分类不动，新包在 technologies.json 的 visualExtensions 独立登记，来源/许可看 EFFECT-SOURCES.md。

安装、调用、验证分别记录。历史角色遵守原文，不因未安装编译器而删除。

| ID | 类别 | 技术 | 阶段 | 角色 | 状态 | 用途 |
| --- | --- | --- | --- | --- | --- | --- |
| TECH001 | 仓库 | pnpm workspace | 1 | active | verified-current-role | workspace 调度、缓存；Turborepo 仅保留废弃配置 |
| TECH002 | 仓库 | Nx | 1 | active | verified-current-role | workspace 调度、缓存；Turborepo 仅保留废弃配置 |
| TECH003 | 仓库 | Turborepo 配置 | 1 | historical-or-scoped-config | verified-current-role | workspace 调度、缓存；Turborepo 仅保留废弃配置 |
| TECH004 | 启动 | Docker Compose | 1 | active | verified-current-role | 按需启动；单入口代理 |
| TECH005 | 启动 | Nginx | 1 | active | verified-current-role | 按需启动；单入口代理 |
| TECH006 | 前端壳 | Astro | 1 | active | verified-current-role | 门户总壳，静态页面与后续小岛 |
| TECH007 | 前端应用 | Next.js | 3 | active | verified-current-role | 不同年代模块；Next API 多绕一层；Angular iframe |
| TECH008 | 前端应用 | React | 3 | active | verified-current-role | 不同年代模块；Next API 多绕一层；Angular iframe |
| TECH009 | 前端应用 | Vue 3 | 3 | active | verified-current-role | 不同年代模块；Next API 多绕一层；Angular iframe |
| TECH010 | 前端应用 | Svelte | 3 | active | verified-current-role | 不同年代模块；Next API 多绕一层；Angular iframe |
| TECH011 | 前端应用 | Angular | 3 | active | verified-current-role | 不同年代模块；Next API 多绕一层；Angular iframe |
| TECH012 | 前端应用 | SolidJS | 3 | active | verified-current-role | 不同年代模块；Next API 多绕一层；Angular iframe |
| TECH013 | 小型前端框架 | Lit | 3 | active | verified-current-role | 印章组件、折叠、HTML 片段、展示节点修改 |
| TECH014 | 小型前端框架 | Alpine.js | 3 | active | verified-current-role | 印章组件、折叠、HTML 片段、展示节点修改 |
| TECH015 | 小型前端框架 | htmx | 3 | active | verified-current-role | 印章组件、折叠、HTML 片段、展示节点修改 |
| TECH016 | 小型前端框架 | jQuery | 3 | active | verified-current-role | 印章组件、折叠、HTML 片段、展示节点修改 |
| TECH017 | 状态管理 | Redux Toolkit | 3 | active | verified-current-role | 每项管理独立的小状态；RxJS 点击防抖；XState 两态审批 |
| TECH018 | 状态管理 | Zustand | 3 | active | verified-current-role | 每项管理独立的小状态；RxJS 点击防抖；XState 两态审批 |
| TECH019 | 状态管理 | MobX | 3 | active | verified-current-role | 每项管理独立的小状态；RxJS 点击防抖；XState 两态审批 |
| TECH020 | 状态管理 | Jotai | 3 | active | verified-current-role | 每项管理独立的小状态；RxJS 点击防抖；XState 两态审批 |
| TECH021 | 状态管理 | Pinia | 3 | active | verified-current-role | 每项管理独立的小状态；RxJS 点击防抖；XState 两态审批 |
| TECH022 | 状态管理 | RxJS | 3 | active | verified-current-role | 每项管理独立的小状态；RxJS 点击防抖；XState 两态审批 |
| TECH023 | 状态管理 | Svelte Store | 3 | active | verified-current-role | 每项管理独立的小状态；RxJS 点击防抖；XState 两态审批 |
| TECH024 | 状态管理 | Angular Signals | 3 | active | verified-current-role | 每项管理独立的小状态；RxJS 点击防抖；XState 两态审批 |
| TECH025 | 状态管理 | XState | 3 | active | verified-current-role | 每项管理独立的小状态；RxJS 点击防抖；XState 两态审批 |
| TECH026 | UI | Ant Design | 3 | active | verified-current-role | 分散模块及明确要求的混用控件 |
| TECH027 | UI | MUI | 3 | active | verified-current-role | 分散模块及明确要求的混用控件 |
| TECH028 | UI | Element Plus | 3 | active | verified-current-role | 分散模块及明确要求的混用控件 |
| TECH029 | UI | Bootstrap | 3 | active | verified-current-role | 分散模块及明确要求的混用控件 |
| TECH030 | CSS | Tailwind | 3 | active | verified-current-role | 混合年代布局及样式，非统一设计系统 |
| TECH031 | CSS | 普通 CSS | 3 | active | verified-current-role | 混合年代布局及样式，非统一设计系统 |
| TECH032 | CSS | CSS Modules | 3 | active | verified-current-role | 混合年代布局及样式，非统一设计系统 |
| TECH033 | CSS | Sass | 3 | active | verified-current-role | 混合年代布局及样式，非统一设计系统 |
| TECH034 | CSS | Less | 3 | active | verified-current-role | 混合年代布局及样式，非统一设计系统 |
| TECH035 | CSS | styled-components | 3 | active | verified-current-role | 混合年代布局及样式，非统一设计系统 |
| TECH036 | CSS | Emotion | 3 | active | verified-current-role | 混合年代布局及样式，非统一设计系统 |
| TECH037 | CSS | 内联 style | 3 | active | verified-current-role | 混合年代布局及样式，非统一设计系统 |
| TECH038 | 表单 | React Hook Form | 3 | active | verified-current-role | 不同部门的独立表单 |
| TECH039 | 表单 | Formik | 3 | active | verified-current-role | 不同部门的独立表单 |
| TECH040 | 表单 | vee-validate | 3 | active | verified-current-role | 不同部门的独立表单 |
| TECH041 | 表单 | Angular Reactive Forms | 3 | active | verified-current-role | 不同部门的独立表单 |
| TECH042 | 校验 | Zod | 3 | active | verified-current-role | 冗余校验链与明确最大输入边界 |
| TECH043 | 校验 | Joi | 3 | active | verified-current-role | 冗余校验链与明确最大输入边界 |
| TECH044 | 校验 | Yup | 3 | active | verified-current-role | 冗余校验链与明确最大输入边界 |
| TECH045 | 校验 | validator.js | 3 | active | verified-current-role | 冗余校验链与明确最大输入边界 |
| TECH046 | 校验 | 手写 if | 3 | active | verified-current-role | 冗余校验链与明确最大输入边界 |
| TECH047 | HTTP 客户端 | fetch | 3 | active | verified-current-role | 不同页面与后端转发，所有请求有上限 |
| TECH048 | HTTP 客户端 | Axios | 3 | active | verified-current-role | 不同页面与后端转发，所有请求有上限 |
| TECH049 | HTTP 客户端 | jQuery.ajax | 3 | active | verified-current-role | 不同页面与后端转发，所有请求有上限 |
| TECH050 | HTTP 客户端 | htmx HTTP | 3 | active | verified-current-role | 不同页面与后端转发，所有请求有上限 |
| TECH051 | HTTP 客户端 | got | 3 | active | verified-current-role | 不同页面与后端转发，所有请求有上限 |
| TECH052 | 日期 | 原生 Date | 3 | active | verified-current-role | 不同格式/时区，最终适配正确 |
| TECH053 | 日期 | Day.js | 3 | active | verified-current-role | 不同格式/时区，最终适配正确 |
| TECH054 | 日期 | Moment.js | 3 | active | verified-current-role | 不同格式/时区，最终适配正确 |
| TECH055 | 日期 | date-fns | 3 | active | verified-current-role | 不同格式/时区，最终适配正确 |
| TECH056 | 日期 | Luxon | 3 | active | verified-current-role | 不同格式/时区，最终适配正确 |
| TECH057 | 工具库 | Lodash | 3 | active | verified-current-role | 空值、pipe、冗余 ID、正确计算 |
| TECH058 | 工具库 | Ramda | 3 | active | verified-current-role | 空值、pipe、冗余 ID、正确计算 |
| TECH059 | 工具库 | Nano ID | 3 | active | verified-current-role | 空值、pipe、冗余 ID、正确计算 |
| TECH060 | 工具库 | uuid | 3 | active | verified-current-role | 空值、pipe、冗余 ID、正确计算 |
| TECH061 | 工具库 | Math.js | 3 | active | verified-current-role | 空值、pipe、冗余 ID、正确计算 |
| TECH062 | Node 主网关 | NestJS | 1 | active | verified-current-role | 实际统一网关，成功字段 errorMessage |
| TECH063 | 第二套 Node 后端 | Hono | 2 | active | verified-current-role | 历史后缀兼容接口 |
| TECH064 | Java | Spring Boot | 2 | active | verified-current-role | REST/gRPC 中转与日期审批 |
| TECH065 | Python | FastAPI | 2 | active | verified-current-role | gRPC 与微型科学演示服务 |
| TECH066 | PHP | Laravel | 2 | active | verified-current-role | 名称叫 nodeService 的 PHP 服务 |
| TECH067 | Go | Fiber | 2 | active | verified-current-role | 极小的按钮编号服务 |
| TECH068 | C# | ASP.NET Core Minimal API | 2 | active | verified-current-role | 极小的格式权威认证服务 |
| TECH069 | Ruby | Sinatra | 2 | active | verified-current-role | 可工作的古老状态接口 |
| TECH070 | 接口 | REST | 2 | active | verified-current-role | 同站真实异构协议及荒谬 DTO |
| TECH071 | 接口 | GraphQL | 2 | active | verified-current-role | 同站真实异构协议及荒谬 DTO |
| TECH072 | 接口 | gRPC | 2 | active | verified-current-role | 同站真实异构协议及荒谬 DTO |
| TECH073 | 接口 | XML/SOAP 风格接口 | 2 | active | verified-current-role | 同站真实异构协议及荒谬 DTO |
| TECH074 | 实时 | WebSocket | 2 | active | verified-current-role | 实际实时消息与偶尔一句公告 |
| TECH075 | 实时 | SSE | 2 | active | verified-current-role | 实际实时消息与偶尔一句公告 |
| TECH076 | 消息系统 | RabbitMQ | 2 | active | verified-current-role | 事件跨队列转发与 Spring→Redis→Nest→Mongo 日志 |
| TECH077 | 消息系统 | Kafka | 2 | active | verified-current-role | 事件跨队列转发与 Spring→Redis→Nest→Mongo 日志 |
| TECH078 | 消息系统 | Redis Pub/Sub | 2 | active | verified-current-role | 事件跨队列转发与 Spring→Redis→Nest→Mongo 日志 |
| TECH079 | SQL 数据库 | PostgreSQL | 2 | active | verified-current-role | 对象拆分、SQLite 文件、微量分析 |
| TECH080 | SQL 数据库 | MySQL | 2 | active | verified-current-role | 对象拆分、SQLite 文件、微量分析 |
| TECH081 | SQL 数据库 | SQLite | 2 | active | verified-current-role | 对象拆分、SQLite 文件、微量分析 |
| TECH082 | SQL 数据库 | DuckDB | 2 | active | verified-current-role | 对象拆分、SQLite 文件、微量分析 |
| TECH083 | NoSQL | MongoDB | 2 | active | verified-current-role | 附加字段、缓存/唯一无害状态、全文搜索 |
| TECH084 | NoSQL | Redis | 2 | active | verified-current-role | 附加字段、缓存/唯一无害状态、全文搜索 |
| TECH085 | NoSQL | Elasticsearch | 2 | active | verified-current-role | 附加字段、缓存/唯一无害状态、全文搜索 |
| TECH086 | 文件/对象 | MinIO | 2 | active | verified-current-role | 小文件对象与正式玩具数据源 |
| TECH087 | 文件/对象 | JSON | 2 | active | verified-current-role | 小文件对象与正式玩具数据源 |
| TECH088 | 文件/对象 | CSV | 2 | active | verified-current-role | 小文件对象与正式玩具数据源 |
| TECH089 | 文件/对象 | YAML | 2 | active | verified-current-role | 小文件对象与正式玩具数据源 |
| TECH090 | ORM | Prisma | 2 | active | verified-current-role | 独立表范围，各 ORM 真实读写 |
| TECH091 | ORM | TypeORM | 2 | active | verified-current-role | 独立表范围，各 ORM 真实读写 |
| TECH092 | ORM | Hibernate/JPA | 2 | active | verified-current-role | 独立表范围，各 ORM 真实读写 |
| TECH093 | ORM | SQLAlchemy | 2 | active | verified-current-role | 独立表范围，各 ORM 真实读写 |
| TECH094 | ORM | Eloquent | 2 | active | verified-current-role | 独立表范围，各 ORM 真实读写 |
| TECH095 | ORM | Mongoose | 2 | active | verified-current-role | 独立表范围，各 ORM 真实读写 |
| TECH096 | ORM | 裸 SQL | 2 | active | verified-current-role | 独立表范围，各 ORM 真实读写 |
| TECH097 | 浏览器数据库 | IndexedDB | 3 | active | verified-current-role | 局部唯一数据、虚构会话、缓存与重建 |
| TECH098 | 浏览器数据库 | localStorage | 3 | active | verified-current-role | 局部唯一数据、虚构会话、缓存与重建 |
| TECH099 | 浏览器数据库 | sessionStorage | 3 | active | verified-current-role | 局部唯一数据、虚构会话、缓存与重建 |
| TECH100 | 浏览器数据库 | Cache Storage | 3 | active | verified-current-role | 局部唯一数据、虚构会话、缓存与重建 |
| TECH101 | 其他“数据库” | Cookie | 3 | active | verified-current-role | CSV/浏览器/CSS/SVG/hash 拼装对象 |
| TECH102 | 其他“数据库” | URL query | 3 | active | verified-current-role | CSV/浏览器/CSS/SVG/hash 拼装对象 |
| TECH103 | 其他“数据库” | URL hash | 3 | active | verified-current-role | CSV/浏览器/CSS/SVG/hash 拼装对象 |
| TECH104 | 其他“数据库” | DOM data-* | 3 | active | verified-current-role | CSV/浏览器/CSS/SVG/hash 拼装对象 |
| TECH105 | 其他“数据库” | CSS 变量 | 3 | active | verified-current-role | CSV/浏览器/CSS/SVG/hash 拼装对象 |
| TECH106 | 其他“数据库” | SVG metadata | 3 | active | verified-current-role | CSV/浏览器/CSS/SVG/hash 拼装对象 |
| TECH107 | 监控 | OpenTelemetry | 2 | active | verified-current-role | 真实采集、十几段 span、无意义巨大 dashboard |
| TECH108 | 监控 | Prometheus | 2 | active | verified-current-role | 真实采集、十几段 span、无意义巨大 dashboard |
| TECH109 | 监控 | Grafana | 2 | active | verified-current-role | 真实采集、十几段 span、无意义巨大 dashboard |
| TECH110 | 测试 | Jest | 9 | active | planned | 核心测试可靠；各语言活跃代码分批验证 |
| TECH111 | 测试 | Vitest | 9 | active | verified-current-role | 核心测试可靠；各语言活跃代码分批验证 |
| TECH112 | 测试 | Playwright | 9 | active | verified-current-role | 核心测试可靠；各语言活跃代码分批验证 |
| TECH113 | 测试 | Cypress | 9 | active | planned | 核心测试可靠；各语言活跃代码分批验证 |
| TECH114 | 测试 | JUnit | 9 | active | planned | 核心测试可靠；各语言活跃代码分批验证 |
| TECH115 | 测试 | pytest | 9 | active | planned | 核心测试可靠；各语言活跃代码分批验证 |
| TECH116 | 测试 | PHPUnit | 9 | active | planned | 核心测试可靠；各语言活跃代码分批验证 |
| TECH117 | 测试 | Go testing | 9 | active | planned | 核心测试可靠；各语言活跃代码分批验证 |
| TECH118 | 测试 | .NET tests | 9 | active | planned | 核心测试可靠；各语言活跃代码分批验证 |
| TECH119 | 测试 | Ruby tests | 9 | active | planned | 核心测试可靠；各语言活跃代码分批验证 |
| TECH120 | 构建残骸 | Vite | 8 | active | verified-current-role | 分别真实构建或复制少量内容 |
| TECH121 | 构建残骸 | Webpack | 8 | active | planned | 分别真实构建或复制少量内容 |
| TECH122 | 构建残骸 | Gulp | 8 | active | planned | 分别真实构建或复制少量内容 |
| TECH123 | 构建残骸 | Babel | 8 | active | planned | 分别真实构建或复制少量内容 |
| TECH124 | 死代码语言 | Rust | 8 | historical-or-scoped-config | planned | 明确要求的原创历史遗迹；不必安装其完整工具链 |
| TECH125 | 死代码语言 | Lua | 8 | historical-or-scoped-config | planned | 明确要求的原创历史遗迹；不必安装其完整工具链 |
| TECH126 | 死代码语言 | CoffeeScript | 8 | historical-or-scoped-config | planned | 明确要求的原创历史遗迹；不必安装其完整工具链 |
| TECH127 | 死代码语言 | Shell | 8 | historical-or-scoped-config | planned | 明确要求的原创历史遗迹；不必安装其完整工具链 |
| TECH128 | 死代码语言 | .proto | 8 | historical-or-scoped-config | planned | 明确要求的原创历史遗迹；不必安装其完整工具链 |
| TECH129 | 死代码语言 | SQL 脚本 | 8 | historical-or-scoped-config | planned | 明确要求的原创历史遗迹；不必安装其完整工具链 |
| TECH130 | 正文附加技术 | i18next | 3 | active | verified-current-role | 重复国际化、缓存与无意义同步 |
| TECH131 | 正文附加技术 | vue-i18n | 3 | active | verified-current-role | 重复国际化、缓存与无意义同步 |
| TECH132 | 正文附加技术 | TanStack Query | 3 | active | verified-current-role | 重复国际化、缓存与无意义同步 |
| TECH133 | 正文附加技术 | BroadcastChannel | 3 | active | verified-current-role | 重复国际化、缓存与无意义同步 |
| TECH134 | 正文附加技术 | Web Worker | 3 | active | verified-current-role | 重复国际化、缓存与无意义同步 |
| TECH135 | 正文附加技术 | postMessage | 3 | active | verified-current-role | 重复国际化、缓存与无意义同步 |
| TECH136 | 正文附加配置 | ESLint | 8 | active | planned | 分散的配置与构建遗迹；Terraform 不执行 |
| TECH137 | 正文附加配置 | Prettier | 8 | active | planned | 分散的配置与构建遗迹；Terraform 不执行 |
| TECH138 | 正文附加配置 | Biome | 8 | historical-or-scoped-config | planned | 分散的配置与构建遗迹；Terraform 不执行 |
| TECH139 | 正文附加配置 | Stylelint | 8 | active | planned | 分散的配置与构建遗迹；Terraform 不执行 |
| TECH140 | 正文附加配置 | ESM | 8 | active | verified-current-role | 分散的配置与构建遗迹；Terraform 不执行 |
| TECH141 | 正文附加配置 | CommonJS | 8 | active | verified-current-role | 分散的配置与构建遗迹；Terraform 不执行 |
| TECH142 | 正文附加配置 | JavaScript | 8 | active | verified-current-role | 分散的配置与构建遗迹；Terraform 不执行 |
| TECH143 | 正文附加配置 | TypeScript | 8 | active | verified-current-role | 分散的配置与构建遗迹；Terraform 不执行 |
| TECH144 | 正文附加配置 | Kubernetes YAML | 8 | historical-or-scoped-config | planned | 分散的配置与构建遗迹；Terraform 不执行 |
| TECH145 | 正文附加配置 | Maven 配置 | 8 | historical-or-scoped-config | planned | 分散的配置与构建遗迹；Terraform 不执行 |
| TECH146 | 正文附加配置 | Terraform | 8 | historical-or-scoped-config | planned | 分散的配置与构建遗迹；Terraform 不执行 |

