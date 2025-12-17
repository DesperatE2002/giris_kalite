import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// Load environment variables
dotenv.config();

// Force PostgreSQL in production
if (process.env.VERCEL) {
  process.env.USE_SQLITE = 'false';
  console.log('🐘 Vercel: Using PostgreSQL');
}

// Import routes
import authRoutes from '../routes/auth.js';
import otpaRoutes from '../routes/otpa.js';
import bomRoutes from '../routes/bom.js';
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/otpa', otpaRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/goods-receipt', goodsReceiptRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/reports', reportsRoutes);

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

// 404 handler for API
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

export default app;
