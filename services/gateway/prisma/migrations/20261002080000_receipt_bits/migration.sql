ALTER TABLE ocv_prisma.outbox ADD COLUMN payload JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN ocv_prisma.outbox.payload IS 'Toy receipt only; no account or credential fields. Restores the original ornament and JSON log when the optional broker was off.';
