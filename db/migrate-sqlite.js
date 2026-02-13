import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, '..', 'database.sqlite'));

console.log('🔄 SQLite Migration başlatılıyor...');

try {
  // Users tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('tekniker', 'kalite', 'admin')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Users tablosu oluşturuldu');

  // OTPA tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS otpa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      otpa_number TEXT UNIQUE NOT NULL,
      project_name TEXT NOT NULL,
      customer_info TEXT,
      battery_pack_count INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'acik' CHECK (status IN ('acik', 'uretimde', 'kapali')),
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  console.log('✅ OTPA tablosu oluşturuldu');

  // BOM Items tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS bom_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      otpa_id INTEGER NOT NULL,
      component_type TEXT NOT NULL DEFAULT 'batarya' CHECK (component_type IN ('batarya', 'vccu', 'junction_box', 'pdu')),
      material_code TEXT NOT NULL,
      material_name TEXT NOT NULL,
      required_quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (otpa_id) REFERENCES otpa(id) ON DELETE CASCADE,
      UNIQUE(otpa_id, component_type, material_code)
    )
  `);
  console.log('✅ BOM Items tablosu oluşturuldu');

  // Goods Receipt tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS goods_receipt (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      otpa_id INTEGER NOT NULL,
      component_type TEXT NOT NULL DEFAULT 'batarya' CHECK (component_type IN ('batarya', 'vccu', 'junction_box', 'pdu')),
      material_code TEXT NOT NULL,
      received_quantity REAL NOT NULL,
      return_of_rejected INTEGER DEFAULT 0,
      receipt_date TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (otpa_id) REFERENCES otpa(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  console.log('✅ Goods Receipt tablosu oluşturuldu');

  // Quality Results tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS quality_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'bekliyor' CHECK (status IN ('kabul', 'iade', 'bekliyor')),
      accepted_quantity REAL DEFAULT 0,
      rejected_quantity REAL DEFAULT 0,
      total_returned_quantity REAL DEFAULT 0,
      reason TEXT,
      decision_by INTEGER,
      returned_by INTEGER,
      decision_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (receipt_id) REFERENCES goods_receipt(id) ON DELETE CASCADE,
      FOREIGN KEY (decision_by) REFERENCES users(id),
      FOREIGN KEY (returned_by) REFERENCES users(id)
    )
  `);
  console.log('✅ Quality Results tablosu oluşturuldu');

  // Mevcut tablodaysa sütunları ekle (migration)
  try {
    const columns = db.pragma('table_info(quality_results)');
    if (!columns.some(c => c.name === 'total_returned_quantity')) {
      db.exec(`ALTER TABLE quality_results ADD COLUMN total_returned_quantity REAL DEFAULT 0`);
      db.exec(`UPDATE quality_results SET total_returned_quantity = rejected_quantity WHERE rejected_quantity > 0`);
      console.log('✅ total_returned_quantity sütunu eklendi');
    }
    if (!columns.some(c => c.name === 'returned_by')) {
      db.exec(`ALTER TABLE quality_results ADD COLUMN returned_by INTEGER REFERENCES users(id)`);
      db.exec(`UPDATE quality_results SET returned_by = decision_by WHERE status = 'iade' AND decision_by IS NOT NULL`);
      console.log('✅ returned_by sütunu eklendi');
    }
  } catch (e) {
    // Sütunlar zaten varsa hata vermez
    console.log('ℹ️ Migration sütunları kontrol edildi');
  }

  // Varsayılan admin kullanıcısı
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  const checkAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  
  if (!checkAdmin) {
    db.prepare(`
      INSERT INTO users (username, password, full_name, role)
      VALUES (?, ?, ?, ?)
    `).run('admin', hashedPassword, 'Sistem Yöneticisi', 'admin');
    console.log('✅ Varsayılan admin kullanıcısı oluşturuldu (username: admin, password: admin123)');
  }

  // Projects tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT,
      estimated_end_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Projects tablosu oluşturuldu');

  // Project Tasks tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      owner_text TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      duration_workdays INTEGER DEFAULT 1,
      progress_percent INTEGER DEFAULT 0,
      manual_start_date TEXT,
      depends_on_task_id INTEGER,
      blocked_reason TEXT,
      notes TEXT,
      calculated_start_date TEXT,
      calculated_end_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (depends_on_task_id) REFERENCES project_tasks(id) ON DELETE SET NULL
    )
  `);
  console.log('✅ Project Tasks tablosu oluşturuldu');

  // Tech Assignments tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS tech_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      assigned_to INTEGER NOT NULL,
      assigned_by INTEGER,
      difficulty INTEGER DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      blocked_reason TEXT,
      started_at TEXT,
      completed_at TEXT,
      actual_duration_minutes INTEGER,
      performance_score REAL,
      deadline TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (assigned_by) REFERENCES users(id)
    )
  `);
  console.log('✅ Tech Assignments tablosu oluşturuldu');

  // Tech Activity Logs tablosu
  db.exec(`
    CREATE TABLE IF NOT EXISTS tech_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES tech_assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  console.log('✅ Tech Activity Logs tablosu oluşturuldu');

  // Mevcut project_tasks tablosuna notes sütunu ekle
  try {
    const ptCols = db.pragma('table_info(project_tasks)');
    if (!ptCols.some(c => c.name === 'notes')) {
      db.exec(`ALTER TABLE project_tasks ADD COLUMN notes TEXT`);
      console.log('✅ project_tasks.notes sütunu eklendi');
    }
  } catch (e) {
    console.log('ℹ️ project_tasks notes kontrolü');
  }

  console.log('✅ Migration başarıyla tamamlandı!');
  console.log('✅ E-LAB Süreç Kontrol Sistemi hazır!');
  console.log('📁 Veritabanı: database.sqlite');
  
} catch (error) {
  console.error('❌ Migration hatası:', error);
  process.exit(1);
}

db.close();
