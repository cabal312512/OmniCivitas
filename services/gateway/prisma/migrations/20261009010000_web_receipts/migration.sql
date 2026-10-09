CREATE SCHEMA ocv_web3;
CREATE TABLE ocv_web3.return_orders (
 id uuid PRIMARY KEY, session uuid NOT NULL, kind varchar(16) NOT NULL,
 job_id uuid REFERENCES ocv_after.jobs(id) ON DELETE CASCADE,
 ticket_sha char(64) NOT NULL, wrong_column jsonb NOT NULL DEFAULT '{}',
 result jsonb, content_sha char(64), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(kind IN ('music','projection','certificate','index')),
 CHECK(octet_length(wrong_column::text)<=196608),
 CHECK(result IS NULL OR octet_length(result::text)<=1048576)
);
CREATE INDEX web3_return_time ON ocv_web3.return_orders(updated_at);
CREATE TABLE ocv_web3.event_lines (
 seq bigserial PRIMARY KEY,id uuid UNIQUE NOT NULL,session uuid NOT NULL,
 session_seq bigint NOT NULL CHECK(session_seq BETWEEN 1 AND 1000000000),
 kind varchar(16) NOT NULL,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(kind IN ('collect','favorite','talk','achievement')),
 CHECK(octet_length(data::text)<=1024)
);
CREATE INDEX web3_events_session ON ocv_web3.event_lines(session,seq);
CREATE UNIQUE INDEX web3_events_order ON ocv_web3.event_lines(session,session_seq);
CREATE TABLE ocv_web3.lost_clock (
 session uuid PRIMARY KEY, value bigint NOT NULL CHECK(value BETWEEN 1 AND 1000000000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ocv_web3.warehouse_stock (
 session uuid PRIMARY KEY,checkpoint jsonb NOT NULL,content_sha char(64) NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),CHECK(octet_length(checkpoint::text)<=65536)
);
