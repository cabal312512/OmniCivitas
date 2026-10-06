CREATE SCHEMA IF NOT EXISTS station;
CREATE TABLE station.records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label text NOT NULL, body jsonb NOT NULL, opened boolean DEFAULT false,
  stored_at timestamptz DEFAULT now()
);
CREATE TABLE station.notes (
  record bigint REFERENCES station.records(id) ON DELETE CASCADE,
  position integer, pitch integer, duration integer,
  PRIMARY KEY(record,position)
);
CREATE VIEW station.totals AS
  SELECT r.id,r.label,count(n.position) AS length,coalesce(sum(n.duration),0) AS duration
  FROM station.records r LEFT JOIN station.notes n ON n.record=r.id GROUP BY r.id,r.label;
CREATE FUNCTION station.trim() RETURNS void LANGUAGE sql AS $$
 DELETE FROM station.records WHERE id IN
 (SELECT id FROM station.records ORDER BY stored_at DESC,id DESC OFFSET 128);
$$;
