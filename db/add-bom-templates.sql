-- BOM Şablonları Tablosu
CREATE TABLE IF NOT EXISTS bom_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BOM Şablon Malzemeleri Tablosu
CREATE TABLE IF NOT EXISTS bom_template_items (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES bom_templates(id) ON DELETE CASCADE,
  material_code VARCHAR(100) NOT NULL,
  material_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'Adet',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bom_template_items_template_id ON bom_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_bom_templates_created_by ON bom_templates(created_by);

-- Comments
COMMENT ON TABLE bom_templates IS 'BOM şablonları - tekrar kullanılabilir malzeme listeleri';
COMMENT ON TABLE bom_template_items IS 'BOM şablonlarındaki malzeme kalemleri';
