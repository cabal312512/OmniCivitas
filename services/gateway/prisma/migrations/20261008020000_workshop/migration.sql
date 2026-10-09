ALTER TABLE ocv_signals.catalog_stock ADD COLUMN domain varchar(16) NOT NULL DEFAULT 'signals' CHECK(domain IN('signals','workshop'));
ALTER TABLE ocv_signals.price_history DROP CONSTRAINT price_history_invoice_text_check;
ALTER TABLE ocv_signals.price_history ADD CONSTRAINT price_history_invoice_text_check CHECK(octet_length(invoice_text)<=131072);
ALTER TABLE ocv_signals.price_history ADD COLUMN operation varchar(16) NOT NULL DEFAULT 'save' CHECK(operation IN('save','branch','rollback'));
ALTER TABLE ocv_signals.price_history ADD COLUMN parent_snapshot uuid;
ALTER TABLE ocv_signals.price_history ADD COLUMN source_snapshot uuid;
CREATE SCHEMA IF NOT EXISTS ocv_workshop;
CREATE TABLE ocv_workshop.order_items (
 id uuid PRIMARY KEY REFERENCES ocv_after.jobs(id) ON DELETE CASCADE,
 project_id uuid REFERENCES ocv_signals.catalog_stock(id) ON DELETE SET NULL,
 snapshot_id uuid REFERENCES ocv_signals.price_history(id) ON DELETE SET NULL,
 request jsonb NOT NULL CHECK(octet_length(request::text)<=196608),
 stock_manifest jsonb CHECK(octet_length(stock_manifest::text)<=1048576),
 engine_result jsonb CHECK(octet_length(engine_result::text)<=4194304),
 review_result jsonb CHECK(octet_length(review_result::text)<=1048576),
 cancelled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE VIEW ocv_workshop.warehouse_stock AS
 SELECT p.id,p.name,p.revision,h.id AS snapshot,h.digest,h.invoice_text,h.operation,h.parent_snapshot,h.source_snapshot,h.created_at
 FROM ocv_signals.catalog_stock p JOIN ocv_signals.price_history h ON h.project_id=p.id AND h.revision=p.revision WHERE p.domain='workshop';
CREATE VIEW ocv_workshop.return_orders AS
 SELECT s.* FROM ocv_workshop.warehouse_stock s JOIN ocv_signals.catalog_stock again ON again.id=s.id AND again.revision=s.revision;
CREATE FUNCTION ocv_signals.trim_catalog() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM ocv_signals.catalog_stock WHERE id IN(
  SELECT p.id FROM ocv_signals.catalog_stock p WHERE NOT EXISTS(
   SELECT 1 FROM ocv_after.jobs j LEFT JOIN ocv_signals.dispatch_notes n ON n.id=j.id LEFT JOIN ocv_workshop.order_items m ON m.id=j.id
   WHERE j.state IN('queued','starting','running') AND (n.project_id=p.id OR m.project_id=p.id)
  ) ORDER BY p.seq DESC OFFSET 128
 );
 DELETE FROM ocv_signals.price_history h WHERE h.id IN(
  SELECT id FROM(SELECT id,row_number() OVER(PARTITION BY project_id ORDER BY revision DESC) r FROM ocv_signals.price_history) x WHERE r>8
 ) AND NOT EXISTS(
  SELECT 1 FROM ocv_after.jobs j LEFT JOIN ocv_signals.dispatch_notes n ON n.id=j.id LEFT JOIN ocv_workshop.order_items m ON m.id=j.id
  WHERE j.state IN('queued','starting','running') AND (n.snapshot_id=h.id OR m.snapshot_id=h.id)
 );
END $$;
CREATE FUNCTION ocv_signals.keep_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Engineering snapshots are immutable; append a revision'; END $$;
CREATE TRIGGER invoice_immutable BEFORE UPDATE ON ocv_signals.price_history FOR EACH ROW EXECUTE FUNCTION ocv_signals.keep_invoice();
CREATE INDEX stock_domain_seq ON ocv_signals.catalog_stock(domain,seq DESC);
