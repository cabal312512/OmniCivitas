import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(project,file),'utf8').replace(/^\uFEFF/,''));
const accepted=read('docs/phase-2-acceptance.json');
assert.equal(accepted.phase,2);assert.equal(accepted.status,'complete');
const requirements=read('docs/requirements.json').requirements.filter(x=>x.phase===2);
const technologies=read('docs/technologies.json').technologies.filter(x=>x.phase===2);
assert.equal(requirements.length,113);assert.equal(technologies.length,37);
const cell=s=>String(s).replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
const localFile=s=>s.replace(/\\/g,'/').split('/').at(-1);
const lines=[
 '# 第二阶段验收：后端的七个窗口与一百个印章', '',
 '2026-10-02。本阶段已完成并停止；第三阶段尚未授权。这里只验收后端与基础设施，不声称前端、工具或全站已完成。', '',
 '## 结果与边界', '',
 '- 113 条阶段内要求逐条登记：112 条 verified；A042 保持 partial，浏览器 Yup 在第三阶段补齐。原始 381 A + 351 B 的文字、行号与 hash 保留。',
 '- 37 项阶段技术均有当前职责的真实运行证据，不用包安装或文件存在充当验证。FastAPI 科学界面、多前端与其他跨阶段职责仍待后续阶段。',
 '- 23 个实际服务曾同时健康，无 OOM；完整组 79 项检查通过。当前仅 edge、portal、gateway、postgres、redis 健康运行，builder 已停止。',
 '- 三个语言中转故障和 PostgreSQL/Redis 故障均实际停启验证。核心依赖断开时有限 503，主页与独立 ping 可用；恢复时同一个 gateway 进程恢复真实 ORM/Redis 连接。',
 '- 源码/配置在本机项目目录；实际依赖、工具、镜像、缓存、临时文件和数据的原生物理路径检查通过，符合本机存储授权。',
 '- 原始 UI 没有在本阶段重画。文件实际分散到多层古怪目录，入口索引见 [烂摊子地图](烂摊子地图.md)。', '',
 '## 实际运行证据', '',
 '| 批次 | 通过检查数 | 运行报告 |', '| --- | ---: | --- |',
 ...Object.entries(accepted.batchChecks).map(([name,count])=>`| ${name} | ${count} | ${localFile(accepted.reports[name])} |`), '',
 '另有 Nx 三项目顺序构建、5 个 Vitest 用例、4 个桌面/手机 Playwright 用例通过；浏览器检查要求真实 PostgreSQL/Redis，没有以内存演示冒充。实际 23 容器快照检查资源上限、健康、版本和数据库端口不外露。', '',
 '精确数据验证包括 Prisma/TypeORM 独立迁移、JPA、Eloquent 真 MySQL、三个 SQLAlchemy SQLite 文件、DuckDB 输入文件、MinIO UTF-8 put/get、Rabbit 确认后 Kafka 转发、另一套 Nest/Mongoose 入库、Redis Pub/Sub、四份副本与被破坏副本的定时修复，以及 OTel 15 span、Prometheus 指标、Grafana 48 面板。成功日志同一行真存在 stdout、有界文件、Mongo 和 Elasticsearch。', '',
 '## 内存与默认运行', '',
 '| 范围 | 容器/构建器限制合计 |', '| --- | ---: |',
 `| 默认 core | ${accepted.memoryLimitsMiB.core} MiB |`,
 `| 全部 23 服务 | ${accepted.memoryLimitsMiB.maximum} MiB |`,
 `| 串行 builder（构建时停止可选服务） | ${accepted.memoryLimitsMiB.builder} MiB |`,
 `| 本机 WSL 日常上限 | ${accepted.memoryLimitsMiB.wslDailyCeiling} MiB |`, '',
 ...accepted.memorySamples.filter(x=>/maximum/.test(x.group)).map(x=>`实测 ${x.group}：Docker/WSL 相关进程工作集合计 ${x.totalWorkingSetMiB.toFixed(1)} MiB。`),
 '工作集包含文件缓存且共享页可能重复计入，这是开发时观测，不是长期峰值保证。停止可选容器后 WSL 页缓存不会立即全部归还；不把容器 cap 合计当成宿主实际内存。', '',
 '这些限制和磁盘放置属于本机开发配置。公开部署的参数化及干净环境安装/启动尚未通过；12 条追加约束和现存耦合见 [公开发布约束](PUBLIC-RELEASE.md)。第九阶段必须独立执行 public release portability audit。', '',
 '## 本阶段逐条核对', '',
 '完整原文、实现路径及实际检查名称在 requirements.json / REQUIREMENTS.md；下面保留每一条的状态与实现解释。', '',
 '| 编号 | 原文（不改写） | 状态 | 实现与验收说明 |', '| --- | --- | --- | --- |',
 ...requirements.map(x=>`| ${x.id} | ${cell(x.text)} | ${x.status} | ${cell(x.notes)} |`), '',
 '## 37 项技术的当前职责', '',
 '| 技术 | 状态 | 已验证版本/固定来源 | 实际检查 |', '| --- | --- | --- | --- |',
 ...technologies.map(x=>`| ${cell(x.name)} | ${cell(x.status)} | ${cell(x.version??'版本由锁文件/容器快照保留')} | ${cell(x.verification[0].split(' :: ').at(-1))} |`), '',
 '机器级原始报告留在本机 runtime/reports，不将数据库、缓存、浏览器输出或 Docker volumes 纳入公开仓库。机器验收状态见 phase-2-acceptance.json；该文件的路径是此轮证据位置，不是应用启动依赖。', '',
 '阶段三以后由用户另行授权；本轮停止，不启动后续实施或发布。', ''
];
fs.writeFileSync(path.join(project,'docs/PHASE-2-ACCEPTANCE.md'),lines.join('\n'));
console.log('Rendered 113 individual requirements and 37 current-role technology rows.');
