# F 盘运行环境

WSL 3.0.1 与 Docker Desktop 已安装，Windows 已重启。第一阶段只配置和运行五个核心服务，没有安装 Ubuntu 或其他语言工具链。源码在 E:，新增工具、依赖、缓存、下载、临时文件、数据盘与运行日志在 F:\OCVdeps。

## 日常启动

在 E:\OmniCivitas 中执行：

```powershell
.\ocv.ps1 civilization:docker
.\ocv.ps1 civilization:core
```

访问 http://127.0.0.1:8080。Docker 无须注册账号。civilization:status 查看状态；civilization:stop 停止本项目容器并保留数据卷。

请使用项目入口启动 Docker。它只为 Docker 子进程设置 F: 的 APPDATA、LOCALAPPDATA、USERPROFILE 与界面目录，不永久修改 Windows 账号、HOME、系统环境或其他应用。Docker 前端从 Windows homedir 拼接部分日志路径，因此仅设置 APPDATA 或传给启动器 Chromium 参数还不够。全局 WSL 配置仍在真实 Windows 用户目录，Docker 独立目录保留同内容副本。

WSL 日常上限 9 GiB、6 CPU、F: 的 2 GiB swap；实际内核可见内存约 8.73 GiB。五容器内存限制合计 1216 MiB。构建使用 3 GiB builder，各目标顺序构建，结束停止 builder。其余技术在后续授权阶段接入，不能把第一阶段 maximum 当作全栈已经实现。

## 存储检查和验证

scripts/Confirm-DockerStorage.ps1 在每次 pull/build 前运行：检查本地 Linux 引擎、安装/覆盖设置、实际 WSL 注册 BasePath、两份 F: VHDX、F: swap 与活动内存上限。scripts/Inspect-OcvPhysicalPaths.ps1 用原生文件句柄核实物理路径，避免 MSIX 重定向造成误判。

```powershell
$env:OCV_EXPECT_DATABASE = 'true'
.\ocv.ps1 civilization:verify
.\ocv.ps1 civilization:verify-storage
.\ocv.ps1 test:e2e
.\ocv.ps1 civilization:doctor
```

存储验收会短暂停止本项目的 PostgreSQL、Redis 和核心容器，核对失败响应与重启保留，随后恢复核心。只操作虚构演示表；诊断报告在 F:\OCVdeps\runtime\reports。

## 无容器开发

先停止容器入口避免 8080 冲突，再运行 civilization:dev 或构建后 civilization:serve。便携 Nginx、Astro、NestJS 可独立工作；无连接信息时明确使用最多 64 条内存演示，不能计作 PostgreSQL/Redis 验收。

## 安装与维护

Install-OcvRuntime.ps1 验证官方安装包 SHA-256、Authenticode 与发布者，WSL、Docker 程序及 Docker 数据根指定 F:。用户已明确接受 Windows 组件、服务注册和 Installer 维护缓存的系统例外；脚本不会自动重启。实际系统路径与首次启动缓存处置见 [C-DRIVE-EXCEPTIONS.md](C-DRIVE-EXCEPTIONS.md)。

安装器额外创建的全局 CLI 插件已移到 F:，C: 的兼容入口是联接；项目 CLI 显式优先使用 F: 插件。升级后仍须重新核查，不能把安装目录参数当作所有缓存已正确的证据。

依赖重建使用 scripts/bootstrap-tools.mjs、scripts/link-dependencies.ps1 和 ocv.ps1 install --frozen-lockfile。不调用 C: pnpm 或全局安装。明确休眠的历史语言不提前安装编译器。

官方依据：[Docker 安装参数](https://docs.docker.com/desktop/setup/install/windows-install/)、[Docker 设置](https://docs.docker.com/desktop/settings-and-maintenance/settings/)、[Microsoft WSL 配置](https://learn.microsoft.com/zh-cn/windows/wsl/wsl-config)、[MSIX 重定向](https://learn.microsoft.com/en-us/windows/msix/desktop/flexible-virtualization)。前端覆盖行为根据已安装 Docker 官方 frontend/resources/app.asar 实际代码核对。
