CREATE TABLE IF NOT EXISTS parking_receipts (slot_id integer, amount_cents integer CHECK (amount_cents >= 0));
