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
