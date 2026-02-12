import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Check database type
import fs from 'fs';
const useSQLite = !process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '';
if (useSQLite) {
  console.log('📊 Using SQLite database');
  process.env.USE_SQLITE = 'true';
} else {
  console.log('🐘 Using PostgreSQL database');
  process.env.USE_SQLITE = 'false';
}

// Routes
import authRoutes from './routes/auth.js';
import otpaRoutes from './routes/otpa.js';
import bomRoutes from './routes/bom.js';
import bomTemplateRoutes from './routes/bom-template.js';
import goodsReceiptRoutes from './routes/goods-receipt.js';
import qualityRoutes from './routes/quality.js';
import reportsRoutes from './routes/reports.js';
import projectsRoutes from './routes/projects.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/otpa', otpaRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/bom-templates', bomTemplateRoutes);
app.use('/api/goods-receipt', goodsReceiptRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/projects', projectsRoutes);

// Auto-migration: total_returned_quantity ve returned_by sütunlarını ekle
import pool from './db/database.js';
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
})();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// SPA fallback - tüm diğer route'ları index.html'e yönlendir
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Sunucu hatası:', err);
  res.status(500).json({ 
    error: 'Sunucu hatası', 
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// Vercel serverless için app.listen'i sadece local'de çalıştır
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║   🚀 E-LAB Süreç Kontrol Sistemi Başlatıldı                     ║
  ║                                                            ║
  ║   🌐 Sunucu: http://localhost:${PORT}                        ║
  ║   📊 API: http://localhost:${PORT}/api                       ║
  ║                                                            ║
  ║   👤 Admin: admin / admin123                              ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝
    `);
    console.log('✅ Server is LISTENING on port', PORT);
  });
}

export default app;
