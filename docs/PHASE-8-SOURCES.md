# 第八阶段实现来源与边界

318 条原始要求的分配见 phase-8-plan.json。原文保留，318 条已完成真实验收，详见 PHASE-8-ACCEPTANCE.md；第九阶段未授权。

事故页、眼睛 SVG、样式、历史业务源码均为本站原创；不复制第三方演示项目。使用正常原生 DOM、CSS、Canvas 之外的现有框架入口保持。假死仅暂停本站动画和暂时禁用本页操作，实际定时四秒恢复，不阻塞主线程、不制造内存垃圾；固定出口仍可用。新惊吓是本地 SVG，用户点击触发且每次页面只出现一次，声音幅度低，遵从自动播放限制、系统减少动画和兼容设置。

小构建任务依据官方 API，工具只作实际的小职责：[Gulp src/dest 文件流](https://gulpjs.com/docs/en/getting-started/working-with-files/)、[Babel preset-env](https://babeljs.io/docs/babel-preset-env/)、[Webpack 输出](https://webpack.js.org/configuration/output/)、[ESLint Node API](https://eslint.org/docs/latest/integrate/nodejs-api)、[Prettier API](https://prettier.io/docs/api)、[Stylelint Node API](https://stylelint.io/user-guide/node-api)。Gulp 复制两份 CSS，Babel 只编译 only-old-file.js，Webpack 实际打包 CommonJS 停车数组，输出实际接入 iframe / 历史货架。ESLint 两个独立 scope、Prettier 单配置和 Stylelint 两份 CSS 都运行，并用无效代码/颜色/格式做拒绝检查。Babel 8 已移除 bugfixes 选项，遵从当前 API，不安装旧版本兼容栈。

七个直接工具包按需固定版本，原许可字节记录在 phase-8-direct-licenses.json；原十份许可保留。Biome 是仅面向原创停用历史目录的配置，不接 CI、不安装工具链。CoffeeScript、Rust、Lua、Shell、Java、Python、PHP、Go、C#、Ruby 和停用 SQL/proto/Kubernetes/Maven/Terraform 只作原创源码遗迹；没有执行 Terraform 或部署历史 Kubernetes，没有冒充旧项目运行证据。少量原生 JS/TS 海鲜、补考、停车函数实际被网页调用。

指标表实际用核心 PostgreSQL，记录具名数值，不接收姓名、凭据或任意输入；128 行保留上限及真实索引。演示配置分别来自环境变量、JSON、YAML、数据库；服务优先级不同，本地展示可覆盖服务值，最终适配值固定 43，均不控制正常工具或权限。数据库未开时明确失败，其他功能仍可用。

成就只保存固定奖章、已用工具 ID、分类、十进制玩笑指数和兼容标志；不保存输入、按键内容或坐标历史。三标签页通过同源 BroadcastChannel 交换匿名临时 ID，20 秒过期、离开退出；存储失败退内存。拖动只显式保留一个悬浮挡板位置。演示客服不上传、不保存回复，不伪装人工。

逃跑 5–30 次、持续逃跑变速不停止、手机越界和不提供“停止乱动”按钮继续按用户新要求覆盖旧文，原文不删。新设置只提供兼容选项和局部语义倒置开关，不新增移动的停止动画按钮。公开部署、干净 clone、多平台、所有传递依赖与用户素材再分发许可的完整审计仍在第九阶段。

真实 /500/ 由 Nginx error_page 内部转至自己的静态页面，保留 500 响应，不制造实际后端崩溃；404 同理。依据 [Nginx 官方 error_page 指令](https://nginx.org/en/docs/http/ngx_http_core_module.html#error_page)。
