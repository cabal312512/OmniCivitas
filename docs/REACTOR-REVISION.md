# 累加式三维反应堆修订

2026-10-02。用户否定之前过淡的线球，明确要求上网查成熟效果、增加专用依赖、加强颜色与科技感；随后明确“这一版别删也别撤”“直接强行放到页面上”“就这样一直累加”。这覆盖前一轮只留白色光场的取舍。本轮仍是第三阶段之后的视觉修订，第四阶段未授权。

## 当前页面

用户后续认可叠层方向，又说明“乱”包含排版、遮挡、分布、反人类设计逻辑和新手 CSS 错误，要求接回旧功能与更多不同布局的迷宫。新增2.astro / 迷宫.css / map.mjs / pages/maze/[...path].astro / 迷宫.js / b.js，27 真路由、21 种布局，共用白色玻璃/钴蓝/深色材质。首页加入重叠设置、永久展开菜单、任务表、被压住的确认框、错误位置 toast 与真实目录；有些装饰控件确实不能点击，真实功能提供置顶/折叠/移动窗口和固定退出。

路由包含九层深路径、横向 2900px 长廊、5200px 长页、极窄/侧转/倒序/超大/底部先出现/错列/表头在侧/无样式覆盖等情况。原 Vue/Pinia/vee-validate/Element Plus/vue-i18n 领票、Svelte store 计数、Solid signal 翻面在新壳里真实运行；Lit 新壳调用原浏览器抽屉模块保存、重载、切 CSS 标签/URL hash、Worker 与导出 JSON，不是写静态按钮糊弄。通知与表格排序也实际可用。原 React/Angular 等其他旧 UI 不自动全部重启。

用户最后明确手机低优先级，按钮越界也属于想要的错乱。本轮手机验证只检查关键真实交互/返回，并不要求所有框框规整响应式，也不宣称手机排版没有故意越界。首轮发现手机 layout viewport 被目录变大，出口落到 visual viewport 外，已用局部 overflow 容器和 visualViewport 定位修最小出口；27 页故意布局、裁切/过大/横向并未改成单列。首轮横廊测试阈值把 2900−1440=1460 错要求成 >1500，改为对真实滚动容器检查 >1000；原失败报告保留，完整新运行另行记录。

原 index.astro、光场.css、光场.js、Diagram.astro、所有玻璃板/图形集仍在实际入口挂载；不是把旧版仅移进 historical。新的 Overdrive.astro、反应堆.css、反应堆.js 直接追加 import 和图层。扉页继续安静，点击 Logo 或向下进入后才展开新层。新层透明合成，旧光场仍能透过背景和缝隙看到。前一轮源码另存 historical/luminous_白到看不清，更早的梗图版继续停用，均不删除。

新增内容：真实 MeshPhysicalMaterial 金属及 transmission/ior/thickness 折射壳；PMREM 摄影棚反射；三个实体编织环、八组实体轨道、十条分叉导管和沿路径移动的光包；实例化零件/刻度环；程序粒子 shader；HDR 辉光与透明合成；强钴蓝电路、位矩阵、频谱、深色扫描仪表；GSAP ScrollTrigger 拆解、导轨变化、图形集进入动画。实际帧渲染 draw calls 显示在角落，非虚构业务状态。页面无口号、长解释、梗图或账号表单。

真实包：three 0.186.1、gsap 3.15.0。Node/pnpm、包实体、缓存和下载均沿本地环境到 F:；源文件仅 import 标准包名，不含机器盘符。来源和许可见 EFFECT-SOURCES.md，GSAP 使用其标准许可，不冒充 MIT。不下载示例模型/HDR 照片，不复制他人品牌。

## 运行边界

用户明确可接受卡一点，因此新画布最长边现在为桌面 1920、小屏 1024，不按帧率自动降分辨率；单个新增帧循环约 25 FPS 上限，不保证帧率。旧画布原有帧循环和交互保留。进入主页后新增绘制，扉页新画布透明且不持续绘制。实例上限桌面 144、小屏 84，粒子 1500/600；几何固定，不无限增加节点。透射使用低比例渲染目标，HDR 基底复制用一个全屏 quad 避免重复渲染整个世界。隐藏页面暂停两层与 GSAP；减少动画停止持续循环但按钮/导航可用；WebGL1/2 全不可用时保留两个 CSS fallback。非 BFCache 离开释放几何、材质、render targets、环境纹理和事件。

实际当前验收见 reactor-acceptance.json，桌面与小屏截图、renderer JSON、Playwright 报告在本地 runtime/reports，构建日志在 runtime/logs。不要把之前 luminous / phase3 通过记录当作本轮结果，不把装包本身当效果已完成。

## 最终证据与停点

新完整运行 20/20 通过，原首轮错误报告另留 maze-before-exit-fix.json，本轮不是手工改失败结果。两套实际 GPU 都在绘制，新层实体几何 draw calls/triangles 和 getError=0 分桌面/小屏记录。27 路由全部逐 URL HTTP 核对，21 个 layout 类实际分别生成；代表性的首页/设置/缓存/横廊与原图形集有截图。桌面 headless 软件渲染实际帧率低于循环上限，观测值看 renderers[].sample；用户允许卡顿不等于编造性能保证。

已重建真正运行的 portal Linux 生产镜像，不只编辑源码；本轮没改 Next UI，不无意义重建其它语言。Docker 存储在每次镜像 build 前由既有实盘 guard 验证到 F:，重型 build 顺序执行。停点六个 core 健康、caps 合计 1728 MiB；builder 停止且 cap 3072 MiB。最后 Docker/WSL Windows 工作集采样 3806.4 MiB，包含缓存/共享页，不代表长期峰值。two packages 的原生联接目录写入验收 JSON，均在 F:；源码/配置及许可证在项目 E:。732 ID、原文/行号、34 来源类别和两个原始文档 hash 最终检查通过。

未开始第四阶段三门户/搜索/身份，也未宣称所有旧 71 技术再次同时运行、干净 clone 或三平台部署通过。用户定义的排版反人类/累加/手机低优先级已写入 HANDOFF 与 DECISIONS 34–36，本轮完成后停止。

完成时核对：真实新旧两个 renderer、三维 triangles/draw calls、GPU getError、四形态控制两层同步、ScrollTrigger 实际 explosion、指针视角、旧图形集/键盘/返回、隐藏暂停、减少动画、完整 GPU fallback、真实状态页、旧 Next redirect、core 健康/限额与 builder 停止、原文/hash。美术没有自动“用户认可”的结论。干净 clone、多平台部署、全部技术再次同时活跃及长期内存峰值均不在本轮验收范围，第九阶段独立审计继续待办。
