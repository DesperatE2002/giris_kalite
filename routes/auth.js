import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/database.js';

const router = express.Router();

// Register (kalite kullanıcısı oluşturma)
router.post('/register', async (req, res) => {
  try {
    const { full_name, username, password } = req.body;

    if (!full_name || !username || !password) {
      return res.status(400).json({ error: 'Tüm alanları doldurun' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
    }

    // Check if username exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with 'kalite' role
    const result = await pool.query(
      `INSERT INTO users (username, password, full_name, role, is_active)
       VALUES (?, ?, ?, ?, TRUE) RETURNING *`,
      [username, hashedPassword, full_name, 'kalite']
    );

    res.status(201).json({
      message: 'Hesap başarıyla oluşturuldu',
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        full_name: result.rows[0].full_name,
        role: result.rows[0].role
      }
    });
  } catch (error) {
    console.error('Register hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

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

// Kullanıcı güncelle (sadece admin - rol, isim, durum, şifre)
router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkiniz yok' });
    }

    const { full_name, role, is_active, password } = req.body;
    const userId = req.params.id;

    // Mevcut kullanıcıyı kontrol et
    const existing = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    // Şifre değiştirilecekse hashle
    if (password && password.length >= 6) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users SET full_name = ?, role = ?, is_active = ?, password = ? WHERE id = ? RETURNING id, username, full_name, role, is_active, created_at`,
        [full_name, role, is_active ? true : false, hashedPassword, userId]
      );
    } else {
      await pool.query(
        `UPDATE users SET full_name = ?, role = ?, is_active = ? WHERE id = ? RETURNING id, username, full_name, role, is_active, created_at`,
        [full_name, role, is_active ? true : false, userId]
      );
    }

    const updated = await pool.query(
      'SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Kullanıcı güncelleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
