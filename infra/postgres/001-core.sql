-- 本表由裸 SQL 管理。阶段 2 的 Prisma/TypeORM 使用独立 schema。
CREATE SCHEMA IF NOT EXISTS ocv_core;
CREATE TABLE IF NOT EXISTS ocv_core.mall_goods (
  id uuid PRIMARY KEY,
  product_name varchar(200) NOT NULL,
  supplier_id integer NOT NULL DEFAULT 43,
  delivery_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mall_goods_civilization_warehouse_index ON ocv_core.mall_goods(created_at);
-- 演示数据有界；后续 reconciliation 不得造成无限增长。
