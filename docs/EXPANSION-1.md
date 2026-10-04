# 路由与工作台增补

这是第八阶段完成后的用户授权增补。原来 101 个工具、27 个迷宫房间、18 个事件房间与旧前端层继续保留；没有开始第九阶段。最新指令优先：中文为主，少量标签使用日语、韩语、希腊语；两处指定的旧内置用词退出当前界面，原始需求和历史验收原文不改。用户自己输入的文字照原样处理。

文案覆盖引用为 B020、B028、B048、B055、B090、B198、B333–336。这里只覆盖内置名称和提示，保留原算法、计数、增长与导出含义；旧验收仍是当时的快照，不伪装成新文案的逐字证明。

## 新入口

首页窗口菜单的“实验室”、各迷宫房间内的实验窗、万能搜索均可进入。新增八个深层页面：

| 页面 | 内容 |
| --- | --- |
| /lab/field/surface/ | WebGL 距离场曲面，四种形体与参数变化 |
| /lab/field/interference/ | 干涉材质、指针观察角度 |
| /lab/data/query/ | CSV 实际分组统计 |
| /lab/data/graph/ | 可移动节点、最短路径与添加节点 |
| /lab/frames/bytes/ | 输入文字的 UTF-8 字节 |
| /lab/signal/bands/ | 波形与频带参数 |
| /lab/flow/steps/ | 顺序文本处理 |
| /lab/space/orbit/ | 多轨道运动与参数变化 |

27 个旧迷宫房间各加一个不同实验窗及一个小面板，共 14 种实验类型。尺寸、位置、纵横比例、明暗材质不同，叠在原页面上；不改成统一网格。主实验窗可拖动、置前、关闭后重新打开，部分窗可临时展开实际工具 iframe，再次操作会卸载它。独立实验页保留固定返回入口。动画在隐藏标签页或离开页面时暂停/清理，减少动画设置保留静态操作。

## 正常功能

新添八项，累计 109 工具、13 个原分类：

| 工具 | 实际行为与边界 |
| --- | --- |
| SQL 工作台 | sql.js / SQLite WASM Worker，CSV 重建 data 表，多语句查询，保留 64 位整数，超时终止 Worker；每次运行独立数据库 |
| 数据透视 | 按列分组，求和、均值、中位数、最小、最大与计数，导出真实 CSV |
| JSON 补丁 | RFC 6902 比对及应用，根节点的数字/字符串/布尔/null 变化也产生真实替换；严格校验、禁止原型修改 |
| PDF 编排 | 两份 PDF 按页码/范围/逆序/重复页重排和追加，保持实际页面尺寸，导出真实 PDF |
| 图片拼版 | 多张 PNG/JPEG/WebP 的 contain/cover 拼版，导出实际尺寸 PNG |
| 文件校验清单 | 真实 SHA-256，生成/核验清单，区别缺失、增加和变化，支持空文件 |
| 处理流程 | 顺序执行 trim、大小写、排序、去重、JSON、Base64、SHA-256，显示步骤的输入/输出字节 |
| 矢量图表 | CSV 柱状/折线/散点图，支持负数，转义标签，导出真实 SVG |

109 个工具页接入公共工作台操作：表单字段在内存中撤销/重做、显式导出/导入项目 JSON、导入 UTF-8 文本、结果查找/下一项、换行及展开。这里的项目和撤销只针对表单输入，不回放游戏棋盘或计时器状态；没有文本字段的页面会明确提示无法导入文本。输入历史不写 localStorage；项目文件不含上传文件本体，重新导入时会要求重新选择文件。项目 schema、工具 ID、字段类型及选项均校验。

万能搜索使用当前真实描述符，支持标题、ID、字段标签及别名，例如“SQL查询”“PDF合并”“JSON diff”“拼图”“数据透视”“SHA256 校验”。支持全角英文和混合语言、输入后更新、回车、向下键及 Escape。深层实验页也可搜索。旧图片压缩说明和原推荐逻辑继续保留。

CSV 限 1 MiB/5000 行/64 列；流程最多 12 步；PDF 每个源限 500 页，输出最多 50 页。图片拼版 1–12 张、总量 32 MiB；文件清单 1–24 个不同名文件、每个 16 MiB/总量 64 MiB。SQL 5 秒终止、64 MiB SQLite heap、小型页数和输出限制。这些属于本地浏览器工具，未实现服务器持久化数据库、协作账号或硬件遥测。

SQL 的 CSV 导入会把有限、可安全表示的十进制字段识别为数值；较大整数和其他字段保留文本。SQL 整数结果以十进制字符串输出，避免 JavaScript 数值精度丢失。CSV 统计使用普通浮点数，未声称财务精度。

## 接手文件地图

| 文件 | 用途 |
| --- | --- |
| config/apps/portal/src/z/map.mjs、Panel.astro、0.css | 27 实验窗、八实验页映射、窗口与小面板外观 |
| config/apps/portal/src/z/a.js、shader.mjs | 原生 Canvas、节点操作、原始 WebGL shader、生命周期与降级 |
| config/apps/portal/src/z/model.mjs、tools.mjs | CSV/PDF/图表/流程/路径算法及八工具描述符 |
| config/apps/portal/src/z/sql.mjs、sql.worker.js | 可中止的真正 SQLite Worker，独立数据库及 WASM |
| config/apps/portal/src/pages/lab/、pages/maze/[...path].astro | 独立层级路由及原迷宫增补 |
| config/apps/portal/src/tool/Tool.astro、run.js、work.mjs、work.css | 全部工具的公共操作，既有导出和复制保持原数据 |
| config/apps/portal/src/main1/catalogue.mjs、index.js | 当前真实目录、别名搜索及输入/键盘操作 |
| tests/expand1.test.mjs、tests/browser/expand.spec.mjs、playwright.expand.config.mjs | 算法边界、实际导出、查询超时恢复、搜索、GL/无 GPU 降级及旧回归 |
| scripts/inspect-expansion-runtime.mjs、record-expansion-acceptance.mjs | 实际 core、HTTP、许可、旧快照与全部新证据核对 |
| docs/expansion-plan.json、expansion-libraries.json、expansion-acceptance.json | 用户授权范围、原始许可和本次验收；旧命名/阶段验收保持历史身份 |

## 依赖与参考

仅按需新增 [sql.js](https://github.com/sql-js/sql.js) 1.14.2 与 [fast-json-patch](https://github.com/Starcounter-Jack/JSON-Patch) 3.1.1，均为 MIT；原文许可随站点提供，归属声明只追加。PDF 复用已有 [pdf-lib](https://pdf-lib.js.org/)，补丁遵循 [RFC 6902](https://www.rfc-editor.org/info/rfc6902/)。图形参考 [Three.js 官方 shader 示例](https://threejs.org/examples/webgl_shaders_ocean) 的表现思路，实际 shader 为本站原创，不引入示例外部素材或代码。

应用、正常构建和新路由没有磁盘布局硬编码。当前机器的工具/实际依赖/临时结果继续使用本地环境脚本指定的位置；只启动 core，重构建先验证 Docker 实际磁盘，顺序构建后关闭 builder。公开部署的干净 clone、多平台与全栈审计仍待第九阶段。
