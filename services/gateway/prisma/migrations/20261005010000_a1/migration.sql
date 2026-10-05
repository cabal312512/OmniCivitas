CREATE SCHEMA IF NOT EXISTS ocv_after;
CREATE SCHEMA IF NOT EXISTS ocv_after_pockets;

CREATE TABLE ocv_after.code_bank (
  name varchar(16) PRIMARY KEY,
  source text NOT NULL CHECK (octet_length(source) <= 8192),
  sha256 char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ocv_after.clock (
  id integer PRIMARY KEY CHECK (id = 1),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ocv_after.clock(id) VALUES (1);
CREATE TABLE ocv_after.runs (
  seq bigserial PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  event_id uuid NOT NULL UNIQUE,
  request_sha char(64) NOT NULL,
  ticket_sha char(64) NOT NULL,
  kind varchar(16) NOT NULL,
  feature varchar(64) NOT NULL,
  program varchar(16) NOT NULL REFERENCES ocv_after.code_bank(name),
  input_sha char(64) NOT NULL,
  frontend_sha char(64) NOT NULL,
  backend_sha char(64) NOT NULL,
  database_piece text NOT NULL CHECK (octet_length(database_piece) <= 8192),
  package_sha char(64) NOT NULL,
  result jsonb NOT NULL,
  clicks bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ocv_after.steps (
  run_id uuid NOT NULL REFERENCES ocv_after.runs(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 0 AND 15),
  office varchar(32) NOT NULL,
  stamp char(32) NOT NULL,
  PRIMARY KEY (run_id, ordinal)
);
CREATE TABLE ocv_after.features (
  name varchar(64) PRIMARY KEY,
  total bigint NOT NULL,
  residue integer NOT NULL CHECK (residue BETWEEN 0 AND 96),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ocv_after.pockets (
  name varchar(32) PRIMARY KEY,
  run_id uuid NOT NULL,
  serial bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX after_run_created ON ocv_after.runs(created_at,seq);
CREATE INDEX after_pocket_serial ON ocv_after.pockets(serial,name);
CREATE VIEW ocv_after.receipts AS
SELECT r.id,r.feature,r.kind,r.program,r.clicks,r.result,
       count(s.ordinal)::integer AS stamps,r.created_at
FROM ocv_after.runs r LEFT JOIN ocv_after.steps s ON s.run_id=r.id
GROUP BY r.seq;
