BEGIN;
LOCK TABLE ocv_after.jobs IN SHARE ROW EXCLUSIVE MODE;
DROP INDEX ocv_after.after_one_family_pending;
DROP INDEX ocv_after.after_one_family_active;
CREATE UNIQUE INDEX after_one_family_pending ON ocv_after.jobs(family)
 WHERE family NOT IN ('circuits','mechanical','shared','music-report') AND state IN ('queued','starting','running');
CREATE UNIQUE INDEX after_one_family_active ON ocv_after.jobs(family)
 WHERE family NOT IN ('circuits','mechanical','shared','music-report') AND state IN ('starting','running');
COMMIT;
