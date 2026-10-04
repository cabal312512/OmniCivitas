# Finite-memory control of random sequential adsorption

这是一个独立、认真的计算研究目录。研究问题是：只知道放置成功或失败、
只有一位内部状态的控制器，能否改善不可逆随机堆积？不依赖网站、数据库或 Docker。

本轮得到的是有条件的负结果和明确的机制区分，不能宣传为“记忆提高堆积”的证明：

- 64 个确定性两状态编码归约为 26 个带方向的根行为类，交换 H/V 后为 13 类。
- 严格交替成功方向可以近乎完全平衡，但仍经常卡死，且另一方向有可用空间。
- 在锁定的 36 项检验中，没有反馈策略同时确认低各向异性，以及相对公平随机和
  开环交替两个对照的覆盖率优势。部分密度收益伴随明显的方向偏置。

实际完成 226,816 次终态模拟、768 对外部救援、192 条直接试探轨迹，另有精确
有理数枚举和独立校验。完整结果在 `results/RESEARCH_REPORT.zh.md`，英文论文在
`paper/paper.md` / `paper/paper.pdf`；这是尚未投稿、未经外部同行评审的研究稿。

## 快速复现

安装普通 Node.js 22 或更新版本，在本目录执行：

```sh
node scripts/reproduce.mjs --profile quick
```

无需 `npm install`。命令创建全新的源码副本，运行全部研究单测、精确小系统、
520 次快速模拟与分析，并逐行对照从原 atlas 保存的 520 条科学记录。只忽略
实验标签和不确定的计时字段；原始数据不会覆盖。这个快速检查不代替完整实验。
默认输出到 `results/reproduction-quick-时间/`，也可指定不存在的目录：

```sh
node scripts/reproduce.mjs --profile quick --output ../rsa-check
```

## 完整复现

```sh
node scripts/reproduce.mjs --profile full --output ../rsa-full
```

这会按顺序重做五个主要实验、RRSA-like 参考、救援、直接轨迹、精确计算、统计和
论文数值表。atlas 后、confirmation 前重新锁定同一预定家族，使用新的 lock 文件，
不改写历史 lock。全部执行只用标准 Node；单进程运行，不同时启动其他技术栈。
不同操作系统和硬件的计时、时间戳及文件 hash 可以不同；同一 RNG 实现/种子下
科学字段可逐行比较。输出包含命令日志与 `results/reproduction-proof.json`。

独立实验入口也保留：`node scripts/run-experiment.mjs experiments/atlas.json`。
如果目标原始 CSV 已经存在，它会拒绝覆盖；完整复现入口负责创建干净目录。

## 从原始数据重做分析和图

本轮已在两个全新源码副本中实际执行 quick 和 full。Quick 的 37 项研究测试、
520 条科学记录回放通过；full 记录的 12 个阶段命令全部退出成功。随后独立逐行
核对 226,816 条终态科学记录（仅排除计时），768 对救援、192 条轨迹摘要与
36 项正式检验也完全一致。证据见 `results/clean-reproduction.json`、
`results/full-reproduction.json`、`results/full-reproduction-comparison.json`。
这验证的是本机同一运行时的干净源码复现，不能冒充另一个操作系统的独立重复研究。

```sh
node analysis/summarize.mjs --input "data/raw/*.csv" --output data/processed --lock docs/confirmation-lock.json
node analysis/extensions.mjs --rescue data/raw/interventions/rescue.csv --dynamics data/raw/dynamics/summary.json --output data/processed
python -m pip install -r requirements.txt
python analysis/figures.py --input data/processed --output figures --snapshots data/raw/dynamics/snapshots.json
```

图表只有 NumPy、Matplotlib 两项直接依赖；不需要 SciPy、Pandas 或深度学习框架。
生成 13 组 PDF/PNG/SVG，图表代码只读统计数据，不挑选“好看”的 seed。
若在复现输出目录执行上述命令，lock 改用 `docs/reproduction-lock.json`。

重做英文论文：

```sh
node scripts/prepare-paper.mjs
python -m pip install -r requirements-paper.txt
python scripts/render-paper.py
```

先生成图再渲染论文。PDF 排版另外使用 ReportLab、pypdf；字体来自 Matplotlib。
科研核心没有 Python 包依赖。不要用图的存在来代替模拟或统计证据。

## 文件地图

| 路径 | 内容 |
| --- | --- |
| `docs/initial-brief.txt` | 用户提供的原始研究提示词快照，未改写 |
| `docs/MODEL.md`, `docs/THEORY.md` | 模型、边界、终止定义、分类和证明 |
| `src/` | RNG、增量合法位置、直接/事件模拟、有理数精确计算 |
| `experiments/` | 规模、策略、种子、重复次数 |
| `data/raw/` | 每次完整运行的 CSV、真实轨迹、快照和运行 manifest |
| `data/processed/` | 均值/方差/区间、36 项检验、Pareto、审计证据 |
| `docs/confirmation-lock.json` | 首批 holdout 开始前封存的统计家族 |
| `figures/` | 13 组正式图与图表清单；`pilot/` 是探索阶段历史图 |
| `tests/` | 模型、枚举、独立 Markov oracle、统计和科学字段回放 |
| `literature/` | 12 条核实文献、38 条查询与来源访问限制 |
| `paper/` | 英文研究稿、数据生成的数值表与 PDF |
| `results/` | 中文报告、验收/复现证据与最终 hash 清单 |
| `RESEARCH_LOG.md`, `OPEN_QUESTIONS.md` | 研究判断、负结果、修复历史和后续问题 |
| `docs/REQUIREMENTS_COVERAGE.md` | 提示词 25 章逐章落实/部分/延期的诚实记录 |

## 阅读结果时的边界

controller 不能看位置、时间、密度或合法位置数量；模拟器知道这些，仅用来准确
跳过失败和识别吸收。终态分为 geometric jam 与 controller deadlock，不用连续
失败次数冒充真正堵塞。事件模拟未生成的随机基线失败方向计数留空，不能当零。
|S| 是每次运行的绝对方向序参量，再取均值，不能用正负相抵的平均 S 伪装平衡。

Atlas 是探索；独立种子 confirmation 才用于锁定家族。外部救援不移动已有粒子，
但借助了控制器不可见的信息，因此不属于一位记忆策略收益。RRSA-like 是已有
思想的明确变体，不宣称完整复制文献停止规则，更不宣称首次研究结果反馈。

没有证明所有有限记忆无用，也没有证明宏观相变或无限体积极限。两位记忆、
noise/delay 和全面空间结构统计本轮没有做；见逐章记录和开放问题。

## 本机环境与公开复现

本次运行使用现有便携 Node，以及独立的便携 Python；工具、下载、缓存和临时
数据均放在用户指定的依赖盘。脚本不写死磁盘、用户名或工具安装位置。
这台 Windows 电脑可先点源仓库的 `scripts/Enter-OcvEnvironment.ps1` 再运行，
该本机 wrapper 不是公开复现的必要条件。其他系统使用自己的正常 Node/Python。

RNG 的第三方出处和许可见 `THIRD_PARTY_NOTICES.md`。AI 辅助开发、内部审阅、
实际数值计算与外部同行评审是不同事项；当前没有外部同行评审记录。
