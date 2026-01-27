import pool from './database.js';

async function createReturnLogs() {
  const client = await pool.connect();
  
  try {
    console.log('📦 return_logs tablosu oluşturuluyor...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS return_logs (
        id SERIAL PRIMARY KEY,
        otpa_id INTEGER NOT NULL REFERENCES otpa(id) ON DELETE CASCADE,
        component_type VARCHAR(20) NOT NULL,
        material_code VARCHAR(100) NOT NULL,
        material_name VARCHAR(200),
        return_quantity DECIMAL(10, 2) NOT NULL,
        unit VARCHAR(20),
        reason TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ return_logs tablosu oluşturuldu');
    
    // Index ekle
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_return_logs_otpa ON return_logs(otpa_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_return_logs_material ON return_logs(material_code)
    `);
    
    console.log('✅ Index\'ler eklendi');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

createReturnLogs();
