-- Treatment category + optional reference tariff price (editable default price stays separate).
ALTER TABLE treatment_types ADD COLUMN category TEXT;
ALTER TABLE treatment_types ADD COLUMN reference_price_cents INTEGER;
