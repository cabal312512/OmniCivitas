# 第三阶段之后：现代混乱视觉修订验收

2026-10-02。用户授权的视觉大改与交接文档已完成，运行入口 http://127.0.0.1:8080 已更新为本轮镜像。第三阶段历史验收保留；第四阶段没有开启。零上下文接手先读 [HANDOFF.md](HANDOFF.md)。

## 这轮实际改变

撤去整站橙色锅壁纸与复古边框，改为石墨黑、银色金属、薄荷色的精密主框架。首屏真实 WebGL 金属环与粒子叠上梗图卫星；中段有紫粉厨房、荧光终端、酸绿艺术角、旧通知窗口、红黄印章、青色玻璃抽屉、红色计算面板、纸面保洁台、银蓝时钟。Next 共用导航，内部另用米白/蓝色票据视觉，保留真混合框架组件和旧 Angular 小窗。

保留区域分类、36 段长卷、极长图片、四层嵌套路由、横向地下长廊、有效 CSS 故意只挂打印介质的裸页。新增可翻动的横向章节与 sticky 叠卡。全部导航仍落到实际页面或功能。

| 动效参考 | 本轮实现与证据 |
| --- | --- |
| Kinetic typography | 主标题按真实滚动改变字宽和字距；指针专项实际读到变化。不冒称使用了未安装的变量字体 |
| Mask reveal | 标题从 clip-path 遮罩展开；观察未裁切的父容器，修复标题永久消失问题 |
| 液态/磨砂玻璃 | 横向流体结、半透明金属仪表、抽屉和时钟；CSS 渐变、形变、backdrop-filter |
| 局部照明/交互光标 | 指针附近径向光与“临时管理员”跟随角色；细指针才启用，不遮挡操作 |
| 磁吸 / 3D tilt | 主入口实际 translate；区域卡片 perspective rotateX/Y；离开归位 |
| Shader noise / 粒子 | 原生 WebGL torus raymarch shader 带噪声，42 粒子；桌面/手机均实际 renderer=webgl |
| 文本 scramble | 横向章节英文标签短暂打散并恢复；专项验证恢复原文 |
| Marquee | 倾斜薄荷色循环带，装饰多语言；无外部资源 |
| 横向章节 | 原生横向滚动、左右按钮、键盘可聚焦，三个章节均有真实出口 |
| SVG path / odometer | 路径随区块进入视口绘制，五位滚动数字记录真实 scrollY |
| Sticky stacking | 三张不同材质卡片在滚动中依次叠住，手机单独调整位置 |
| 视差 / 3D | 首屏模型随指针改变角度，轨道与卫星处于不同视觉层 |
| 视频与 3D 衔接 | 本轮未实现：没有接入视频素材，不用动画图片假冒视频管线 |

未加回“停止乱动”。系统 reduced-motion 下 CSS 动画停止，5 张动态原图用浏览器画布冻结，工具仍可操作。WebGL 不可用时有 CSS 金属形体替身。画布最长边 640 像素，单个渲染循环约 30 FPS 上限；离屏停止渲染，隐藏页面暂停；碎片上限 8 个、2.8 秒回收。没有新增依赖或拉起 optional 服务。

## 16 张梗图逐张落点

原始文件全数复制，不裁剪/重编码。尺寸、原名、相对 URL、字节数、SHA256 见 `config/apps/portal/src/data/路过的十六位.json`；图片都由本站 `/memes/` 提供。SHA256 同时核对项目文件与实际 HTTP 返回，16/16 相同。素材来源为用户本机提供；未替用户作外部许可证认定。

| ID | 原文件 | 页面位置 |
| --- | --- | --- |
| 01 | 3cb1e332f23166bee9259556ab77650b.webp | 首屏猫观察员卫星 |
| 02 | 9ce4c4363f1a1d1784d9344432e03b1a.gif | 首屏献花卫星 |
| 03 | c (1).avif | 收据小窗旁的预算访客 |
| 04 | c (3).avif | 首屏 Ciallo 卫星 |
| 05 | c (4).avif | 核心接口验收区的视察者 |
| 06 | c (5).avif | 本机抽屉的分析员 |
| 07 | c (6).avif | 地下长廊入口的秩序维护者 |
| 08 | c (7).jpg | 日期面板边缘访客 |
| 09 | c (8).avif | 厨房边缘的隔壁超市 |
| 10 | c.avif | 抽屉/计算器旁极长竖井 |
| 11 | da1860fcd3d593b4a84ce18561727db2.gif | jQuery 保洁台 |
| 12 | e67b48160e78e45879566138d343041e.gif | 收据小窗外的同步访客 |
| 13 | fa26ed9c6d5952d4856410928716a2e1.gif | Svelte 停机终端边缘 |
| 14 | images (1).jpg | 不明来客区域 |
| 15 | images.jpg | 首屏窄比例卫星 |
| 16 | m.avif | 首屏旋转徽章卫星 |

## 验证结果

- Playwright 桌面/手机共 **24/24 通过**：保留原前端 16 项，再加 8 项动效/素材/降级/导航检查。PG/Redis 仍实连；Java 等 optional 保持关闭，日期链本轮验证的是诚实的有限失败路径，未冒称重测语言批次。
- 指针专项通过：磁吸 translate、卡片 rotateX/Y、滚动字宽变化、scramble 恢复、sticky 实际定位。
- Linux Docker 中 Angular、Astro、Next/TypeScript 顺序生产构建通过，实际网站换镜像。首次 Windows 原生 Astro build 在编译日志出现前停滞，已结束该自建进程树；本轮不记原生构建通过。
- 查看了桌面首屏、模块区、叠层、Next 全页和手机首屏/模块/横向章节截图。修复首次检查发现的遮罩观察死锁和桌面横向溢出；路径断言改为等待下一渲染帧的实际结果。
- 16 图真实解码、服务端原图 SHA256 全通过；无新增应用盘符/用户名硬编码；`ledger:check` 确认 732 条编号、原文/行映射、34 分类和源文件 hash 完整。
- 当前仅 **6 个 core 健康**，caps 合计 **1728 MiB**；builder 停止、cap 3072 MiB。Docker/WSL 工作集一次采样 **7246.8 MiB**（约 7.1 GiB，含缓存/可能重复共享页，不代表长期峰值）。

证据目录：本机 `F:\OCVdeps\runtime\reports`。主要文件：`phase3-visual-playwright.json`、`phase3-visual-runtime.json`、`phase3-visual-pointer.json`、`phase3-visual-desktop-renderer.json`、`phase3-visual-mobile-renderer.json`、`phase3-visual-*-hero.png`、`phase3-visual-*-home.png`、`phase3-visual-*-next.png`、`phase3-visual-mobile-materials.png`、`phase3-visual-mobile-chapters.png`。镜像重建日志在 `runtime/logs/phase3-visual-rebuild.log`。以上路径仅是这台开发机的证据位置，不是应用运行条件。

当前范围验收完毕，停在第三阶段之后。第九阶段的完整公开可移植性/干净 clone 审计仍未完成；本轮没有改变原 732 条要求的验收归属，也没有把第八阶段所有视觉要求自动标完。
