import express from 'express';
import pool from '../db/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// ========================= MODULE DEFINITIONS =========================
export const MODULE_DEFINITIONS = [
  { key: 'dashboard', label: 'Ana Sayfa', icon: 'fas fa-home', type: 'simple' },
  { key: 'goods-receipt', label: 'Malzeme Girişi', icon: 'fas fa-box', type: 'simple' },
  { key: 'returns', label: 'İadeler', icon: 'fas fa-undo', type: 'simple' },
  { key: 'quality', label: 'Kalite Kontrol', icon: 'fas fa-check-circle', type: 'simple' },
  { key: 'projects', label: 'Proje Takip', icon: 'fas fa-project-diagram', type: 'simple' },
  { key: 'technicians', label: 'İş Takip', icon: 'fas fa-user-cog', type: 'simple' },
  { key: 'taskboard', label: 'Görev Panosu', icon: 'fas fa-tasks', type: 'simple' },
  { key: 'paket-analiz', label: 'Paket Analiz', icon: 'fas fa-battery-full', type: 'simple' },
  { 
    key: 'prosedur-otpa', label: 'Prosedür & OTPA', icon: 'fas fa-file-alt', type: 'multi',
    subPermissions: [
      { key: 'prosedur_view', label: 'Görüntüle & İndir', description: 'Prosedürleri, formları ve raporları görüntüleme' },
      { key: 'prosedur_fill', label: 'Form Doldur', description: 'Tekniker: form doldurabilir' },
      { key: 'prosedur_manage', label: 'Şablon & Döküman Yönet', description: 'Yönetici: form şablonu, döküman yükleme/silme' }
    ]
  },
  { key: 'field-changelog', label: 'Saha Değişiklik', icon: 'fas fa-history', type: 'simple' },
  { key: 'admin', label: 'Yönetim Paneli', icon: 'fas fa-cog', type: 'simple' }
];

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

    // Role permissions tablosu - yeni basit yapı
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        module VARCHAR(50) NOT NULL,
        permission_key VARCHAR(50) NOT NULL DEFAULT 'access',
        granted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_id, module, permission_key)
      )
    `);

    // Eski yapıyı kontrol et - can_view sütunu varsa yeni yapıya geç
    try {
      const { rows: cols } = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'role_permissions' AND column_name = 'can_view'
      `);
      if (cols.length > 0) {
        console.log('🔄 Eski izin yapısı tespit edildi, yeni yapıya geçiliyor...');
        await pool.query('DROP TABLE IF EXISTS role_permissions CASCADE');
        await pool.query(`
          CREATE TABLE role_permissions (
            id SERIAL PRIMARY KEY,
            role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            module VARCHAR(50) NOT NULL,
            permission_key VARCHAR(50) NOT NULL DEFAULT 'access',
            granted BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(role_id, module, permission_key)
          )
        `);
        // Eski roller varsa izinlerini yeniden seed et
        const { rows: existingRoles } = await pool.query('SELECT * FROM roles');
        if (existingRoles.length > 0) {
          await pool.query('DELETE FROM roles');
        }
      }
    } catch (e) { /* ignore */ }

    await pool.query('CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_role_permissions_module ON role_permissions(module, permission_key)');

    // Seed default roles if empty
    const { rows: existingRoles } = await pool.query('SELECT COUNT(*) as cnt FROM roles');
    if (parseInt(existingRoles[0].cnt) === 0) {
      await seedDefaultRoles();
    }

    // Patch: tekniker rolüne quality erişimi ekle (eksikse)
    try {
      const { rows: tekRole } = await pool.query("SELECT id FROM roles WHERE name = 'tekniker'");
      if (tekRole.length > 0) {
        await pool.query(
          `INSERT INTO role_permissions (role_id, module, permission_key, granted) VALUES (?, 'quality', 'access', true)
           ON CONFLICT (role_id, module, permission_key) DO NOTHING`,
          [tekRole[0].id]
        );
      }
    } catch (e) { /* ignore */ }

    // Patch: tüm system rollere projects erişimi ekle (eksikse)
    try {
      const { rows: allRoles } = await pool.query("SELECT id FROM roles WHERE is_system = true");
      for (const r of allRoles) {
        await pool.query(
          `INSERT INTO role_permissions (role_id, module, permission_key, granted) VALUES (?, 'projects', 'access', true)
           ON CONFLICT (role_id, module, permission_key) DO NOTHING`,
          [r.id]
        );
      }
    } catch (e) { /* ignore */ }

    // users.role constraint kaldır
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

async function grantPermission(roleId, module, permKey = 'access') {
  await pool.query(
    `INSERT INTO role_permissions (role_id, module, permission_key, granted) VALUES (?, ?, ?, true)
     ON CONFLICT (role_id, module, permission_key) DO UPDATE SET granted = true`,
    [roleId, module, permKey]
  );
}

async function seedDefaultRoles() {
  // Admin - her şeye tam erişim
  const { rows: [admin] } = await pool.query(
    `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?) RETURNING id`,
    ['admin', 'Yönetici', 'Tam yetkili sistem yöneticisi', true]
  );
  for (const mod of MODULE_DEFINITIONS) {
    await grantPermission(admin.id, mod.key, 'access');
    if (mod.subPermissions) {
      for (const sub of mod.subPermissions) {
        await grantPermission(admin.id, mod.key, sub.key);
      }
    }
  }

  // Kalite
  const kaliteModules = ['dashboard', 'goods-receipt', 'returns', 'quality', 'taskboard', 'field-changelog'];
  const { rows: [kalite] } = await pool.query(
    `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?) RETURNING id`,
    ['kalite', 'Kalite', 'Kalite kontrol sorumlusu', true]
  );
  for (const mod of kaliteModules) {
    await grantPermission(kalite.id, mod, 'access');
  }
  await grantPermission(kalite.id, 'prosedur-otpa', 'access');
  await grantPermission(kalite.id, 'prosedur-otpa', 'prosedur_view');
  await grantPermission(kalite.id, 'prosedur-otpa', 'prosedur_fill');
  await grantPermission(kalite.id, 'prosedur-otpa', 'prosedur_manage');

  // Tekniker
  const teknikerModules = ['dashboard', 'goods-receipt', 'returns', 'quality', 'taskboard'];
  const { rows: [tekniker] } = await pool.query(
    `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?) RETURNING id`,
    ['tekniker', 'Tekniker', 'Teknik personel', true]
  );
  for (const mod of teknikerModules) {
    await grantPermission(tekniker.id, mod, 'access');
  }
  await grantPermission(tekniker.id, 'prosedur-otpa', 'access');
  await grantPermission(tekniker.id, 'prosedur-otpa', 'prosedur_view');
  await grantPermission(tekniker.id, 'prosedur-otpa', 'prosedur_fill');

  // Proje Yöneticisi
  const { rows: [projMgr] } = await pool.query(
    `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?) RETURNING id`,
    ['proje_yonetici', 'Proje Yöneticisi', 'Proje takip sorumlusu', true]
  );
  await grantPermission(projMgr.id, 'dashboard', 'access');
  await grantPermission(projMgr.id, 'projects', 'access');

  // Viewer - hiçbir erişim yok
  await pool.query(
    `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, ?)`,
    ['viewer', 'Yeni Kullanıcı', 'Henüz yetkilendirilmemiş kullanıcı', true]
  );

  console.log('✅ Varsayılan roller oluşturuldu');
}

// ========================= HELPER MIDDLEWARE =========================
export function requireModuleAccess(moduleName, permKey = 'access') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Giriş yapmanız gerekiyor' });
    }

    try {
      // Her zaman DB'den güncel role'ü al (JWT eski olabilir)
      const { rows: userRows } = await pool.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
      const currentRole = userRows.length > 0 ? userRows[0].role : req.user.role;

      if (currentRole === 'admin') return next();

      const { rows } = await pool.query(`
        SELECT rp.granted
        FROM role_permissions rp
        JOIN roles r ON r.id = rp.role_id
        WHERE r.name = ? AND rp.module = ? AND rp.permission_key = ?
      `, [currentRole, moduleName, permKey]);

      if (rows.length > 0 && rows[0].granted) {
        return next();
      }
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    } catch (error) {
      console.error('İzin kontrolü hatası:', error);
      return next(); // fallback
    }
  };
}

// ========================= ROUTES =========================

// Tüm roller listesi
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { rows: roles } = await pool.query(
      'SELECT * FROM roles ORDER BY is_system DESC, display_name ASC'
    );
    for (const role of roles) {
      const { rows: perms } = await pool.query(
        'SELECT * FROM role_permissions WHERE role_id = ? ORDER BY module, permission_key',
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

// Benim izinlerim
router.get('/my-permissions', authenticateToken, async (req, res) => {
  try {
    const { rows: perms } = await pool.query(`
      SELECT rp.module, rp.permission_key, rp.granted
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      WHERE r.name = ?
    `, [req.user.role]);

    const permMap = {};
    for (const p of perms) {
      if (!permMap[p.module]) permMap[p.module] = {};
      permMap[p.module][p.permission_key] = p.granted;
    }
    res.json(permMap);
  } catch (error) {
    console.error('İzin listesi hatası:', error);
    res.status(500).json({ error: 'İzinler alınamadı' });
  }
});

// Modül tanımları
router.get('/module-definitions', authenticateToken, (req, res) => {
  res.json(MODULE_DEFINITIONS);
});

// Tek rol detay
router.get('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Rol bulunamadı' });

    const role = rows[0];
    const { rows: perms } = await pool.query(
      'SELECT * FROM role_permissions WHERE role_id = ? ORDER BY module, permission_key',
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

    const safeName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const { rows: [newRole] } = await pool.query(
      `INSERT INTO roles (name, display_name, description, is_system) VALUES (?, ?, ?, false) RETURNING *`,
      [safeName, display_name, description || null]
    );

    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        if (perm.granted) {
          await pool.query(
            `INSERT INTO role_permissions (role_id, module, permission_key, granted) VALUES (?, ?, ?, true)
             ON CONFLICT (role_id, module, permission_key) DO UPDATE SET granted = true`,
            [newRole.id, perm.module, perm.permission_key || 'access']
          );
        }
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
    if (rows.length === 0) return res.status(404).json({ error: 'Rol bulunamadı' });

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
    if (rows.length === 0) return res.status(404).json({ error: 'Rol bulunamadı' });

    await pool.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        if (perm.granted) {
          await pool.query(
            `INSERT INTO role_permissions (role_id, module, permission_key, granted) VALUES (?, ?, ?, true)`,
            [roleId, perm.module, perm.permission_key || 'access']
          );
        }
      }
    }

    res.json({ message: 'İzinler güncellendi' });
  } catch (error) {
    console.error('İzin güncelleme hatası:', error);
    res.status(500).json({ error: 'İzinler güncellenemedi' });
  }
});

// Rol sil
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Rol bulunamadı' });
    if (rows[0].is_system) return res.status(400).json({ error: 'Sistem rolü silinemez' });

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
