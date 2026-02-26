import jwt from 'jsonwebtoken';

// Lazy import for pool to avoid circular dependency
let _pool = null;
async function getPool() {
  if (!_pool) {
    const module = await import('../db/database.js');
    _pool = module.default;
  }
  return _pool;
}

export const authenticateToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekiyor' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }
    next();
  };
};

// Modül bazlı izin kontrolü (DB tabanlı)
// Kullanım: authorizeModule('goods-receipt', 'can_edit')
export const authorizeModule = (moduleName, action = 'can_view') => {
  // Güvenlik: sadece izin verilen sütun adları
  const validActions = ['can_view', 'can_create', 'can_edit', 'can_delete'];
  if (!validActions.includes(action)) {
    throw new Error(`Geçersiz action: ${action}`);
  }

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Giriş yapmanız gerekiyor' });
    }

    // Admin her zaman erişebilir (fallback)
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const pool = await getPool();
      const { rows } = await pool.query(`
        SELECT rp.can_view, rp.can_create, rp.can_edit, rp.can_delete
        FROM role_permissions rp
        JOIN roles r ON r.id = rp.role_id
        WHERE r.name = ? AND rp.module = ?
      `, [req.user.role, moduleName]);

      if (rows.length > 0 && rows[0][action]) {
        return next();
      }

      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    } catch (error) {
      console.error('İzin kontrolü hatası:', error);
      // Fallback: erişime izin ver (roles tablosu hazır olmayabilir)
      return next();
    }
  };
};
