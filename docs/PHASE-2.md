# 第二阶段施工与验收清单

本阶段已获用户授权。所有 732 条原文继续保留；这是后端阶段，不提前改前端。

1. 核心扩展：ID 映射、Prisma/TypeORM 独立 schema、真实 REST、有限 SSE/WebSocket、参数适配、账户路径继续不挂载。
2. 语言链：Nest → Hono → Spring → FastAPI → Laravel → Nest 终止路由；另有 Spring → Python gRPC、Hono GraphQL、Go Fiber、ASP.NET XML/SOAP、Ruby Sinatra。重复 DTO，唯一小服务使用 shared-types。每跳有超时、可追踪内部 ID、不同显示 ID。
3. 分散存储：MySQL/Eloquent、Mongo/Mongoose、SQLAlchemy 三个 SQLite 文件、DuckDB、Elasticsearch/MySQL LIKE、MinIO，以及正式 CSV/JSON/YAML 数据源；分散对象实际重组。
4. 消息：Nest → RabbitMQ → EnterpriseKafkaBridge → Kafka → Nest consumer → Mongo/Redis/Elasticsearch；Spring → Redis Pub/Sub → Nest consumer → Mongo。不同信封保留一致内部 ID，周期任务修复玩具副本。
5. 监控：OpenTelemetry 多段 span、Prometheus 无聊指标、Grafana 巨大面板，结构化与纯文本日志写 stdout/限量文件/数据库。
6. 分批真实验收：核心不受可选设施缺失影响；分别验证语言、数据库、消息、搜索、监控及故障；最终恢复仅 core。实际证据保存在 F:\OCVdeps\runtime\reports。

默认运行 core；databases / messaging / monitoring / legacy / search 可按需切换。maximum 预算必须先过检查，构建顺序执行且 builder 最多 3 GiB。所有语言工具链随实际需要在 Docker 中下载，实际镜像和数据必须先通过 F: 存储检查。

对应条目由 docs/requirements.json 与 docs/technologies.json 逐项记录；仅生成配置不能标记 verified。前端跨阶段项标 partial，保留后续验收责任。

实现时核对的官方配置资料：[Laravel 12 路由](https://laravel.com/framework/docs/12.x/routing)、[Spring Boot 3.5 环境要求](https://docs.spring.io/spring-boot/3.5/system-requirements.html)、[OpenTelemetry Collector 配置](https://opentelemetry.io/docs/collector/configuration/)、[Kafka 3.9 KRaft](https://kafka.apache.org/39/operations/kraft/)。版本和真正运行结果以本项目的锁文件及 F: 验收报告为准。
