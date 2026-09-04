-- Patient-level account discount applied to total treatment cost
ALTER TABLE patients ADD COLUMN account_discount_cents INTEGER NOT NULL DEFAULT 0;
