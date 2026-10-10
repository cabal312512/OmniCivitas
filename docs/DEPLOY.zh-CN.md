# 部署（中文）

[Default English deployment guide](DEPLOY.en.md)。

回到仓库根目录。Web 界面使用 Astro、Next.js、Angular 和 NestJS；Docker 默认仅运行核心服务。常规开发、构建和主要功能不需要启动全部基础设施。

### 本地开发

安装 **Node.js 24.14.1**、**pnpm 10.34.6** 和 Git：

```sh
git clone https://github.com/cabal312512/OmniCivitas.git
cd OmniCivitas
pnpm install --frozen-lockfile
pnpm dev
```

打开 **http://127.0.0.1:8080** 首次启动顺序准备 Angular、网关与科研下载包，再启动开发服务；大体积原始记录需要处理时间。Ctrl+C 停止。没有数据库 URL 时，开发入口明确使用有容量限制的内存存储，重启后不保留该数据。需要 PostgreSQL/Redis 持久化时使用 Docker 核心模式。

```sh
pnpm build
pnpm test
pnpm test:jest
```

五个构建目标默认顺序运行。端口可用 `OCV_WEB_PORT`、`OCV_PORTAL_PORT`、`OCV_NEXT_PORT`、`OCV_GATEWAY_PORT` 调整，四个值应互不冲突。标准命令不要求特定盘符、Windows 用户名、本机 PowerShell wrapper 或缓存变量。

### Docker 核心模式

完成第一次 Docker 安装与构建后，Windows 可双击根目录的 **`启动网站.bat`**。
它会按需启动 Docker Desktop，验证已选择的本地存储策略，分批启动已有的六个核心镜像，
打开实际配置的本地端口，并请求已有的共享任务调度器；调度器通过租约防止重复执行。
工具位置取自可选本地配置或 PATH，没有固定盘符或用户目录要求。
此入口不会自动安装工具、下载镜像或重新构建；缺少初始镜像会明确提示先完成安装。
只检查启动、不打开浏览器和请求调度器时，可运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Start-OcvWebsite.ps1 -NoOpen -NoRunner
```

Linux 使用 Docker Engine + Compose v2；Windows/macOS 使用 Docker Desktop 的 Linux 容器模式。在根目录运行：

```sh
docker compose up --build -d --wait
docker compose ps
```

默认启动 **edge、portal、next、gateway、PostgreSQL、Redis** 六个服务，入口仍是 **http://127.0.0.1:8080**。首次构建下载依赖并生成科研资源，请预留空间。仓库源文件接近 1 GB；安装包、镜像和构建缓存另占磁盘。

也可使用带预算的标准 Node 入口：

```sh
pnpm civilization:core
pnpm civilization:status
pnpm civilization:stop
```

控制器使用 3 GiB 构建器并顺序构建，完成后停止构建器。停止服务保留 named volumes。`docker compose down` 也保留数据；**`docker compose down -v` 会删除卷数据**。

### 按需服务

全部已配置服务保留在 [compose.yaml](../compose.yaml)。core 无需指定 profile，其余按工作需要选择。

| Profile | 额外服务 | 包含 core 的容器内存上限合计 |
| --- | --- | ---: |
| core | 默认六服务 | 1728 MiB |
| databases | MySQL、MongoDB、MinIO、archive API | 2944 MiB |
| legacy | Spring、FastAPI、Laravel、Fiber、ASP.NET SOAP、Sinatra、Hono、MySQL | 4000 MiB |
| messaging | RabbitMQ、Kafka、MongoDB、消息工作进程 | 3968 MiB |
| search | Elasticsearch | 3008 MiB |
| monitoring | OpenTelemetry、Prometheus、Grafana | 2240 MiB |
| maximum / everything | 全部可选服务 | 10400 MiB |

```sh
pnpm civilization:databases
pnpm civilization:legacy
pnpm civilization:messaging
pnpm civilization:monitoring
pnpm civilization:search
pnpm civilization:batch legacy,messaging,search
pnpm civilization:maximum
```

控制器切换组时停止不相关的可选容器。直接用 Compose 则会保留之前启动的服务：

```sh
docker compose --profile legacy up --build -d --wait
docker compose --profile legacy stop
```

小内存机器分批使用 profiles，避免全栈运行时同时编译。表中是容器上限，不是主机总内存预测；Docker、系统、缓存和编译还会占用内存。maximum 控制器默认拒绝总容器预算超过 **8192 MiB**；其他硬件可通过 `OCV_CONTAINER_BUDGET_MIB` 调整。Java、Kafka、Elasticsearch 使用小型开发 heap。重要服务设置内存、CPU、PID 与日志限制。

资源预算是有界开发默认值，应按选用的服务和硬件调整。公开命令不会修改宿主 WSL 的内存、swap 或磁盘设置。

### 配置与持久化

仓库仅提供 [.env.example](../.env.example)。需要修改时复制成 `.env`；真实 `.env` 不提交。

```sh
# Linux / macOS
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Compose 读取 `.env`；直接 `pnpm dev` 使用进程环境变量，需要在终端设置相应值。示例提供发布地址、端口、数据库/消息凭据、容器资源与 heap 参数。共享部署前更换示例凭据。`OCV_DATABASE_URL` / `OCV_RABBIT_URL` 可覆盖拼接的连接串，密码含保留字符须 URL 编码。

数据库初始化用户名、密码和库名只对 **新卷** 生效。已有卷改配置后连接失败，应维护现有账号或另建项目卷；不要为排错直接删除重要数据。

Docker 数据使用 **named volumes**，实际硬盘由 Docker 决定。默认 bind mounts 仅使用仓库内相对路径与只读配置。本机挂载放在忽略的 `compose.local.yaml`，显式执行：

```sh
docker compose -f compose.yaml -f compose.local.yaml up -d --wait
```

资源变量形如 `OCV_POSTGRES_MEM=512m`、`OCV_MESSAGE_BRIDGE_CPU=0.5`；完整参数见 `.env.example`。heap 应小于容器上限。发布地址默认 loopback。对外访问需显式调整 bind address，配置 HTTPS 反向代理、访问控制与防火墙；当前示例是开发部署配置。

### 常见问题

| 现象 | 处理 |
| --- | --- |
| Node / pnpm 不匹配、安装失败 | 使用上述版本，保留 lockfile，确认 npm registry 网络 |
| 首次进入前等待较久 | 初次科研下载包和前端构建需要时间；查看终端或容器日志 |
| 端口被占用 | 调整四个 `OCV_*_PORT`，不要重复使用同一端口 |
| Docker 无法连接 | 启动 Docker，确认 Linux 容器模式和 Compose v2，执行 `docker info` |
| optional 接口返回降级状态 | 启动对应 profile；降级不代表实际数据库/消息服务已运行 |
| 数据库改密码后无法连接 | 已有卷不会重新初始化；维护原账号或使用新项目卷 |
| 内存不足、编译被终止 | 回到 core，停止可选组，顺序构建；检查可用内存后再调整预算 |
| WebGL 场景为空 | 检查浏览器硬件加速和 WebGL；图形演示不改变原始科研结果 |
| 音乐不自动播放 | 浏览器可能要求首次点击后才允许音频；页面提供开关和音量 |
| 手工验封提示缺论文 PDF | 对照 publication policy 的明确排除项；其余文件仍必须匹配 |

### 测试与平台范围

单元测试不需要全栈。浏览器检查需要运行中的应用及相应浏览器：

```sh
pnpm exec cypress install
pnpm test:cypress
pnpm exec playwright install chromium
```

`OCV_BASE_URL` 可调整测试入口。日常使用专项检查。原生后端集成测试按需运行：

```sh
pnpm civilization:legacy
node scripts/test-languages.mjs java python php go dotnet ruby
```

helper 依次使用 768 MiB 测试容器，SDK 按需下载。当前版本的自动检查见仓库 Actions。独立 macOS Docker / Linux Engine 宿主完整部署未验证。内部需求账本、交接和验收记录不随公开源码发布；公开 clone 中的 `pnpm ledger:check` 会明确报告无法核对内部账本。

`ocv.ps1` 是可选 PowerShell 入口，从配置或 PATH 查找工具，不要求特定盘符。可选配置及发布边界见 [可移植配置](PORTABILITY.md)。不要提交 node_modules、工具、缓存、构建输出、真实配置、token、证书、数据库数据、Docker volumes 或 WSL 磁盘。小型第三方包也通过 package.json / pnpm-lock.yaml 安装。

### 后台留存

普通页面新增的后台收据使用现有 core PostgreSQL、Redis 和网关 named volume，不需要启动可选服务。容器启动时会自动执行新增迁移；升级保留原数据库卷。`OCV_AFTER_RUN_LIMIT=128`、`OCV_AFTER_TABLE_LIMIT=6`、`OCV_AFTER_TABLE_EVERY=5` 控制收据留存和临时表轮换。只发送结果摘要和长度等元数据，不发送工具输入、输出正文或文件，也不改变现有输出和导出。没有数据库的本地开发会静默退避，工具仍可用。详情见 [后台链路](AFTER-ROUTES.md)；真实 core 启动后可执行 `node scripts/verify-after.mjs` 简要验收。

### 按需分支

按需语言/数据库/消息分支：先启动 core，再在另一终端执行 `pnpm civilization:after`，需要 Node 24 和可信宿主 Docker CLI 权限。任务排队分批运行，只关闭调度器自己启动的容器，named volumes 保留；已有工具结果立即显示。默认容器上限预算为 6144 MiB，并受 Docker 总内存减 1536 MiB 余量约束。较小机器可降低 `OCV_RUNNER_BUDGET_MIB`，部分重型分支会记录失败，不影响原工具；完整分支和冷构建建议至少 8 GiB Docker 宿主。脚本会在忽略的 `.env` 中保存私密调度密钥，不能发布。`pnpm civilization:after --stop` 请求正常停止；没有 pnpm 也可直接执行 `node scripts/after-runner.mjs`。详见 [分支与操作说明](AFTER-ROUTES.md#optional-on-demand-dispatcher)。其他部署默认仍只有 core。

### 机械工坊

根目录的数字Vue文件名控制共享任务档次，默认 `128.vue` 是最高档：最多128个活跃任务，排队数量不限。把它改名为 `1.vue` 到 `128.vue` 即可，例如 `32.vue` 表示32个活跃任务、2048个排队任务；低档排队上限为数字乘64。只保留一个此类文件。其中的坦克大战组件独立、休眠，网站和调度器都不导入它；调度器只读取文件名，兼容旧的无扩展名空数字文件。网关通过私有只读挂载读取文件名，不公开目录内容；网关和调度器会自动发现改名。调低后已有任务继续完成，新任务等待空位。排队默认24小时过期，可用 `OCV_AFTER_QUEUE_TTL_SECONDS` 调整。数字文件优先于环境变量；文件缺失时才使用 `OCV_RUNNER_CONCURRENCY` 和 `OCV_AFTER_QUEUE_LIMIT`，后者为0表示只取消数量上限。

128是任务调度上限，实际原生计算还受各服务CPU、内存和进程数限制。共享服务引用计数防止一个任务关闭另一个任务正在使用的容器，原生执行槽依据实际资源配置计算，大结果读取另设有界限制。强服务器可提高 `OCV_RUNNER_BUDGET_MIB` 和 `OCV_SIGNALS_NATIVE_MEM`／`CPU`／`PIDS`、`OCV_MECHANICS_NATIVE_MEM`／`CPU`／`PIDS`；改数字文件不会自动增加内存分配，本机仍保留原资源上限。

可选的 `OCV_RUNNER_MAX_CONCURRENCY` 可以独立于数字文件降低实际调度并发上限，默认128；实际执行仍受各服务资源限制。

已结束任务默认保留 `max(128, 档次数字×4)` 条，最高档512条；可用 `OCV_AFTER_TERMINAL_LIMIT` 在32–10000条内覆盖。超过留存数量会清理最旧的已结束结果；排队和正在执行的任务不会按这条规则清理。被裁剪或过期的结果会明确提示过期。

从“游戏”分类中的“机械工坊”、全局搜索或三个迷宫页面 `/maze/table/`、`/maze/offices/settings/`、`/maze/route/a/b/c/d/e/` 进入 `/workshop/`。保留网站导航，C#/Blazor负责编辑，Rust/Rapier负责同源二维浏览器与原生模拟，Vue负责可复用组件，Svelte负责记录帧回放。3D只改变外观。普通运行与参数实验同时开始本地计算和后台任务，先显示本地结果；“查看复核结果”保持灰色，直到本次后台结果通过核对并缓存才启用，完成不会自动切换显示。点击已启用的按钮才显示缓存。首入示例只在本地运行；调度器停用时本地计算仍可用。

服务端保存和后台计算需要core和持续运行的 `pnpm civilization:after`。同一调度器分批启动C#准备、固定Rust执行文件、C#核对；真实结果先存PostgreSQL再读回，核对不替换原结果。两端支持相同功能，后台使用更细步长，最小1/240秒、最多4,800步/256帧；导出记录实际请求设置。通信实验也采用并行运行、点击切换，电路瞬态和AC可用更密采样，事件网络/DC/同种子通信不伪称额外精度。独立工程任务在所选档位与资源上限内共享队列和服务；有限队列档位排满时返回429，本地计算继续。版本回退追加新版本。本地零件库默认只保存在当前浏览器。

工坊前120次自动读取每秒一次，之后每15秒一次，绝对等待上限7天。暂时读取失败时每15秒退避重试，复核按钮继续保持灰色，未结束任务仍可取消。编辑、重跑或离开页面会使旧显示请求失效。通过核对的结果缓存后按钮才启用，仍须点击才显示；过期或被裁剪的记录显示过期状态。浏览器的7天等待上限不会延长默认24小时排队期限或已结束结果留存数量。

普通 `pnpm build` 使用并校验已附带的浏览器产物。可选 `pnpm workshop:engines` 顺序重编译，需要联网、足够磁盘和3GiB构建预算；`docker compose --profile mechanics build dotnet mechanics-native` 构建原生服务。数值范围见 `pinia/folder2/README.md`，许可见 `/workshop/engines/NOTICE.txt`。受限二维与理想传动模型不冒称完整CAD、FEA或三维物理。

### 许可与联系

原创代码采用 **MIT — Copyright (c) 2026 cabal312512**，见 [LICENSE](../LICENSE)。第三方代码、字体、音乐及其他素材保留自身权利与许可，MIT 不重新授权它们。必要代码来源见 [THIRD_PARTY_NOTICES.txt](../THIRD_PARTY_NOTICES.txt)、[EFFECT-SOURCES.md](EFFECT-SOURCES.md) 和构建时生成的 `/licenses/bundled-notices.txt`。

素材声明：[MEDIA_NOTICE.md](../MEDIA_NOTICE.md) / `/legal/`。研究音乐 **Holizna — Retro Wave Collection**，来源 [OpenGameArt](https://opengameart.org/content/retro-wave-collection)，CC0；其他既有作者与来源保留在声明中。联系：**user31436@proton.me**。

当前版本的自动检查与部署限制见仓库 Actions 及本说明。

完整 maximum 服务组当前容器上限合计 10400 MiB，高于默认 8192 MiB 准入预算。启用全组前须明确调高 `OCV_CONTAINER_BUDGET_MIB` 并预留宿主和构建内存；较小机器使用分组。默认 core 和资源保护规则不变。

音乐处理、工具核对、事件投影和目录索引复用同一个按需调度器；资源限制、首次构建与留存边界见 [SITE-SERVICES.md](SITE-SERVICES.md)。
