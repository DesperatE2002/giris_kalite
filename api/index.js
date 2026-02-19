import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Validate environment
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is missing!');
  throw new Error('DATABASE_URL is required');
}

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is missing!');
  throw new Error('JWT_SECRET is required');
}

console.log('🐘 API: Using PostgreSQL database');

// Import routes
import authRoutes from '../routes/auth.js';
import otpaRoutes from '../routes/otpa.js';
import bomRoutes from '../routes/bom.js';
import bomTemplateRoutes from '../routes/bom-template.js';
import goodsReceiptRoutes from '../routes/goods-receipt.js';
import qualityRoutes from '../routes/quality.js';
import reportsRoutes from '../routes/reports.js';
import projectsRoutes from '../routes/projects.js';
import techniciansRoutes from '../routes/technicians.js';
import paketAnalizRoutes, { migratePacketAnaliz } from '../routes/paket-analiz.js';
import prosedurOtpaRoutes, { migrateProsedurOtpa } from '../routes/prosedur-otpa.js';

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/otpa', otpaRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/bom-templates', bomTemplateRoutes);
app.use('/api/goods-receipt', goodsReceiptRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/technicians', techniciansRoutes);
app.use('/api/paket-analiz', paketAnalizRoutes);
app.use('/api/prosedur-otpa', prosedurOtpaRoutes);

// Auto-migration: total_returned_quantity ve returned_by sütunlarını ekle
import pool from '../db/database.js';
(async () => {
  try {
    await pool.query(`ALTER TABLE quality_results ADD COLUMN IF NOT EXISTS total_returned_quantity REAL DEFAULT 0`);
    await pool.query(`ALTER TABLE quality_results ADD COLUMN IF NOT EXISTS returned_by INTEGER REFERENCES users(id)`);
    await pool.query(`UPDATE quality_results SET total_returned_quantity = rejected_quantity WHERE rejected_quantity > 0 AND (total_returned_quantity IS NULL OR total_returned_quantity = 0)`);
    await pool.query(`UPDATE quality_results SET returned_by = decision_by WHERE status = 'iade' AND decision_by IS NOT NULL AND returned_by IS NULL`);
    console.log('✅ Auto-migration: total_returned_quantity ve returned_by sütunları hazır');
  } catch (e) {
    if (!e.message.includes('already exists') && !e.message.includes('duplicate column')) {
      console.error('⚠️ Auto-migration uyarısı:', e.message);
    }
  }

  // Auto-migration: Projects tabloları
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_date TEXT,
        estimated_end_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        owner_text TEXT,
        status TEXT NOT NULL DEFAULT 'backlog',
        duration_workdays INTEGER DEFAULT 1,
        progress_percent INTEGER DEFAULT 0,
        manual_start_date TEXT,
        depends_on_task_id INTEGER REFERENCES project_tasks(id) ON DELETE SET NULL,
        blocked_reason TEXT,
        calculated_start_date TEXT,
        calculated_end_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Auto-migration: projects ve project_tasks tabloları hazır');
  } catch (e) {
    if (!e.message.includes('already exists')) {
      console.error('⚠️ Projects auto-migration uyarısı:', e.message);
    }
  }

  // Auto-migration: users role constraint güncellemesi (viewer + proje_yonetici ekleme)
  try {
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('viewer', 'tekniker', 'kalite', 'proje_yonetici', 'admin'))`);
    console.log('✅ Auto-migration: users role constraint güncellendi (viewer + proje_yonetici)');
  } catch(e) {
    if (!e.message.includes('already exists')) {
      console.error('⚠️ Users role constraint uyarısı:', e.message);
    }
  }

  // Auto-migration: project_tasks notes sütunu
  try {
    await pool.query(`ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS notes TEXT`);
    await pool.query(`ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS deadline DATE`);
  } catch (e) {
    if (!e.message.includes('already exists') && !e.message.includes('duplicate column')) {
      console.error('⚠️ project_tasks migration:', e.message);
    }
  }

  // Auto-migration: Tekniker İş Takip tabloları
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tech_assignments (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to INTEGER NOT NULL REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        difficulty INTEGER DEFAULT 3 CHECK (difficulty >= 1 AND difficulty <= 5),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'blocked', 'completed')),
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
    // deadline kolonu eklenmemişse ekle
    try { await pool.query('ALTER TABLE tech_assignments ADD COLUMN IF NOT EXISTS deadline DATE'); } catch(e) {}
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tech_activity_logs (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES tech_assignments(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        action TEXT NOT NULL CHECK (action IN ('start', 'complete', 'block', 'pause', 'note')),
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Auto-migration: tech_assignments ve tech_activity_logs tabloları hazır');

    // paused status ve pause action constraint güncellemesi
    try {
      await pool.query(`ALTER TABLE tech_assignments DROP CONSTRAINT IF EXISTS tech_assignments_status_check`);
      await pool.query(`ALTER TABLE tech_assignments ADD CONSTRAINT tech_assignments_status_check CHECK (status IN ('pending', 'active', 'paused', 'blocked', 'completed'))`);
      await pool.query(`ALTER TABLE tech_activity_logs DROP CONSTRAINT IF EXISTS tech_activity_logs_action_check`);
      await pool.query(`ALTER TABLE tech_activity_logs ADD CONSTRAINT tech_activity_logs_action_check CHECK (action IN ('start', 'complete', 'block', 'pause', 'note'))`);
      console.log('✅ Auto-migration: paused status constraint güncellendi');
    } catch(e) {
      if (!e.message.includes('already exists')) {
        console.error('⚠️ Constraint güncelleme uyarısı:', e.message);
      }
    }
  } catch (e) {
    if (!e.message.includes('already exists')) {
      console.error('⚠️ Technicians auto-migration uyarısı:', e.message);
    }
  }
})();

// Auto-migration: Paket-Analiz tabloları
(async () => {
  await migratePacketAnaliz();
})();

// Auto-migration: Prosedür-OTPA tabloları
(async () => {
  await migrateProsedurOtpa();
})();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV 
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Vercel serverless function handler
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}
