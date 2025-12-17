import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import dbSqlite from '../db/database-sqlite.js';
import dbPostgres from '../db/database.js';

// Choose database based on environment
const pool = process.env.USE_SQLITE === 'true' ? dbSqlite : dbPostgres;

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 saat
    });

    res.json({
      message: 'Giriş başarılı',
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Çıkış yapıldı' });
});

// Mevcut kullanıcı bilgisi
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, role FROM users WHERE id = ?',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Me hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Kullanıcı listesi (sadece admin)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkiniz yok' });
    }

    const result = await pool.query(
      'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Kullanıcı listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Yeni kullanıcı oluştur (sadece admin)
router.post('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkiniz yok' });
    }

    const { username, password, full_name, role } = req.body;

    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Tüm alanları doldurun' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?) RETURNING id, username, full_name, role, is_active, created_at',
      [username, hashedPassword, full_name, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
    }
    console.error('Kullanıcı oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
