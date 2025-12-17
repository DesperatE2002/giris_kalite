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
import goodsReceiptRoutes from './routes/goods-receipt.js';
import qualityRoutes from './routes/quality.js';
import reportsRoutes from './routes/reports.js';

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
app.use('/api/goods-receipt', goodsReceiptRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/reports', reportsRoutes);

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

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║   🚀 Temsa Kalite Sistemi Başlatıldı                     ║
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

export default app;
