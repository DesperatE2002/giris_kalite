import pool from './database.js';
import bcrypt from 'bcryptjs';

const migrate = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Migration başlatılıyor...');
    
    await client.query('BEGIN');

    // Users tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('tekniker', 'kalite', 'admin')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users tablosu oluşturuldu');

    // OTPA tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS otpa (
        id SERIAL PRIMARY KEY,
        otpa_number VARCHAR(50) UNIQUE NOT NULL,
        project_name VARCHAR(200) NOT NULL,
        customer_info VARCHAR(200),
        battery_pack_count INTEGER DEFAULT 8,
        status VARCHAR(20) NOT NULL DEFAULT 'acik' CHECK (status IN ('acik', 'uretimde', 'kapali')),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ OTPA tablosu oluşturuldu');

    // BOM Items tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS bom_items (
        id SERIAL PRIMARY KEY,
        otpa_id INTEGER NOT NULL REFERENCES otpa(id) ON DELETE CASCADE,
        component_type VARCHAR(20) NOT NULL CHECK (component_type IN ('batarya', 'vccu', 'junction_box', 'pdu')),
        material_code VARCHAR(100) NOT NULL,
        material_name VARCHAR(200) NOT NULL,
        required_quantity DECIMAL(10, 2) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(otpa_id, component_type, material_code)
      )
    `);
    console.log('✅ BOM Items tablosu oluşturuldu');

    // Goods Receipt tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS goods_receipt (
        id SERIAL PRIMARY KEY,
        otpa_id INTEGER NOT NULL REFERENCES otpa(id) ON DELETE CASCADE,
        component_type VARCHAR(20) NOT NULL CHECK (component_type IN ('batarya', 'vccu', 'junction_box', 'pdu')),
        material_code VARCHAR(100) NOT NULL,
        received_quantity DECIMAL(10, 2) NOT NULL,
        receipt_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Goods Receipt tablosu oluşturuldu');

    // Quality Results tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS quality_results (
        id SERIAL PRIMARY KEY,
        receipt_id INTEGER NOT NULL REFERENCES goods_receipt(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'bekliyor' CHECK (status IN ('kabul', 'iade', 'bekliyor')),
        accepted_quantity DECIMAL(10, 2) DEFAULT 0,
        rejected_quantity DECIMAL(10, 2) DEFAULT 0,
        reason TEXT,
        decision_by INTEGER REFERENCES users(id),
        decision_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Quality Results tablosu oluşturuldu');

    // Return Logs tablosu (kalıcı iade kayıtları)
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
    console.log('✅ Return Logs tablosu oluşturuldu');

    // İndeksler
    await client.query('CREATE INDEX IF NOT EXISTS idx_bom_otpa ON bom_items(otpa_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_receipt_otpa ON goods_receipt(otpa_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_receipt_material ON goods_receipt(material_code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_quality_receipt ON quality_results(receipt_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_return_logs_otpa ON return_logs(otpa_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_return_logs_material ON return_logs(material_code)');
    console.log('✅ İndeksler oluşturuldu');

    // Varsayılan admin kullanıcısı oluştur
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (username, password, full_name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO NOTHING
    `, ['admin', hashedPassword, 'Sistem Yöneticisi', 'admin']);
    console.log('✅ Varsayılan admin kullanıcısı oluşturuldu (username: admin, password: admin123)');

    await client.query('COMMIT');
    console.log('✅ Migration başarıyla tamamlandı!');
    console.log('✅ Temsa Kalite Sistemi hazır!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration hatası:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(console.error);
