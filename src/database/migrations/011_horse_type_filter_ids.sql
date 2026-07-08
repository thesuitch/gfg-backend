-- Migration: horse_type_filter_ids
-- Horse type is now a Filter Settings option ID (VARCHAR), not a fixed enum.

ALTER TABLE horses DROP CONSTRAINT IF EXISTS horses_horse_type_check;

-- Map legacy display text to default Filter Settings IDs (see frontend defaultHorseTypes)
UPDATE horses SET horse_type = '1' WHERE horse_type = 'Yearling/Baby';
UPDATE horses SET horse_type = '2' WHERE horse_type = 'Stakes Racehorse';
UPDATE horses SET horse_type = '3' WHERE horse_type = 'Conditioned Racehorse';
UPDATE horses SET horse_type = '4' WHERE horse_type = 'Broodmare';
