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
        return_of_rejected BOOLEAN DEFAULT false,
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
        total_returned_quantity DECIMAL(10, 2) DEFAULT 0,
        reason TEXT,
        decision_by INTEGER REFERENCES users(id),
        returned_by INTEGER REFERENCES users(id),
        decision_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Quality Results tablosu oluşturuldu');

    // İndeksler
    await client.query('CREATE INDEX IF NOT EXISTS idx_bom_otpa ON bom_items(otpa_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_receipt_otpa ON goods_receipt(otpa_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_receipt_material ON goods_receipt(material_code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_quality_receipt ON quality_results(receipt_id)');
    console.log('✅ İndeksler oluşturuldu');

    // Projects tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        start_date DATE,
        estimated_end_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Projects tablosu oluşturuldu');

    // Project Tasks tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(300) NOT NULL,
        owner_text VARCHAR(200),
        status VARCHAR(20) NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'doing', 'blocked', 'done')),
        duration_workdays INTEGER DEFAULT 1,
        progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
        manual_start_date DATE,
        depends_on_task_id INTEGER REFERENCES project_tasks(id) ON DELETE SET NULL,
        blocked_reason TEXT,
        calculated_start_date DATE,
        calculated_end_date DATE,
        deadline DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_project_tasks_depends ON project_tasks(depends_on_task_id)');
    console.log('✅ Project Tasks tablosu oluşturuldu');

    // Tech Assignments tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS tech_assignments (
        id SERIAL PRIMARY KEY,
        title VARCHAR(300) NOT NULL,
        description TEXT,
        assigned_to INTEGER NOT NULL REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        difficulty INTEGER DEFAULT 3 CHECK (difficulty >= 1 AND difficulty <= 5),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'blocked', 'completed')),
        notes TEXT,
        blocked_reason TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        actual_duration_minutes INTEGER,
        performance_score REAL,
        deadline DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_tech_assignments_assigned ON tech_assignments(assigned_to)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tech_assignments_status ON tech_assignments(status)');
    console.log('✅ Tech Assignments tablosu oluşturuldu');

    // Tech Activity Logs tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS tech_activity_logs (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES tech_assignments(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(20) NOT NULL CHECK (action IN ('start', 'complete', 'block', 'note')),
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_tech_logs_assignment ON tech_activity_logs(assignment_id)');
    console.log('✅ Tech Activity Logs tablosu oluşturuldu');

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
    console.log('✅ E-LAB Süreç Kontrol Sistemi hazır!');
    
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
