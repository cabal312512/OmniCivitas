CREATE SCHEMA IF NOT EXISTS ocv_q8;
CREATE TABLE ocv_q8.scores (
 id uuid PRIMARY KEY, session uuid NOT NULL, events jsonb NOT NULL,
 tempo integer NOT NULL CHECK(tempo BETWEEN 40 AND 240),
 sha char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX q8_score_time ON ocv_q8.scores(created_at);
CREATE TABLE ocv_q8.hunt (
 session uuid PRIMARY KEY, mask bigint NOT NULL DEFAULT 0 CHECK(mask BETWEEN 0 AND 1073741823),
 talks integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ocv_q8.postbox (
 seq bigserial PRIMARY KEY, kind varchar(16) NOT NULL, target uuid NOT NULL,
 folded varchar(256) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
