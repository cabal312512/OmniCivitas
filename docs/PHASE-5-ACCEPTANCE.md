# 第五阶段验收

2026-10-02T17:14:42.127Z。本阶段 35 条要求逐条 verified；35 个真实工具页与工具目录已接入现有门户和搜索。第四阶段的扉页、两层光场、失修窗口和互动继续保留。第六阶段未授权，本阶段完成后停止。

新完整浏览器报告：134/134（桌面/手机各 67；84 项本阶段 + 50 项原界面回归；无失败、跳过、重试拼接或 flaky）。算法与边界单测 43/43。报告索引：[phase-5-acceptance.json](phase-5-acceptance.json)，原始运行文件 runtime/reports/phase5-final/phase5-playwright.json、runtime/reports/phase5-unit.json。

## 逐条核对

| 编号 | 原文 | 页面 | 状态 | 主要源码 | 证据 |
| --- | --- | --- | --- | --- | --- |
| B026 | Base64 编解码。认真实现，使用浏览器原生 API。 | /functions/base64/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；算法单测 2 项 |
| B027 | JSON 格式化和校验。认真实现，JSON.parse()＋格式化即可。 | /functions/json/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；算法单测 2 项；routes |
| B028 | XML 格式化。不自己写完整 XML formatter；用现成轻量包，如果不想增加实现量，可以只做缩进演示，对格式不正确的 XML 返回“文明无法理解该结构”。 | /functions/xml/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；浏览器 DOM 实测；xml-markdown |
| B029 | 正则表达式测试器。认真实现基础版本，只支持 JavaScript RegExp。 | /functions/regex/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 3 项；regex-isolation |
| B030 | UUID 生成器。直接调用 crypto.randomUUID()，但代码旁边依然可以保留 uuid、Nano ID 等无谓依赖。 | /functions/uuid/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项 |
| B031 | 随机数生成器。认真实现。 | /functions/random/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项 |
| B032 | 哈希计算工具。只支持 SHA-256，直接调用 Web Crypto API。不实现一大堆算法。 | /functions/hash/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项 |
| B033 | 时间戳转换工具。认真实现。 | /functions/timestamp/ | verified | apps/portal/src/运费其实是计算器/报价单_final2.mjs | 桌面/手机默认值；算法单测 2 项 |
| B034 | 时区转换工具可以简化成几个固定常见时区，不制作全球城市数据库。使用 Intl.DateTimeFormat()。 | /functions/time-zone/ | verified | apps/portal/src/运费其实是计算器/报价单_final2.mjs | 桌面/手机默认值；算法单测 1 项 |
| B035 | 单位换算工具只支持长度、重量、温度、面积几个基础分类，不做上百种单位。 | /functions/convert/ | verified | apps/portal/src/运费其实是计算器/报价单_final2.mjs | 桌面/手机默认值；算法单测 1 项 |
| B036 | 简单计算器认真实现。 | /functions/calculator/ | verified | apps/portal/src/运费其实是计算器/报价单_final2.mjs | 桌面/手机默认值；算法单测 2 项 |
| B037 | 科学计算器直接使用 Math.js，不自己写表达式解析器。界面可以有一大堆按钮，但实际支持常用函数即可。 | /functions/scientific/ | verified | apps/portal/src/运费其实是计算器/报价单_final2.mjs | 桌面/手机默认值；算法单测 2 项 |
| B038 | 矩阵计算器可以降级，只支持 2×2 和 3×3 的加减、行列式，或者直接调用 Math.js。不要做任意维度完整矩阵系统。 | /functions/matrix/ | verified | apps/portal/src/运费其实是计算器/报价单_final2.mjs | 桌面/手机默认值；算法单测 2 项 |
| B039 | 进制转换器。认真实现二、八、十、十六进制即可。 | /functions/radix/ | verified | apps/portal/src/运费其实是计算器/报价单_final2.mjs | 桌面/手机默认值；算法单测 2 项 |
| B040 | 文本字数统计。认真实现。 | /functions/text/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；算法单测 1 项 |
| B041 | 文本去重。按行去重即可。 | /functions/text-dedupe/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；算法单测 1 项；copy-export-privacy |
| B042 | 文本排序。按行字典序、长度两种即可。 | /functions/text-sort/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；算法单测 1 项 |
| B043 | 大小写转换。认真实现。 | /functions/text-case/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；算法单测 1 项 |
| B044 | Markdown 预览器直接调用现成 Markdown 包，不自己造 parser。 | /functions/markdown/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；浏览器 DOM 实测；xml-markdown |
| B045 | CSV 查看器只做简单 CSV 文件读取和表格展示。复杂引号、换行边界交给现成 CSV parser。 | /functions/csv/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；算法单测 4 项；csv |
| B046 | 颜色格式转换只实现 HEX、RGB、HSL 常见情况，或者用小库完成。 | /functions/color/ | verified | apps/portal/src/运费其实是计算器/报价单_final2.mjs | 桌面/手机默认值；算法单测 3 项 |
| B047 | 随机密码生成器，这里只是随机字符串生成器，不涉及真实账户系统。 | /functions/password/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项；copy-export-privacy |
| B048 | 文件校验和计算只支持较小文件和 SHA-256，使用浏览器 Web Crypto；大文件直接提示“大型文件请等待下一代文明”。 | /functions/file-checksum/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项；checksum |
| B059 | ASCII 艺术生成器。简单版本就行，可以做文字字符画，不需要图片转超复杂 ASCII。 | /functions/ascii/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；算法单测 1 项 |
| B060 | 摩斯电码转换器。 | /functions/morse/ | verified | apps/portal/src/发错货的文本部/发票抬头没填.mjs | 桌面/手机默认值；算法单测 1 项 |
| B061 | 罗马数字转换器。 | /functions/roman/ | verified | apps/portal/src/运费其实是计算器/报价单_final2.mjs | 桌面/手机默认值；算法单测 1 项 |
| B062 | Unix 权限计算器。 | /functions/permissions/ | verified | apps/portal/src/运费其实是计算器/报价单_final2.mjs | 桌面/手机默认值；算法单测 1 项 |
| B063 | HTTP 状态码查询。直接内置一个 JSON 对照表。 | /functions/http-status/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项 |
| B064 | MIME 类型查询。只内置几十种常见类型，不引入完整庞大数据库也可以。 | /functions/mime/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项 |
| B065 | 键盘按键检测器。 | /functions/keyboard/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项；live-and-ping |
| B066 | 屏幕尺寸检测器。 | /functions/screen/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项；live-and-ping |
| B067 | User-Agent 查看器。 | /functions/user-agent/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；浏览器 DOM 实测 |
| B068 | 浏览器能力检查器，一本正经告诉用户“您的设备支持按钮”。 | /functions/capabilities/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；浏览器 DOM 实测 |
| B069 | 鼠标坐标查看器。 | /functions/pointer/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项；live-and-ping |
| B070 | 网络请求耗时测试器。只请求本站自己的一个静态/轻量 ping 接口，不做真正网络测速。 | /functions/ping/ | verified | apps/portal/src/客服转网管_没移交/工单状态404.mjs | 桌面/手机默认值；算法单测 1 项；live-and-ping |

## 实测结果

- 真正使用 Math.js 解析常见科学函数及计算 2×2/3×3 矩阵；标量白名单拒绝赋值、属性、范围、数组与无限值。安全整数原样呈现；进制使用 BigInt。
- 时间戳明确秒/毫秒，ISO 日期须带时区并验证历法；Intl 时区转换覆盖夏令时跳跃/重复小时与历史年份。
- 正则的灾难性回溯只在可终止 Worker 中执行，1.5 秒期限、取消、恢复与主线程计时均在真实浏览器完成。
- Markdown 用 marked 和 DOMPurify，脚本/事件/iframe/外部请求不进入预览；XML 混合内容、CDATA 和有效文本保留，DTD/外部实体拒绝。
- CSV 使用 PapaParse 处理引号、逗号、换行和 UTF-8；实际下载的 CRLF 字节与独立已知样本相同，重新解析的单元格无损，公式字符串仍为原数据。剪贴板 Unicode 文本按平台换行规范化后内容一致（Windows 可能读回 CRLF）；Blob 下载的 UTF-8 原字节与规范结果相同。
- 小文件 SHA-256 为 Web Crypto 实算，超过 8 MiB 在读取前拒绝，不上传文件；输入和随机字符串不写存储或诊断，账户 API 未挂载。
- 键盘、指针、视口使用实际浏览器事件；请求耗时只对本站固定静态 ping 发起一次 GET，不能当作网络测速。

## 运行与边界

72 个页面 HTTP 200；8 次账户 GET/POST 均为 404；真实 PostgreSQL 三张停用账户表计数为 0|0|0。只运行六个健康 core，内存上限合计 1728 MiB，CPU/PID/swap/日志边界实际存在；3 GiB builder 已停止。最后 Docker/WSL 工作集采样 3637.1 MiB，采样时间 2026-10-02T17:14:40.0549277Z，不代表长期峰值。

新增 marked 18.0.14、DOMPurify 3.4.16、PapaParse 5.7.0；精确版本、真实本地目录和许可证登记见 JSON 与 THIRD_PARTY_NOTICES.txt，真实用途见上述浏览器证明。现有 Math.js 15.2.0 被实际调用。732 条原文/行号/hash、146 原技术和 34 来源类别完整；第八阶段仍为原状态，未顺手完成。

公开 /third-party-notices.txt 与 /licenses/ 下六份原许可均实际 HTTP 200，逐字节与本地文件相同；六份许可字节数和 SHA-256 另对照 PHASE-5-SOURCES.md。部署证据见 JSON 的 licenseHTTP，不借包已安装推定许可已发布。

## 未宣称完成的事项

- Only phase 5 is accepted. Phase 6 is not authorized; its remaining placeholder routes are still explicitly unopened.
- These are browser-local tools. XML and Markdown previews require JavaScript and browser DOM APIs; no SSR tool execution is claimed.
- Only six core services run. Optional language/database/messaging/monitoring services and complete-stack end-to-end testing were not rerun.
- The old phase 4 21-check dormant backend probe is historical. This run freshly verifies account API 404 and real empty PostgreSQL tables only.
- Intentional overlap and mobile clipping remain. Actual keyboard/focus/raise controls complete tools; passing browser tests is not a promise of tidy mobile layout.
- Math.js uses finite JavaScript numbers for scalar calculations; the BigInt radix tool preserves arbitrary integer precision within its digit limit.
- The working-set measurement is one sample after tests, includes shared/file-cache pages, and is not a long-term peak or FPS guarantee.
- The public release portability audit, clean clone, cross-platform installation, and supplied-image redistribution licenses remain phase 9 work.

阶段停点：[phase-state.json](phase-state.json)。第六阶段等待用户授权。
