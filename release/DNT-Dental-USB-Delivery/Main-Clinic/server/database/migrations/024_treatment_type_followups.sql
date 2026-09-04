-- Three independent follow-up day slots per treatment type (Settings > Treatment Catalog).
ALTER TABLE treatment_types ADD COLUMN follow_up_1_days INTEGER;
ALTER TABLE treatment_types ADD COLUMN follow_up_2_days INTEGER;
ALTER TABLE treatment_types ADD COLUMN follow_up_3_days INTEGER;

UPDATE treatment_types
SET follow_up_1_days = follow_up_days
WHERE follow_up_days IS NOT NULL AND follow_up_days > 0;
