# 原始研究提示词逐章覆盖

来源是仓库根目录 `Prompt.txt` 的 25 章；原文未重写。本表对应本轮独立有限记忆 RSA 研究，不代表网站要求账本或第九阶段验收。提示词明确允许根据数据调整路线，二位记忆、噪声等大量方向是后期/建议性扩展；将它们保留为延期项，不能暗示已经实现。

**状态口径：**“本轮完成”指已实际执行或给出对应代码、数据、证明；“部分”明确列出尚无证据的内容；“建议性延期”指按提示词次序及本轮研究判断未开展。安装依赖、文件名存在和漂亮快照均不能代替科学结果。一键入口的 **quick 与 full 均已在全新源码目录实际执行**，10 页 PDF 已逐页视觉核验。full 属同运行时确定性重建，不是新的独立实验或跨平台验证。

| 章 | 原始主题 | 本轮状态 | 已完成内容与证据 | 尚未完成/边界 |
| --- | --- | --- | --- | --- |
| 1 | 研究背景与核心动机 | 本轮完成 | 定向文献检索、12 篇核实文献和 38 条查询；最近 RRSA 已有结果反馈机制，收缩新颖性表述。见 `literature/notes.md`、`references.bib`、`search-log.json`。 | 不是系统综述或优先权证明；2012 Publisher's Note 正文未获得，不能推断其更正内容。 |
| 2 | 基础模型 | 本轮完成 | 二维 H/V 直线 k-mer、不可逆吸附、均匀锚点、两状态二元反馈；周期与开放边界均运行。`docs/MODEL.md`、`src/lattice.mjs`、`src/simulate.mjs`。 | 开放边界只抽完整包含的锚点；将越界计作失败是未采用的不同模型。控制器不读取模拟器合法集合。 |
| 3 | 完整 deterministic 1-bit controller 研究 | 本轮完成 | 枚举全部 64 码；证明 26 根行为类、13 个 H/V 类；去除不可达状态，保持初始根；全部 atlas 与 13 类确认数据。`src/controllers.mjs`、`docs/THEORY.md`、`controller_classes.json`。 | 不把状态重标号后重新固定根当作等价；未宣称涵盖任意状态数或随机控制器。 |
| 4 | 不把目标简化为最高密度 | 本轮完成 | 联合测量 θ、逐运行绝对序、死锁与效率；画样本 Pareto/权衡；正式家族纳入各向同性检验、IID 与不读反馈的交替基线。`summary.csv`、`pareto.csv`、`comparisons.csv`。 | 未支持锁定各向同性反馈收益；样本前沿不是显著性或连续偏置最优解。 |
| 5 | 区分 geometric jamming 与 controller deadlock | 本轮完成 | 增量合法 H/V 集合与全失败前缀/循环判据；证明失败公平性；精确与 Monte Carlo 都记录残留合法位置。`MODEL.md`、`THEORY.md`、`src/exact.mjs`。 | 有限等待不是死锁；单方向堵塞不等于两方向几何堵塞。无限失败尾不计入已终止后的尝试数。 |
| 6 | 基础观测量 | 部分 | 终态覆盖率、粒子和方向数、残余空比例、合法位置、死锁、尝试/失败；192 条真实直接轨迹含状态/行动/结果与覆盖率。`data/raw/*.csv`、`data/raw/dynamics/`。 | **空簇、孔洞分布、域大小、空间 pair correlation、相关长度未计算。** 快照不能冒充这些测量；也未系统分析时间自相关。 |
| 7 | 信息论分析 | 部分 | 从真实 2×2×2 转移计数重算 `I(Y_previous;switch | O_previous)` 与结果条件换向率，192 轨迹/12 组。`analysis/extensions.mjs`、`dynamics-summary.json`。 | 非平稳、插件正偏已标明；不是因果信息或熵率。状态熵、历史信息率及“单位信息收益”未建立。 |
| 8 | 从 1 bit 扩展到 2 bit | 建议性延期 | 完整一位家族提供筛选地基；当前重心为分类、终止与负结果验证。 | **未枚举/筛选 1048576 个四状态策略**，未做 successive halving、百万策略 holdout 或 memory scaling。没有把拟议搜索当完成。 |
| 9 | 精确小系统 | 本轮完成 | BigInt 有理吸收计算：六小系统×64 控制器=384 组合，另 24 基线及单体；完整终态分布。独立 Markov 图/SCC/线性方程 oracle 与模拟核对。`src/exact.mjs`、`exact_small_systems.json`、`tests/exact.test.mjs`。 | 大系统精确状态空间未枚举。Monte Carlo 与精确值的 96 个 CI 检查无实质漏覆盖，4 个 1-ulp Wilson 端点伪失配公开保留。 |
| 10 | finite-size scaling | 部分 | L=16,32,64,128,256；五策略、k=2,4,8，各 128 次；开放边界另作 L=32,64,128。`finite_size.csv`、`open_boundary.csv`、`figures/finite-size.*`。 | **没有 L=512、临界指数、无限尺寸拟合或 bootstrap/jackknife 外推**；连接线仅引导视线，尺寸趋势不叫相变。 |
| 11 | 随机 controller | 部分 | 九个固定 IID 方向偏置及公平基线；最近 RRSA-like 两状态随机规则独立 2048 次描述性扩展。`confirmation.csv`、`rrsa.csv`。 | 未系统扫描随机 FSM 转移参数、确定性邻域扰动或连续概率优化；RRSA 扩展未追加到原 36 检验。 |
| 12 | feedback noise 与 delay | 建议性延期 | 保留为核心模型充分理解后的方向。 | **未实现/运行噪声、延迟、稳健性、critical noise 或 stochastic-resonance 检验。** |
| 13 | 自由探索的高级方向 | 部分 | 控制器精确分类、失败公平性证书、死锁的独立外部救援诊断已落地。`THEORY.md`、`rescue-summary.json`。 | 未做多记忆 scaling、进化/合成搜索、其他形状、多反馈字母表或全局性能上界。救援观察者不符合原信息约束。 |
| 14 | 可复现、统计、多重探索、sanity、负结果 | 本轮完成 | 参数/种子、原始 CSV、输入/source hash 与 run manifests；pilot 后封存独立 36-family；配对效应、Holm、Wilson；k=1、H/V、IID、exact 对照与负结果保留。quick 520 行和 full 全 226816 行科学字段一致；救援/轨迹摘要/36 检验一致。`STATISTICAL_PROTOCOL.md`、`audit.json`、`analysis-proof.json`、`results/full-reproduction-comparison.json`。 | Student-t 是明确的大样本近似；不把不拒绝当等效证明。full 是同运行时重建，不把回放算新重复；其他 OS 和可选 Python 从零安装未验证。 |
| 15 | 依赖极少的工程方案 | 本轮完成 | Node **标准库**、TypedArray、增量合法集合、解析失败循环；分析仅 NumPy/Matplotlib。`requirements.txt`、`src/`。 | 用 Node 取代建议的 C++/NumPy 核心，是根据已有可移植运行时与事件算法效率作出的判断；不是额外庞大框架。不依赖网站、Docker、数据库、用户盘符。 |
| 16 | 代码质量与测试 | 本轮完成 | 模拟器、RNG、控制器枚举/等价、精确 oracle、统计数值、缺失值与扩展信息/救援均有必要测试；全新目录集成研究单测 37/37，quick 与 full 实际重建完成。`tests/`、`src/`、`analysis/`、`results/unit-tests.txt`、`results/full-reproduction.json`。 | 子任务证据与最终整合证据区分；不把不同旧代码运行拼作当前验收，不把未测平台写成已测。 |
| 17 | 性能服务研究问题 | 本轮完成 | 事件算法省去无信息失败循环，允许完整枚举、独立确认与多尺寸真实执行；不以 benchmark 作为主产物。`MODEL.md`、`simulate.mjs`。 | 无分布式/深度学习堆栈，没有为跑分开展大性能工程；不承诺任意巨大晶格的运行时。 |
| 18 | 论文级视觉结果 | 本轮完成 | 从 processed 数据独立生成 13 组 PDF/PNG/SVG：64-code atlas、权衡、36-family 同时区间、有限尺寸、条件换向/MI、救援、RRSA、固定 k4 快照。`analysis/figures.py`、`figure-manifest.json`。 | 不强制凑某个图数；示例快照不是统计证据。已查看代表图，未声称逐个单独目视核验所有面板。 |
| 19 | 主动寻找意外现象 | 部分 | 平衡与死锁的冲突、长 k 偏置收益、41 尺寸趋势得到独立确认/尺寸/边界与外部救援检查。`summary.csv`、`comparisons.csv`、`rescue-summary.json`。 | 尚无 hysteresis、临界点、scaling collapse 或自发破缺的可信结论；不把趋势升级成相变。 |
| 20 | 研究自主权与重要改变留痕 | 本轮完成 | 根据 RRSA 文献收缩 novelty；按完整 quotient 改为 13 类确认和 36 个固定机制检验；保留 atlas、原锁与两项公开 lock 后实现修复。`confirmation-lock.json`、`STATISTICAL_PROTOCOL.md`、`RESEARCH_LOG.md`。 | 原始 Prompt 未改，holdout 后不重选赢家/基线。后续新问题需另列探索与新确认。 |
| 21 | 科研成功/失败标准 | 本轮完成 | 不强迫正收益：取得控制器分类、死锁机制、严格终止、精确支持和有范围的负结果。`THEORY.md`、`results/RESEARCH_REPORT.zh.md`。 | 不声称已实现所有 A–I 可能成果；没有证明“所有记忆只等价于方向偏置”或“任何记忆都无优势”。 |
| 22 | 真正执行，不只计划 | 本轮核心流程完成 | 已检索、形式化、实现、测试、穷举、探索、独立确认、精确/尺寸分析及依结果加入 RRSA/救援/直接轨迹；实际终态 226816、干预 768、轨迹 192；干净源码 quick 和 full 真实完成，后者记录的 12 阶段命令全部 exit0。`data/`、`analysis-proof.json`、`results/full-reproduction.json`。 | 2bit 等未被机械执行；可选 Python/PDF 环境的从零安装、其他 OS 和外部人类同行评审仍未验证。 |
| 23 | RESEARCH_LOG 与 OPEN_QUESTIONS | 本轮完成 | 定义、分类、pilot/lock、负结果、研究取舍、实际修复及完整复现判断均已进入日志；开放问题独立维护。`RESEARCH_LOG.md`、`OPEN_QUESTIONS.md`、`STATISTICAL_PROTOCOL.md`。 | 日志只记录实际工作；后续扩展需要新实验与新证据。 |
| 24 | 最终代码、数据、图、文献、技术报告、README | 本轮交付完成 | 可运行代码、原始/处理数据、13 图、文献/BibTeX、中文报告、README、一键 quick/full、英文稿与 10 页 PDF 已生成并逐页检查，无溢出。`results/RESEARCH_REPORT.zh.md`、`README.md`、`paper/paper.md`、`paper/paper.pdf`、`results/full-reproduction-comparison.json`。 | 是尚未投稿、未经外部人类同行评审的研究稿；不存在优先权或发表接受证明。 |
| 25 | 能承受随机、偏置、尺寸、基线、算法、文献质疑 | 本轮核心证据完成，长期问题保留 | 独立种子/锁定、多重校正、强制交替和偏置格、精确 oracle、边界/尺寸、原始数据以及既有 RRSA 对照均可审查。`STATISTICAL_PROTOCOL.md`、`THEORY.md`、`literature/notes.md`。 | 有限样本只支持所测模型/控制器/尺寸范围；不证明热力学极限、所有随机记忆最优性、因果信息回报或绝对优先权。 |

## 本轮必须保留的未完成事项

空间结构测量尚未开展；二位及更大记忆、噪声/延迟、随机 FSM 系统参数搜索、粒子形状/反馈字母表扩展均未开展。无限尺寸和因果信息结论也未建立。它们的延期不是缺陷被隐藏，而是提示词允许的研究取舍：先把已有发现变成明确、可复核的问题。

`scripts/reproduce.mjs --profile quick` 与 `--profile full` 均已在独立全新源码目录实际执行。quick 的 37/37 集成单测与 520 条科学回放通过；full 记录的 12 个阶段命令全部成功，226816 条终态科学字段、768 救援、192 轨迹摘要和 36 项锁定检验均匹配，见 `results/full-reproduction.json` 与 `results/full-reproduction-comparison.json`。回放不是新独立重复，不能扩充样本量；其范围不含其他操作系统或可选 Python 环境从零安装。README、OPEN_QUESTIONS、英文稿、逐页检查后的 PDF 与完整研究日志均已完成。

以上覆盖状态只作用于这个独立研究项目。原网站源码、功能账本、部署环境和第九阶段发布审计保持原停点。
