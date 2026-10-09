CREATE SCHEMA IF NOT EXISTS ocv_shared1;
CREATE SCHEMA IF NOT EXISTS ocv_shared2;
CREATE SCHEMA IF NOT EXISTS ocv_shared4;

CREATE TABLE ocv_shared1.task_books (
 seq bigserial PRIMARY KEY,job_id uuid NOT NULL UNIQUE REFERENCES ocv_after.jobs(id) ON DELETE CASCADE,
 plan_sha char(64),envelope jsonb NOT NULL DEFAULT '{}',owner_bucket varchar(64) NOT NULL,
 priority int NOT NULL DEFAULT 0,attempts int NOT NULL DEFAULT 0,max_attempts int NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 3),
 available_at timestamptz NOT NULL DEFAULT now(),checkpoint jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(octet_length(envelope::text)<=16384),CHECK(octet_length(checkpoint::text)<=24576)
);
CREATE TABLE ocv_shared1.cash_book (
 job_id uuid NOT NULL REFERENCES ocv_after.jobs(id) ON DELETE CASCADE,step_key varchar(16) NOT NULL,ordinal int NOT NULL,
 status varchar(16) NOT NULL DEFAULT 'pending' CHECK(status IN('pending','running','done','failed')),attempts int NOT NULL DEFAULT 0,
 lease_owner uuid,result_sha char(64),result jsonb NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_id,step_key),UNIQUE(job_id,ordinal),CHECK(octet_length(result::text)<=24576)
);
CREATE TABLE ocv_shared1.order_items (
 job_id uuid NOT NULL,step_key varchar(16) NOT NULL,depends_on varchar(16) NOT NULL,PRIMARY KEY(job_id,step_key,depends_on),
 FOREIGN KEY(job_id,step_key) REFERENCES ocv_shared1.cash_book(job_id,step_key) ON DELETE CASCADE,
 FOREIGN KEY(job_id,depends_on) REFERENCES ocv_shared1.cash_book(job_id,step_key) ON DELETE CASCADE,CHECK(step_key<>depends_on)
);
CREATE TABLE ocv_shared1.dispatch_outbox (
 seq bigserial PRIMARY KEY,job_id uuid NOT NULL REFERENCES ocv_after.jobs(id) ON DELETE CASCADE,event_key varchar(96) NOT NULL,kind varchar(32) NOT NULL,
 payload jsonb NOT NULL,payload_sha char(64) NOT NULL,delivery varchar(16) NOT NULL DEFAULT 'pending' CHECK(delivery IN('pending','delivered')),
 attempts int NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),acked_at timestamptz,
 UNIQUE(job_id,event_key),CHECK(octet_length(payload::text)<=16384)
);
CREATE TABLE ocv_shared1.delivery_inbox (
 event_seq bigint PRIMARY KEY REFERENCES ocv_shared1.dispatch_outbox(seq) ON DELETE CASCADE,
 job_id uuid NOT NULL REFERENCES ocv_after.jobs(id) ON DELETE CASCADE,payload_sha char(64) NOT NULL,envelope jsonb NOT NULL,
 transport varchar(24) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CHECK(octet_length(envelope::text)<=16384)
);
CREATE INDEX task_books_fair ON ocv_shared1.task_books(owner_bucket,available_at,priority,seq);
CREATE TABLE ocv_shared1.client_cash(owner_bucket varchar(64) PRIMARY KEY,last_claim timestamptz NOT NULL DEFAULT 'epoch');
CREATE INDEX outbox_pending ON ocv_shared1.dispatch_outbox(delivery,available_at,seq);

CREATE TABLE ocv_shared2.desk (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES ocv_signals.catalog_stock(id) ON DELETE CASCADE,
 snapshot_id uuid REFERENCES ocv_signals.price_history(id) ON DELETE SET NULL,owner_sha char(64) NOT NULL,
 size int NOT NULL CHECK(size BETWEEN 1 AND 8388608),chunk_size int NOT NULL CHECK(chunk_size=65536),digest char(64) NOT NULL,
 state varchar(16) NOT NULL CHECK(state IN('uploading','ready','cancelled')),object_key varchar(192),created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
CREATE TABLE ocv_shared2.receipt (
 upload_id uuid NOT NULL REFERENCES ocv_shared2.desk(id) ON DELETE CASCADE,part int NOT NULL CHECK(part BETWEEN 0 AND 127),
 digest char(64) NOT NULL,payload bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(upload_id,part),CHECK(octet_length(payload)<=65536)
);
CREATE TABLE ocv_shared2.rooms (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES ocv_signals.catalog_stock(id) ON DELETE CASCADE,
 base_revision int NOT NULL,base_snapshot uuid REFERENCES ocv_signals.price_history(id) ON DELETE SET NULL,
 sequence bigint NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
CREATE TABLE ocv_shared2.room_tickets (
 room_id uuid NOT NULL REFERENCES ocv_shared2.rooms(id) ON DELETE CASCADE,client_id uuid NOT NULL,ticket_sha char(64) NOT NULL,
 seen_seq bigint NOT NULL DEFAULT 0,last_seen timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(room_id,client_id)
);
CREATE TABLE ocv_shared2.postbox (
 room_id uuid NOT NULL REFERENCES ocv_shared2.rooms(id) ON DELETE CASCADE,seq bigint NOT NULL,operation_id uuid NOT NULL,client_id uuid NOT NULL,
 expected_revision int NOT NULL,committed_revision int NOT NULL,snapshot_id uuid REFERENCES ocv_signals.price_history(id) ON DELETE SET NULL,
 event jsonb NOT NULL,digest char(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(room_id,seq),UNIQUE(room_id,operation_id),CHECK(octet_length(event::text)<=16384)
);
CREATE TABLE ocv_shared2.order_items (
 operation_id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES ocv_signals.catalog_stock(id) ON DELETE CASCADE,
 action varchar(32) NOT NULL,request_digest char(64) NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',CHECK(octet_length(response::text)<=32768)
);
CREATE INDEX desk_expiry ON ocv_shared2.desk(expires_at,created_at);
CREATE INDEX rooms_expiry ON ocv_shared2.rooms(expires_at,created_at);

CREATE TABLE ocv_shared4.receipts (
 job_id uuid PRIMARY KEY REFERENCES ocv_after.jobs(id) ON DELETE CASCADE,
 source_digest char(64) NOT NULL,source jsonb NOT NULL,dataset jsonb NOT NULL,
 version jsonb,analysis jsonb,artifact jsonb,object jsonb,attestation jsonb,publication jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(octet_length(dataset::text)<=6291456),CHECK(octet_length(analysis::text)<=2097152),CHECK(octet_length(artifact::text)<=6291456)
);
CREATE TABLE ocv_shared4.orders (
 job_id uuid PRIMARY KEY REFERENCES ocv_after.jobs(id) ON DELETE CASCADE,operation_id uuid UNIQUE,project_id uuid REFERENCES ocv_signals.catalog_stock(id) ON DELETE CASCADE,
 snapshot_id uuid REFERENCES ocv_signals.price_history(id) ON DELETE SET NULL,operation varchar(32) NOT NULL,input jsonb NOT NULL,
 request_digest char(64) NOT NULL,result jsonb,created_at timestamptz NOT NULL DEFAULT now(),CHECK(octet_length(input::text)<=196608),CHECK(octet_length(result::text)<=262144)
);
CREATE TABLE ocv_shared4.object_log (
 key varchar(192) PRIMARY KEY,job_id uuid REFERENCES ocv_after.jobs(id) ON DELETE SET NULL,digest char(64) NOT NULL,bytes int NOT NULL CHECK(bytes BETWEEN 1 AND 3145728),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION ocv_shared1.seed_book() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO ocv_shared1.task_books(job_id,owner_bucket) VALUES(NEW.id,CASE WHEN NEW.family IN('mechanical','circuits','music-report','shared') THEN NEW.family||':'||NEW.run_id::text ELSE md5(NEW.feature) END) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER shared_book_insert AFTER INSERT ON ocv_after.jobs FOR EACH ROW EXECUTE FUNCTION ocv_shared1.seed_book();
INSERT INTO ocv_shared1.task_books(job_id,owner_bucket,attempts) SELECT id,md5(feature),CASE WHEN state IN('starting','running') THEN 1 ELSE 0 END FROM ocv_after.jobs ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION ocv_signals.trim_catalog() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM ocv_shared2.rooms WHERE expires_at<=now();
 DELETE FROM ocv_shared2.order_items WHERE expires_at<=now();
 DELETE FROM ocv_signals.price_history h WHERE h.id IN(
  SELECT id FROM(SELECT id,project_id,row_number() OVER(PARTITION BY project_id ORDER BY revision DESC) AS n FROM ocv_signals.price_history) ranked WHERE n>32
 ) AND NOT EXISTS(SELECT 1 FROM ocv_signals.dispatch_notes n JOIN ocv_after.jobs j ON j.id=n.id WHERE n.snapshot_id=h.id AND j.state IN('queued','starting','running'))
 AND NOT EXISTS(SELECT 1 FROM ocv_workshop.order_items n JOIN ocv_after.jobs j ON j.id=n.id WHERE n.snapshot_id=h.id AND j.state IN('queued','starting','running'))
 AND NOT EXISTS(SELECT 1 FROM ocv_shared4.orders n JOIN ocv_after.jobs j ON j.id=n.job_id WHERE n.snapshot_id=h.id AND j.state IN('queued','starting','running'))
 AND NOT EXISTS(SELECT 1 FROM ocv_shared2.desk n WHERE n.snapshot_id=h.id AND n.expires_at>now())
 AND NOT EXISTS(SELECT 1 FROM ocv_shared2.rooms n WHERE n.base_snapshot=h.id AND n.expires_at>now())
 AND NOT EXISTS(SELECT 1 FROM ocv_shared2.postbox n JOIN ocv_shared2.rooms r ON r.id=n.room_id WHERE n.snapshot_id=h.id AND r.expires_at>now());
 DELETE FROM ocv_signals.catalog_stock p WHERE p.id IN(SELECT id FROM ocv_signals.catalog_stock ORDER BY updated_at DESC,id DESC OFFSET 128)
 AND NOT EXISTS(SELECT 1 FROM ocv_signals.dispatch_notes n JOIN ocv_after.jobs j ON j.id=n.id WHERE n.project_id=p.id AND j.state IN('queued','starting','running'))
 AND NOT EXISTS(SELECT 1 FROM ocv_workshop.order_items n JOIN ocv_after.jobs j ON j.id=n.id WHERE n.project_id=p.id AND j.state IN('queued','starting','running'))
 AND NOT EXISTS(SELECT 1 FROM ocv_shared4.orders n JOIN ocv_after.jobs j ON j.id=n.job_id WHERE n.project_id=p.id AND j.state IN('queued','starting','running'))
 AND NOT EXISTS(SELECT 1 FROM ocv_shared2.desk n WHERE n.project_id=p.id)
 AND NOT EXISTS(SELECT 1 FROM ocv_shared2.rooms n WHERE n.project_id=p.id AND n.expires_at>now());
END $$;
