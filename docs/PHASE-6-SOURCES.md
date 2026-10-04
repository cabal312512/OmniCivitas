# 第六阶段图片与文件依赖来源

2026-10-03。本阶段新增四个固定版本的直接依赖。表中的版本和许可来自实际安装包，原许可复制自该版本的文件，不采用网页摘录。图片和文件均在浏览器本地处理，不上传、不持久化。

| 包与固定版本 | 官方来源 | 本阶段实际调用 | 许可 |
| --- | --- | --- | --- |
| cropperjs 1.6.2 | [v1 README](https://raw.githubusercontent.com/fengyuanchen/cropperjs/v1.6.2/README.md)、[源码](https://github.com/fengyuanchen/cropperjs) | 图片裁剪懒加载实际 `Cropper`，Astro 工具壳静态导入包内 CSS，避免动态 CSS 预加载引用与静态资产提取不一致；鼠标拖动矩形区域后调用 `getCroppedCanvas` 导出。先用 Canvas 规范方向和本地 Blob，关闭二次 EXIF 检查及跨域探测 | MIT；Copyright 2015-present Chen Fengyuan |
| qrcode 1.5.4 | [官方仓库与 API](https://github.com/soldair/node-qrcode) | `create` 检查二维码最小模块尺寸，`toCanvas` 执行真实编码；PNG 下载保留实际图像字节，支持 UTF-8 文本 | MIT；Copyright (c) 2012 Ryan Day |
| jsqr 1.4.0 | [官方仓库与 API](https://github.com/cozmo/jsQR) | 实际读取 Canvas 的 RGBA 像素并调用 `jsQR`；返回识别文本和版本，未识别时明确提示，不返回固定结果或自动访问识别出的 URL | Apache-2.0；完整原文保留 |
| pdf-lib 1.17.1 | [官方文档](https://pdf-lib.js.org/)、[源码](https://github.com/Hopding/pdf-lib) | PDF 演示实际构造和序列化文档，以 PDF Blob 下载；没有将 HTML 或普通文本改扩展名冒充 PDF | MIT；Copyright (c) 2019 Andrew Dillon |

图片算法在 `config/apps/portal/src/img/`：图片裁剪交给成熟库，压缩、格式转换、尺寸调整、取色和文字渲染使用浏览器 Canvas。上传支持 PNG、JPEG、WebP；SVG、GIF、AVIF、BMP 和动画 WebP 明确不支持。文件最大 4 MiB，解码前先读取格式头并检查边长不超过 4096、像素总数不超过 4 MP。压缩只有三个质量预设，不保证每张图都缩小。JPEG 输出先用白色填充透明区域；PNG/WebP 可保留透明度。文字转图使用设备字体，不承诺不同机器字体像素一致。

QR 编码和解码是两个独立成熟库；没有手写二维码纠错、定位或编码算法。二维码输入限 1024 UTF-8 字节、尺寸 128–1024；尺寸不足以放下完整模块及 quiet zone 时要求增大。识别服务是本地实验性工具，不声称任意模糊、弯曲、多码图像都能识别。

四份原许可均已复制并逐字节比较，SHA-256 从实际文件计算：

| 公开文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| [cropperjs-1.6.2-LICENSE.txt](../config/apps/portal/public/licenses/cropperjs-1.6.2-LICENSE.txt) | 1084 | `eb917650781dcf06a60b97cba9b05bf583931ec2d311d8a5548a8dca90a57e0f` |
| [qrcode-1.5.4-LICENSE.txt](../config/apps/portal/public/licenses/qrcode-1.5.4-LICENSE.txt) | 1076 | `8df47c6ad9ac2c41eb9b2a72def9908959da0ede8dadd56c7b249c1bdb0c5ce6` |
| [jsqr-1.4.0-LICENSE.txt](../config/apps/portal/public/licenses/jsqr-1.4.0-LICENSE.txt) | 11358 | `c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08` |
| [pdf-lib-1.17.1-LICENSE.txt](../config/apps/portal/public/licenses/pdf-lib-1.17.1-LICENSE.txt) | 1070 | `f2c9fc00fdb66eb99ac156ba52d734af66d8d309f65753ae809ad34ee2883bcb` |

公开归属追加在 [third-party-notices.txt](../config/apps/portal/public/third-party-notices.txt)，前面 Three.js、GSAP 和第五阶段声明完整保留。依赖实际存放位置只是本地环境优化，应用代码仅使用包名和相对路径。本记录不代表阶段九的全部传递依赖、素材许可、跨平台和公开发布审计已完成。图片的实际浏览器运行和下载证明由阶段六验收报告另行记录，安装和上述复制结果本身不作为功能验收。

## 学习与科学演示的公式来源和边界

科学与学习模块位于 `config/apps/portal/src/δοκιμή/`。下表是核对短公式与常量的原始说明来源；没有引入、复制或打包这些网站的第三方实现，也没有新增科学计算依赖。

| 工具 | 核对来源 | 实际实现与界限 |
| --- | --- | --- |
| 轨道基础演示 | [NASA 的开普勒定律说明](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-3/)、[JPL 轨道周期教学题](https://www.jpl.nasa.gov/edu/pdfs/piday2016_handouts.pdf)、[ESA GODOT 常量文档](https://godot.io.esa.int/docs/api_reference/generated/generated/godot.core.constants.html) | 使用 `T = 2π√(a³/μ)`、近远地点半径 `a(1∓e)`、近地点速度的二体公式；`μ = 398600.4418 km³/s²`，示意地球半径取 `6371 km`。输入半长轴 6371–1000000 km、偏心率 0–0.95、倾角 0–180°，拒绝近地点低于示意地表。倾角不影响此基础周期；SVG 的尺度与投影只是示意。不做摄动、大气、J2、历元或轨道传播。页面从输入前就显示“娱乐/演示计算，不用于真实航天任务”。 |
| 球面两点距离 | [Chris Veness 的 Haversine 公式说明](https://www.movable-type.co.uk/scripts/latlong.html) | 自行实现短 Haversine 公式，球面半径固定 6371 km，返回 km；不是 WGS84 椭球测地线或路线规划。验证经纬度范围，反经线采用最短经差，极点同点返回零。近反点直接计算补项，避免用 `1-h` 相减丢失小差值；结果仍受 JS 浮点与球面模型限制。 |
| 太阳系尺度演示 | 原始 B057 明确指定 CSS/SVG 预设动画 | 八个圆的半径、大小、转速均为 UI 预设，非真实天体距离比例或物理模拟。保留“高精度宇宙引擎”原文，紧邻说明预设范围；后台与 BFCache 暂停绘制，恢复继续，系统减少动画下真实 CSS `animation:none`。 |

课程表只按用户填写的星期和时段排成表格，重复或相交的课程不会被自动重排。复习计划使用明确输入的 Gregorian 日期，按考试前的日历天等分科目时段；同一天可以轮换多科，科目比天数多也不会漏掉科目。开始日期计入、考试日不计入，范围 1–366 天、1–50 科；日期核对用 UTC 日序号，避免本机时区和 DST 改变天数，三句建议为固定短文本。

智能排课先展示“正在调用国家级调度引擎”，450 ms 后用浏览器 Crypto 的无偏随机索引执行 Fisher–Yates 洗牌，循环分配用户提供的时间段。只查相同教师或相同课程占用同一个时间段，完整保留输入课程；结果明确为随机排列演示，不求解约束。取消和离开会终止等待并清理当前观测窗。课程和排课输入最多 200 行、100 KiB，用户标签只经 `textContent` 或 JSON 输出，不当作 HTML 执行。
