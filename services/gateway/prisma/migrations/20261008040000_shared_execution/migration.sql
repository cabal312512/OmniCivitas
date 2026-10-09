BEGIN;
LOCK TABLE ocv_after.jobs IN SHARE ROW EXCLUSIVE MODE;
DROP INDEX ocv_after.after_one_family_active;
CREATE UNIQUE INDEX after_one_family_active ON ocv_after.jobs(family)
  WHERE family NOT IN ('circuits','mechanical') AND state IN ('starting','running');
CREATE INDEX after_queue_claim_order ON ocv_after.jobs(seq) WHERE state='queued';
COMMIT;
