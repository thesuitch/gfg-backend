-- Migration: drop_horse_type_enum_check
-- horse_type stores Filter Settings option IDs (e.g. '1','2'), not fixed enum labels.
-- Keep DROP idempotent in case 011 was recorded without removing the constraint.

ALTER TABLE horses DROP CONSTRAINT IF EXISTS horses_horse_type_check;

-- Map any remaining legacy display labels to default Filter Settings IDs
UPDATE horses SET horse_type = '1' WHERE horse_type = 'Yearling/Baby';
UPDATE horses SET horse_type = '2' WHERE horse_type = 'Stakes Racehorse';
UPDATE horses SET horse_type = '3' WHERE horse_type = 'Conditioned Racehorse';
UPDATE horses SET horse_type = '4' WHERE horse_type = 'Broodmare';
UPDATE horses SET horse_type = '1' WHERE horse_type IN ('standardbred', 'thoroughbred', 'quarter_horse', 'arabian', 'other');
