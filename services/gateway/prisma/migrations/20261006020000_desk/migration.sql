CREATE TABLE ocv_q8.desk (
 session uuid PRIMARY KEY,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 favorites jsonb NOT NULL DEFAULT '[]',
 pinned jsonb NOT NULL DEFAULT '[]',
 note text NOT NULL DEFAULT '' CHECK(length(note)<=1200),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_typeof(favorites)='array' AND jsonb_array_length(favorites)<=60),
 CHECK(jsonb_typeof(pinned)='array' AND jsonb_array_length(pinned)<=8)
);
