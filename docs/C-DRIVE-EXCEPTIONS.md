# 本次被用户明确接受的系统盘例外

2026-10-02（Asia/Shanghai），用户明确接受 WSL/Windows 系统组件与 Windows Installer 维护缓存写入 C: 的具体例外，并要求报告路径。其余新增依赖、软件主体、下载、数据盘、交换文件和普通缓存仍在 F:。

实际观察：

| 路径 | 用途 | 已观察到的体积 / 状态 |
| --- | --- | --- |
| `C:\WINDOWS\Installer\281e930d.msi` | Windows Installer 对 WSL 3.0.1 的维护缓存；注册表 LocalPackage 指向此处 | 367,669,248 bytes，约 350.6 MiB |
| `C:\WINDOWS\Installer\SourceHash{14CEDBC6-042F-4AB4-B177-BAFE1C16BC7A}` | Windows Installer 源校验元数据 | 20,480 bytes |
| `C:\Users\Lenovo\.wslconfig` | 小型全局 WSL 配置；9 GiB / 6 CPU / 2 GiB F: swap | 已写入 |
| `C:\Windows\WinSxS` 等系统目录 | VirtualMachinePlatform 由 Windows 自行维护的组件 | 已启用并完成重启；不能把系统共享目录整体大小算成本项目新增量 |
| `C:\ProgramData\DockerDesktop\install-settings.json` | 安装参数与系统注册所需的小设置 | 原生句柄确认在 C:；WSL 数据根指定 F: |
| `C:\ProgramData\DockerDesktop\install-log-admin.txt`、`install-cli-log-admin.txt` | 安装器维护日志 | 4,683 / 4,363 bytes |
| `C:\Program Files\Docker\cli-plugins` | 全局兼容入口 | 联接到 `F:\OCVdeps\docker-desktop\global-cli-plugins`；物理插件在 F: |

Docker 已安装并启动。拉取前确认实际磁盘为 `F:\OCVdeps\docker-data\disk\docker_data.vhdx` 和 `F:\OCVdeps\docker-data\main\ext4.vhdx`，实际 WSL 注册也在 F:，随后才拉取核心镜像。

首次失败启动生成约 3.60 GiB `backend.error.json`。显示路径 `C:\Users\Lenovo\AppData\Local\Docker` 被 MSIX 重定向到 `D:\WpSystem\S-1-5-21-988957464-1667095091-2741208122-1001\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\Docker`。原生文件句柄证明它在 D:；前期口头报告把显示路径当作物理路径，已纠正。

转储完整备份到 `F:\OCVdeps\runtime\backups\docker-first-launch-backend.error.json`，SHA-256 为 `1C992EF1145D81D2D44AA6EF2BB65AD47D866DC7096288818054B91E57710781`。正常删除被自动审批阻止；按用户后续明确要求，通过实际 D: 路径成功移入回收站。旧设置、日志与界面缓存也逐文件核对后备份到 F: 并回收。没有清空回收站。

当前 Docker 后端、前端与 CLI 子进程均使用 F: 的独立目录。物理路径证据在 `F:\OCVdeps\runtime\reports\physical-paths.json`，回收证据在 `docker-crash-recycling.json`、`docker-old-cache-recycling.json`。

WSL 服务的真实可执行路径通过 Win32_Service 验证为 `F:\OCVdeps\wsl-app\wslservice.exe`。安装原包在 `F:\OCVdeps\downloads\wsl.3.0.1.0.x64.msi`。安装日志在 `F:\OCVdeps\runtime\logs\wsl-install.log`，管理员步骤日志在 `F:\OCVdeps\runtime\logs\setup-admin.log`。

**不要手动删除 Windows Installer / WinSxS 的内容。** 它们用于系统及软件维护，删除会破坏修复、更新或卸载。本项目不会移动系统缓存来掩盖写入。
