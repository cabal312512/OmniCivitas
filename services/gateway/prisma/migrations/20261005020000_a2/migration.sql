CREATE TABLE ocv_after.jobs (
  seq bigserial PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  run_id uuid NOT NULL,
  ticket_sha char(64) NOT NULL,
  family varchar(16) NOT NULL,
  feature varchar(64) NOT NULL,
  digest char(64) NOT NULL,
  state varchar(16) NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','starting','running','done','failed')),
  phase integer NOT NULL DEFAULT 0,
  result jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(octet_length(result::text)<=8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX after_one_family_pending ON ocv_after.jobs(family) WHERE state IN('queued','starting','running');
CREATE TABLE ocv_after.worker (
  id integer PRIMARY KEY CHECK(id=1),
  owner uuid,
  lease_until timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ocv_after.worker(id) VALUES(1);
