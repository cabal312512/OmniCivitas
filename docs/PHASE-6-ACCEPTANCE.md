# 第六阶段验收

2026-10-02T18:17:29.320Z。本阶段 19 条要求逐条 verified，新工具累加到现有玻璃/失修门户，总计 54 个工具。第五阶段及原扉页、光场、迷宫与互动保留。已完成并停止，第七阶段未授权。

新完整浏览器 212/212（桌面/手机各 106；本阶段 78＋第五阶段回归 84＋原页面回归 50），无失败、跳过、flaky 或重试拼接。新合并单测 90/90（本阶段 47＋第五阶段 43）。详细证据见 [phase-6-acceptance.json](phase-6-acceptance.json)。

初次 89/90 单测因 Math.js 冷加载超过默认 5 秒期限而保留为失败报告；改用 15 秒单测期限重新完整执行。初次 78 浏览器专项有六项 Cropper CSS 404，已将库 CSS 改成 Astro 静态导入并重建；旧诊断和专项复查都独立保留，不拼入当前 212 项。具体记录见 JSON 的 earlierRuns。

第一次完整浏览器运行是 208/212：本阶段 78 项均通过，四项旧页面检查分别遇到新增同名入口、手机故意遮挡和 GPU 首绘期间的协议轮询。修正搜索结果定位、使用真实键盘完成被遮挡的移动端操作，并将轮询改为原生属性断言，原要求和验证条件保留。随后六项专项通过，再从头执行本报告对应的完整 212 项；全部旧结果分开保存。

## 逐条核对

| 编号 | 原文 | 页面 | 状态 | 主要源码 | 证据 |
| --- | --- | --- | --- | --- | --- |
| B018 | 正常实用功能之一：图片裁剪。这个认真实现，但只实现最基础版本：上传一张图片、拖动矩形裁剪区域、导出 PNG/JPEG。直接用成熟前端裁剪库，不自己写复杂缩放和坐标算法。 | /functions/image-crop/ | verified | apps/portal/src/图没印在这一面/相纸拿反了.mjs | 8 项关联单测；桌面/手机真实默认值；image-crop, image-cancel-pdf, image-limits |
| B019 | 图片压缩。只做浏览器端 Canvas 压缩，允许选择几个预设质量，例如低、中、高；不追求专业压缩算法。 | /functions/image-compress/ | verified | apps/portal/src/图没印在这一面/相纸拿反了.mjs | 6 项关联单测；桌面/手机真实默认值；image-resize-compression, image-limits |
| B020 | 图片格式转换。只支持浏览器比较容易处理的 PNG、JPEG、WebP，使用 Canvas；遇到不支持格式直接提示“此文明阶段暂不支持”。 | /functions/image-convert/ | verified | apps/portal/src/图没印在这一面/相纸拿反了.mjs | 6 项关联单测；桌面/手机真实默认值；image-formats, image-limits |
| B021 | 图片尺寸调整。只处理单张图片，不做真正复杂的批量任务队列。输入宽高后 Canvas resize。 | /functions/image-resize/ | verified | apps/portal/src/图没印在这一面/相纸拿反了.mjs | 1 项关联单测；桌面/手机真实默认值；image-resize-compression |
| B022 | 图片取色器。用浏览器 Color Picker 或 Canvas 像素取色即可。 | /functions/image-color/ | verified | apps/portal/src/图没印在这一面/相纸拿反了.mjs | 1 项关联单测；桌面/手机真实默认值；image-pixels |
| B023 | 文字转图片。一个 textarea＋字体大小＋简单背景设置，然后 Canvas 导出。 | /functions/text-image/ | verified | apps/portal/src/图没印在这一面/相纸拿反了.mjs | 1 项关联单测；桌面/手机真实默认值；image-text |
| B024 | 二维码生成器。直接使用成熟二维码 npm 库，不自己实现二维码编码算法。 | /functions/qr-generate/ | verified | apps/portal/src/图没印在这一面/相纸拿反了.mjs | 2 项关联单测；桌面/手机真实默认值；image-qr |
| B025 | 二维码解析器可以降级：如果有非常轻量成熟库就接库；否则做完整 UI，上传图片后模拟扫描 1～2 秒，并从几组固定演示结果中返回一个。页面底部小字写“实验性识别服务”。 | /functions/qr-read/ | verified | apps/portal/src/图没印在这一面/相纸拿反了.mjs | 2 项关联单测；桌面/手机真实默认值；image-qr, image-limits |
| B049 | 倒计时器。 | /functions/countdown/ | verified | apps/portal/src/钟归另一栋楼管/时间表忘了盖章.mjs | 4 项关联单测；桌面/手机真实默认值；time-countdown-controls |
| B050 | 秒表。 | /functions/stopwatch/ | verified | apps/portal/src/钟归另一栋楼管/时间表忘了盖章.mjs | 3 项关联单测；桌面/手机真实默认值；time-stopwatch-pomodoro, time-lifecycle |
| B051 | 番茄钟。 | /functions/pomodoro/ | verified | apps/portal/src/钟归另一栋楼管/时间表忘了盖章.mjs | 3 项关联单测；桌面/手机真实默认值；time-stopwatch-pomodoro |
| B052 | 简单待办事项，数据存在浏览器里。 | /functions/todo/ | verified | apps/portal/src/钟归另一栋楼管/时间表忘了盖章.mjs | 6 项关联单测；桌面/手机真实默认值；time-todo-crud-download, time-todo-rejections, time-todo-fallback |
| B053 | 课程表生成器改成“课程表排版器”：用户手动填课程和时间，系统只是生成表格，不负责智能安排。 | /functions/timetable/ | verified | apps/portal/src/调度中心借了天文台/值班表其实是星历.mjs | 3 项关联单测；桌面/手机真实默认值；science-timetable |
| B054 | 考试复习计划生成器不做真正规划算法。用户输入科目和考试日期，系统根据天数平均切分，然后夹杂几句固定建议。 | /functions/study-plan/ | verified | apps/portal/src/调度中心借了天文台/值班表其实是星历.mjs | 3 项关联单测；桌面/手机真实默认值；science-study-plan |
| B055 | “智能排课系统”保留入口和很正式的 UI，但不做真正约束求解。用户输入教师、课程和几个时间段后，系统先显示“正在调用国家级调度引擎”，随后使用简单随机排列；如果发现明显同一教师同一时间重复，只做一两个基础冲突检查。还可以偶尔返回“当前排课复杂度超过免费文明等级”。 | /functions/scheduling/ | verified | apps/portal/src/调度中心借了天文台/值班表其实是星历.mjs | 4 项关联单测；桌面/手机真实默认值；science-scheduling |
| B056 | “卫星轨道计算器”不做真正严谨的航天计算。页面看起来非常专业，有半长轴、偏心率、倾角等输入框，但实际只做几个非常基础的公式或者直接返回经过限制的演示值。旁边明确标为“娱乐/演示计算，不用于真实航天任务”。 | /functions/orbit/ | verified | apps/portal/src/调度中心借了天文台/值班表其实是星历.mjs | 2 项关联单测；桌面/手机真实默认值；science-orbit |
| B057 | “太阳系尺度演示”不做真正物理模拟。就是一张 CSS/SVG 动画页面，让几个圆按照预设速度转动，下面一本正经显示“高精度宇宙引擎”。 | /functions/solar-system/ | verified | apps/portal/src/调度中心借了天文台/值班表其实是星历.mjs | 1 项关联单测；桌面/手机真实默认值；science-solar-system |
| B058 | 经纬度距离计算器可以认真实现，因为 Haversine 公式很短，只计算两点直线球面距离，不做路线规划。 | /functions/distance/ | verified | apps/portal/src/调度中心借了天文台/值班表其实是星历.mjs | 3 项关联单测；桌面/手机真实默认值；science-distance |
| B123 | “空白 PDF 生成器”不需要自己实现 PDF 排版引擎。直接用现成 PDF 库生成一页，中央放一句很小的“本页有意接近空白”，或者如果懒得引入库，入口直接跳到 TXT 生成器并提示“PDF 服务已战略转型为文本服务”。 | /functions/blank-pdf/ | verified | apps/portal/src/文件从打印机背后出来/白纸也要走审批.mjs | 0 项关联单测；桌面/手机真实默认值；image-cancel-pdf |

## 实测结果

- 真正拖动 Cropper 选区后导出改变的矩形；三种图片格式有真实 magic bytes 和解码尺寸，透明 JPEG 明确铺白，PNG/WebP 保留透明。文字图有可见像素，取色使用实际 Canvas 坐标与 alpha。
- 实际二维码 PNG 下载、重新上传、由独立 jsQR 识别出原 Unicode 文字；恶意标签/URL 仍为文字，没有导航、外部请求或上传。SVG/文件字节/解码像素超限在本地拒绝。
- 真正的一页 A4 PDF 包含居中小图；解析页数、图像尺寸、绘制矩阵和无脚本，浏览器预览有文字像素。中文句子是 Canvas 栅格而非可选择 PDF 文本，字体按设备变化。
- 倒计时真暂停/继续/归零/完成，秒表记录实际分段，番茄钟短参数在最后休息后有限完成。取消/重跑无重复工作台。生命周期钩子以合成事件和模拟隐藏属性检查，不冒充真实 BFCache 命中。
- 待办真实增改勾选删除、刷新恢复、JSON 原字节下载及重新导入；坏结构/数量/文字/字节超限不破坏当前列表，实际 storage 写拒绝后仍能内存操作并明确显示。它是唯一新获准持久化的工具。
- 手动课程保留重叠原数据；复习按真实公历日期均分；排课取消后能恢复、所有课程保留且冲突明确；轨道基本数值、八行星预设 CSS 动画及 Haversine 已知球面距离都实际检查，演示边界可见。

## 运行与边界

90 个页面 HTTP 200，8 次账户 GET/POST 均 404，真实 PostgreSQL 停用账户表 0|0|0。仅六个健康 core，内存 caps 合计 1728 MiB，实际 CPU/PID/swap/日志边界存在；3 GiB builder 已停止。Docker/WSL 最后工作集采样 3018.6 MiB（2026-10-02T18:17:27.2670301Z），不是长期峰值。

新增 cropperjs 1.6.2、qrcode 1.5.4、jsqr 1.4.0、pdf-lib 1.17.1；真实调用证据、精确版本、本地目录和原许可见 JSON 与 [PHASE-6-SOURCES.md](PHASE-6-SOURCES.md)。公开归属声明及十份原许可均 HTTP 200，原字节/hash 一致；旧第五阶段来源记录保留。732 原文/行号/hash、146 原技术与 34 类别完整，其他阶段行不修改。

## 证据的实际范围

- Only phase 6 is accepted. Phase 7 is not authorized. Existing phase 5 and earlier evidence is preserved; it is not silently relabeled.
- Only six core services run; optional databases/languages/messaging/monitoring and the full technology stack are not claimed rerun in this phase.
- PNG/JPEG/WebP input only, 4 MiB file limit, 4096 per edge and 4 MP total decoded pixels; SVG, GIF, AVIF, BMP and animated WebP are explicitly unsupported. Compression presets do not guarantee every file becomes smaller.
- QR decoding is experimental; tested fixtures and exact Unicode round trips do not guarantee arbitrary blurred, bent or multiple-code images. Recognized URLs stay inert text.
- The PDF is a real one-page A4 document containing a small centered Chinese raster image. Its sentence is not selectable PDF text, depends on device fonts, and is not a general document layout or accessibility engine.
- Countdown/stopwatch/pomodoro use actual performance.now elapsed time; synthetic persisted PageTransitionEvent and simulated hidden getter test the lifecycle handlers, not a genuine BFCache hit or a real OS suspension measurement.
- Todo alone intentionally persists under localStorage key ocv.todo.v1. Invalid/unavailable/full storage falls back honestly to memory; memory data is not promised to survive refresh. Other tool inputs/files are not persisted or uploaded.
- Manual timetable only lays out supplied cells. Review divides calendar-day shares equally. Random scheduling flags conflicts instead of solving constraints; orbit is basic two-body entertainment math and solar-system periods/sizes are CSS/SVG presets, not flight or physical simulation.
- Intentional overlap and mobile clipping remain, with actual keyboard/focus/window-raise completion paths. Passing tests does not promise tidy responsive layout or FPS.
- Docker/WSL working set is a sample after testing, includes shared/file-cache pages and is not a long-term peak memory guarantee.
- Phase 9 public release portability audit, clean clone, full cross-platform installation and complete dependency/supplied-asset license audit remain pending.

阶段停点：[phase-state.json](phase-state.json)。第七阶段等待用户授权。
