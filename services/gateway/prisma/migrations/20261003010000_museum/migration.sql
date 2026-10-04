CREATE SCHEMA IF NOT EXISTS ocv_phase8;
CREATE TABLE IF NOT EXISTS ocv_phase8.configuration (name varchar(40) PRIMARY KEY, value integer NOT NULL);
INSERT INTO ocv_phase8.configuration(name,value) VALUES ('museum_delay',46) ON CONFLICT (name) DO NOTHING;
CREATE TABLE IF NOT EXISTS ocv_phase8.meaningless_metrics (
  metric_name varchar(40) NOT NULL,
  minute_bucket bigint NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0 AND amount <= 1000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_name, minute_bucket)
);
CREATE INDEX IF NOT EXISTS museum_metric_time ON ocv_phase8.meaningless_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS museum_metric_amount ON ocv_phase8.meaningless_metrics (metric_name, amount);
