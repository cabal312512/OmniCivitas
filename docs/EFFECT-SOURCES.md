# 新增特效来源与许可

2026-10-02，本轮只在既有页面累加新层，旧光场、模块及其交互继续挂载。未复制他人整站、Logo、截图、HDR 贴图或模型。几何与仪表图形在项目内生成，不运行远程 CDN 代码。

| 来源 | 当前实际用途 | 许可/处理 |
| --- | --- | --- |
| [Three.js r186 Unreal Bloom 示例](https://github.com/mrdoob/three.js/blob/r186/examples/webgl_postprocessing_unreal_bloom.html) | 参考 RenderPass → UnrealBloomPass 的后处理组织，使用包内真实后处理实现。另写透明合成 pass 保留旧光场 | three 0.186.1；MIT，包与构建产物保留其版权声明 |
| [Three.js physical transmission](https://github.com/mrdoob/three.js/blob/r186/examples/webgl_materials_physical_transmission.html) | 参考 MeshPhysicalMaterial 的 transmission/thickness/ior 参数关系，应用于程序生成的折射壳 | MIT；不下载示例外部环境照片 |
| [Three.js RoomEnvironment](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/environments/RoomEnvironment.js) | 包内程序生成摄影棚环境，经 PMREM 烘焙真实 PBR 金属反射 | MIT；不在仓库复制依赖目录 |
| [GSAP / ScrollTrigger](https://github.com/greensock/GSAP) | gsap 3.15.0，真实滚动拆解、标尺旋转、图形集进入动画 | [GSAP 标准许可](https://gsap.com/community/standard-license/)，不是 MIT；保留原包版权注释。仅作为本站页面动画，不提供 GSAP 可视化动画编辑器 |
| [OGL Flowmap](https://github.com/oframe/ogl/blob/master/examples/mouse-flowmap.html) | 调研对比，仅参考鼠标影响渲染思路，未安装或拷贝 OGL/素材 | 无当前依赖 |

新作者代码：config/apps/portal/src/aaa/Overdrive.astro、反应堆.css、反应堆.js。原光场.css / 光场.js 不撤下，不用安装新包代替运行验证。实体几何、发光路径、分实例阵列、实时折射和透明 HDR 辉光必须实际渲染后才记证据。

随后追加的叠错窗口、27 路由/21 种布局、迷宫窗口与 Lit 包壳亦为项目作者代码；Vue/Svelte/Solid 和浏览器抽屉沿用项目原代码。MIT 完整文本随仓库保存在 THIRD_PARTY_NOTICES.txt 与 docs/licenses/three-MIT.txt，GSAP 原版权注释仍保留在依赖/构建中。

实际缓存位置是本地 wrapper 配置；应用 import 使用标准包名，没有机器盘符，package.json / pnpm-lock.yaml 固定版本。正式公开部署仍需第九阶段独立审计。
