# 第五阶段工具来源与许可

2026-10-03。本阶段使用下面四个本地实际安装的包。版本取自包内 `package.json`；许可原文与版权信息取自同一安装包，没有联网下载许可或从模板重写。前三个是本阶段新增依赖，Math.js 是已有依赖在新计算工具中的实际调用。

| 包与固定版本 | 官方来源 | 当前实际调用 | 本地原许可 |
| --- | --- | --- | --- |
| marked 18.0.14 | [官方文档](https://marked.js.org/)、[源码](https://github.com/markedjs/marked) | `1.mjs` 中懒加载后调用 `marked.parse`，生成真实 Markdown HTML；没有另写 Markdown parser | MIT；原 `LICENSE` 还包含 Markdown 的版权、再分发条件和免责声明，整份保留 |
| DOMPurify 3.4.16 | [官方仓库与说明](https://github.com/cure53/DOMPurify) | Markdown 的结果先经过 `sanitize` 白名单再进入预览；禁止 script、img、iframe、SVG、style、事件属性和外部资源嵌入，链接只保留页内锚点 | 包声明 `(MPL-2.0 OR Apache-2.0)`；本项目采用 Apache-2.0 选项，两份原文均保留，原作者归属为 Cure53 and other contributors |
| PapaParse 5.7.0 | [官方文档](https://www.papaparse.com/docs)、[源码](https://github.com/mholt/PapaParse) | CSV 实际调用 `parse` / `unparse`，引号、逗号、单元格换行和转义由库处理；UTF-8 文件先严格解码，BOM 交给 parser 处理 | MIT；Copyright (c) 2015 Matthew Holt |
| mathjs 15.2.0 | [官方文档](https://mathjs.org/docs/)、[表达式安全说明](https://mathjs.org/docs/expressions/security.html)、[源码](https://github.com/josdejong/mathjs) | `报价单_final2.mjs` 懒加载后调用 `parse` / `compile` / `evaluate` 和矩阵 `add` / `subtract` / `det`；表达式节点、函数、参数、层级和长度另有本项目白名单，拒绝赋值、属性、数组、范围与分配函数 | Apache-2.0；原 `LICENSE` 与 `NOTICE` 均保留；Copyright (C) 2013-2026 Jos de Jong |

文本、转换、计算与 SHA-256 的输入在浏览器本地处理，文件不上传，也不持久化到 localStorage、sessionStorage 或数据库。正则在可终止 Worker 中执行。网络耗时工具只请求本站固定 `/tool-ping.json`，不接受目标 URL，结果不是网络速度测量。输入大小、取消与导出边界由工具模块及壳共同检查；新增 parser 不随首页目录元数据初始化而执行。

JSON 使用原文要求的原生 `JSON.parse`，接受有限 JavaScript 数值语义，拒绝非有限数和超出安全精度的整数；大整数需要写成字符串。XML 是浏览器 DOMParser / XMLSerializer 的缩进演示，保留混合文本、空白文本和 CDATA 子树，不声称完整 XML formatter，也不读取 DTD 或实体声明。

公开静态声明在 [third-party-notices.txt](../config/apps/portal/public/third-party-notices.txt)，保留原有 Three.js / GSAP 归属并追加这四个包。完整许可放在 `config/apps/portal/public/licenses/`，构建后路径为 `/licenses/<文件名>`；几百行许可原文不需要重复塞入每个 JS chunk。已有特效的来源仍见 [EFFECT-SOURCES.md](EFFECT-SOURCES.md)。

以下文件均直接复制本地包的原字节，复制后逐字节比较并计算 SHA-256：

| 公开文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| [marked-18.0.14-LICENSE.txt](../config/apps/portal/public/licenses/marked-18.0.14-LICENSE.txt) | 2942 | `8e3a3f82f59a60958f56ca08f445647c32a4733dc7ca6c2c46f6eb898471ab9c` |
| [dompurify-3.4.16-LICENSE-APACHE-2.0.txt](../config/apps/portal/public/licenses/dompurify-3.4.16-LICENSE-APACHE-2.0.txt) | 11358 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| [dompurify-3.4.16-LICENSE-MPL-2.0.txt](../config/apps/portal/public/licenses/dompurify-3.4.16-LICENSE-MPL-2.0.txt) | 16726 | `fab3dd6bdab226f1c08630b1dd917e11fcb4ec5e1e020e2c16f83a0a13863e85` |
| [papaparse-5.7.0-LICENSE.txt](../config/apps/portal/public/licenses/papaparse-5.7.0-LICENSE.txt) | 1079 | `99aa68e4b42758b09828a46515f70369e5463458ab7a990189f641af2b8d9b4e` |
| [mathjs-15.2.0-LICENSE.txt](../config/apps/portal/public/licenses/mathjs-15.2.0-LICENSE.txt) | 10172 | `3b0f65a9308588e12b619b2f05c788b4a5f41220006ce563b826b0feb489fd26` |
| [mathjs-15.2.0-NOTICE.txt](../config/apps/portal/public/licenses/mathjs-15.2.0-NOTICE.txt) | 629 | `40e0c8aac7a769ef524e089b8ef75f81325ab7deca50def443b9b20d425e65b5` |

本文件记录本阶段实际使用的直接依赖，不代表阶段九的完整许可证、全部传递依赖、用户素材再分发许可或 public release portability audit 已完成。
