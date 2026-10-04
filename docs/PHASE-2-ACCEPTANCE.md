# 第二阶段验收：后端的七个窗口与一百个印章

2026-10-02。本阶段已完成并停止；第三阶段尚未授权。这里只验收后端与基础设施，不声称前端、工具或全站已完成。

## 结果与边界

- 113 条阶段内要求逐条登记：112 条 verified；A042 保持 partial，浏览器 Yup 在第三阶段补齐。原始 381 A + 351 B 的文字、行号与 hash 保留。
- 37 项阶段技术均有当前职责的真实运行证据，不用包安装或文件存在充当验证。FastAPI 科学界面、多前端与其他跨阶段职责仍待后续阶段。
- 23 个实际服务曾同时健康，无 OOM；完整组 79 项检查通过。当前仅 edge、portal、gateway、postgres、redis 健康运行，builder 已停止。
- 三个语言中转故障和 PostgreSQL/Redis 故障均实际停启验证。核心依赖断开时有限 503，主页与独立 ping 可用；恢复时同一个 gateway 进程恢复真实 ORM/Redis 连接。
- 源码/配置在本机项目目录；实际依赖、工具、镜像、缓存、临时文件和数据的原生物理路径检查通过，符合本机存储授权。
- 原始 UI 没有在本阶段重画。文件实际分散到多层古怪目录，入口索引见 [烂摊子地图](烂摊子地图.md)。

## 实际运行证据

| 批次 | 通过检查数 | 运行报告 |
| --- | ---: | --- |
| core | 28 | phase2-core.json |
| legacy | 48 | phase2-legacy.json |
| databases | 16 | phase2-databases.json |
| messaging | 19 | phase2-messaging.json |
| monitoring | 17 | phase2-monitoring.json |
| everything | 79 | phase2-everything.json |
| faults-core | 11 | phase2-faults-core.json |
| faults-legacy | 9 | phase2-faults-legacy.json |

另有 Nx 三项目顺序构建、5 个 Vitest 用例、4 个桌面/手机 Playwright 用例通过；浏览器检查要求真实 PostgreSQL/Redis，没有以内存演示冒充。实际 23 容器快照检查资源上限、健康、版本和数据库端口不外露。

精确数据验证包括 Prisma/TypeORM 独立迁移、JPA、Eloquent 真 MySQL、三个 SQLAlchemy SQLite 文件、DuckDB 输入文件、MinIO UTF-8 put/get、Rabbit 确认后 Kafka 转发、另一套 Nest/Mongoose 入库、Redis Pub/Sub、四份副本与被破坏副本的定时修复，以及 OTel 15 span、Prometheus 指标、Grafana 48 面板。成功日志同一行真存在 stdout、有界文件、Mongo 和 Elasticsearch。

## 内存与默认运行

| 范围 | 容器/构建器限制合计 |
| --- | ---: |
| 默认 core | 1216 MiB |
| 全部 23 服务 | 7328 MiB |
| 串行 builder（构建时停止可选服务） | 3072 MiB |
| 本机 WSL 日常上限 | 9216 MiB |

实测 maximum-starting：Docker/WSL 相关进程工作集合计 9584.7 MiB。
实测 maximum-rebuild：Docker/WSL 相关进程工作集合计 9596.8 MiB。
实测 maximum：Docker/WSL 相关进程工作集合计 9551.6 MiB。
工作集包含文件缓存且共享页可能重复计入，这是开发时观测，不是长期峰值保证。停止可选容器后 WSL 页缓存不会立即全部归还；不把容器 cap 合计当成宿主实际内存。

这些限制和磁盘放置属于本机开发配置。公开部署的参数化及干净环境安装/启动尚未通过；12 条追加约束和现存耦合见 [公开发布约束](PUBLIC-RELEASE.md)。第九阶段必须独立执行 public release portability audit。

## 本阶段逐条核对

完整原文、实现路径及实际检查名称在 requirements.json / REQUIREMENTS.md；下面保留每一条的状态与实现解释。

| 编号 | 原文（不改写） | 状态 | 实现与验收说明 |
| --- | --- | --- | --- |
| A042 | 一个字段可能前端 Yup 校验，网关 Zod 校验，Java 服务 Hibernate Validator 再校验，最终 SQLite 里没有约束。 | partial | 后端 Zod → Hibernate Validator → 无字段约束 SQLite 已实际验证；Yup 浏览器部分明确保留到阶段 3，本条仍 partial。 |
| A043 | 部分字段完全不校验，但仍保留大量验证框架。 | verified | ornament 不做语义校验；仍受大小/身份字段保护。实际附加字段到达 Mongo。 |
| A048 | Node 服务之间又有人坚持用 got。 | verified | 两套 Node 之间实际 got 转发，request 上限与零无限重试。 |
| A051 | 有的时间存 ISO 8601。 | verified | 逐跳实际 ISO / Unix 秒 / Unix 毫秒 / 上海斜线字符串，适配器从各实际字段计算同一时间；后续前端消费该结果。 |
| A052 | 有的存 Unix 秒。 | verified | 逐跳实际 ISO / Unix 秒 / Unix 毫秒 / 上海斜线字符串，适配器从各实际字段计算同一时间；后续前端消费该结果。 |
| A053 | 有的存 Unix 毫秒。 | verified | 逐跳实际 ISO / Unix 秒 / Unix 毫秒 / 上海斜线字符串，适配器从各实际字段计算同一时间；后续前端消费该结果。 |
| A054 | 有的直接存 "2026/10/02 03:14"。 | verified | 逐跳实际 ISO / Unix 秒 / Unix 毫秒 / 上海斜线字符串，适配器从各实际字段计算同一时间；后续前端消费该结果。 |
| A055 | 不同服务对时区理解不统一，但最后有一层适配器保证页面结果能对上。 | verified | 逐跳实际 ISO / Unix 秒 / Unix 毫秒 / 上海斜线字符串，适配器从各实际字段计算同一时间；后续前端消费该结果。 |
| A056 | UUID 有的用 crypto.randomUUID()。 | verified | 实际 crypto UUID、uuid 包、两个不同 Nano ID、自增整数；PG 映射与 Redis 不同 key ID 逐字段核对。 |
| A057 | 有的用 uuid 包。 | verified | 实际 crypto UUID、uuid 包、两个不同 Nano ID、自增整数；PG 映射与 Redis 不同 key ID 逐字段核对。 |
| A058 | 有的用 Nano ID。 | verified | 实际 crypto UUID、uuid 包、两个不同 Nano ID、自增整数；PG 映射与 Redis 不同 key ID 逐字段核对。 |
| A059 | 数据库里另外一些记录还是自增整数。 | verified | 实际 crypto UUID、uuid 包、两个不同 Nano ID、自增整数；PG 映射与 Redis 不同 key ID 逐字段核对。 |
| A060 | 为了统一这些 ID，再专门建映射表。 | verified | 实际 crypto UUID、uuid 包、两个不同 Nano ID、自增整数；PG 映射与 Redis 不同 key ID 逐字段核对。 |
| A061 | 映射表在 PostgreSQL。 | verified | 实际 crypto UUID、uuid 包、两个不同 Nano ID、自增整数；PG 映射与 Redis 不同 key ID 逐字段核对。 |
| A062 | 映射表缓存又放 Redis。 | verified | 实际 crypto UUID、uuid 包、两个不同 Nano ID、自增整数；PG 映射与 Redis 不同 key ID 逐字段核对。 |
| A063 | Redis 缓存里的 key 还使用另一套 ID。 | verified | 实际 crypto UUID、uuid 包、两个不同 Nano ID、自增整数；PG 映射与 Redis 不同 key ID 逐字段核对。 |
| A064 | NestJS 做“统一 API 网关”。 | verified | 统一公开 /api 网关实际承接所有语言入口；保留阶段 1 原始保存路径。 |
| A066 | NestJS 再去调用 Spring Boot。 | verified | 真实六跳；PHP 只回 Nest 独立终止路由。三处中断均有限失败、主页可用、恢复后真实链可继续。 |
| A067 | Spring Boot 再调用 FastAPI。 | verified | 真实六跳；PHP 只回 Nest 独立终止路由。三处中断均有限失败、主页可用、恢复后真实链可继续。 |
| A068 | FastAPI 某些时候再调用 Laravel。 | verified | 真实六跳；PHP 只回 Nest 独立终止路由。三处中断均有限失败、主页可用、恢复后真实链可继续。 |
| A069 | Laravel 可能把一个结果发回 NestJS。 | verified | 真实六跳；PHP 只回 Nest 独立终止路由。三处中断均有限失败、主页可用、恢复后真实链可继续。 |
| A070 | 某些简单操作能故意经过五六个 HTTP 服务，但每一步都有超时和明确 fallback，不会无限等。 | verified | 真实六跳；PHP 只回 Nest 独立终止路由。三处中断均有限失败、主页可用、恢复后真实链可继续。 |
| A071 | Hono 另外负责所谓“历史兼容接口”。 | verified | 公开 /api/foo.php 确实通过 Nest 转到 Hono，与 PHP 无关。 |
| A072 | Go Fiber 负责一个完全可以在 Node 里写完的小服务。 | verified | 真正 Go Fiber 的微型空气税接口。 |
| A073 | ASP.NET Core 再负责另一个很小的接口。 | verified | 真实 ASP.NET Minimal API，只输出荒谬空气税 XML。 |
| A074 | Ruby Sinatra 留一个能正常工作的旧接口。 | verified | 真实 Sinatra 旧接口，JSON 中另塞一个 JSON 字符串。 |
| A075 | REST 是主要协议，但并不统一。 | verified | 真实 REST 为主要转发协议。 |
| A076 | NestJS → Spring 的一部分请求用 REST。 | verified | 真实 REST 为主要转发协议。 |
| A077 | Spring → Python 有一部分使用 gRPC。 | verified | Java/Python 从同一 .proto 生成 wire 协议实现；Python gRPC 真写 SQLite 后返回秒数。DTO 仍独立定义。 |
| A078 | 另一个服务坚持 GraphQL。 | verified | graphql 库实际执行固定石头查询。 |
| A079 | 还有一个接口返回 XML。 | verified | SOAP 外形 XML 是真正 HTTP 响应，空气税 0。 |
| A080 | 某个 XML 路由名字和结构故意像 SOAP，但真正业务简单得可笑。 | verified | SOAP 外形 XML 是真正 HTTP 响应，空气税 0。 |
| A081 | 一些接口使用 WebSocket。 | verified | Nginx 真实 Upgrade；公告后客户端关闭，服务有帧/连接/寿命上限。 |
| A082 | 另一些实时提示使用 SSE。 | verified | 真实 SSE 三句状态后结束，不遗留无限订阅。 |
| A083 | RabbitMQ 真存在。 | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A084 | Kafka 也真存在。 | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A085 | Redis Pub/Sub 又承担第三种消息广播方式。 | verified | 真实 Spring 发布 data/_internalId，独立 Nest 消费者接收并保存 Mongo warehouse_logs，精确对象 ID 查询。 |
| A086 | 一个事件可能 NestJS 发 RabbitMQ，另一个服务监听后再扔 Kafka，最后消费者写数据库。 | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A087 | 某些日志则通过 Redis Pub/Sub 发走。 | verified | 真实 Spring 发布 data/_internalId，独立 Nest 消费者接收并保存 Mongo warehouse_logs，精确对象 ID 查询。 |
| A088 | 可以保留之前那个“日志由 Spring 发 Redis，另一个 NestJS consumer 收到后写 MongoDB”的调用路线。 | verified | 真实 Spring 发布 data/_internalId，独立 Nest 消费者接收并保存 Mongo warehouse_logs，精确对象 ID 查询。 |
| A089 | 绝不统一消息格式：Kafka 消息字段叫 payload，RabbitMQ 叫 body，Redis 叫 data. | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A090 | 但是每种消息都额外藏一个可靠的内部 ID，防止真的无法追踪。 | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A091 | HTTP API 路由后缀完全胡来，例如 .php、.cgi、.do、.asmx，实际可能全部由 Nest/Hono 处理。 | verified | 实际 .php/.cgi/.do/.asmx 后缀混用；PHP 真入口是 /api/nodeService。 |
| A092 | /api/foo.php 并不经过 PHP。 | verified | 公开 /api/foo.php 确实通过 Nest 转到 Hono，与 PHP 无关。 |
| A093 | 真正 Laravel 服务的路由反而可能叫 /api/nodeService. | verified | 实际 .php/.cgi/.do/.asmx 后缀混用；PHP 真入口是 /api/nodeService。 |
| A094 | 一个接口返回正常 JSON。 | verified | 实际成功响应为 JSON，observations.initialRecord 中有成功的 errorMessage 与可靠 canContinue。 |
| A095 | 一个直接返回 HTML fragment。 | verified | Hono 实际返回 HTML 碎片，由网关保留 HTML Content-Type。 |
| A096 | 一个返回 XML。 | verified | SOAP 外形 XML 是真正 HTTP 响应，空气税 0。 |
| A097 | 一个把 JSON JSON.stringify() 后作为另一个 JSON 字段里的字符串返回。 | verified | 真实 Sinatra 旧接口，JSON 中另塞一个 JSON 字符串。 |
| A098 | 成功提示字段可能叫 errorMessage。 | verified | 实际成功响应为 JSON，observations.initialRecord 中有成功的 errorMessage 与可靠 canContinue。 |
| A099 | 失败解释字段可能叫 successReason。 | verified | 缺可选窗口时 successReason 解释失败；逻辑判断始终以 canContinue 为准。 |
| A100 | 真正决定是否继续的可靠字段另叫 canContinue，保证逻辑不会因为这些命名玩笑坏掉。 | verified | 缺可选窗口时 successReason 解释失败；逻辑判断始终以 canContinue 为准。 |
| A101 | boolean 在不同系统里分别使用 true/false、1/0、Y/N、yes/no、"正常"/"异常"。 | verified | 实际 hop 的 true / 1 / Y / yes / 正常进入同一布尔适配器；否定值不误判为成功。 |
| A102 | 数据转换层长期负责把这些东西转换回来。 | verified | 实际 hop 的 true / 1 / Y / yes / 正常进入同一布尔适配器；否定值不误判为成功。 |
| A103 | DTO 在不同服务中重复定义，禁止共享同一份模型。 | verified | DTO 在五个源入口重复定义并各自实际处理数据，不共享同一个应用模型。 |
| A104 | 明明仓库里存在一个 shared-types 包，却只有一个最不重要的服务在使用。 | verified | 仅 Hono 模式实际动态引用 shared-types 的无意义石头；其他 DTO 全重复。 |
| A105 | PostgreSQL 真存一部分数据。 | verified | 同一 PG 里的 Prisma / TypeORM 真实读写，业务表分别在 ocv_prisma / ocv_typeorm。 |
| A106 | MySQL 真存另一部分。 | verified | 精确直接查真实 MySQL 表，不能用 Laravel 默认 SQLite 冒充。Eloquent 模型映射旧表名。 |
| A107 | MongoDB 再存一些。 | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A108 | Redis 既是缓存，又偶尔成为某个数据唯一来源。 | verified | Redis 同时真缓存映射/副本，并独占无关土豆计数，不从 PG 假装读取。 |
| A109 | SQLite 真有几个文件数据库。 | verified | 三个真文件 postgres.sqlite/mysql.sqlite/redis.sqlite，逐文件 SQL 查询实际不同日期值。 |
| A110 | DuckDB 被拿来处理极少量“分析数据”。 | verified | CSV 3 条真实进 DuckDB 表 SUM=6；JSON 提供展示名，YAML 决定最低饭量及科室。实际响应验证派生字段。 |
| A111 | Elasticsearch 负责全文搜索，但一部分搜索仍然直接 LIKE '%xxx%' 查 MySQL。 | verified | 实际 ES 全文检索，另一条查询绑定参数执行 MySQL LIKE。 |
| A112 | MinIO 用于存一些可以直接放静态目录的小文件。 | verified | 官方固定版本源码编译真实 MinIO；小 UTF-8 文本实际 put/get，字节结果一致，保留 192 MiB 限制。 |
| A113 | CSV 是正式数据源之一。 | verified | CSV 3 条真实进 DuckDB 表 SUM=6；JSON 提供展示名，YAML 决定最低饭量及科室。实际响应验证派生字段。 |
| A114 | JSON 文件也是正式数据源之一。 | verified | CSV 3 条真实进 DuckDB 表 SUM=6；JSON 提供展示名，YAML 决定最低饭量及科室。实际响应验证派生字段。 |
| A115 | YAML 里放一些理论上应该进数据库的东西。 | verified | CSV 3 条真实进 DuckDB 表 SUM=6；JSON 提供展示名，YAML 决定最低饭量及科室。实际响应验证派生字段。 |
| A116 | SQLite 文件可以故意叫 postgres.sqlite、mysql.sqlite、redis.sqlite。 | verified | 三个真文件 postgres.sqlite/mysql.sqlite/redis.sqlite，逐文件 SQL 查询实际不同日期值。 |
| A117 | 数据库表名明显来自其他项目，例如 mall_goods、school_student、warehouse_stock。 | verified | mall_goods / school_student / warehouse_stock 等旧项目名真存在；product_name 是玩具文明/收据名，supplier_id=43 是分类，delivery_count=1 是一次盖章。 |
| A118 | 实际字段用途和字段名字毫无关系，例如 product_name 实际代表另一个完全不相关的概念。 | verified | mall_goods / school_student / warehouse_stock 等旧项目名真存在；product_name 是玩具文明/收据名，supplier_id=43 是分类，delivery_count=1 是一次盖章。 |
| A119 | supplier_id 可能表示某种内部分类。 | verified | mall_goods / school_student / warehouse_stock 等旧项目名真存在；product_name 是玩具文明/收据名，supplier_id=43 是分类，delivery_count=1 是一次盖章。 |
| A120 | delivery_count 可能代表操作次数。 | verified | mall_goods / school_student / warehouse_stock 等旧项目名真存在；product_name 是玩具文明/收据名，supplier_id=43 是分类，delivery_count=1 是一次盖章。 |
| A121 | 数据库里保留完整的 users、user_passwords、login_sessions 等表。 | verified | 完整空账户表仅设计遗迹；网站账号路由不挂载，密钥/身份形状字段拒绝，不收真实账户。 |
| A122 | 这些表设计得煞有介事，但实际账号系统根本不用它们。 | verified | 完整空账户表仅设计遗迹；网站账号路由不挂载，密钥/身份形状字段拒绝，不收真实账户。 |
| A123 | 真实用户数据不保存，因为这个项目没有真正账号系统。 | verified | 完整空账户表仅设计遗迹；网站账号路由不挂载，密钥/身份形状字段拒绝，不收真实账户。 |
| A124 | 数据可以故意拆散在几个数据库中。 | verified | observations.splitObject 实际重组 UUID / MySQL 名称 / Mongo 附加字段 / Redis 临时状态 / SQLite 时间；统一对象 ID，没有虚构可用性。 |
| A125 | 同一个逻辑对象的 UUID 在 PostgreSQL。 | verified | observations.splitObject 实际重组 UUID / MySQL 名称 / Mongo 附加字段 / Redis 临时状态 / SQLite 时间；统一对象 ID，没有虚构可用性。 |
| A126 | 显示名可能在 MySQL。 | verified | observations.splitObject 实际重组 UUID / MySQL 名称 / Mongo 附加字段 / Redis 临时状态 / SQLite 时间；统一对象 ID，没有虚构可用性。 |
| A127 | 附加信息在 MongoDB。 | verified | observations.splitObject 实际重组 UUID / MySQL 名称 / Mongo 附加字段 / Redis 临时状态 / SQLite 时间；统一对象 ID，没有虚构可用性。 |
| A128 | 临时状态放 Redis。 | verified | observations.splitObject 实际重组 UUID / MySQL 名称 / Mongo 附加字段 / Redis 临时状态 / SQLite 时间；统一对象 ID，没有虚构可用性。 |
| A129 | 一个无关时间戳甚至可以放 SQLite。 | verified | observations.splitObject 实际重组 UUID / MySQL 名称 / Mongo 附加字段 / Redis 临时状态 / SQLite 时间；统一对象 ID，没有虚构可用性。 |
| A130 | 然后通过映射层重新拼回来。 | verified | observations.splitObject 实际重组 UUID / MySQL 名称 / Mongo 附加字段 / Redis 临时状态 / SQLite 时间；统一对象 ID，没有虚构可用性。 |
| A148 | SSE 长连接可能只是为了偶尔发送一句状态。 | verified | 真实 SSE 三句状态后结束，不遗留无限订阅。 |
| A149 | EnterpriseKafkaBridge 可能内部只发一种消息。 | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A150 | RedisClusterManager 有一部分方法实际只是包装一个 JavaScript Map。 | verified | 真实 create 路径调用 RedisClusterManager.put 的 JS Map 与超长类名的 Service→Manager→Provider→Adapter 单行传递；Map 有 16 条上限。 |
| A151 | 类名经常远远大于真实职责，例如 GlobalEnterpriseCompatibilityManagerFactoryProvider. | verified | 真实 create 路径调用 RedisClusterManager.put 的 JS Map 与超长类名的 Service→Manager→Provider→Adapter 单行传递；Map 有 16 条上限。 |
| A152 | 一个只有一行代码的函数也套 Service → Manager → Provider → Adapter。 | verified | 真实 create 路径调用 RedisClusterManager.put 的 JS Map 与超长类名的 Service→Manager→Provider→Adapter 单行传递；Map 有 16 条上限。 |
| A279 | Prometheus 会收集几个几乎毫无价值的 metric。 | verified | Prometheus 真抓石头重量 1 与无聊盖章计数。 |
| A280 | Grafana 有一个巨大 dashboard 展示非常微不足道的数据。 | verified | 实际 Grafana API 验证 48 个面板，重复展示两个微小指标，匿名只读。 |
| A281 | OpenTelemetry 把一个简单请求追踪成十几段 span。 | verified | 实际请求创建 1 父 + 14 子 span，OTLP 到真实 Collector，日志中看到最后窗口与 Trace ID。 |
| A282 | 每一跳又重新生成一个“显示用 requestId”，让日志看起来难追。 | verified | 每跳真实显示 UUID 不同，六跳同一个内部 rootTraceId；OTel 另有 trace ID 并保留内部 UUID attribute。 |
| A283 | 但内部同时保留一个真正统一的 root trace ID，测试和排障还能用。 | verified | 每跳真实显示 UUID 不同，六跳同一个内部 rootTraceId；OTel 另有 trace ID 并保留内部 UUID attribute。 |
| A284 | 同一条日志既写 stdout，又写文件，又可能进入 Mongo/Elasticsearch 之类的存储。 | verified | 同一 JSON 行精确存在 stdout/有界文件/Mongo/ES；另有纯文本和不同日期格式，error 内容为成功。 |
| A285 | 日志格式有 JSON，也有纯文本。 | verified | 同一 JSON 行精确存在 stdout/有界文件/Mongo/ES；另有纯文本和不同日期格式，error 内容为成功。 |
| A286 | 不同服务时间格式还不同。 | verified | 同一 JSON 行精确存在 stdout/有界文件/Mongo/ES；另有纯文本和不同日期格式，error 内容为成功。 |
| A287 | 某些日志字段叫 error，内容却是成功消息。 | verified | 同一 JSON 行精确存在 stdout/有界文件/Mongo/ES；另有纯文本和不同日期格式，error 内容为成功。 |
| A323 | PostgreSQL 可以使用 Prisma。 | verified | 同一 PG 里的 Prisma / TypeORM 真实读写，业务表分别在 ocv_prisma / ocv_typeorm。 |
| A324 | 同一个 PostgreSQL 另一组表再用 TypeORM。 | verified | 同一 PG 里的 Prisma / TypeORM 真实读写，业务表分别在 ocv_prisma / ocv_typeorm。 |
| A325 | Spring 侧用 Hibernate/JPA。 | verified | 真实 JPA/Hibernate 只拥有 ocv_jpa 表，精确读到饭与操作次数。 |
| A326 | FastAPI 使用 SQLAlchemy。 | verified | 三个真文件 postgres.sqlite/mysql.sqlite/redis.sqlite，逐文件 SQL 查询实际不同日期值。 |
| A327 | Laravel 使用 Eloquent。 | verified | 精确直接查真实 MySQL 表，不能用 Laravel 默认 SQLite 冒充。Eloquent 模型映射旧表名。 |
| A328 | MongoDB 使用 Mongoose。 | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A329 | 某些地方仍然坚持手写 SQL。 | verified | 手写 SQL 真写 PG outbox/旧核心表，后台用 SQL canonical data 对账。 |
| A330 | 一个数据库 migration 工具不知道另一个 ORM 建过哪些表。 | verified | 真实 Prisma 两次 migration、TypeORM 独立 migration 与 JPA 表同库并存；业务表范围不踩。Prisma 自己的元数据在 public._prisma_migrations，TypeORM 在 ocv_typeorm.warehouse_migrations。 |
| A331 | 但各自 schema 限定在不同表范围，避免实际迁移互踩。 | verified | 真实 Prisma 两次 migration、TypeORM 独立 migration 与 JPA 表同库并存；业务表范围不踩。Prisma 自己的元数据在 public._prisma_migrations，TypeORM 在 ocv_typeorm.warehouse_migrations。 |
| A332 | 同一逻辑数据可能先写 PostgreSQL。 | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A333 | 再通过消息队列异步复制一份到 MongoDB。 | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A334 | 最后缓存 Redis。 | verified | 实际 Rabbit body → 单一 Kafka topic/payload → 第二个 Nest context/Mongoose Mongo；内部 ID 一致，显示 ID 不同，Redis 临时状态真读到。Redis Pub/Sub 另用 data。 |
| A335 | 搜索索引再进 Elasticsearch。 | verified | observations.fourCopies 精确核对同 UUID 的 PG/Mongo/Redis/ES 四份值一致。 |
| A336 | 因此一份数据可能有四份副本。 | verified | observations.fourCopies 精确核对同 UUID 的 PG/Mongo/Redis/ES 四份值一致。 |
| A337 | 不做真正分布式事务，但因为数据都是玩具数据，可以由后台 reconciliation job 定期修正。 | verified | 无分布式事务。超长名字的任务每 15 秒运行，16 条分页/256 条上界，仅比较少量字段；手动破坏三副本后实际修复，再破坏 Mongo 不手动触发也恢复。原始 ornament 与日志保留。 |
| A338 | reconciliation job 名字可以极其夸张。 | verified | 无分布式事务。超长名字的任务每 15 秒运行，16 条分页/256 条上界，仅比较少量字段；手动破坏三副本后实际修复，再破坏 Mongo 不手动触发也恢复。原始 ornament 与日志保留。 |
| A339 | 它实际上只比较几个 JSON 字段。 | verified | 无分布式事务。超长名字的任务每 15 秒运行，16 条分页/256 条上界，仅比较少量字段；手动破坏三副本后实际修复，再破坏 Mongo 不手动触发也恢复。原始 ornament 与日志保留。 |

## 37 项技术的当前职责

| 技术 | 状态 | 已验证版本/固定来源 | 实际检查 |
| --- | --- | --- | --- |
| Hono | verified-current-role | 4.13.12 | Active hono service really responds |
| Spring Boot | verified-current-role | 3.5.8 | Direct Nest to Spring REST |
| FastAPI | verified-current-role | 0.115.12 | Spring to Python uses real gRPC |
| Laravel | verified-current-role | Laravel Framework 12.69.3 | Eloquent really persists Unix milliseconds in MySQL |
| Fiber | verified-current-role | 2.52.6 | Active go service really responds |
| ASP.NET Core Minimal API | verified-current-role | 8.0.31 | ASP.NET returns silly SOAP XML |
| Sinatra | verified-current-role | 4.1.1 | Active ruby service really responds |
| REST | verified-current-role | 版本由锁文件/容器快照保留 | Direct Nest to Spring REST |
| GraphQL | verified-current-role | 版本由锁文件/容器快照保留 | Active graphql service really responds |
| gRPC | verified-current-role | 版本由锁文件/容器快照保留 | Spring to Python uses real gRPC |
| XML/SOAP 风格接口 | verified-current-role | 版本由锁文件/容器快照保留 | ASP.NET returns silly SOAP XML |
| WebSocket | verified-current-role | 版本由锁文件/容器快照保留 | Nginx upgraded real WebSocket |
| SSE | verified-current-role | 版本由锁文件/容器快照保留 | SSE sends three real messages and ends |
| RabbitMQ | verified-current-role | 4.1.8 | Nest RabbitMQ confirm is real |
| Kafka | verified-current-role | 3.9.1 | Rabbit body to Kafka payload to Nest Mongoose Mongo |
| Redis Pub/Sub | verified-current-role | 版本由锁文件/容器快照保留 | Spring Redis Pub/Sub reaches separate Nest Mongo log consumer |
| PostgreSQL | verified-current-role | PostgreSQL 17.6 | Exact PostgreSQL join exercises both ORM-owned schemas |
| MySQL | verified-current-role | mysql  Ver 8.4.11 for Linux on x86_64 (MySQL Community Server - GPL) | Eloquent really persists Unix milliseconds in MySQL |
| SQLite | verified-current-role | 版本由锁文件/容器快照保留 | Three actual SQLAlchemy SQLite files store different timestamp formats |
| DuckDB | verified-current-role | 1.3.2 | DuckDB consumes formal CSV/JSON/YAML |
| MongoDB | verified-current-role | db version v8.0.32 | Rabbit body to Kafka payload to Nest Mongoose Mongo |
| Redis | verified-current-role | v=7.4.2 | Redis has a harmless sole-source counter |
| Elasticsearch | verified-current-role | 8.19.0 | Real Elasticsearch full text finds fourth copy |
| MinIO | verified-current-role | RELEASE.2025-10-15T17-29-55Z (official source commit 9e49d5e7a648) | MinIO tiny object put/get exact bytes |
| JSON | verified-current-role | 版本由锁文件/容器快照保留 | DuckDB consumes formal CSV/JSON/YAML |
| CSV | verified-current-role | 版本由锁文件/容器快照保留 | DuckDB consumes formal CSV/JSON/YAML |
| YAML | verified-current-role | 版本由锁文件/容器快照保留 | DuckDB consumes formal CSV/JSON/YAML |
| Prisma | verified-current-role | 7.10.0 | Exact PostgreSQL join exercises both ORM-owned schemas |
| TypeORM | verified-current-role | 0.3.28 | Exact PostgreSQL join exercises both ORM-owned schemas |
| Hibernate/JPA | verified-current-role | 版本由锁文件/容器快照保留 | Hibernate JPA really stores the chain receipt |
| SQLAlchemy | verified-current-role | 2.0.40 | Three actual SQLAlchemy SQLite files store different timestamp formats |
| Eloquent | verified-current-role | 版本由锁文件/容器快照保留 | Eloquent really persists Unix milliseconds in MySQL |
| Mongoose | verified-current-role | 8.24.4 | Rabbit body to Kafka payload to Nest Mongoose Mongo |
| 裸 SQL | verified-current-role | 版本由锁文件/容器快照保留 | Four actual copies have identical label and internal UUID |
| OpenTelemetry | verified-current-role | 2.11.0 | Collector receives real OpenTelemetry multi-span export |
| Prometheus | verified-current-role | 3.3.0 | Prometheus scrapes real trivial gauge |
| Grafana | verified-current-role | 12.0.0 | Grafana provisions 48 actual panels |

机器级原始报告留在本机 runtime/reports，不将数据库、缓存、浏览器输出或 Docker volumes 纳入公开仓库。机器验收状态见 phase-2-acceptance.json；该文件的路径是此轮证据位置，不是应用启动依赖。

阶段三以后由用户另行授权；本轮停止，不启动后续实施或发布。
