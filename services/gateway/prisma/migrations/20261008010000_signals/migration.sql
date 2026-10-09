CREATE SCHEMA IF NOT EXISTS ocv_signals;
ALTER TABLE ocv_after.jobs DROP CONSTRAINT jobs_state_check;
ALTER TABLE ocv_after.jobs ADD CONSTRAINT jobs_state_check CHECK(state IN('queued','starting','running','done','failed','cancelled'));
CREATE TABLE ocv_signals.catalog_stock (
 seq bigserial PRIMARY KEY, id uuid UNIQUE NOT NULL, ticket_sha char(64) NOT NULL,
 name varchar(80) NOT NULL, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ocv_signals.price_history (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES ocv_signals.catalog_stock(id) ON DELETE CASCADE,
 revision integer NOT NULL, digest char(64) NOT NULL, invoice_text text NOT NULL CHECK(octet_length(invoice_text)<=65536),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,revision)
);
CREATE TABLE ocv_signals.dispatch_notes (
 id uuid PRIMARY KEY REFERENCES ocv_after.jobs(id) ON DELETE CASCADE,
 project_id uuid REFERENCES ocv_signals.catalog_stock(id) ON DELETE SET NULL,
 snapshot_id uuid REFERENCES ocv_signals.price_history(id) ON DELETE SET NULL,
 request jsonb NOT NULL CHECK(octet_length(request::text)<=65536),
 engine_result jsonb CHECK(octet_length(engine_result::text)<=4194304),
 independent_result jsonb CHECK(octet_length(independent_result::text)<=1048576),
 cancelled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ocv_signals.delivery_steps (
 seq bigserial PRIMARY KEY, job_id uuid NOT NULL REFERENCES ocv_after.jobs(id) ON DELETE CASCADE,
 event_key varchar(64) NOT NULL, phase varchar(32) NOT NULL,
 envelope jsonb NOT NULL CHECK(octet_length(envelope::text)<=8192),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(job_id,event_key)
);
CREATE TABLE ocv_signals.stock_files (
 id uuid PRIMARY KEY REFERENCES ocv_after.jobs(id) ON DELETE CASCADE, snapshot_id uuid NOT NULL REFERENCES ocv_signals.price_history(id) ON DELETE CASCADE,
 digest char(64) NOT NULL, manifest jsonb NOT NULL CHECK(octet_length(manifest::text)<=16384),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signals_price_project ON ocv_signals.price_history(project_id,revision DESC);
CREATE INDEX signals_steps_job ON ocv_signals.delivery_steps(job_id,seq);
