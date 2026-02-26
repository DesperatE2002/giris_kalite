import express from 'express';
import pool from '../db/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// ========================= MIGRATION =========================
export async function migrateRoles() {
  try {
    // Roles tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Role permissions tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        module VARCHAR(50) NOT NULL,
        can_view BOOLEAN DEFAULT false,
        can_create BOOLEAN DEFAULT false,
        can_edit BOOLEAN DEFAULT false,
        can_delete BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_id, module)
      )
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id)');

    // Seed default roles if empty
    const { rows: existingRoles } = await pool.query('SELECT COUNT(*) as cnt FROM roles');
    if (parseInt(existingRoles[0].cnt) === 0) {
      await seedDefaultRoles();
    }

    // users.role constraint kaldır (artık custom roles olabilir)
    try {
      await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
    } catch (e) { /* ignore */ }

    console.log('✅ Auto-migration: roles ve role_permissions tabloları hazır');
  } catch (e) {
    if (!e.message.includes('already exists')) {
      console.error('⚠️ Roles migration uyarısı:', e.message);
    }
  }
}

// Default roller ile seed
async function seedDefaultRoles() {
  const modules = [
    'dashboard', 'goods-receipt', 'returns', 'quality', 'admin',
    'projects', 'technicians', 'taskboard', 'paket-analiz',
    'prosedur-otpa', 'field-changelog'
  ];

  // Admin - hepsi
  const { rows: [admin] } = await pool.query(
    `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?) RETURNING id`,
    ['admin', 'Yönetici', 'Tam yetkili sistem yöneticisi', true]
  );
  for (const mod of modules) {
    await pool.query(
      `INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)`,
      [admin.id, mod, true, true, true, true]
    );
  }

  // Kalite
  const kaliteModules = ['dashboard', 'goods-receipt', 'returns', 'quality', 'technicians', 'taskboard', 'prosedur-otpa', 'field-changelog'];
  const { rows: [kalite] } = await pool.query(
    `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?) RETURNING id`,
    ['kalite', 'Kalite', 'Kalite kontrol sorumlusu', true]
  );
  for (const mod of modules) {
    const canView = kaliteModules.includes(mod);
    await pool.query(
      `INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)`,
      [kalite.id, mod, canView, canView, canView, false]
    );
  }

  // Tekniker
  const teknikerModules = ['dashboard', 'goods-receipt', 'returns', 'technicians', 'taskboard'];
  const { rows: [tekniker] } = await pool.query(
    `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?) RETURNING id`,
    ['tekniker', 'Tekniker', 'Teknik personel', true]
  );
  for (const mod of modules) {
    const canView = teknikerModules.includes(mod);
    await pool.query(
      `INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)`,
      [tekniker.id, mod, canView, canView, canView, false]
    );
  }

  // Proje Yöneticisi
  const { rows: [projMgr] } = await pool.query(
    `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?) RETURNING id`,
    ['proje_yonetici', 'Proje Yöneticisi', 'Proje takip sorumlusu', true]
  );
  for (const mod of modules) {
    const canView = mod === 'projects' || mod === 'dashboard';
    await pool.query(
      `INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)`,
      [projMgr.id, mod, canView, canView, canView, false]
    );
  }

  // Viewer
  const { rows: [viewer] } = await pool.query(
    `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?) RETURNING id`,
    ['viewer', 'Yeni Kullanıcı', 'Henüz yetkilendirilmemiş kullanıcı', true]
  );
  for (const mod of modules) {
    await pool.query(
      `INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)`,
      [viewer.id, mod, false, false, false, false]
    );
  }

  console.log('✅ Varsayılan roller oluşturuldu: admin, kalite, tekniker, proje_yonetici, viewer');
}

// ========================= ROUTES =========================

// Tüm roller listesi (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { rows: roles } = await pool.query(
      'SELECT * FROM roles ORDER BY is_system DESC, display_name ASC'
    );

    // Her rol için izinleri çek
    for (const role of roles) {
      const { rows: perms } = await pool.query(
        'SELECT * FROM role_permissions WHERE role_id = ? ORDER BY module',
        [role.id]
      );
      role.permissions = perms;
    }

    res.json(roles);
  } catch (error) {
    console.error('Roller listeleme hatası:', error);
    res.status(500).json({ error: 'Roller listelenemedi' });
  }
});

// Benim izinlerim (login olan kullanıcı)
router.get('/my-permissions', authenticateToken, async (req, res) => {
  try {
    const { rows: perms } = await pool.query(`
      SELECT rp.module, rp.can_view, rp.can_create, rp.can_edit, rp.can_delete
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      WHERE r.name = ?
    `, [req.user.role]);

    // Nesne formatına çevir
    const permMap = {};
    for (const p of perms) {
      permMap[p.module] = {
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete
      };
    }

    res.json(permMap);
  } catch (error) {
    console.error('İzin listesi hatası:', error);
    res.status(500).json({ error: 'İzinler alınamadı' });
  }
});

// Tek rol detay
router.get('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Rol bulunamadı' });
    }

    const role = rows[0];
    const { rows: perms } = await pool.query(
      'SELECT * FROM role_permissions WHERE role_id = ? ORDER BY module',
      [role.id]
    );
    role.permissions = perms;

    res.json(role);
  } catch (error) {
    console.error('Rol detay hatası:', error);
    res.status(500).json({ error: 'Rol detayı alınamadı' });
  }
});

// Yeni rol oluştur
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { name, display_name, description, permissions } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({ error: 'Rol adı ve görüntüleme adı gereklidir' });
    }

    // Slug-ify name
    const safeName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');

    const { rows: [newRole] } = await pool.query(
      `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, false) RETURNING *`,
      [safeName, display_name, description || null]
    );

    // Permissions ekle
    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        await pool.query(
          `INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete) 
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (role_id, module) DO UPDATE SET can_view = ?, can_create = ?, can_edit = ?, can_delete = ?`,
          [
            newRole.id, perm.module,
            perm.can_view || false, perm.can_create || false, perm.can_edit || false, perm.can_delete || false,
            perm.can_view || false, perm.can_create || false, perm.can_edit || false, perm.can_delete || false
          ]
        );
      }
    }

    res.status(201).json(newRole);
  } catch (error) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      return res.status(400).json({ error: 'Bu rol adı zaten mevcut' });
    }
    console.error('Rol oluşturma hatası:', error);
    res.status(500).json({ error: 'Rol oluşturulamadı' });
  }
});

// Rol güncelle
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { display_name, description } = req.body;

    const { rows } = await pool.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Rol bulunamadı' });
    }

    await pool.query(
      `UPDATE roles SET display_name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [display_name || rows[0].display_name, description !== undefined ? description : rows[0].description, req.params.id]
    );

    res.json({ message: 'Rol güncellendi' });
  } catch (error) {
    console.error('Rol güncelleme hatası:', error);
    res.status(500).json({ error: 'Rol güncellenemedi' });
  }
});

// Rol izinlerini güncelle
router.put('/:id/permissions', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { permissions } = req.body;
    const roleId = req.params.id;

    const { rows } = await pool.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Rol bulunamadı' });
    }

    // Mevcut izinleri sil ve yeniden ekle
    await pool.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        await pool.query(
          `INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)`,
          [roleId, perm.module, perm.can_view || false, perm.can_create || false, perm.can_edit || false, perm.can_delete || false]
        );
      }
    }

    res.json({ message: 'İzinler güncellendi' });
  } catch (error) {
    console.error('İzin güncelleme hatası:', error);
    res.status(500).json({ error: 'İzinler güncellenemedi' });
  }
});

// Rol sil (sadece is_system=false olanlar)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Rol bulunamadı' });
    }

    if (rows[0].is_system) {
      return res.status(400).json({ error: 'Sistem rolü silinemez' });
    }

    // Bu role atanmış kullanıcı var mı kontrol et
    const { rows: users } = await pool.query('SELECT COUNT(*) as cnt FROM users WHERE role = ?', [rows[0].name]);
    if (parseInt(users[0].cnt) > 0) {
      return res.status(400).json({ error: 'Bu role atanmış kullanıcılar var. Önce kullanıcıların rolünü değiştirin.' });
    }

    await pool.query('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ message: 'Rol silindi' });
  } catch (error) {
    console.error('Rol silme hatası:', error);
    res.status(500).json({ error: 'Rol silinemedi' });
  }
});

export default router;
