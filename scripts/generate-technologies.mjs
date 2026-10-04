import { readFile, writeFile } from 'node:fs/promises';
const definitions = [
  ['仓库', 1, 'pnpm workspace|Nx|Turborepo 配置', 'workspace 调度、缓存；Turborepo 仅保留废弃配置'],
  ['启动', 1, 'Docker Compose|Nginx', '按需启动；单入口代理'],
  ['前端壳', 1, 'Astro', '门户总壳，静态页面与后续小岛'],
  ['前端应用', 3, 'Next.js|React|Vue 3|Svelte|Angular|SolidJS', '不同年代模块；Next API 多绕一层；Angular iframe'],
  ['小型前端框架', 3, 'Lit|Alpine.js|htmx|jQuery', '印章组件、折叠、HTML 片段、展示节点修改'],
  ['状态管理', 3, 'Redux Toolkit|Zustand|MobX|Jotai|Pinia|RxJS|Svelte Store|Angular Signals|XState', '每项管理独立的小状态；RxJS 点击防抖；XState 两态审批'],
  ['UI', 3, 'Ant Design|MUI|Element Plus|Bootstrap', '分散模块及明确要求的混用控件'],
  ['CSS', 3, 'Tailwind|普通 CSS|CSS Modules|Sass|Less|styled-components|Emotion|内联 style', '混合年代布局及样式，非统一设计系统'],
  ['表单', 3, 'React Hook Form|Formik|vee-validate|Angular Reactive Forms', '不同部门的独立表单'],
  ['校验', 3, 'Zod|Joi|Yup|validator.js|手写 if', '冗余校验链与明确最大输入边界'],
  ['HTTP 客户端', 3, 'fetch|Axios|jQuery.ajax|htmx HTTP|got', '不同页面与后端转发，所有请求有上限'],
  ['日期', 3, '原生 Date|Day.js|Moment.js|date-fns|Luxon', '不同格式/时区，最终适配正确'],
  ['工具库', 3, 'Lodash|Ramda|Nano ID|uuid|Math.js', '空值、pipe、冗余 ID、正确计算'],
  ['Node 主网关', 1, 'NestJS', '实际统一网关，成功字段 errorMessage'],
  ['第二套 Node 后端', 2, 'Hono', '历史后缀兼容接口'],
  ['Java', 2, 'Spring Boot', 'REST/gRPC 中转与日期审批'],
  ['Python', 2, 'FastAPI', 'gRPC 与微型科学演示服务'],
  ['PHP', 2, 'Laravel', '名称叫 nodeService 的 PHP 服务'],
  ['Go', 2, 'Fiber', '极小的按钮编号服务'],
  ['C#', 2, 'ASP.NET Core Minimal API', '极小的格式权威认证服务'],
  ['Ruby', 2, 'Sinatra', '可工作的古老状态接口'],
  ['接口', 2, 'REST|GraphQL|gRPC|XML/SOAP 风格接口', '同站真实异构协议及荒谬 DTO'],
  ['实时', 2, 'WebSocket|SSE', '实际实时消息与偶尔一句公告'],
  ['消息系统', 2, 'RabbitMQ|Kafka|Redis Pub/Sub', '事件跨队列转发与 Spring→Redis→Nest→Mongo 日志'],
  ['SQL 数据库', 2, 'PostgreSQL|MySQL|SQLite|DuckDB', '对象拆分、SQLite 文件、微量分析'],
  ['NoSQL', 2, 'MongoDB|Redis|Elasticsearch', '附加字段、缓存/唯一无害状态、全文搜索'],
  ['文件/对象', 2, 'MinIO|JSON|CSV|YAML', '小文件对象与正式玩具数据源'],
  ['ORM', 2, 'Prisma|TypeORM|Hibernate/JPA|SQLAlchemy|Eloquent|Mongoose|裸 SQL', '独立表范围，各 ORM 真实读写'],
  ['浏览器数据库', 3, 'IndexedDB|localStorage|sessionStorage|Cache Storage', '局部唯一数据、虚构会话、缓存与重建'],
  ['其他“数据库”', 3, 'Cookie|URL query|URL hash|DOM data-*|CSS 变量|SVG metadata', 'CSV/浏览器/CSS/SVG/hash 拼装对象'],
  ['监控', 2, 'OpenTelemetry|Prometheus|Grafana', '真实采集、十几段 span、无意义巨大 dashboard'],
  ['测试', 9, 'Jest|Vitest|Playwright|Cypress|JUnit|pytest|PHPUnit|Go testing|.NET tests|Ruby tests', '核心测试可靠；各语言活跃代码分批验证'],
  ['构建残骸', 8, 'Vite|Webpack|Gulp|Babel', '分别真实构建或复制少量内容'],
  ['死代码语言', 8, 'Rust|Lua|CoffeeScript|Shell|.proto|SQL 脚本', '明确要求的原创历史遗迹；不必安装其完整工具链'],
  ['正文附加技术', 3, 'i18next|vue-i18n|TanStack Query|BroadcastChannel|Web Worker|postMessage', '重复国际化、缓存与无意义同步'],
  ['正文附加配置', 8, 'ESLint|Prettier|Biome|Stylelint|ESM|CommonJS|JavaScript|TypeScript|Kubernetes YAML|Maven 配置|Terraform', '分散的配置与构建遗迹；Terraform 不执行'],
];
let previous = {};
try { previous = Object.fromEntries(JSON.parse(await readFile('docs/technologies.json','utf8')).technologies.map(t => [t.name,t])); } catch(error) { if(error.code !== 'ENOENT') throw error; }
const technologies = definitions.flatMap(([category, phase, names, purpose]) => names.split('|').map(name => ({
  id: '', category, name, phase,
  role: category === '死代码语言' || name === 'Turborepo 配置' || ['Biome','Kubernetes YAML','Maven 配置','Terraform'].includes(name) ? 'historical-or-scoped-config' : 'active',
  purpose, status: previous[name]?.status || 'planned', version: previous[name]?.version || null, implementation: previous[name]?.implementation || [], verification: previous[name]?.verification || []
})));
technologies.forEach((item,i) => item.id = `TECH${String(i+1).padStart(3,'0')}`);
await writeFile('docs/technologies.json', JSON.stringify({ schemaVersion:1, originalCategories:34, technologies },null,2)+'\n');
await writeFile('docs/TECHNOLOGIES.md', '# 技术用途与验收账本\n\n安装、调用、验证分别记录。历史角色遵守原文，不因未安装编译器而删除。\n\n| ID | 类别 | 技术 | 阶段 | 角色 | 状态 | 用途 |\n| --- | --- | --- | --- | --- | --- | --- |\n'+technologies.map(t=>`| ${t.id} | ${t.category} | ${t.name} | ${t.phase} | ${t.role} | ${t.status} | ${t.purpose} |`).join('\n')+'\n');
console.log(`${technologies.length} individually tracked technologies; all 34 original categories plus body-only additions.`);

