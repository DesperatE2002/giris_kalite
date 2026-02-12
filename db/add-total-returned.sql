-- total_returned_quantity: Kümülatif iade takibi - yenisi gelse bile bu değer azalmaz
ALTER TABLE quality_results ADD COLUMN IF NOT EXISTS total_returned_quantity REAL DEFAULT 0;

-- returned_by: Kim iade kesti - ayrı alan
ALTER TABLE quality_results ADD COLUMN IF NOT EXISTS returned_by INTEGER REFERENCES users(id);

-- Mevcut verileri backfill et
UPDATE quality_results SET total_returned_quantity = rejected_quantity WHERE rejected_quantity > 0 AND total_returned_quantity = 0;
UPDATE quality_results SET returned_by = decision_by WHERE status = 'iade' AND decision_by IS NOT NULL AND returned_by IS NULL;
