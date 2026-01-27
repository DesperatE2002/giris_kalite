-- return_logs tablosunu oluştur
CREATE TABLE IF NOT EXISTS return_logs (
    id SERIAL PRIMARY KEY,
    otpa_id INTEGER NOT NULL REFERENCES otpa(id) ON DELETE CASCADE,
    component_type VARCHAR(100),
    material_code VARCHAR(100) NOT NULL,
    material_name VARCHAR(255),
    return_quantity INTEGER NOT NULL,
    unit VARCHAR(50) DEFAULT 'adet',
    reason TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_return_logs_otpa ON return_logs(otpa_id);
CREATE INDEX IF NOT EXISTS idx_return_logs_material ON return_logs(material_code);
CREATE INDEX IF NOT EXISTS idx_return_logs_date ON return_logs(created_at);
